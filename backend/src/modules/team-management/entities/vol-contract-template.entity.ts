import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('vol_contract_template')
export class VolContractTemplate {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 255 })
  template_name!: string;

  @Column({ type: 'longtext' })
  content_html!: string;

  @Column({ type: 'json' })
  variables!: string[];

  @Column({ type: 'boolean', default: true })
  is_active!: boolean;

  // ── Party A (Bên A) — configurable per template so different roles can
  //    sign with different legal entities (5BIB, 5Solution, Thành An …).
  //    Rendered as {{party_a_company_name}}, {{party_a_address}}, etc.
  //    All nullable: if absent the placeholder resolves to empty string,
  //    which is fine for templates that still hardcode the company info.
  @Column({ type: 'varchar', length: 200, nullable: true })
  party_a_company_name!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  party_a_address!: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  party_a_tax_code!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  party_a_representative!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  party_a_position!: string | null;

  @Column({ type: 'varchar', length: 100 })
  created_by!: string;

  @CreateDateColumn({ type: 'datetime' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at!: Date;
}
