import CheckinButton from "./checkin-button";

export default async function CheckinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return (
    <div className="space-y-4">
      <section className="card">
        <h1 className="text-2xl font-bold">Check-in bằng vị trí</h1>
        <p className="text-sm text-[color:var(--color-muted)] mt-1">
          Bấm nút dưới để trình duyệt chia sẻ vị trí GPS hiện tại. Hệ thống sẽ
          so sánh với địa điểm sự kiện và ghi nhận check-in nếu bạn đang ở
          trong phạm vi cho phép.
        </p>
      </section>
      <CheckinButton token={token} />
    </div>
  );
}
