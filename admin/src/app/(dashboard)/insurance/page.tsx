"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { InsuranceCreateTab } from "@/components/insurance/InsuranceCreateTab";
import { InsuranceOrdersTab } from "@/components/insurance/InsuranceOrdersTab";
import { useIglooConfig } from "@/lib/insurance-hooks";

/**
 * FEATURE-085 — Trang Bảo hiểm Igloo (admin). 2 tab: tạo bảo hiểm thủ công +
 * danh sách đơn đã tạo. Banner cảnh báo khi chế độ gửi đang TẮT.
 */
export default function InsurancePage() {
  const { data: config } = useIglooConfig();
  const submitEnabled = config?.submitEnabled ?? false;

  return (
    <div className="space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Bảo hiểm Igloo
          </h1>
          <p className="text-sm text-stone-500">
            Tạo đơn bảo hiểm cho VĐV — duy trì hợp đồng Igloo. Mỗi đơn phí cố
            định {new Intl.NumberFormat("vi-VN").format(10000)} đ.
          </p>
        </div>
        <Badge
          className={
            submitEnabled
              ? "bg-green-100 text-green-700"
              : "bg-amber-100 text-amber-800"
          }
        >
          Chế độ gửi: {submitEnabled ? "BẬT" : "TẮT"}
        </Badge>
      </header>

      {!submitEnabled && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Chế độ gửi đang <strong>TẮT</strong> — đơn tạo ra sẽ ở trạng thái
          &ldquo;Chờ gửi&rdquo;, chưa gửi sang Igloo cho tới khi bật
          <code className="mx-1 rounded bg-amber-100 px-1">
            IGLOO_SUBMIT_ENABLED
          </code>
          trên server.
        </div>
      )}

      <Tabs defaultValue="create">
        <TabsList>
          <TabsTrigger value="create">Tạo bảo hiểm</TabsTrigger>
          <TabsTrigger value="orders">Đơn đã tạo</TabsTrigger>
        </TabsList>
        <TabsContent value="create" className="mt-4">
          <InsuranceCreateTab />
        </TabsContent>
        <TabsContent value="orders" className="mt-4">
          <InsuranceOrdersTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
