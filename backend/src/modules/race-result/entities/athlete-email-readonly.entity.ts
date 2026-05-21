/**
 * FEATURE-047 Phase 1B — MySQL platform `athletes` table email + identity columns
 * for cross-race identity merge.
 *
 * **Multi-entity-per-table pattern** (F-037 V2 precedent): separate class from
 * `AthleteReadonly` in race-master-data module — different col subsets per
 * concern, both map to same MySQL table `athletes`.
 *
 * **PII DEFENSE (Manager Adjustment #10):**
 * Email column read ONCE → SHA256 hash → discard raw → cache by hash. Logger
 * output sanitized as `[emailHash:abc12345]` (8-char hash prefix). Email
 * NEVER persisted in MongoDB, NEVER returned in any public DTO.
 *
 * Connection: 'platform' (5bib_platform_live, READ-ONLY replica).
 */

import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('athletes')
export class AthleteEmailReadonly {
  @PrimaryColumn({ type: 'bigint', name: 'athletes_id' })
  athletes_id: number;

  @Column({ type: 'bigint', nullable: false })
  race_id: number;

  @Column({ nullable: true, type: 'varchar', length: 64 })
  bib_number: string | null;

  @Column({ nullable: true, type: 'varchar', length: 255 })
  name: string | null;

  /**
   * PII — handled per Adjustment #10. Spike test 2026-05-20 confirmed 99.995%
   * coverage on this field. NEVER log/persist/return raw.
   */
  @Column({ nullable: true, type: 'varchar', length: 255 })
  email: string | null;
}
