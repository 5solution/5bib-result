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
  @Prop({ required: true, enum: ['DOCX', 'PDF'] }) format: string;
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
  @Prop() raceDate: Date;
  @Prop() raceLocation: string;

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
