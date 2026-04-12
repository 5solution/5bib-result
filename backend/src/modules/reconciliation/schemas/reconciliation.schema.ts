import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ReconciliationDocument = Reconciliation & Document;

@Schema({ _id: false })
export class LineItem {
  @Prop({ type: String, required: true })
  order_category: string;

  @Prop({ type: String, required: true })
  ticket_type_name: string;

  @Prop({ type: String, required: true })
  distance_name: string;

  @Prop({ type: Number, required: true })
  unit_price: number;

  @Prop({ type: Number, required: true })
  quantity: number;

  @Prop({ type: Number, default: 0 })
  discount_amount: number;

  @Prop({ type: Number, required: true })
  subtotal: number;

  @Prop({ type: Number, default: 0 })
  add_on_price: number;
}

@Schema({ _id: false })
export class ManualOrderRow {
  @Prop({ type: Number, required: true })
  order_id: number;

  @Prop({ type: String, required: true })
  ticket_type_name: string;

  @Prop({ type: String, required: true })
  participant_name: string;

  @Prop({ type: Number, required: true })
  quantity: number;

  @Prop({ type: Number, required: true })
  unit_price: number;

  @Prop({ type: Number, required: true })
  subtotal: number;

  @Prop({ type: String, default: null })
  note: string | null;
}

export const LineItemSchema = SchemaFactory.createForClass(LineItem);
export const ManualOrderRowSchema = SchemaFactory.createForClass(ManualOrderRow);

@Schema({ collection: 'reconciliations', timestamps: true })
export class Reconciliation {
  @Prop({ type: Number, required: true, index: true })
  tenant_id: number;

  @Prop({ type: Number, required: true, index: true })
  mysql_race_id: number;

  @Prop({ type: String, required: true })
  race_title: string;

  @Prop({ type: String, required: true })
  tenant_name: string;

  @Prop({ type: String, required: true })
  period_start: string;

  @Prop({ type: String, required: true })
  period_end: string;

  // Snapshot fee config at creation time
  @Prop({ type: Number, default: null })
  fee_rate_applied: number | null;

  @Prop({ type: Number, default: 5000 })
  manual_fee_per_ticket: number;

  @Prop({ type: Number, default: 0 })
  fee_vat_rate: number;

  // 5BIB orders summary
  @Prop({ type: Number, default: 0 })
  gross_revenue: number;

  @Prop({ type: Number, default: 0 })
  total_discount: number;

  @Prop({ type: Number, default: 0 })
  net_revenue: number;

  @Prop({ type: Number, default: 0 })
  fee_amount: number;

  @Prop({ type: Number, default: 0 })
  fee_vat_amount: number;

  // MANUAL orders summary
  @Prop({ type: Number, default: 0 })
  manual_ticket_count: number;

  @Prop({ type: Number, default: 0 })
  manual_gross_revenue: number;

  @Prop({ type: Number, default: 0 })
  manual_fee_amount: number;

  // Payout
  @Prop({ type: Number, default: 0 })
  payout_amount: number;

  @Prop({ type: Number, default: 0 })
  manual_adjustment: number;

  @Prop({ type: String, default: null })
  adjustment_note: string | null;

  // Status workflow: draft → flagged/ready → approved → sent
  @Prop({
    type: String,
    enum: ['draft', 'flagged', 'ready', 'approved', 'sent', 'reviewed', 'signed', 'completed'],
    default: 'draft',
  })
  status: string;

  // Pre-flight flags/warnings computed at creation time
  @Prop({ type: [Object], default: [] })
  flags: Array<{
    type: string;
    severity: 'ERROR' | 'WARNING' | 'INFO';
    message: string;
    count: number | null;
  }>;

  // Source: 'manual' | 'cron'
  @Prop({ type: String, default: 'manual' })
  created_source: string;

  // Generated file URLs (S3)
  @Prop({ type: String, default: null })
  xlsx_url: string | null;

  @Prop({ type: String, default: null })
  docx_url: string | null;

  // Audit
  @Prop({ type: Number, default: null })
  created_by: number | null;

  @Prop({ type: Number, default: null })
  reviewed_by: number | null;

  @Prop({ type: Date, default: null })
  reviewed_at: Date | null;

  @Prop({ type: Number, default: null })
  approved_by: number | null;

  @Prop({ type: Date, default: null })
  approved_at: Date | null;

  @Prop({ type: Date, default: null })
  signed_at: Date | null;

  @Prop({ type: String, default: null })
  signed_date_str: string | null;

  // Embedded line items (5BIB orders grouped by ticket_type + distance)
  @Prop({ type: [LineItemSchema], default: [] })
  line_items: LineItem[];

  // Embedded manual orders
  @Prop({ type: [ManualOrderRowSchema], default: [] })
  manual_orders: ManualOrderRow[];

  // Raw order rows for XLSX sheets
  @Prop({ type: [Object], default: [] })
  raw_5bib_orders: Array<Record<string, any>>;

  @Prop({ type: [Object], default: [] })
  raw_manual_orders: Array<Record<string, any>>;
}

export const ReconciliationSchema = SchemaFactory.createForClass(Reconciliation);
