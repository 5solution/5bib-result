import { SignIn } from "@clerk/nextjs";
import Logo5bib from "@/components/Logo5bib";

export default function Page() {
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
              Đăng nhập để vào trang quản trị
            </p>
          </div>
        </div>

        <SignIn
          appearance={{
            elements: {
              rootBox: "w-full",
              card: "shadow-xl border border-slate-200",
              headerTitle: "hidden",
              headerSubtitle: "hidden",
              footer: "hidden",
            },
          }}
        />

        <p className="text-center text-xs text-slate-400">
          Cần cấp quyền admin? Liên hệ superadmin để được cấp role.
        </p>
      </div>
    </div>
  );
}
