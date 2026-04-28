import Link from "next/link";
import Image from "next/image";
import { fetchCategories } from "@/lib/api";

const LEGAL_LINKS = [
  { label: "Quy chế 5bib.com", href: "#" },
  { label: "Chính sách bảo mật thông tin", href: "#" },
  { label: "Chính sách bảo mật thông tin thanh toán", href: "#" },
  { label: "Chính sách thanh toán", href: "#" },
  { label: "Thông tin về chủ sở hữu", href: "#" },
  { label: "Quy trình giải quyết tranh chấp, khiếu nại", href: "#" },
];

const SOCIAL_LINKS = [
  {
    href: "https://www.facebook.com/5bibapp",
    label: "Facebook",
    bg: "bg-[#1877F2]",
    path: "M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z",
  },
  {
    href: "https://www.instagram.com/5bib_findyournewexperience",
    label: "Instagram",
    bg: "bg-gradient-to-br from-[#f9ce34] via-[#ee2a7b] to-[#6228d7]",
    path: "M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.162 3.405 0 6.162-2.76 6.162-6.162 0-3.405-2.76-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405c0 .795-.646 1.44-1.44 1.44-.795 0-1.44-.646-1.44-1.44 0-.794.646-1.439 1.44-1.439.793-.001 1.44.645 1.44 1.439z",
  },
  {
    href: "https://www.tiktok.com/@5bib.com",
    label: "TikTok",
    bg: "bg-black",
    path: "M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.73a4.85 4.85 0 01-1.01-.04z",
  },
  {
    href: "https://www.youtube.com/@5BIBCustomerSupport",
    label: "YouTube",
    bg: "bg-[#FF0000]",
    path: "M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z",
  },
  {
    href: "https://www.strava.com/clubs/1282714?oq=5b",
    label: "Strava",
    bg: "bg-[#FC4C02]",
    path: "M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169",
  },
];

/**
 * Footer is a Server Component — fetches help categories at request time
 * (cached via fetchCategories' ISR layer). Mirrors result.5bib.com footer
 * layout/info: company address, tax info, contact, gov.vn badge, legal,
 * social — adapted to the content-web dark theme.
 */
export async function Footer() {
  const allCategories = await fetchCategories("help");
  const helpLinks = allCategories
    .filter((c) => c.articleCount > 0)
    .slice(0, 5)
    .map((c) => ({ label: c.name, href: `/danh-muc/${c.slug}` }));
  const helpFallback = [
    { label: "Tất cả hướng dẫn", href: "/tin-tuc?type=help" },
    { label: "Tin tức", href: "/tin-tuc?type=news" },
    { label: "Dành cho BTC", href: "/btc" },
    { label: "Liên hệ", href: "/lien-he" },
  ];
  const helpColumn = helpLinks.length > 0 ? helpLinks : helpFallback;

  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-20 bg-[#0B1328] py-14 text-white">
      <div className="mx-auto max-w-[1200px] px-8">
        {/* Top: Brand info / Trợ giúp / Pháp lý / Liên hệ */}
        <div className="grid gap-10 md:grid-cols-[2fr_1fr_1.4fr_1fr]">
          {/* Col 1 — Brand & Company info */}
          <div className="space-y-2.5">
            <Image
              src="/logo_5BIB_white.png"
              alt="5BIB"
              width={107}
              height={32}
              className="mb-3 h-8 w-auto"
            />
            <p className="text-[13px] leading-relaxed text-white/70">
              <span className="font-semibold text-white/90">Địa chỉ:</span>{" "}
              Tầng 9, Hồ Gươm Plaza (tòa văn phòng), Số 102 Trần Phú, Quận
              Hà Đông, Thành Phố Hà Nội, Việt Nam.
            </p>
            <p className="text-[13px] text-white/70">
              <span className="font-semibold text-white/90">Mã thuế:</span>{" "}
              0110398986
            </p>
            <p className="text-[13px] text-white/70">
              <span className="font-semibold text-white/90">Ngày cấp:</span>{" "}
              26/06/2023
            </p>
            <p className="text-[13px] text-white/70">
              <span className="font-semibold text-white/90">Nơi cấp:</span> Sở
              Kế hoạch và Đầu tư Thành phố Hà Nội
            </p>
            <p className="text-[13px] text-white/70">
              <span className="font-semibold text-white/90">Email:</span>{" "}
              <a
                href="mailto:info@5bib.com"
                className="hover:text-white"
              >
                info@5bib.com
              </a>
            </p>
            <p className="text-[13px] text-white/70">
              <span className="font-semibold text-white/90">
                Số điện thoại:
              </span>{" "}
              <a href="tel:0373398986" className="hover:text-white">
                0373398986
              </a>
            </p>
            <div className="pt-3">
              <a
                href="http://online.gov.vn/Website/chi-tiet-111732"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block rounded-md bg-white/95 p-1"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="http://online.gov.vn/Content/EndUser/LogoCCDVSaleNoti/logoCCDV.png"
                  alt="Đã Đăng Ký Bộ Công Thương"
                  className="h-12 w-auto"
                />
              </a>
            </div>
          </div>

          {/* Col 2 — Trợ giúp (dynamic) */}
          <FooterColumn title="Trợ giúp" links={helpColumn} />

          {/* Col 3 — Pháp lý */}
          <FooterColumn title="Pháp lý" links={LEGAL_LINKS} />

          {/* Col 4 — Liên hệ social */}
          <div>
            <div className="mb-3.5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-white/50">
              Liên hệ
            </div>
            <div className="flex flex-wrap gap-2.5">
              {SOCIAL_LINKS.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  className={`${s.bg} flex size-9 items-center justify-center rounded-full text-white transition-opacity hover:opacity-80`}
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="size-4">
                    <path d={s.path} />
                  </svg>
                </a>
              ))}
            </div>
            <div className="mt-5 flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
                Powered by
              </span>
              <svg
                viewBox="0 0 24 24"
                fill="#FC4C02"
                className="h-3.5 w-auto"
              >
                <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
              </svg>
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#FC4C02]">
                Strava
              </span>
            </div>
          </div>
        </div>

        {/* Bottom: copyright */}
        <div className="mt-10 flex flex-col gap-2 border-t border-white/10 pt-5 text-xs text-white/50 md:flex-row md:items-center md:justify-between">
          <span>
            © {currentYear} 5Solution JSC. All rights reserved · hotro.5bib.com
          </span>
          <span>v1.0 — Blog &amp; Help Center</span>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: Array<{ label: string; href: string }>;
}) {
  return (
    <div>
      <div className="mb-3.5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-white/50">
        {title}
      </div>
      <ul className="grid list-none gap-2 p-0">
        {links.map((l) => (
          <li key={`${title}-${l.label}`}>
            <Link
              href={l.href}
              className="text-[13px] text-white/80 transition-colors hover:text-white"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
