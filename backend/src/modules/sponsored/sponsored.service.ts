import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Model, Types } from 'mongoose';
import Redis from 'ioredis';
import { SponsoredSlot, SponsoredSlotDocument, SponsoredSlotItem } from './schemas/sponsored-slot.schema';
import { CreateSponsoredSlotDto } from './dto/create-sponsored-slot.dto';
import { UpdateSponsoredSlotDto } from './dto/update-sponsored-slot.dto';
import { CreateSponsoredItemDto } from './dto/create-sponsored-item.dto';
import { UpdateSponsoredItemDto } from './dto/update-sponsored-item.dto';
import { ReorderSlotsDto, ReorderItemsDto } from './dto/reorder.dto';

const CACHE_KEY = 'homepage:sponsored';
const CACHE_TTL = 300; // 5 minutes

// ── Public response types ─────────────────────────────────────────────────────

interface PublicItem {
  _id: string;
  race_slug: string;
  event_name: string;
  event_type: string | null;
  event_date_start: string;
  event_date_end: string | null;
  event_location: string;
  cover_image_url: string;
  price_from: number;
  cta_text: string;
  cta_url: string;
  promo_label: string | null;
  badge_labels: string[];
  show_countdown: boolean;
  countdown_target_at: string | null;
  race_url: string;
  item_order: number;
}

interface PublicSlot {
  _id: string;
  package_tier: string;
  is_hero: boolean;
  display_order: number;
  rotation_interval_seconds: number;
  items: PublicItem[];
}

export interface PublicSponsoredResponse {
  slots: PublicSlot[];
  cached_at: string;
}

@Injectable()
export class SponsoredService {
  private readonly logger = new Logger(SponsoredService.name);

  constructor(
    @InjectModel(SponsoredSlot.name)
    private readonly slotModel: Model<SponsoredSlotDocument>,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  // ── Cache ─────────────────────────────────────────────────────────────────

  private async invalidateCache(): Promise<void> {
    try {
      await this.redis.del(CACHE_KEY);
    } catch (err) {
      this.logger.warn(`Redis DEL ${CACHE_KEY} failed: ${(err as Error).message}`);
    }
  }

  // ── Public API ────────────────────────────────────────────────────────────

  async getPublicSlots(): Promise<PublicSponsoredResponse> {
    try {
      const cached = await this.redis.get(CACHE_KEY);
      if (cached) return JSON.parse(cached) as PublicSponsoredResponse;
    } catch (err) {
      this.logger.warn(`Redis GET ${CACHE_KEY} failed: ${(err as Error).message}`);
    }

    const now = new Date();
    const rawSlots = await this.slotModel
      .find({
        is_active: true,
        display_start_at: { $lte: now },
        display_end_at: { $gte: now },
      })
      .sort({ display_order: 1 })
      .limit(4)
      .lean()
      .exec();

    const result: PublicSponsoredResponse = {
      slots: rawSlots
        .filter((s) => s.items.length > 0)
        .map((slot) => ({
          _id: String(slot._id),
          package_tier: slot.package_tier,
          is_hero: slot.is_hero,
          display_order: slot.display_order,
          rotation_interval_seconds: slot.rotation_interval_seconds,
          items: [...slot.items]
            .sort((a, b) => a.item_order - b.item_order)
            .map((item) => this.toPublicItem(item, now)),
        })),
      cached_at: now.toISOString(),
    };

    try {
      await this.redis.set(CACHE_KEY, JSON.stringify(result), 'EX', CACHE_TTL);
    } catch (err) {
      this.logger.warn(`Redis SET ${CACHE_KEY} failed: ${(err as Error).message}`);
    }

    return result;
  }

  private toPublicItem(item: SponsoredSlotItem & { _id?: unknown }, now: Date): PublicItem {
    const promoExpired =
      item.promo_label_expires_at != null && item.promo_label_expires_at < now;
    return {
      _id: String(item._id),
      race_slug: item.race_slug,
      event_name: item.event_name,
      event_type: item.event_type ?? null,
      event_date_start: item.event_date_start.toISOString().split('T')[0],
      event_date_end: item.event_date_end?.toISOString().split('T')[0] ?? null,
      event_location: item.event_location,
      cover_image_url: item.cover_image_url,
      price_from: item.price_from,
      cta_text: item.cta_text,
      cta_url: item.cta_url ?? `/races/${item.race_slug}`,
      promo_label: promoExpired ? null : (item.promo_label ?? null),
      badge_labels: item.badge_labels ?? [],
      show_countdown: item.show_countdown,
      countdown_target_at: item.countdown_target_at?.toISOString() ?? null,
      race_url: `/races/${item.race_slug}`,
      item_order: item.item_order,
    };
  }

  // ── Admin Slot CRUD ───────────────────────────────────────────────────────

  async findAllSlots(): Promise<SponsoredSlotDocument[]> {
    return this.slotModel.find().sort({ display_order: 1 }).exec();
  }

  async findSlotById(id: string): Promise<SponsoredSlotDocument> {
    const slot = await this.slotModel.findById(id).exec();
    if (!slot) throw new NotFoundException(`Slot ${id} not found`);
    return slot;
  }

  async createSlot(dto: CreateSponsoredSlotDto): Promise<SponsoredSlotDocument> {
    const diamondConflict =
      dto.package_tier === 'diamond'
        ? await this.slotModel.exists({ package_tier: 'diamond', is_active: true }).exec()
        : null;

    const slot = await this.slotModel.create({
      ...dto,
      display_start_at: new Date(dto.display_start_at),
      display_end_at: new Date(dto.display_end_at),
      display_order: dto.display_order ?? 99,
      rotation_interval_seconds: dto.rotation_interval_seconds ?? 5,
      is_hero: dto.is_hero ?? false,
      is_active: dto.is_active ?? true,
    });

    await this.invalidateCache();

    // Attach diamond conflict warning onto returned doc object
    const result = slot.toObject() as SponsoredSlotDocument & { diamond_conflict?: boolean };
    if (diamondConflict) result.diamond_conflict = true;
    return result;
  }

  async updateSlot(id: string, dto: UpdateSponsoredSlotDto): Promise<SponsoredSlotDocument> {
    const update: Record<string, unknown> = { ...dto };
    if (dto.display_start_at) update.display_start_at = new Date(dto.display_start_at);
    if (dto.display_end_at) update.display_end_at = new Date(dto.display_end_at);

    // Re-check diamond uniqueness if tier changes to diamond OR slot is reactivated.
    // Mirrors createSlot: warn via diamond_conflict flag, do not block (PRD BR-01).
    const willBeDiamondActive =
      (dto.package_tier === 'diamond' || dto.is_active === true) &&
      dto.is_active !== false;
    const diamondConflict = willBeDiamondActive
      ? await this.slotModel
          .exists({
            _id: { $ne: new Types.ObjectId(id) },
            package_tier: 'diamond',
            is_active: true,
          })
          .exec()
      : null;

    const slot = await this.slotModel
      .findByIdAndUpdate(id, { $set: update }, { new: true })
      .exec();
    if (!slot) throw new NotFoundException(`Slot ${id} not found`);

    await this.invalidateCache();

    // Only attach flag if updated doc is actually diamond + active after save
    const afterTier = slot.package_tier;
    const afterActive = slot.is_active;
    const result = slot.toObject() as SponsoredSlotDocument & { diamond_conflict?: boolean };
    if (diamondConflict && afterTier === 'diamond' && afterActive) {
      result.diamond_conflict = true;
    }
    return result;
  }

  async deleteSlot(id: string): Promise<void> {
    const result = await this.slotModel.findByIdAndDelete(id).exec();
    if (!result) throw new NotFoundException(`Slot ${id} not found`);
    await this.invalidateCache();
  }

  async reorderSlots(dto: ReorderSlotsDto): Promise<void> {
    await Promise.all(
      dto.slots.map(({ slotId, display_order }) =>
        this.slotModel.findByIdAndUpdate(slotId, { $set: { display_order } }).exec(),
      ),
    );
    await this.invalidateCache();
  }

  // ── Admin Item CRUD ───────────────────────────────────────────────────────

  async addItem(slotId: string, dto: CreateSponsoredItemDto): Promise<SponsoredSlotDocument> {
    const slot = await this.slotModel.findById(slotId).exec();
    if (!slot) throw new NotFoundException(`Slot ${slotId} not found`);

    const maxOrder = slot.items.reduce((max, i) => Math.max(max, i.item_order), 0);
    const newItem = {
      _id: new Types.ObjectId(),
      race_slug: dto.race_slug,
      event_name: dto.event_name,
      event_type: dto.event_type ?? null,
      event_date_start: new Date(dto.event_date_start),
      event_date_end: dto.event_date_end ? new Date(dto.event_date_end) : null,
      event_location: dto.event_location,
      cover_image_url: dto.cover_image_url,
      price_from: dto.price_from,
      cta_text: dto.cta_text ?? 'Đăng ký →',
      cta_url: dto.cta_url ?? null,
      promo_label: dto.promo_label ?? null,
      promo_label_expires_at: dto.promo_label_expires_at
        ? new Date(dto.promo_label_expires_at)
        : null,
      badge_labels: dto.badge_labels ?? [],
      show_countdown: dto.show_countdown ?? false,
      countdown_target_at: dto.countdown_target_at ? new Date(dto.countdown_target_at) : null,
      item_order: dto.item_order ?? maxOrder + 1,
    };

    slot.items.push(newItem as unknown as SponsoredSlotItem);
    await slot.save();
    await this.invalidateCache();
    return slot;
  }

  async updateItem(
    slotId: string,
    itemId: string,
    dto: UpdateSponsoredItemDto,
  ): Promise<SponsoredSlotDocument> {
    const slot = await this.slotModel.findById(slotId).exec();
    if (!slot) throw new NotFoundException(`Slot ${slotId} not found`);

    const item = slot.items.find((i) => String(i._id) === itemId);
    if (!item) throw new NotFoundException(`Item ${itemId} not found in slot ${slotId}`);

    const dateFields = ['event_date_start', 'event_date_end', 'promo_label_expires_at', 'countdown_target_at'] as const;
    const updatable = { ...dto } as Record<string, unknown>;
    for (const f of dateFields) {
      if (updatable[f] != null) updatable[f] = new Date(updatable[f] as string);
    }
    Object.assign(item, updatable);

    await slot.save();
    await this.invalidateCache();
    return slot;
  }

  async deleteItem(slotId: string, itemId: string): Promise<SponsoredSlotDocument> {
    const slot = await this.slotModel.findById(slotId).exec();
    if (!slot) throw new NotFoundException(`Slot ${slotId} not found`);

    if (slot.items.length <= 1) {
      throw new BadRequestException(
        'Slot phải có ít nhất 1 item. Hãy xóa cả slot nếu muốn xóa item cuối.',
      );
    }

    const idx = slot.items.findIndex((i) => String(i._id) === itemId);
    if (idx === -1) throw new NotFoundException(`Item ${itemId} not found in slot ${slotId}`);

    slot.items.splice(idx, 1);
    await slot.save();
    await this.invalidateCache();
    return slot;
  }

  async reorderItems(slotId: string, dto: ReorderItemsDto): Promise<void> {
    const slot = await this.slotModel.findById(slotId).exec();
    if (!slot) throw new NotFoundException(`Slot ${slotId} not found`);

    for (const { itemId, item_order } of dto.items) {
      const item = slot.items.find((i) => String(i._id) === itemId);
      if (item) item.item_order = item_order;
    }

    await slot.save();
    await this.invalidateCache();
  }
}
