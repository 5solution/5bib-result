import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ContractTemplateDocument = HydratedDocument<ContractTemplate>;

@Schema({ _id: false })
export class TemplateVariable {
  @Prop({ required: true }) key: string;
  @Prop({ required: true }) label: string;
  @Prop() source: string;
}
export const TemplateVariableSchema =
  SchemaFactory.createForClass(TemplateVariable);

@Schema({
  collection: 'contract_templates',
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
})
export class ContractTemplate {
  _id: Types.ObjectId;

  @Prop({
    required: true,
    enum: ['TICKET_SALES', 'TIMING', 'RACEKIT', 'OPERATIONS'],
    unique: true,
    index: true,
  })
  contractType: string;

  /** Map<articleKey, articleText>. Override of default-templates.ts */
  @Prop({ type: Object, default: {} })
  articles: Record<string, string>;

  @Prop({ type: [TemplateVariableSchema], default: [] })
  variables: TemplateVariable[];

  @Prop() lastEditedBy: string;

  createdAt: Date;
  updatedAt: Date;
}

export const ContractTemplateSchema =
  SchemaFactory.createForClass(ContractTemplate);
