import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ContractDocument = HydratedDocument<Contract>;

export type ContractType = 'TICKET_SALES' | 'TIMING' | 'RACEKIT' | 'OPERATIONS';
export type DocumentType = 'QUOTATION' | 'CONTRACT';
export type ContractStatus =
  | 'DRAFT'
  | 'SENT'
  | 'ACCEPTED'
  | 'CONVERTED_TO_CONTRACT'
  | 'REJECTED'
  | 'ACTIVE'
  | 'COMPLETED'
  | 'CANCELLED';

@Schema({ _id: false })
export class ProviderInfo {
  @Prop({ required: true }) entityName: string;
  @Prop({ required: true }) taxId: string;
  @Prop() address: string;
  @Prop() representative: string;
  @Prop() position: string;
  @Prop() bankAccount: string;
  @Prop() bankName: string;
}
export const ProviderInfoSchema = SchemaFactory.createForClass(ProviderInfo);

@Schema({ _id: false })
export class ClientInfo {
  @Prop({ required: true }) entityName: string;
  @Prop() taxId: string;
  @Prop() address: string;
  @Prop() representative: string;
  @Prop() position: string;
  @Prop() bankAccount: string;
  @Prop() bankName: string;
  @Prop() phone: string;
  @Prop() email: string;
}
export const ClientInfoSchema = SchemaFactory.createForClass(ClientInfo);

@Schema({ _id: false })
export class LineItem {
  @Prop({ required: true }) stt: number;
  @Prop({ required: true }) description: string;
  @Prop() unit: string;
  @Prop({ required: true, min: 0 }) quantity: number;
  @Prop({ required: true, min: 0 }) unitPrice: number;
  @Prop({ default: 0, min: 0, max: 100 }) discount: number;
  @Prop({ required: true, min: 0 }) amount: number;
  @Prop({ default: true }) selected: boolean;
  @Prop() note: string;
  /**
   * F-028 Phase 3 — reference tới `ServiceCatalog._id` khi line item được
   * pick từ catalog picker. Optional: line item nhập tay (chưa có catalog)
   * vẫn hợp lệ với `catalogItemId === undefined`.
   *
   * Dùng để cost-suggestions endpoint match HĐ ↔ catalog → tính
   * `referenceCost × quantity` đưa vào P&L pre-compute.
   *
   * String thay vì Types.ObjectId vì line item là snapshot — nếu catalog
   * bị soft delete, query lookup vẫn trả null → suggestion skip (KHÔNG
   * crash). Pattern: `Contract.raceId` (string) thay vì ObjectId ref.
   */
  @Prop() catalogItemId?: string;
  /**
   * FEATURE-033 — Quote-time estimated cost per unit (giá vốn 1 đơn vị).
   *
   * Lý do: Danny 2026-05-14 request "tao muốn nhìn thấy P&L ở đầu mục luôn,
   * còn việc phát sinh thêm gì thì ghi sau". Cho phép admin nhập cost ngay
   * trên line items table khi tạo HĐ → P&L Deal preview = estimated profit
   * BEFORE actual cost_items được nhập.
   *
   * Auto-fill khi pick từ catalog: line.cost = ServiceCatalog.referenceCost.
   * Manual edit cũng được. Default 0 (backward compat: HĐ cũ không có field).
   *
   * P&L priority (xem `pnl.service.ts`):
   *   1. cost_items collection có data → totalCost = sum(cost_items.amount) [actual]
   *   2. cost_items rỗng → totalCost = sum(line_items[i].cost × quantity) [estimated]
   *   3. Cả 2 rỗng → totalCost = 0 (legacy fallback)
   */
  @Prop({ default: 0, min: 0 }) cost?: number;
}
export const LineItemSchema = SchemaFactory.createForClass(LineItem);

@Schema({ _id: false })
export class RevenueShare {
  @Prop({ default: 0, min: 0, max: 100 }) feePercentage: number;
  @Prop({ default: 0, min: 0 }) feePerAthlete: number;
  @Prop({ default: 0, min: 0 }) estimatedAthletes: number;
  // M-03 QC fix: BR-CM-15 — server-side compute estimatedFee at create/update
  // Formula: estimatedAthletes × feePerAthlete + estimatedAthletes × avgTicketPrice × feePercentage / 100
  @Prop({ default: 0, min: 0 }) estimatedFee: number;
  // M-03 — snapshot avgTicketPrice used in compute (for audit trace)
  @Prop({ default: 0, min: 0 }) avgTicketPrice: number;
}
export const RevenueShareSchema = SchemaFactory.createForClass(RevenueShare);

@Schema({ _id: false })
export class PaymentTerms {
  @Prop({ default: 50 }) advancePercentage: number;
  @Prop({ default: 0 }) advanceAmount: number;
  @Prop({ default: 50 }) remainderPercentage: number;
  @Prop({ default: 0 }) remainderAmount: number;
  @Prop({ default: 0.02 }) latePenaltyRate: number;
  @Prop({ enum: ['PER_DAY', 'PER_YEAR'], default: 'PER_DAY' })
  latePenaltyUnit: string;
  @Prop({ default: 15 }) paymentDeadlineDays: number;
}
export const PaymentTermsSchema = SchemaFactory.createForClass(PaymentTerms);

@Schema({ _id: false })
export class GeneratedDocument {
  @Prop({
    required: true,
    enum: ['QUOTATION', 'CONTRACT', 'ACCEPTANCE_REPORT', 'PAYMENT_REQUEST'],
  })
  docType: string;
  @Prop({ required: true }) generatedAt: Date;
  @Prop({ required: true }) s3Key: string;
  // F-024 Phase 3 finalize: XLSX cho Quotation (Excel template).
  @Prop({ required: true, enum: ['DOCX', 'PDF', 'XLSX'] }) format: string;
  @Prop({ default: 1 }) version: number;
}
export const GeneratedDocumentSchema =
  SchemaFactory.createForClass(GeneratedDocument);

@Schema({ _id: false })
export class ActualLineItem {
  @Prop({ required: true }) stt: number;
  @Prop({ required: true }) description: string;
  @Prop() unit: string;
  @Prop({ required: true, min: 0 }) quantity: number;
  @Prop({ required: true, min: 0 }) unitPrice: number;
  @Prop({ required: true, min: 0 }) amount: number;
}
export const ActualLineItemSchema =
  SchemaFactory.createForClass(ActualLineItem);

@Schema({ _id: false })
export class AcceptanceReport {
  @Prop() reportDate: Date;
  @Prop({ type: [ActualLineItemSchema], default: [] })
  actualValues: ActualLineItem[];
  @Prop({ default: 0 }) actualSubtotal: number;
  @Prop({ default: 0 }) actualVatAmount: number;
  @Prop({ default: 0 }) actualTotalWithVat: number;
  @Prop({ default: 0 }) contractSubtotal: number;
  @Prop({ default: 0 }) diffAmount: number;
  @Prop({ default: 0 }) advancePaid: number;
  @Prop({ default: 0 }) remainingBalance: number;
  @Prop({
    enum: ['ACCEPTED', 'ACCEPTED_WITH_NOTES', 'REJECTED'],
    default: 'ACCEPTED',
  })
  verdict: string;
  @Prop() notes: string;
  @Prop({ enum: ['DRAFT', 'FINALIZED'], default: 'DRAFT' }) status: string;
  @Prop() finalizedAt: Date;
}
export const AcceptanceReportSchema =
  SchemaFactory.createForClass(AcceptanceReport);

@Schema({ _id: false })
export class PaymentRequest {
  @Prop() requestDate: Date;
  @Prop({ default: 0 }) totalAmount: number;
  @Prop({ default: 0 }) advancePaid: number;
  @Prop({ default: 0 }) amountDue: number;
  @Prop() paymentDeadline: Date;
  @Prop({ enum: ['DRAFT', 'SENT', 'PAID'], default: 'DRAFT' }) status: string;
  @Prop() paidAt: Date;
  @Prop() notes: string;
}
export const PaymentRequestSchema =
  SchemaFactory.createForClass(PaymentRequest);

@Schema({
  collection: 'contracts',
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
})
export class Contract {
  _id: Types.ObjectId;

  @Prop({ index: true, sparse: true, unique: true })
  contractNumber: string;

  @Prop({
    required: true,
    enum: ['TICKET_SALES', 'TIMING', 'RACEKIT', 'OPERATIONS'],
    index: true,
  })
  contractType: ContractType;

  @Prop({ required: true, enum: ['QUOTATION', 'CONTRACT'], default: 'CONTRACT' })
  documentType: DocumentType;

  @Prop({
    required: true,
    enum: [
      'DRAFT',
      'SENT',
      'ACCEPTED',
      'CONVERTED_TO_CONTRACT',
      'REJECTED',
      'ACTIVE',
      'COMPLETED',
      'CANCELLED',
    ],
    default: 'DRAFT',
    index: true,
  })
  status: ContractStatus;

  @Prop({ required: true, enum: ['5BIB', '5SOLUTION'] })
  providerId: string;

  @Prop({ type: ProviderInfoSchema, required: true })
  provider: ProviderInfo;

  @Prop({ type: Types.ObjectId, ref: 'Partner', index: true })
  partnerId: Types.ObjectId;

  @Prop({ type: ClientInfoSchema, required: true })
  client: ClientInfo;

  @Prop({ index: true }) raceId: string;
  @Prop() raceName: string;

  /**
   * F-028 — MySQL platform linkage for TICKET_SALES revenue pull.
   *
   * Optional, sparse-indexed: chỉ HĐ TICKET_SALES mới cần link để FeeService
   * cross-DB SUM(total_price). 3 contract types khác (TIMING/RACEKIT/OPERATIONS)
   * KHÔNG cần — fallback estimatedFee + acceptance report.
   *
   * Validation rule (ContractsService.update):
   *   - chỉ allow set khi contractType === 'TICKET_SALES' (else 400)
   *   - allow edit anytime (kể cả ACTIVE/COMPLETED) vì là metadata,
   *     KHÔNG affect contract business amount (Danny chốt Q3.A 2026-05-12)
   */
  @Prop({ index: true, sparse: true })
  linkedTenantId?: number;

  @Prop({ index: true, sparse: true })
  linkedMysqlRaceId?: number;
  /**
   * F-024 race manual input — raceDate là FREE-FORMAT STRING.
   * Khi pick race từ DB: lưu ISO date string (vd "2026-06-15").
   * Khi manual input: admin nhập tự do (vd "06:00 ngày 15/06/2026 đến 12:00 ngày 16/06/2026").
   * Templates DOCX substitute {raceDate} as-is — KHÔNG format lại để giữ semantics
   * race nhiều ngày (Danny chốt B 2026-05-11).
   * Schema String (KHÔNG Date) để chấp nhận free-format. Backward compat: existing
   * Date documents → Mongoose cast về ISO string khi đọc.
   */
  @Prop() raceDate: string;
  @Prop() raceLocation: string;

  /**
   * F-064 Phase 4 — Event date + location override + athlete count fields.
   * All optional, no default. Empty → `buildRenderContext` derives fallback
   * (setup = raceDate - 3d, expo = raceDate - 1d, location = raceLocation,
   * athleteCount = sum match line items). Backward compat 100% — existing
   * contracts have these undefined → render empty (no hardcoded leak).
   */
  @Prop() eventStartDate?: Date;
  @Prop() eventEndDate?: Date;
  @Prop() setupDate?: Date;
  @Prop() expoDate?: Date;
  @Prop() eventLocation?: string;
  @Prop() expectedAthleteCount?: number;

  @Prop() signDate: Date;
  @Prop() effectiveDate: Date;
  @Prop() endDate: Date;

  @Prop({ type: [LineItemSchema], default: [] }) lineItems: LineItem[];

  @Prop({ type: RevenueShareSchema }) revenueShare?: RevenueShare;

  @Prop({ default: 0 }) subtotal: number;
  @Prop({ default: 8 }) vatRate: number;
  @Prop({ default: 0 }) vatAmount: number;
  @Prop({ default: 0 }) totalAmount: number;

  @Prop({ type: PaymentTermsSchema, default: () => ({}) })
  paymentTerms: PaymentTerms;

  /** Map<articleKey, customText>. Null/missing = use default boilerplate */
  @Prop({ type: Object, default: {} })
  templateOverrides: Record<string, string>;

  @Prop({ type: Types.ObjectId, ref: 'Contract' })
  sourceQuotationId?: Types.ObjectId;

  @Prop({ type: [GeneratedDocumentSchema], default: [] })
  generatedDocuments: GeneratedDocument[];

  @Prop({ type: AcceptanceReportSchema })
  acceptanceReport?: AcceptanceReport;

  @Prop({ type: PaymentRequestSchema })
  paymentRequest?: PaymentRequest;

  @Prop() createdBy: string;
  @Prop() updatedBy: string;
  @Prop({ index: true }) deletedAt: Date;

  createdAt: Date;
  updatedAt: Date;
}

export const ContractSchema = SchemaFactory.createForClass(Contract);

ContractSchema.index({ contractType: 1, status: 1 });
ContractSchema.index({ deletedAt: 1, createdAt: -1 });
