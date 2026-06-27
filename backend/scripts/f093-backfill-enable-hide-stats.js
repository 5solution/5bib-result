/**
 * F-093 backfill — "Ẩn biểu đồ thống kê" mặc định BẬT cho TẤT CẢ giải.
 *
 * Frontend đã đổi default `enableHideStats ?? true` (phủ giải field undefined),
 * nhưng giải lưu explicit `false` (do schema default cũ = false) sẽ KHÔNG bị
 * phủ ở frontend. Script này set `enableHideStats = true` cho mọi giải hiện
 * KHÔNG phải true (false hoặc thiếu) → phủ hết.
 *
 * AN TOÀN: chỉ đụng field `enableHideStats`. KHÔNG đụng enablePrivateList /
 * privateListLimit / bất kỳ field nào khác. Idempotent (chạy lại = 0 thay đổi).
 * BTC vẫn tự tắt lại (set false) per giải sau backfill nếu muốn show.
 *
 * Run: docker exec <backend-container> node /app/scripts/f093-backfill-enable-hide-stats.js
 * (cwd /app → resolve mongoose + đọc process.env.MONGODB_URL / MONGODB_DB_NAME)
 */
const mongoose = require('mongoose');

(async () => {
  const url = process.env.MONGODB_URL;
  const dbName = process.env.MONGODB_DB_NAME;
  if (!url) {
    console.error('[F-093] MONGODB_URL missing — abort');
    process.exit(1);
  }
  await mongoose.connect(url, dbName ? { dbName } : undefined);
  const col = mongoose.connection.collection('races');

  const before = {
    total: await col.countDocuments({}),
    hidden: await col.countDocuments({ enableHideStats: true }),
    notHidden: await col.countDocuments({ enableHideStats: { $ne: true } }),
  };
  console.log('[F-093] BEFORE:', JSON.stringify(before));

  // Dry-run unless RUN=1 — in ra số sẽ đổi mà không ghi.
  if (process.env.RUN !== '1') {
    console.log(
      `[F-093] DRY-RUN — sẽ set enableHideStats=true cho ${before.notHidden} giải. ` +
        `Chạy lại với RUN=1 để ghi thật.`,
    );
    await mongoose.disconnect();
    return;
  }

  const res = await col.updateMany(
    { enableHideStats: { $ne: true } },
    { $set: { enableHideStats: true } },
  );
  const after = await col.countDocuments({ enableHideStats: true });
  console.log(
    `[F-093] DONE — matched=${res.matchedCount} modified=${res.modifiedCount} | ` +
      `enableHideStats=true now: ${after}/${before.total}`,
  );
  await mongoose.disconnect();
})().catch((e) => {
  console.error('[F-093] ERROR', e);
  process.exit(1);
});
