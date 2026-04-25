"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { VN_BANKS } from "@/lib/banks";
import type { BackfillBenBInput } from "@/lib/team-api";

/**
 * Admin-facing modal to backfill Bên B fields required for contract +
 * acceptance rendering. Surfaces:
 *   - birth_date / cccd_issue_date (date)
 *   - cccd_issue_place
 *   - bank_account_number / bank_name (merged into form_data)
 *   - address (merged into form_data)
 *
 * Initial values come from the detail response so the admin can review
 * and edit before saving. Empty string → explicit null.
 */
export function BackfillBenBDialog({
  open,
  onOpenChange,
  name,
  initial,
  busy,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  name: string;
  initial: BackfillBenBInput;
  busy: boolean;
  onConfirm: (body: BackfillBenBInput) => void | Promise<void>;
}): React.ReactElement {
  const [birthDate, setBirthDate] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [issuePlace, setIssuePlace] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [bankName, setBankName] = useState("");
  const [address, setAddress] = useState("");

  useEffect(() => {
    if (!open) return;
    setBirthDate(initial.birth_date ?? "");
    setIssueDate(initial.cccd_issue_date ?? "");
    setIssuePlace(initial.cccd_issue_place ?? "");
    setBankAccount(initial.bank_account_number ?? "");
    setBankName(initial.bank_name ?? "");
    setAddress(initial.address ?? "");
  }, [open, initial]);

  function submit(): void {
    // Only send fields that are non-empty — empty string means "leave
    // existing value alone" from the admin's POV (they opened the modal
    // only to fill in missing pieces).
    const body: BackfillBenBInput = {};
    if (birthDate) body.birth_date = birthDate;
    if (issueDate) body.cccd_issue_date = issueDate;
    if (issuePlace.trim()) body.cccd_issue_place = issuePlace.trim();
    if (bankAccount.trim()) body.bank_account_number = bankAccount.trim();
    if (bankName.trim()) body.bank_name = bankName.trim();
    if (address.trim()) body.address = address.trim();
    void onConfirm(body);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (!busy ? onOpenChange(v) : null)}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Bổ sung thông tin Bên B — {name}</DialogTitle>
          <DialogDescription>
            Các trường dưới đây bắt buộc cho mẫu HĐ/Biên bản nghiệm thu. Bỏ
            trống nghĩa là giữ nguyên giá trị cũ.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="bb_birth_date">Ngày sinh</Label>
            <Input
              id="bb_birth_date"
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="bb_issue_date">Ngày cấp CCCD</Label>
            <Input
              id="bb_issue_date"
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="bb_issue_place">Nơi cấp CCCD</Label>
            <Input
              id="bb_issue_place"
              value={issuePlace}
              onChange={(e) => setIssuePlace(e.target.value)}
              placeholder="VD: Cục CSQLHC về TTXH"
              maxLength={255}
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="bb_address">Địa chỉ thường trú</Label>
            <Input
              id="bb_address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Số nhà, phường/xã, quận/huyện, tỉnh/thành"
              maxLength={512}
            />
          </div>
          <div>
            <Label htmlFor="bb_bank_account">Số tài khoản</Label>
            <Input
              id="bb_bank_account"
              value={bankAccount}
              onChange={(e) => setBankAccount(e.target.value)}
              placeholder="Chỉ số, không có khoảng trắng"
              maxLength={32}
              inputMode="numeric"
            />
          </div>
          <div>
            <Label htmlFor="bb_bank_name">Ngân hàng</Label>
            <select
              id="bb_bank_name"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
            >
              <option value="">— chọn —</option>
              {VN_BANKS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Huỷ
          </Button>
          <Button disabled={busy} onClick={submit}>
            {busy ? "Đang lưu..." : "Lưu"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
