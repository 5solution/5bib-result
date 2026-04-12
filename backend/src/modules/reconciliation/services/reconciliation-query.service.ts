import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../../merchant/entities/tenant.entity';

const FIVE_BIB_CATEGORIES = ['ORDINARY', 'PERSONAL_GROUP', 'CHANGE_COURSE'];

@Injectable()
export class ReconciliationQueryService {
  constructor(
    @InjectRepository(Tenant, 'platform')
    private tenantRepo: Repository<Tenant>,
  ) {}

  async queryOrders(
    mysql_race_id: number,
    period_start: string,
    period_end: string,
  ): Promise<{
    fiveBibOrders: any[];
    manualOrders: any[];
    missingPaymentRef: any[];
  }> {
    const sql = `
      SELECT
        oli.id as oli_id, oli.order_id, o.order_category,
        oli.price AS line_price,
        o.name as full_name, o.email, o.last_name, o.first_name,
        o.phone_number, o.internal_status, o.payment_ref, o.processed_on,
        rc.name AS distance, tt.type_name, tt.price AS origin_price,
        oli.quantity AS qty, o.total_discounts, o.total_add_on_price,
        dc.code as discount_code, o.subtotal_price, o.total_price, o.vat_metadata
      FROM order_line_item oli
      LEFT JOIN order_metadata o ON oli.order_id = o.id
      LEFT JOIN ticket_type tt ON oli.ticket_type_id = tt.id
      LEFT JOIN race_course rc ON tt.race_course_id = rc.id
      LEFT JOIN discount_code dc ON o.discound_code_id = dc.id
      WHERE rc.race_id = ?
        AND o.internal_status = 'COMPLETE'
        AND o.processed_on >= ?
        AND o.processed_on <= ?
        AND o.deleted = 0
      ORDER BY o.order_category, oli.id ASC
    `;

    const rows: any[] = await this.tenantRepo.manager.query(sql, [
      mysql_race_id,
      period_start + ' 00:00:00',
      period_end + ' 23:59:59',
    ]);

    // PERSONAL_GROUP có payment_ref = đã thanh toán qua 5BIB → tính vào Section 1
    // PERSONAL_GROUP không có payment_ref = nhập tay bởi organizer → tính vào Section 2 (Manual)
    const fiveBibOrders = rows.filter((r) => {
      if (r.order_category === 'PERSONAL_GROUP') return !!r.payment_ref;
      return FIVE_BIB_CATEGORIES.includes(r.order_category);
    });
    const manualOrders = rows.filter((r) =>
      r.order_category === 'MANUAL' ||
      (r.order_category === 'PERSONAL_GROUP' && !r.payment_ref),
    );
    const missingPaymentRef = fiveBibOrders.filter(
      (r) => !r.payment_ref,
    );

    return { fiveBibOrders, manualOrders, missingPaymentRef };
  }

  async getTenant(tenant_id: number): Promise<Tenant | null> {
    return this.tenantRepo.findOne({ where: { id: tenant_id } });
  }

  async getRacesByTenant(tenant_id: number): Promise<any[]> {
    const sql = `
      SELECT r.race_id, r.title, r.created_on, r.modified_on
      FROM races r
      WHERE r.tenant_id = ?
      ORDER BY r.created_on DESC
    `;
    return this.tenantRepo.manager.query(sql, [tenant_id]);
  }
}
