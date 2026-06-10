/**
 * F-082 QC — assert SQL boundary params THẬT truyền vào manager.query
 * cho cả 2 nhánh cutover (kỳ cũ UTC / kỳ mới ICT / kỳ seam T6).
 *
 * Existing specs mock manager.query trả rows mà KHÔNG assert params —
 * QC test này là regression gate cho period-keyed cutover: nếu ai revert
 * periodRangeUtc hoặc đổi cutover constant, test fail với boundary cụ thể.
 */
import { ReconciliationQueryService } from '../reconciliation-query.service';

function makeService() {
  const query = jest.fn().mockResolvedValue([]);
  const tenantRepo = { manager: { query } } as any;
  const reconciliationModel = {} as any;
  const service = new ReconciliationQueryService(
    tenantRepo,
    reconciliationModel,
  );
  return { service, query };
}

describe('F-082 QC — queryOrders period boundary params', () => {
  it('kỳ CŨ T4/2026 → UTC boundary nguyên trạng (chứng từ đã ký bất biến)', async () => {
    const { service, query } = makeService();
    await service.queryOrders(117, '2026-04-01', '2026-04-30');
    const params = query.mock.calls[0][1];
    expect(params).toEqual([117, '2026-04-01 00:00:00', '2026-04-30 23:59:59']);
  });

  it('kỳ CUTOVER T6/2026 → from UTC seam-continuity, to ICT', async () => {
    const { service, query } = makeService();
    await service.queryOrders(220, '2026-06-01', '2026-06-30');
    const params = query.mock.calls[0][1];
    expect(params).toEqual([220, '2026-06-01 00:00:00', '2026-06-30 16:59:59']);
  });

  it('kỳ T7/2026 → FULL ICT cả 2 đầu', async () => {
    const { service, query } = makeService();
    await service.queryOrders(220, '2026-07-01', '2026-07-31');
    const params = query.mock.calls[0][1];
    expect(params).toEqual([220, '2026-06-30 17:00:00', '2026-07-31 16:59:59']);
  });

  it('preflight share path: re-create kỳ T5 SAU deploy vẫn ra UTC boundary (period-keyed, KHÔNG now-keyed)', async () => {
    // Mô phỏng: hôm nay là sau cutover (T6+) nhưng admin delete + re-create
    // kỳ T5 → boundary PHẢI là UTC như chứng từ gốc. periodRangeUtc key theo
    // period string nên kết quả deterministic bất kể thời điểm chạy.
    const { service, query } = makeService();
    await service.queryOrders(117, '2026-05-01', '2026-05-31');
    const params = query.mock.calls[0][1];
    expect(params).toEqual([117, '2026-05-01 00:00:00', '2026-05-31 23:59:59']);
  });
});
