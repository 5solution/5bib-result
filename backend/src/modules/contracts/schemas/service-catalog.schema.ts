import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ServiceCatalogDocument = HydratedDocument<ServiceCatalog>;

export type ServiceCategory = 'TIMING' | 'RACEKIT' | 'OPERATIONS' | 'GENERAL';

@Schema({
  collection: 'service_catalog',
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
})
export class ServiceCatalog {
  _id: Types.ObjectId;

  @Prop({ required: true, index: true }) name: string;
  @Prop({
    required: true,
    enum: ['TIMING', 'RACEKIT', 'OPERATIONS', 'GENERAL'],
    index: true,
  })
  category: ServiceCategory;
  @Prop() unit: string;
  @Prop({ default: 0, min: 0 }) referencePrice: number;
  /**
   * F-024 — Giá vốn tham khảo (VND).
   * Optional + default 0 (backward compat với items đã tạo trước update này).
   * Dùng làm default khi pre-compute P&L cost item ở F-028 (Phase 2 integration).
   */
  @Prop({ default: 0, min: 0 }) referenceCost: number;
  @Prop() description: string;
  @Prop({ default: 0 }) sortOrder: number;
  @Prop() createdBy: string;
  @Prop({ index: true }) deletedAt: Date;

  createdAt: Date;
  updatedAt: Date;
}

export const ServiceCatalogSchema = SchemaFactory.createForClass(ServiceCatalog);
ServiceCatalogSchema.index({ category: 1, sortOrder: 1 });
