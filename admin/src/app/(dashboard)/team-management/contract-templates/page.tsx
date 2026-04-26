"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import {
  listContractTemplates,
  deleteContractTemplate,
  duplicateContractTemplate,
  listAcceptanceTemplates,
  deleteAcceptanceTemplate,
  type ContractTemplate,
  type AcceptanceTemplate,
} from "@/lib/team-api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Pencil,
  Copy,
  Sparkles,
  FileCheck,
} from "lucide-react";
import { toast } from "sonner";

type Tab = "contract" | "acceptance";

export default function ContractTemplatesPage(): React.ReactElement {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token, isAuthenticated, isLoading: authLoading } = useAuth();

  const [tab, setTab] = useState<Tab>(
    searchParams.get("tab") === "acceptance" ? "acceptance" : "contract",
  );

  // Contract templates state
  const [contracts, setContracts] = useState<ContractTemplate[] | null>(null);
  // Acceptance templates state
  const [acceptances, setAcceptances] = useState<AcceptanceTemplate[] | null>(null);

  const loadContracts = useCallback(async () => {
    if (!token) return;
    try {
      setContracts(await listContractTemplates(token));
    } catch (err) {
      toast.error((err as Error).message);
    }
  }, [token]);

  const loadAcceptances = useCallback(async () => {
    if (!token) return;
    try {
      setAcceptances(await listAcceptanceTemplates(token));
    } catch (err) {
      toast.error((err as Error).message);
    }
  }, [token]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.replace("/sign-in");
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (token) {
      void loadContracts();
      void loadAcceptances();
    }
  }, [token, loadContracts, loadAcceptances]);

  // Sync tab state when URL param changes (e.g. back-navigation from editor)
  useEffect(() => {
    const t = searchParams.get("tab");
    if (t === "acceptance") setTab("acceptance");
    else if (t === "contract") setTab("contract");
  }, [searchParams]);

  async function handleDeleteContract(id: number): Promise<void> {
    if (!token) return;
    if (!confirm("Xóa template? Chỉ được xóa khi không role nào đang dùng."))
      return;
    try {
      await deleteContractTemplate(token, id);
      toast.success("Đã xóa");
      await loadContracts();
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes("đang được sử dụng") || msg.includes("409")) {
        toast.warning(msg);
      } else {
        toast.error(msg);
      }
    }
  }

  async function handleDuplicateContract(id: number): Promise<void> {
    if (!token) return;
    try {
      const copy = await duplicateContractTemplate(token, id);
      toast.success(`Đã sao chép: ${copy.template_name}`);
      await loadContracts();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function handleDeleteAcceptance(id: number): Promise<void> {
    if (!token) return;
    if (
      !confirm(
        "Xoá template nghiệm thu? Chỉ được xoá khi không registration nào đang tham chiếu.",
      )
    )
      return;
    try {
      await deleteAcceptanceTemplate(token, id);
      toast.success("Đã xoá");
      await loadAcceptances();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  if (authLoading || !isAuthenticated) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 size-4" /> Quay lại
        </Button>
        <h1 className="font-display text-3xl font-bold tracking-tight text-gradient">
          Mẫu hợp đồng & nghiệm thu
        </h1>
        <div className="flex-1" />

        {tab === "contract" ? (
          <>
            <Link href="/team-management/contract-templates/new">
              <Button>
                <Sparkles className="mr-2 size-4" /> Mẫu HĐ mới
              </Button>
            </Link>
          </>
        ) : (
          <Link href="/team-management/acceptance-templates/new">
            <Button>
              <Plus className="mr-2 size-4" /> Mẫu NT mới
            </Button>
          </Link>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        <button
          type="button"
          onClick={() => setTab("contract")}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            tab === "contract"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Mẫu hợp đồng
          {contracts !== null && (
            <span className="ml-2 rounded-full bg-muted px-1.5 py-0.5 text-xs">
              {contracts.length}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setTab("acceptance")}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors ${
            tab === "acceptance"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <FileCheck className="size-4" />
          Mẫu biên bản nghiệm thu
          {acceptances !== null && (
            <span className="ml-2 rounded-full bg-muted px-1.5 py-0.5 text-xs">
              {acceptances.length}
            </span>
          )}
        </button>
      </div>

      {/* Contract templates tab */}
      {tab === "contract" && (
        <>
          <p className="text-sm text-muted-foreground">
            Template HĐ được gán cho từng vai trò. Dùng{" "}
            <strong>Soạn mới</strong> để mở editor đầy đủ với live preview và
            chèn biến.
          </p>
          {contracts === null ? (
            <Skeleton className="h-64" />
          ) : contracts.length === 0 ? (
            <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
              Chưa có template nào. Tạo mới ở nút trên.
            </div>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tên template</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead>Variables</TableHead>
                    <TableHead>Người tạo</TableHead>
                    <TableHead className="text-right">Hành động</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contracts.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">
                        {t.template_name}
                      </TableCell>
                      <TableCell>
                        {t.is_active ? (
                          <Badge className="bg-green-500/20 text-green-400">
                            Đang dùng
                          </Badge>
                        ) : (
                          <Badge className="bg-zinc-500/20 text-zinc-400">
                            Ngưng dùng
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {t.variables.length} key
                      </TableCell>
                      <TableCell className="text-sm">{t.created_by}</TableCell>
                      <TableCell className="space-x-1 text-right">
                        <Link
                          href={`/team-management/contract-templates/${t.id}/edit`}
                        >
                          <Button size="sm" variant="ghost" title="Sửa với editor">
                            <Pencil className="size-4" />
                          </Button>
                        </Link>
                        <Button
                          size="sm"
                          variant="ghost"
                          title="Sao chép"
                          onClick={() => void handleDuplicateContract(t.id)}
                        >
                          <Copy className="size-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          title="Xóa"
                          onClick={() => void handleDeleteContract(t.id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}

      {/* Acceptance templates tab */}
      {tab === "acceptance" && (
        <>
          <p className="text-sm text-muted-foreground">
            Mỗi event có thể có 1 template riêng. Nếu không có, hệ thống dùng
            template mặc định (<code>event_id = null, is_default = true</code>
            ).
          </p>
          {acceptances === null ? (
            <Skeleton className="h-64" />
          ) : acceptances.length === 0 ? (
            <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
              Chưa có template nào.
            </div>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tên</TableHead>
                    <TableHead>Phạm vi</TableHead>
                    <TableHead>Mặc định</TableHead>
                    <TableHead>Variables</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="text-right">Hành động</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {acceptances.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">
                        {t.template_name}
                      </TableCell>
                      <TableCell>
                        {t.event_id == null ? (
                          <Badge variant="outline">Global</Badge>
                        ) : (
                          <Badge variant="outline">Event #{t.event_id}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {t.is_default ? (
                          <Badge className="bg-blue-500/20 text-blue-700">
                            Default
                          </Badge>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {t.variables.length} key
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(t.updated_at).toLocaleDateString("vi-VN")}
                      </TableCell>
                      <TableCell className="space-x-1 text-right">
                        <Link
                          href={`/team-management/acceptance-templates/${t.id}/edit`}
                        >
                          <Button size="sm" variant="ghost" title="Sửa với editor">
                            <Pencil className="size-4" />
                          </Button>
                        </Link>
                        <Button
                          size="sm"
                          variant="ghost"
                          title="Xoá"
                          onClick={() => void handleDeleteAcceptance(t.id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
