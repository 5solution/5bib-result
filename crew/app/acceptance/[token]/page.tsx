import type { Metadata } from "next";
import { getAcceptance, getStatus } from "@/lib/api";
import SignForm from "./sign-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  try {
    const s = await getStatus(token);
    const title = `Biên bản nghiệm thu — ${s.full_name} · ${s.event_name}`;
    const description = `Xem và ký biên bản nghiệm thu cho vai trò "${s.role_name}" — sự kiện ${s.event_name}.`;
    return {
      title,
      description,
      openGraph: { title, description },
      twitter: { title, description },
      robots: { index: false, follow: false },
    };
  } catch {
    return {
      title: "Biên bản nghiệm thu không tìm thấy",
      robots: { index: false, follow: false },
    };
  }
}

export default async function AcceptancePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  let data;
  let errorMessage: string | null = null;
  try {
    data = await getAcceptance(token);
  } catch (e) {
    errorMessage = (e as Error).message;
  }

  if (errorMessage || !data) {
    return (
      <div className="card">
        <h1 className="text-xl font-bold">Không xem được biên bản nghiệm thu</h1>
        <p className="text-sm text-[color:var(--color-muted)] mt-2">
          {errorMessage ?? "Link không hợp lệ hoặc đã hết hạn."}
        </p>
      </div>
    );
  }

  // Disputed — admin flagged an issue. Crew cannot sign until admin re-sends.
  if (data.acceptance_status === "disputed") {
    return (
      <div className="space-y-4">
        <section className="card border-red-300 bg-red-50">
          <h1 className="text-xl font-bold text-red-800">
            Biên bản nghiệm thu đang tranh chấp
          </h1>
          {data.notes ? (
            <p className="mt-2 whitespace-pre-wrap text-sm text-red-700">
              <span className="font-semibold">Lý do:</span> {data.notes}
            </p>
          ) : null}
          <p className="mt-3 text-sm text-red-700">
            Admin sẽ liên hệ lại với bạn để giải quyết. Sau khi thống nhất,
            biên bản mới sẽ được gửi lại cho bạn ký.
          </p>
        </section>
        <AcceptancePreview html={data.html_content} />
      </div>
    );
  }

  // Not ready yet — admin hasn't sent this to crew.
  if (data.acceptance_status === "not_ready") {
    return (
      <div className="card">
        <h1 className="text-xl font-bold">Biên bản chưa sẵn sàng</h1>
        <p className="text-sm text-[color:var(--color-muted)] mt-2">
          Admin chưa gửi biên bản nghiệm thu cho bạn. Vui lòng chờ email
          thông báo.
        </p>
      </div>
    );
  }

  // Already signed — show confirmation + PDF link.
  if (data.acceptance_status === "signed") {
    return (
      <div className="space-y-4">
        <section className="card border-green-300 bg-green-50">
          <h1 className="text-xl font-bold text-green-800">
            Biên bản nghiệm thu đã được ký
          </h1>
          <p className="text-sm text-green-700 mt-1">
            Ký vào lúc{" "}
            {data.signed_at
              ? new Date(data.signed_at).toLocaleString("vi-VN")
              : "—"}
          </p>
          {data.pdf_url ? (
            <a
              href={data.pdf_url}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-green-800 hover:underline"
            >
              Tải bản PDF đã ký →
            </a>
          ) : (
            <p className="mt-1 text-sm text-green-700">
              Bản PDF đã được gửi tới email của bạn.
            </p>
          )}
        </section>
        <AcceptancePreview html={data.html_content} />
      </div>
    );
  }

  // pending_sign — show preview + sign form
  return (
    <div className="space-y-4 slide-up">
      <section className="card">
        <h1 className="font-display text-2xl font-bold tracking-tight text-gradient">
          Biên bản nghiệm thu
        </h1>
        <p className="text-sm text-[color:var(--color-muted)] mt-1">
          Đọc kỹ nội dung. Sau khi ký xác nhận, biên bản sẽ được lưu và là
          điều kiện để admin tiến hành thanh toán. Bạn không thể ký lại bản
          này sau khi đã ký.
        </p>
        {typeof data.acceptance_value === "number" && data.acceptance_value > 0 ? (
          <p className="mt-2 text-sm">
            <span className="font-medium">Giá trị nghiệm thu:</span>{" "}
            <span className="font-semibold">
              {data.acceptance_value.toLocaleString("vi-VN")} VNĐ
            </span>
            <span className="ml-1 text-xs text-[color:var(--color-muted)]">
              (đã bao gồm thuế TNCN)
            </span>
          </p>
        ) : null}
      </section>
      <AcceptancePreview html={data.html_content} />
      <SignForm token={token} expectedName={data.full_name} />
    </div>
  );
}

function AcceptancePreview({ html }: { html: string }) {
  return (
    <section className="card overflow-x-auto">
      {/* sandbox="" disables scripts, forms, popups, and same-origin access.
          If any XSS payload slips past the backend sanitizer, it cannot
          execute here or reach the crew.5bib.com origin. */}
      <iframe
        title="Xem biên bản nghiệm thu"
        className="w-full"
        style={{ minHeight: "70vh", border: 0 }}
        sandbox=""
        srcDoc={html}
      />
    </section>
  );
}
