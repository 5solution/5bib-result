import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/**
 * FEATURE-089 — `short_links` collection. 1 doc = 1 short link.
 *
 * `code` unique-indexed (random base62 hoặc custom alias). Resolve cache-aside
 * Redis `shortlink:code:<code>`; mọi mutation DEL cache. `createdBy` (Logto sub)
 * KHÔNG expose ra API (BR-11).
 */
@Schema({ collection: 'short_links', timestamps: true })
export class ShortLink {
  @Prop({ type: String, required: true, unique: true, index: true })
  code!: string;

  @Prop({ type: String, required: true, maxlength: 2048 })
  targetUrl!: string;

  @Prop({ type: String })
  title?: string;

  @Prop({ type: Number, required: true, default: 0 })
  clickCount!: number;

  @Prop({ type: Boolean, required: true, default: true })
  active!: boolean;

  /** Logto userId của admin tạo link. Internal — KHÔNG leak ra response. */
  @Prop({ type: String })
  createdBy?: string;

  // timestamps:true tự quản — khai báo để typed (KHÔNG @Prop).
  createdAt!: Date;
  updatedAt!: Date;
}

export type ShortLinkDocument = ShortLink & Document;
export const ShortLinkSchema = SchemaFactory.createForClass(ShortLink);
