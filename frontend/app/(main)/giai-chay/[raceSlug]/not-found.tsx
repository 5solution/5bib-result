import Link from "next/link";

export default function RaceNotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="text-6xl">🏃</div>
      <h1 className="font-[var(--font-heading)] text-2xl font-black tracking-tight">
        Không tìm thấy giải
      </h1>
      <p className="text-sm leading-relaxed text-stone-600">
        Giải chạy bạn truy cập không tồn tại hoặc chưa được công bố. Có thể link
        bị sai — kiểm tra lại hoặc xem các giải khác.
      </p>
      <Link
        href="/giai-chay"
        className="mt-2 inline-flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
      >
        Xem tất cả giải chạy
      </Link>
    </div>
  );
}
