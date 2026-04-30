import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ChipMappingDocument = HydratedDocument<ChipMapping>;

export type ChipMappingStatus = 'ACTIVE' | 'DISABLED';

/**
 * Mapping chip ↔ BIB cho 1 race. UNIQUE per (race, chip) và per (race, bib)
 * khi `deleted=false`. Soft delete cho phép re-create cùng chip_id trong tương
 * lai (theo BR-09).
 */
@Schema({
  collection: 'chip_mappings',
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
})
export class ChipMapping {
  @Prop({ required: true, index: true })
  mysql_race_id: number;

  /** Luôn UPPER(TRIM()) — normalize ở service trước khi save (BR-01). */
  @Prop({ required: true })
  chip_id: string;

  @Prop({ required: true })
  bib_number: string;

  @Prop({ required: true, enum: ['ACTIVE', 'DISABLED'], default: 'ACTIVE' })
  status: ChipMappingStatus;

  @Prop()
  imported_by_user_id?: string;

  @Prop({ default: false })
  deleted: boolean;

  @Prop()
  deleted_at?: Date | null;

  @Prop()
  deleted_by_user_id?: string | null;
}

export const ChipMappingSchema = SchemaFactory.createForClass(ChipMapping);

// Composite unique partial indexes (BR-08, BR-09).
// Collation strength=2 để case-insensitive (defense in depth — service đã
// normalize UPPER, nhưng nếu lỡ có path nào skip thì index vẫn dedupe).
ChipMappingSchema.index(
  { mysql_race_id: 1, chip_id: 1 },
  {
    unique: true,
    partialFilterExpression: { deleted: false },
    collation: { locale: 'en', strength: 2 },
    name: 'uniq_race_chip_active',
  },
);

ChipMappingSchema.index(
  { mysql_race_id: 1, bib_number: 1 },
  {
    unique: true,
    partialFilterExpression: { deleted: false },
    collation: { locale: 'en', strength: 2 },
    name: 'uniq_race_bib_active',
  },
);
