import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export type FeeField = 'service_fee_rate' | 'manual_fee_per_ticket' | 'fee_vat_rate';

@Entity('tenant_fee_history')
export class TenantFeeHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  tenant_id: number;

  /** Trường phí nào thay đổi */
  @Column({ type: 'varchar', length: 50 })
  fee_field: FeeField;

  /** Giá trị cũ (dạng string để chứa cả % và số nguyên) */
  @Column({ type: 'varchar', length: 20, nullable: true })
  old_value: string | null;

  /** Giá trị mới */
  @Column({ type: 'varchar', length: 20 })
  new_value: string;

  @CreateDateColumn()
  changed_at: Date;

  /** Admin ID đã thay đổi */
  @Column({ nullable: true })
  changed_by: number | null;

  /** Lý do thay đổi — bắt buộc */
  @Column({ type: 'varchar', length: 500 })
  note: string;
}
