import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VolShirtStock } from '../entities/vol-shirt-stock.entity';
import { VolRegistration } from '../entities/vol-registration.entity';
import {
  ShirtAggregateDto,
  SHIRT_SIZES,
  ShirtSizeEnum,
  UpsertShirtStockDto,
} from '../dto/shirt-stock.dto';
import { TeamCacheService } from './team-cache.service';

@Injectable()
export class TeamShirtService {
  constructor(
    @InjectRepository(VolShirtStock, 'volunteer')
    private readonly stockRepo: Repository<VolShirtStock>,
    @InjectRepository(VolRegistration, 'volunteer')
    private readonly regRepo: Repository<VolRegistration>,
    private readonly cache: TeamCacheService,
  ) {}

  async listStock(eventId: number): Promise<VolShirtStock[]> {
    return this.stockRepo.find({
      where: { event_id: eventId },
      order: { size: 'ASC' },
    });
  }

  async upsertStock(
    eventId: number,
    dto: UpsertShirtStockDto,
  ): Promise<{ updated: number }> {
    if (dto.sizes.length === 0) return { updated: 0 };
    // TypeORM `.upsert()` compiles to MySQL `INSERT ... ON DUPLICATE KEY
    // UPDATE` so concurrent PUTs on the same (event_id, size) unique key
    // no longer throw ER_DUP_ENTRY — last-write-wins on the 3 counters.
    await this.stockRepo.upsert(
      dto.sizes.map((row) => ({
        event_id: eventId,
        size: row.size,
        quantity_planned: row.quantity_planned,
        quantity_ordered: row.quantity_ordered,
        quantity_received: row.quantity_received,
        notes: row.notes ?? null,
      })),
      {
        conflictPaths: ['event_id', 'size'],
        skipUpdateIfNoValuesChanged: true,
      },
    );
    await this.cache.invalidateEvent(eventId);
    return { updated: dto.sizes.length };
  }

  async aggregate(eventId: number): Promise<ShirtAggregateDto> {
    const stockRows = await this.listStock(eventId);
    // v1.4: shirt counts cover any active-pipeline status (slot-holding).
    const registeredRows = await this.regRepo
      .createQueryBuilder('r')
      .select('r.shirt_size', 'size')
      .addSelect('COUNT(r.id)', 'count')
      .where('r.event_id = :eid', { eid: eventId })
      .andWhere(
        "r.status IN ('approved','contract_sent','contract_signed','qr_sent','checked_in','completed')",
      )
      .andWhere('r.shirt_size IS NOT NULL')
      .groupBy('r.shirt_size')
      .getRawMany<{ size: ShirtSizeEnum; count: string }>();

    const registeredBySize = new Map<ShirtSizeEnum, number>();
    for (const r of registeredRows) {
      registeredBySize.set(r.size, Number(r.count));
    }
    const stockBySize = new Map<ShirtSizeEnum, VolShirtStock>();
    for (const s of stockRows) stockBySize.set(s.size, s);

    const bySize = SHIRT_SIZES.map((size) => {
      const registered = registeredBySize.get(size) ?? 0;
      const stock = stockBySize.get(size);
      const planned = stock?.quantity_planned ?? 0;
      const ordered = stock?.quantity_ordered ?? 0;
      const received = stock?.quantity_received ?? 0;
      return {
        size,
        registered,
        planned,
        ordered,
        received,
        surplus: planned - registered,
        notes: stock?.notes ?? null,
      };
    }).filter((row) => row.registered > 0 || row.planned > 0 || row.ordered > 0);

    return {
      by_size: bySize,
      total_registered: bySize.reduce((s, r) => s + r.registered, 0),
      total_planned: bySize.reduce((s, r) => s + r.planned, 0),
      total_ordered: bySize.reduce((s, r) => s + r.ordered, 0),
      total_received: bySize.reduce((s, r) => s + r.received, 0),
      last_updated: new Date().toISOString(),
    };
  }
}
