import Link from "next/link";

export default function CityNotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="text-6xl">🏙️</div>
      <h1 className="font-[var(--font-heading)] text-2xl font-black tracking-tight">
        Không tìm thấy thành phố
      </h1>
      <p className="text-sm leading-relaxed text-stone-600">
        Thành phố bạn tìm không có trong danh sách. Xem tất cả giải chạy hoặc
        chọn thành phố khác.
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
