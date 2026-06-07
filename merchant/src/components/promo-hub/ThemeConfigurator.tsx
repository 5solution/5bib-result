"use client";

/**
 * FEATURE-027 — ThemeConfigurator.
 *
 * Theme + SEO form. Lives trong tab "Thiết kế" + "SEO" của edit page.
 *
 * Theme: primaryColor / secondaryColor / fontFamily / layout / customCss
 *   (BR-PH-12 — customCss sanitized server-side via sanitize-html).
 *
 * SEO: metaTitle / metaDescription / ogImage / canonicalUrl / structuredData
 *   (BR-PH-13).
 */

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  PromoHubThemeInputDto,
  PromoHubSeoInputDto,
} from "@/lib/api-generated";

export function ThemeConfigurator({
  theme,
  onChange,
}: {
  theme: PromoHubThemeInputDto;
  onChange: (patch: Partial<PromoHubThemeInputDto>) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Màu chính</Label>
          <div className="flex gap-2">
            <Input
              type="color"
              value={theme.primaryColor ?? "#1d4ed8"}
              onChange={(e) => onChange({ primaryColor: e.target.value })}
              className="w-14 cursor-pointer p-1"
            />
            <Input
              value={theme.primaryColor ?? ""}
              onChange={(e) => onChange({ primaryColor: e.target.value })}
              placeholder="#1d4ed8"
              className="font-mono"
            />
          </div>
        </div>
        <div>
          <Label>Màu phụ</Label>
          <div className="flex gap-2">
            <Input
              type="color"
              value={theme.secondaryColor ?? "#ea580c"}
              onChange={(e) => onChange({ secondaryColor: e.target.value })}
              className="w-14 cursor-pointer p-1"
            />
            <Input
              value={theme.secondaryColor ?? ""}
              onChange={(e) => onChange({ secondaryColor: e.target.value })}
              placeholder="#ea580c"
              className="font-mono"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Font chữ</Label>
          <Input
            value={theme.fontFamily ?? ""}
            onChange={(e) => onChange({ fontFamily: e.target.value })}
            placeholder="Be Vietnam Pro, sans-serif"
          />
        </div>
        <div>
          <Label>Layout</Label>
          <Select
            value={theme.layout ?? "standard"}
            onValueChange={(v) =>
              v && onChange({ layout: v as "standard" | "compact" | "wide" })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="standard">Tiêu chuẩn</SelectItem>
              <SelectItem value="compact">Gọn</SelectItem>
              <SelectItem value="wide">Rộng</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label>Custom CSS</Label>
        <Textarea
          rows={6}
          value={theme.customCss ?? ""}
          onChange={(e) => onChange({ customCss: e.target.value })}
          placeholder="/* CSS sẽ sanitize: strip <script>, event handlers, javascript: URIs */"
          className="font-mono text-xs"
        />
        <p className="mt-1 text-[11px] text-muted-foreground">
          ⚠️ Backend sẽ sanitize CSS — không nhúng JavaScript. Chỉ class selector + property cơ bản.
        </p>
      </div>
    </div>
  );
}

export function SeoConfigurator({
  seo,
  onChange,
}: {
  seo: PromoHubSeoInputDto;
  onChange: (patch: Partial<PromoHubSeoInputDto>) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <Label>Meta Title</Label>
        <Input
          value={seo.metaTitle ?? ""}
          onChange={(e) => onChange({ metaTitle: e.target.value })}
          placeholder="UTMB Việt Nam 2026 — Đăng ký ngay | 5BIB"
          maxLength={70}
        />
        <p className="mt-1 text-[11px] text-muted-foreground">
          {(seo.metaTitle ?? "").length}/70 ký tự (Google ≤60 hiển thị tốt)
        </p>
      </div>

      <div>
        <Label>Meta Description</Label>
        <Textarea
          rows={3}
          value={seo.metaDescription ?? ""}
          onChange={(e) => onChange({ metaDescription: e.target.value })}
          placeholder="Tóm tắt nội dung trang để Google + social link preview hiển thị."
          maxLength={160}
        />
        <p className="mt-1 text-[11px] text-muted-foreground">
          {(seo.metaDescription ?? "").length}/160 ký tự
        </p>
      </div>

      <div>
        <Label>OG Image URL</Label>
        <Input
          value={seo.ogImage ?? ""}
          onChange={(e) => onChange({ ogImage: e.target.value })}
          placeholder="https://… 1200×630 .jpg"
        />
      </div>

      <div>
        <Label>Canonical URL</Label>
        <Input
          value={seo.canonicalUrl ?? ""}
          onChange={(e) => onChange({ canonicalUrl: e.target.value })}
          placeholder="https://5bib.com/hub/<slug>"
        />
      </div>
    </div>
  );
}
