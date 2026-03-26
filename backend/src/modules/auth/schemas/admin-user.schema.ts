import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AdminUserDocument = HydratedDocument<AdminUser>;

@Schema({
  collection: 'admin_users',
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
})
export class AdminUser {
  _id: string;

  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  password: string; // bcrypt hashed

  @Prop({ default: 'admin' })
  role: string;

  @Prop()
  displayName: string;

  created_at: Date;
  updated_at: Date;
}

export const AdminUserSchema = SchemaFactory.createForClass(AdminUser);
