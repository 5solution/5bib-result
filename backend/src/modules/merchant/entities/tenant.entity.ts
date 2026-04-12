import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

/** Transformer cho cột bit(1) trong MySQL → boolean */
const bitTransformer = {
  from: (v: any): boolean => {
    if (Buffer.isBuffer(v)) return v[0] === 1;
    return Boolean(v);
  },
  to: (v: boolean) => v,
};

/**
 * Chỉ map các cột THỰC SỰ TỒN TẠI trong bảng tenant của 5bib_platform_live.
 * Đây là read-only entity — KHÔNG ghi vào DB này.
 */
@Entity('tenant')
export class Tenant {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ nullable: false })
  name: string;

  /** Lưu mã số thuế / mã DN (tên cột vat nhưng thực ra là tax code) */
  @Column({ nullable: true })
  vat: string | null;

  @Column({
    type: 'bit',
    width: 1,
    nullable: true,
    default: false,
    transformer: bitTransformer,
  })
  is_approved: boolean;

  @Column({ nullable: true })
  api_token: string | null;

  @Column({ type: 'bigint', nullable: true })
  owner_id: number | null;

  /** JSON blob: { name, email, phone, avatar, address, companyTax, companyCode, companyName, ... } */
  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any> | null;

  @Column({ name: 'created_on', type: 'datetime', nullable: true })
  created_on: Date | null;

  @Column({ name: 'modified_on', type: 'datetime', nullable: true })
  modified_on: Date | null;

  @Column({
    type: 'bit',
    width: 1,
    nullable: true,
    default: false,
    transformer: bitTransformer,
  })
  deleted: boolean;
}
