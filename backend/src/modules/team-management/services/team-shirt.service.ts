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
    let updated = 0;
    for (const row of dto.sizes) {
      const existing = await this.stockRepo.findOne({
        where: { event_id: eventId, size: row.size },
      });
      if (existing) {
        existing.quantity_planned = row.quantity_planned;
        existing.quantity_ordered = row.quantity_ordered;
        existing.quantity_received = row.quantity_received;
        existing.notes = row.notes ?? existing.notes;
        await this.stockRepo.save(existing);
      } else {
        const entity = this.stockRepo.create({
          event_id: eventId,
          size: row.size,
          quantity_planned: row.quantity_planned,
          quantity_ordered: row.quantity_ordered,
          quantity_received: row.quantity_received,
          notes: row.notes ?? null,
        });
        await this.stockRepo.save(entity);
      }
      updated++;
    }
    await this.cache.invalidateEvent(eventId);
    return { updated };
  }

  async aggregate(eventId: number): Promise<ShirtAggregateDto> {
    const stockRows = await this.listStock(eventId);
    const registeredRows = await this.regRepo
      .createQueryBuilder('r')
      .select('r.shirt_size', 'size')
      .addSelect('COUNT(r.id)', 'count')
      .where('r.event_id = :eid', { eid: eventId })
      .andWhere("r.status = 'approved'")
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
