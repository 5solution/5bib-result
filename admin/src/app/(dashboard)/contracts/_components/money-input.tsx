"use client";

import { Input } from "@/components/ui/input";
import type { ComponentProps } from "react";

interface MoneyInputProps
  extends Omit<ComponentProps<typeof Input>, "value" | "onChange" | "type"> {
  value: number;
  onChange: (value: number) => void;
}

/**
 * MoneyInput — input VND format chấm phân cách hàng nghìn (vi-VN locale).
 * Hiển thị: 15000000 → "15.000.000"
 * State giữ Number, KHÔNG string — để backend nhận đúng kiểu.
 */
export function MoneyInput({
  value,
  onChange,
  placeholder,
  ...rest
}: MoneyInputProps) {
  return (
    <Input
      {...rest}
      type="text"
      inputMode="numeric"
      value={value ? value.toLocaleString("vi-VN") : ""}
      onChange={(e) => {
        const raw = e.target.value.replace(/[^\d]/g, "");
        onChange(raw ? Number(raw) : 0);
      }}
      placeholder={placeholder ?? "vd: 15.000.000"}
    />
  );
}
