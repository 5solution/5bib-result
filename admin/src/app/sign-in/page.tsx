import Logo5bib from "@/components/Logo5bib";
import { ArrowRight } from "lucide-react";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center text-center space-y-3">
          <Logo5bib className="h-10" />
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
              5BIB Admin
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Đăng nhập bằng tài khoản 5BIB Admin được cấp quyền
            </p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-xl p-6 space-y-4">
          <a
            href="/api/logto/sign-in"
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-xl transition-all shadow-md hover:shadow-lg"
          >
            Đăng nhập qua 5BIB Auth
            <ArrowRight className="w-4 h-4" />
          </a>
          <p className="text-xs text-slate-500 text-center leading-relaxed">
            Bạn sẽ được chuyển đến trang xác thực{" "}
            <strong>auth.5bib.com</strong>. Tài khoản phải có role{" "}
            <code className="font-mono text-blue-700">admin</code> để vào
            dashboard.
          </p>
        </div>

        <p className="text-center text-xs text-slate-400">
          Cần cấp quyền? Liên hệ superadmin để được cấp role admin.
        </p>
      </div>
    </div>
  );
}
