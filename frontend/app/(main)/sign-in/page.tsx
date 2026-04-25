import Image from 'next/image';
import Link from 'next/link';
import { Trophy, Users, Award, Timer, ArrowRight } from 'lucide-react';

const HERO_BG =
  'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=1600&q=80';

/**
 * Custom sign-in landing — branded 5BIB UI on our domain.
 * The actual authentication happens at `auth.5bib.com` (Logto hosted UI).
 * Clicking the "Đăng nhập" button hits /api/logto/sign-in which 302s to Logto.
 *
 * This gives users a branded touchpoint + custom copy before the OIDC
 * redirect, while keeping the standard OIDC flow.
 */
export default function SignInPage() {
  return (
    <div className="min-h-[calc(100vh-160px)] grid md:grid-cols-2 bg-slate-50">
      {/* Left: brand hero (desktop only) */}
      <div className="hidden md:block relative overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${HERO_BG})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/95 via-blue-800/90 to-blue-950/95" />

        <div className="relative z-10 flex flex-col h-full p-10 lg:p-14 text-white">
          <div className="mb-auto">
            <Image
              src="/logo_5BIB_white.png"
              alt="5BIB"
              width={120}
              height={36}
              className="h-10 w-auto"
              priority
            />
          </div>

          <div className="space-y-6 max-w-md">
            <h1 className="text-3xl lg:text-4xl font-black leading-tight tracking-tight">
              Theo dõi kết quả
              <br />
              <span className="text-cyan-300">mọi giải chạy</span> của bạn
            </h1>
            <p className="text-blue-100/80 text-base leading-relaxed">
              5BIB là nền tảng kết quả thống nhất cho cộng đồng running Việt
              Nam. Đăng nhập để theo dõi vận động viên yêu thích, lưu kết quả
              và nhận thông báo khi giải diễn ra.
            </p>

            <div className="grid grid-cols-2 gap-4 pt-6">
              {[
                { icon: Timer, label: 'Kết quả trực tiếp' },
                { icon: Trophy, label: 'Bảng xếp hạng' },
                { icon: Users, label: 'Theo dõi VĐV' },
                { icon: Award, label: 'Chứng nhận' },
              ].map((f, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                    <f.icon className="w-4 h-4 text-cyan-300" />
                  </div>
                  <span className="text-sm font-semibold text-white/90">
                    {f.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-auto pt-10 text-xs text-blue-200/60">
            © 5BIB • Một sản phẩm của 5Solution
          </div>
        </div>
      </div>

      {/* Right: sign-in CTA panel */}
      <div className="flex items-center justify-center p-4 md:p-8 lg:p-12">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="md:hidden flex justify-center mb-6">
            <Image
              src="/logo.png"
              alt="5BIB"
              width={72}
              height={72}
              className="w-16 h-16"
              priority
            />
          </div>

          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900">
              Đăng nhập 5BIB
            </h2>
            <p className="text-sm text-slate-500 mt-2">
              Chào mừng trở lại cộng đồng running Việt Nam
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl p-6 space-y-4">
            <a
              href="/api/logto/sign-in"
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-xl transition-all shadow-md hover:shadow-lg"
            >
              Đăng nhập / Đăng ký
              <ArrowRight className="w-4 h-4" />
            </a>
            <p className="text-xs text-slate-500 text-center leading-relaxed">
              Bạn sẽ được chuyển đến trang xác thực an toàn của 5BIB. Hỗ trợ
              đăng nhập bằng email, Google, và các phương thức passwordless.
            </p>
          </div>

          <p className="text-center text-xs text-slate-400 mt-6">
            Cần hỗ trợ?{' '}
            <Link
              href="mailto:info@5bib.com"
              className="text-blue-700 hover:underline"
            >
              Liên hệ đội ngũ 5BIB
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
