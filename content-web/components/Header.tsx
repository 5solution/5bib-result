import Link from "next/link";
import Image from "next/image";

const NAV_ITEMS = [
  { href: "/", label: "Trung tâm trợ giúp" },
  // B-23: link to filtered archive instead of a hardcoded category slug that
  // may not exist or get renamed by admin.
  { href: "/tin-tuc?type=help", label: "Hướng dẫn" },
  { href: "/tin-tuc?type=news", label: "Tin tức" },
  { href: "/btc", label: "Dành cho BTC" },
  { href: "/lien-he", label: "Liên hệ" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[var(--5s-blue-600)]">
      <div className="flex h-[60px] items-stretch text-white">
        {/* Logo + identity */}
        <Link href="/" className="flex items-center gap-3 px-6">
          <Image
            src="/logo_5BIB_white.png"
            alt="5BIB"
            width={107}
            height={32}
            priority
            className="h-7 w-auto"
          />
          <span className="h-5 w-px bg-white/20" aria-hidden />
          <div className="hidden flex-col leading-tight sm:flex">
            <span className="text-[9px] font-extrabold uppercase tracking-[0.2em] opacity-70">
              hotro.5bib.com
            </span>
            <span className="font-[var(--font-display)] text-base font-extrabold tracking-tight">
              Trung tâm trợ giúp
            </span>
          </div>
        </Link>

        {/* Nav */}
        <nav className="hidden flex-1 items-stretch md:flex">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="relative inline-flex items-center px-4 text-[13px] font-semibold text-white/70 transition-colors hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Right side */}
        <div className="ml-auto flex items-center gap-2 px-4">
          <Link
            href="https://5bib.com"
            className="hidden text-[13px] font-bold text-white/85 hover:text-white sm:inline"
          >
            ← Về 5bib.com
          </Link>
        </div>
      </div>
    </header>
  );
}
