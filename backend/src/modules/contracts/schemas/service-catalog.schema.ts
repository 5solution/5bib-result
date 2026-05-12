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
  @Prop() description: string;
  @Prop({ default: 0 }) sortOrder: number;
  @Prop() createdBy: string;
  @Prop({ index: true }) deletedAt: Date;

  createdAt: Date;
  updatedAt: Date;
}

export const ServiceCatalogSchema = SchemaFactory.createForClass(ServiceCatalog);
ServiceCatalogSchema.index({ category: 1, sortOrder: 1 });
