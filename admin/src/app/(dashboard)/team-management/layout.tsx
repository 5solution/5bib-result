import type { ReactNode, ReactElement } from "react";

export default function TeamManagementScopeLayout({
  children,
}: {
  children: ReactNode;
}): ReactElement {
  return (
    <div
      className="duong-mon-scope min-h-screen"
      style={{
        background: "var(--5bib-bg)",
        color: "var(--5bib-text)",
      }}
    >
      {children}
    </div>
  );
}
