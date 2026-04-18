import type { Metadata } from "next";
import { getContract, getStatus } from "@/lib/api";
import SignForm from "./sign-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  try {
    const s = await getStatus(token);
    const title = `Hợp đồng — ${s.full_name} · ${s.event_name}`;
    const description = `Xem và ký hợp đồng cộng tác viên cho vai trò "${s.role_name}" — sự kiện ${s.event_name}.`;
    return {
      title,
      description,
      openGraph: { title, description },
      twitter: { title, description },
      robots: { index: false, follow: false },
    };
  } catch {
    return {
      title: "Hợp đồng không tìm thấy",
      robots: { index: false, follow: false },
    };
  }
}

export default async function ContractPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  let data;
  let errorMessage: string | null = null;
  try {
    data = await getContract(token);
  } catch (e) {
    errorMessage = (e as Error).message;
  }

  if (errorMessage || !data) {
    return (
      <div className="card">
        <h1 className="text-xl font-bold">Không xem được hợp đồng</h1>
        <p className="text-sm text-[color:var(--color-muted)] mt-2">
          {errorMessage ?? "Link không hợp lệ hoặc đã hết hạn."}
        </p>
      </div>
    );
  }

  if (data.already_signed) {
    return (
      <div className="space-y-4">
        <section className="card border-green-300 bg-green-50">
          <h1 className="text-xl font-bold text-green-800">
            Hợp đồng đã được ký
          </h1>
          <p className="text-sm text-green-700 mt-1">
            Ký vào lúc{" "}
            {data.signed_at
              ? new Date(data.signed_at).toLocaleString("vi-VN")
              : "—"}
          </p>
          <p className="text-sm text-green-700 mt-1">
            Bản PDF đã được gửi tới email của bạn.
          </p>
        </section>
        <ContractPreview html={data.html_content} />
      </div>
    );
  }

  return (
    <div className="space-y-4 slide-up">
      <section className="card">
        <h1 className="font-display text-2xl font-bold tracking-tight text-gradient">
          Hợp đồng cộng tác
        </h1>
        <p className="text-sm text-[color:var(--color-muted)] mt-1">
          Đọc kỹ và nhập đầy đủ họ tên để xác nhận ký. Sau khi ký, bạn sẽ
          không thể ký lại bản này.
        </p>
      </section>
      <ContractPreview html={data.html_content} />
      <SignForm token={token} expectedName={data.full_name} />
    </div>
  );
}

function ContractPreview({ html }: { html: string }) {
  return (
    <section className="card overflow-x-auto">
      {/* sandbox="" disables scripts, forms, popups, and same-origin access.
          If any XSS payload slips past the backend sanitizer, it cannot
          execute here or reach the crew.5bib.com origin. */}
      <iframe
        title="Xem hợp đồng"
        className="w-full"
        style={{ minHeight: "70vh", border: 0 }}
        sandbox=""
        srcDoc={html}
      />
    </section>
  );
}
