import { Column, Entity, Index, OneToMany } from 'typeorm';
import { BaseEntity } from 'src/utils/base/base-entity';
import { RaceCourseEntity } from './race-course.entity';

@Entity('races')
@Index(['product_id'], { unique: true })
@Index(['status'])
@Index(['season'])
@Index(['province'])
@Index(['race_type'])
export class RaceEntity extends BaseEntity {
  @Column({ type: 'int', unique: true })
  product_id: number;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  images: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  season: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  brand: string;

  @Column({ type: 'varchar', length: 50 })
  status: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  hotline: string;

  @Column({ type: 'text', nullable: true })
  rule: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  prefix: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  location: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  province: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  district: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  ward: string;

  @Column({ type: 'boolean', default: false })
  is_delete: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata: any;

  @Column({ type: 'boolean', default: false })
  auto_gen_bib: boolean;

  @Column({ type: 'int', nullable: true })
  sapo_product_id: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  event_type: string;

  @Column({ type: 'timestamp', nullable: true })
  event_start_date: Date;

  @Column({ type: 'timestamp', nullable: true })
  event_end_date: Date;

  @Column({ type: 'varchar', length: 100, nullable: true })
  event_category: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  transfer_type: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  url_name: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  assert_transfer_fee: number;

  @Column({ type: 'text', nullable: true })
  logo_url: string;

  @Column({ type: 'int', nullable: true })
  term_id: number;

  @Column({ type: 'int', nullable: true })
  email_template_id: number;

  @Column({ type: 'boolean', default: true })
  is_show: boolean;

  @Column({ type: 'varchar', length: 50, nullable: true })
  event_director: string;

  @Column({ type: 'boolean', default: false })
  vnpay_listed: boolean;

  @Column({ type: 'boolean', default: false })
  have_bib_name: boolean;

  @Column({ type: 'int', nullable: true })
  blacklist_id: number;

  @Column({ type: 'timestamp', nullable: true })
  registration_start_time: Date;

  @Column({ type: 'timestamp', nullable: true })
  registration_end_time: Date;

  @Column({ type: 'timestamp', nullable: true })
  reassign_start_time: Date;

  @Column({ type: 'timestamp', nullable: true })
  reassign_end_time: Date;

  @Column({ type: 'timestamp', nullable: true })
  checkin_start_time: Date;

  @Column({ type: 'timestamp', nullable: true })
  checkin_end_time: Date;

  @Column({ type: 'timestamp', nullable: true })
  racekit_start_time: Date;

  @Column({ type: 'timestamp', nullable: true })
  racekit_end_time: Date;

  @Column({ type: 'varchar', length: 100, nullable: true })
  insurance_type: string;

  @Column({ type: 'int', nullable: true })
  insurance_agency_id: number;

  @Column({ type: 'text', nullable: true })
  insurance_link_cert: string;

  @Column({ type: 'text', nullable: true })
  insurance_content: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  insurance_race_code: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  insurance_sport: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  insurance_package: string;

  @Column({ type: 'int', nullable: true })
  insurance_limit: number;

  @Column({ type: 'boolean', default: false })
  skip_register: boolean;

  @Column({ type: 'jsonb', nullable: true })
  ticket_phases: any;

  @Column({ type: 'int', nullable: true })
  race_extension_id: number;

  @Column({ type: 'jsonb', nullable: true })
  race_extenstion: any;

  @Column({ type: 'int', nullable: true })
  race_virtual_extension_id: number;

  @Column({ type: 'jsonb', nullable: true })
  race_virtual_extenstion: any;

  @Column({ type: 'int', nullable: true })
  template_id: number;

  @Column({ type: 'int', nullable: true })
  tenant_id: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  race_type: string;

  @Column({ type: 'int', nullable: true })
  create_by_id: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  racekit_location: string;

  @Column({ type: 'text', nullable: true })
  location_url: string;

  @Column({ type: 'text', nullable: true })
  racekit_location_url: string;

  @Column({ type: 'int', default: 1 })
  max_code_per_user: number;

  @Column({ type: 'boolean', default: false })
  racekit_edit_enable: boolean;

  @Column({ type: 'varchar', length: 50, default: 'DEFAULT' })
  bib_strategy: string;

  @Column({ type: 'varchar', length: 50, default: 'DEFAULT' })
  race_kit_strategy: string;

  @Column({ type: 'boolean', default: false })
  send_skip_liability_email: boolean;

  @Column({ type: 'boolean', default: false })
  allow_transfer_zero_price_code: boolean;

  @Column({ type: 'boolean', default: false })
  vat_public: boolean;

  @Column({ type: 'boolean', default: false })
  public_athlete_basic_info: boolean;

  @Column({ type: 'boolean', default: false })
  required_transfer_fee: boolean;

  @Column({ type: 'boolean', default: false })
  is_buy_group: boolean;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  synced_at: Date;

  @OneToMany(() => RaceCourseEntity, (raceCourse) => raceCourse.race)
  race_courses: RaceCourseEntity[];
}
