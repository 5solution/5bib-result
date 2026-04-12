import { Injectable } from '@nestjs/common';
import { LineItem, ManualOrderRow } from '../schemas/reconciliation.schema';

export interface CalcSummary {
  gross_revenue: number;
  total_discount: number;
  net_revenue: number;
  fee_amount: number;
  fee_vat_amount: number;
  manual_ticket_count: number;
  manual_gross_revenue: number;
  manual_fee_amount: number;
  payout_amount: number;
}

@Injectable()
export class ReconciliationCalcService {
  calculateSummary(
    fiveBibOrders: any[],
    manualOrders: any[],
    feeRate: number | null,
    manualFeePerTicket: number,
    feeVatRate: number,
    manualAdjustment = 0,
  ): CalcSummary {
    // 5BIB orders: sum line_price × qty per order_line_item row (per-line contribution).
    // Dùng line_price × qty thay vì subtotal_price (order-level) để nhất quán với buildLineItems()
    // và tránh double-count khi 1 order có nhiều order_line_item khác cự ly.
    const gross_revenue = fiveBibOrders.reduce(
      (sum, r) => sum + Number(r.line_price || 0) * Number(r.qty || 0),
      0,
    );
    const total_discount = this.deduplicateByOrderId(fiveBibOrders).reduce(
      (sum, r) => sum + Number(r.total_discounts || 0),
      0,
    );
    const net_revenue = gross_revenue;

    const fee_amount = feeRate
      ? Math.round((net_revenue * feeRate) / 100)
      : 0;
    const fee_vat_amount = Math.round((fee_amount * feeVatRate) / 100);

    // Manual orders
    const uniqueManualOrders = this.deduplicateByOrderId(manualOrders);
    const manual_ticket_count = manualOrders.reduce(
      (sum, r) => sum + Number(r.qty || 0),
      0,
    );
    const manual_gross_revenue = uniqueManualOrders.reduce(
      (sum, r) => sum + Number(r.subtotal_price || 0),
      0,
    );
    const manual_fee_amount = manual_ticket_count * manualFeePerTicket;

    const payout_amount =
      net_revenue - fee_amount - fee_vat_amount + manualAdjustment;

    return {
      gross_revenue,
      total_discount,
      net_revenue,
      fee_amount,
      fee_vat_amount,
      manual_ticket_count,
      manual_gross_revenue,
      manual_fee_amount,
      payout_amount,
    };
  }

  buildLineItems(fiveBibOrders: any[]): LineItem[] {
    const map = new Map<string, LineItem & { _seenOrderIds?: Set<string> }>();

    for (const r of fiveBibOrders) {
      const category = r.order_category ?? '';
      const typeName = r.type_name ?? '';
      const distance = r.distance ?? '';
      const isChangeCourse = category === 'CHANGE_COURSE';
      const linePrice = Number(r.line_price || 0);
      // CHANGE_COURSE: nhóm theo line_price (phí đổi cự ly) vì mỗi người có thể trả khác nhau
      // ORDINARY/PERSONAL_GROUP: nhóm theo cự ly + loại vé như bình thường
      const key = isChangeCourse
        ? `CHANGE_COURSE|${typeName}|${distance}|${linePrice}`
        : `${category}|${typeName}|${distance}`;

      if (!map.has(key)) {
        map.set(key, {
          order_category: category,
          // Thêm label "_CHANGE COURSE" để phân biệt với đơn mua mới
          ticket_type_name: isChangeCourse ? `${typeName}_CHANGE COURSE` : typeName,
          distance_name: isChangeCourse ? `${distance}_CHANGE COURSE` : distance,
          // CHANGE_COURSE: đơn giá = phí đổi cự ly thực tế (line_price), không phải giá vé gốc
          unit_price: isChangeCourse ? linePrice : Number(r.origin_price || r.line_price || 0),
          quantity: 0,
          discount_amount: 0,
          subtotal: 0,
          add_on_price: 0,
        });
      }

      const item = map.get(key)!;
      item.quantity += Number(r.qty || 0);
      item.add_on_price += Number(r.total_add_on_price || 0);
      item.discount_amount += Number(r.total_discounts || 0);

      // Dùng line_price × qty (per-line-item) thay vì subtotal_price (order-level).
      // Đảm bảo Section 3 Grand Total = Section 1 net_revenue (cùng metric).
      item.subtotal += Number(r.line_price || 0) * Number(r.qty || 0);
    }

    return Array.from(map.values()).map(({ _seenOrderIds, ...rest }) => rest as LineItem);
  }

  buildManualOrders(manualOrders: any[]): ManualOrderRow[] {
    return manualOrders.map((r) => ({
      order_id: Number(r.order_id),
      ticket_type_name: r.type_name ?? '',
      participant_name: r.full_name ?? `${r.first_name ?? ''} ${r.last_name ?? ''}`.trim(),
      quantity: Number(r.qty || 0),
      unit_price: Number(r.origin_price || r.line_price || 0),
      subtotal: Number(r.subtotal_price || 0),
      note: null,
    }));
  }

  private deduplicateByOrderId(rows: any[]): any[] {
    const seen = new Set<number>();
    const result: any[] = [];
    for (const r of rows) {
      const id = Number(r.order_id);
      if (!seen.has(id)) {
        seen.add(id);
        result.push(r);
      }
    }
    return result;
  }
}
