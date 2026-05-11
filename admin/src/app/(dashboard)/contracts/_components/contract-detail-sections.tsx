"use client";

/**
 * F-024 Contract Detail Sections — layout PRD Screen 3.
 *
 * Tách 8 section: Header / Provider / Client / Race / Line items / Financial /
 * Payment terms / Generated docs. Caller (page) responsible cho actions.
 */
import type { ContractView } from "@/lib/contracts-api";
import { formatVND, formatVNDate } from "@/lib/contracts-api";
import { ContractStatusBadge } from "./contract-status-badge";

const TYPE_LABEL: Record<string, string> = {
  TIMING: "Tính giờ",
  RACEKIT: "Racekit",
  OPERATIONS: "Vận hành",
  TICKET_SALES: "Bán vé",
};

export function ContractDetailSections({ contract }: { contract: ContractView }) {
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-mono text-xs uppercase tracking-wider text-[var(--text-muted,#78716C)]">
            Số hợp đồng
          </div>
          <div className="font-mono text-lg font-bold">
            {contract.contractNumber || "(chưa kích hoạt)"}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ContractStatusBadge status={contract.status} prominence="lg" />
          <span className="rounded-full border px-2 py-0.5 text-xs">
            {TYPE_LABEL[contract.contractType] ?? contract.contractType}
          </span>
        </div>
      </header>

      <Section title="Bên cung cấp dịch vụ (Provider)">
        <PartyDisplay
          entityName={contract.provider.entityName}
          taxId={contract.provider.taxId}
          address={contract.provider.address}
          representative={contract.provider.representative}
          position={contract.provider.position}
          bankAccount={contract.provider.bankAccount}
          bankName={contract.provider.bankName}
        />
      </Section>

      <Section title="Bên sử dụng dịch vụ (Client)">
        <PartyDisplay
          entityName={contract.client.entityName}
          taxId={contract.client.taxId}
          address={contract.client.address}
          representative={contract.client.representative}
          position={contract.client.position}
          bankAccount={contract.client.bankAccount}
          bankName={contract.client.bankName}
          phone={contract.client.phone}
          email={contract.client.email}
        />
      </Section>

      {(contract.raceName || contract.raceLocation) && (
        <Section title="Thông tin giải">
          <dl className="grid gap-2 text-sm sm:grid-cols-3">
            <Item label="Tên giải" value={contract.raceName} />
            <Item
              label="Ngày tổ chức"
              value={formatVNDate(contract.raceDate)}
            />
            <Item label="Địa điểm" value={contract.raceLocation} />
          </dl>
        </Section>
      )}

      <Section title="Hạng mục dịch vụ">
        {contract.revenueShare ? (
          <RevenueShareDisplay revenueShare={contract.revenueShare} />
        ) : contract.lineItems.length > 0 ? (
          <LineItemsDisplay items={contract.lineItems} />
        ) : (
          <p className="text-sm text-[var(--text-muted,#78716C)]">
            Chưa có hạng mục
          </p>
        )}
      </Section>

      <Section title="Tổng hợp tài chính">
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <Item label="Cộng (chưa VAT)" value={formatVND(contract.subtotal)} mono />
          <Item
            label={`VAT (${contract.vatRate}%)`}
            value={formatVND(contract.vatAmount)}
            mono
          />
          <Item
            label="TỔNG"
            value={formatVND(contract.totalAmount)}
            mono
            emphasis
          />
          <Item
            label="Tạm ứng"
            value={`${formatVND(contract.paymentTerms.advanceAmount)} (${contract.paymentTerms.advancePercentage}%)`}
            mono
          />
          <Item
            label="Còn lại"
            value={formatVND(contract.paymentTerms.remainderAmount)}
            mono
          />
        </dl>
      </Section>

      <Section title="Điều khoản thanh toán">
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <Item
            label="Hạn thanh toán sau nghiệm thu"
            value={`${contract.paymentTerms.paymentDeadlineDays} ngày`}
          />
          <Item
            label="Phạt chậm thanh toán"
            value={`${contract.paymentTerms.latePenaltyRate}%/${contract.paymentTerms.latePenaltyUnit === "PER_DAY" ? "ngày" : "năm"}`}
          />
          <Item label="Ngày ký" value={formatVNDate(contract.signDate)} />
          <Item
            label="Hiệu lực từ"
            value={formatVNDate(contract.effectiveDate)}
          />
          <Item label="Đến hạn" value={formatVNDate(contract.endDate)} />
        </dl>
      </Section>

      <Section title="Tài liệu đã tạo">
        {contract.generatedDocuments.length === 0 ? (
          <p className="text-sm text-[var(--text-muted,#78716C)]">
            Chưa có tài liệu nào — bấm "Xuất DOCX/PDF" để tạo
          </p>
        ) : (
          <ul className="space-y-1 font-mono text-xs">
            {contract.generatedDocuments
              .slice()
              .reverse()
              .map((d, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between rounded border border-[var(--border,#E7E2D9)] bg-[#FAF8F5] px-2 py-1"
                >
                  <span>
                    {d.docType} · {d.format} · v{d.version}
                  </span>
                  <span className="text-[var(--text-muted,#78716C)]">
                    {new Date(d.generatedAt).toLocaleString("vi-VN")}
                  </span>
                </li>
              ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-[var(--border,#E7E2D9)] bg-white p-4">
      <h2 className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.16em] text-[var(--text-muted,#78716C)]">
        {title}
      </h2>
      {children}
    </section>
  );
}

function PartyDisplay(p: {
  entityName: string;
  taxId?: string;
  address?: string;
  representative?: string;
  position?: string;
  bankAccount?: string;
  bankName?: string;
  phone?: string;
  email?: string;
}) {
  return (
    <dl className="grid gap-2 text-sm sm:grid-cols-2">
      <Item label="Tên đơn vị" value={p.entityName} />
      <Item label="MST" value={p.taxId} mono />
      <Item label="Địa chỉ" value={p.address} />
      <Item
        label="Đại diện"
        value={
          p.representative
            ? `${p.representative}${p.position ? ` — ${p.position}` : ""}`
            : undefined
        }
      />
      <Item
        label="Tài khoản"
        value={
          p.bankAccount
            ? `${p.bankAccount}${p.bankName ? ` tại ${p.bankName}` : ""}`
            : undefined
        }
        mono
      />
      {p.phone && <Item label="Điện thoại" value={p.phone} mono />}
      {p.email && <Item label="Email" value={p.email} />}
    </dl>
  );
}

function Item({
  label,
  value,
  mono,
  emphasis,
}: {
  label: string;
  value?: string | null;
  mono?: boolean;
  emphasis?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs text-[var(--text-muted,#78716C)]">{label}</dt>
      <dd
        className={[
          "text-sm",
          mono ? "font-mono" : "",
          emphasis ? "font-bold" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {value || "—"}
      </dd>
    </div>
  );
}

function LineItemsDisplay({
  items,
}: {
  items: ContractView["lineItems"];
}) {
  return (
    <div className="overflow-x-auto rounded border border-[var(--border,#E7E2D9)]">
      <table className="w-full text-sm">
        <thead className="bg-[#F3F0EB] text-[11px] font-extrabold uppercase tracking-[0.12em] text-[var(--text-muted,#78716C)]">
          <tr>
            <th className="px-2 py-2 text-left">STT</th>
            <th className="px-2 py-2 text-left">Mô tả</th>
            <th className="px-2 py-2 text-left">ĐVT</th>
            <th className="px-2 py-2 text-right">SL</th>
            <th className="px-2 py-2 text-right">Đơn giá</th>
            <th className="px-2 py-2 text-right">Giảm</th>
            <th className="px-2 py-2 text-right">Thành tiền</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr
              key={it.stt}
              className="border-t border-[var(--border,#E7E2D9)]"
            >
              <td className="px-2 py-1 font-mono">{it.stt}</td>
              <td className="px-2 py-1">{it.description}</td>
              <td className="px-2 py-1">{it.unit}</td>
              <td className="px-2 py-1 text-right font-mono">{it.quantity}</td>
              <td className="px-2 py-1 text-right font-mono">
                {formatVND(it.unitPrice)}
              </td>
              <td className="px-2 py-1 text-right font-mono">
                {it.discount ?? 0}%
              </td>
              <td className="px-2 py-1 text-right font-mono font-semibold">
                {formatVND(it.amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RevenueShareDisplay({
  revenueShare,
}: {
  revenueShare: NonNullable<ContractView["revenueShare"]>;
}) {
  return (
    <dl className="grid gap-2 text-sm sm:grid-cols-3">
      <Item label="% Phí" value={`${revenueShare.feePercentage}%`} mono />
      <Item
        label="Phí cố định / VĐV"
        value={formatVND(revenueShare.feePerAthlete)}
        mono
      />
      <Item
        label="VĐV ước tính"
        value={String(revenueShare.estimatedAthletes)}
        mono
      />
    </dl>
  );
}
