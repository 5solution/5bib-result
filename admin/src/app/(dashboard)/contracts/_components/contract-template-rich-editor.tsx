"use client";

/**
 * F-024 UX-39 v2 — Rich text editor cho Contract Templates page.
 *
 * Cloned từ `admin/src/components/ContractEditor.tsx` (Team Management) — Option 2.
 * Lý do KHÔNG reuse trực tiếp:
 *   1. TM dùng `{{key}}` syntax + VALID_VARIABLES (full_name, event_name, …).
 *      F-024 dùng `{varName}` single-brace + nested `{client.entityName}`.
 *   2. TM coupling với `uploadEditorImage` (team-management S3 endpoint).
 *      F-024 không cần image upload trong template editor (template chỉ là text body).
 *   3. TM VariablePicker insert literal `{{key}}` — F-024 cần insert `{key}` /
 *      `{nested.path}`.
 *
 * Differences vs TM:
 *   - Variable insert: `{varName}` không `{{varName}}`.
 *   - Variable list: F-024-specific (client/provider/contract/race/financial).
 *   - KHÔNG image menu (template body không chứa ảnh — chỉ text + placeholder).
 *   - KHÔNG signature table preset (DOCX template lo signature layout, không phải article body).
 */

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle, FontFamily, FontSize } from "@tiptap/extension-text-style";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  ChevronDown,
  Search,
  Code2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Table2,
  LayoutGrid,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// ────────────────────────────────────────────────────────────────────────────
// F-024 Variable groups — mirror docs/F-024-placeholder-spec.md sections 3.1–3.9
// ────────────────────────────────────────────────────────────────────────────

export interface VariableItem {
  key: string;
  hint: string;
}

export interface VariableGroup {
  label: string;
  items: VariableItem[];
}

export const F024_VARIABLE_GROUPS: VariableGroup[] = [
  {
    label: "Đối tác (Bên A)",
    items: [
      { key: "client.entityName", hint: "Tên đối tác" },
      { key: "client.taxId", hint: "MST" },
      { key: "client.representative", hint: "Đại diện" },
      { key: "client.position", hint: "Chức vụ" },
      { key: "client.address", hint: "Địa chỉ" },
      { key: "client.phone", hint: "Số ĐT" },
      { key: "client.email", hint: "Email" },
      { key: "client.bankAccount", hint: "Số TK" },
      { key: "client.bankName", hint: "Ngân hàng" },
    ],
  },
  {
    label: "Provider (Bên B)",
    items: [
      { key: "provider.entityName", hint: "Tên provider" },
      { key: "provider.taxId", hint: "MST provider" },
      { key: "provider.address", hint: "Địa chỉ provider" },
      { key: "provider.representative", hint: "Đại diện provider" },
      { key: "provider.position", hint: "Chức vụ provider" },
      { key: "provider.bankAccount", hint: "Số TK provider" },
      { key: "provider.bankName", hint: "Ngân hàng provider" },
    ],
  },
  {
    label: "Hợp đồng",
    items: [
      { key: "contractNumber", hint: "Số hợp đồng" },
      { key: "signDate", hint: "Ngày ký (DD/MM/YYYY)" },
      { key: "signDay", hint: "Ngày" },
      { key: "signMonth", hint: "Tháng" },
      { key: "signYear", hint: "Năm" },
    ],
  },
  {
    label: "Giải đấu",
    items: [
      { key: "raceName", hint: "Tên giải" },
      { key: "raceDate", hint: "Ngày tổ chức" },
      { key: "raceLocation", hint: "Địa điểm" },
      { key: "athleteCount", hint: "Số VĐV" },
    ],
  },
  {
    label: "Tài chính",
    items: [
      { key: "subtotal", hint: "Cộng (chưa VAT)" },
      { key: "vatRate", hint: "% VAT" },
      { key: "vatAmount", hint: "Tiền VAT" },
      { key: "totalAmount", hint: "Tổng (đã VAT)" },
      { key: "totalAmountInWords", hint: "Số tiền bằng chữ" },
    ],
  },
  {
    label: "Thanh toán",
    items: [
      { key: "paymentTerms.advanceAmount", hint: "Tạm ứng (VND)" },
      { key: "paymentTerms.advancePercentage", hint: "% tạm ứng" },
      { key: "paymentTerms.remainderAmount", hint: "Còn lại (VND)" },
      { key: "paymentTerms.latePenaltyRate", hint: "Tỷ lệ phạt chậm" },
      { key: "paymentTerms.latePenaltyUnit", hint: "Đơn vị phạt (%/ngày)" },
    ],
  },
  {
    label: "Bán vé (TICKET_SALES)",
    items: [
      { key: "ticketFeePercent", hint: "% phí bán vé" },
      { key: "athleteManagementFee", hint: "Phí quản lý / VĐV" },
    ],
  },
];

export const F024_VALID_KEYS: string[] = F024_VARIABLE_GROUPS.flatMap((g) =>
  g.items.map((i) => i.key),
);

// ────────────────────────────────────────────────────────────────────────────
// Conversion helpers — DB stores plain text (with `\n`), editor needs HTML.
// ────────────────────────────────────────────────────────────────────────────

const HTML_ESCAPE_RE = /[&<>"]/g;
const HTML_ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
};

function escapeHtml(s: string): string {
  return s.replace(HTML_ESCAPE_RE, (c) => HTML_ESCAPE_MAP[c] ?? c);
}

/**
 * Plain-text body (default-templates.ts format) → HTML for TipTap.
 *
 * Splits on blank lines → paragraphs. Single newlines → `<br>` within paragraph.
 * Escapes HTML to prevent injection from default text (defensive — defaults
 * are trusted code constants, but client doesn't know that).
 */
export function plainTextToHtml(text: string): string {
  if (!text) return "<p></p>";
  const blocks = text.split(/\n{2,}/).map((block) => {
    const escaped = escapeHtml(block);
    const withBr = escaped.replace(/\n/g, "<br>");
    return `<p>${withBr}</p>`;
  });
  return blocks.join("");
}

/**
 * TipTap HTML → plain text for DB save.
 *
 * Backend DOCX renderer treats `body` as plain text — embedding HTML tags
 * would render literally. So we strip tags, preserving block separation as
 * `\n\n` and inline `<br>` as `\n`.
 *
 * Browser-only: uses DOMParser. Safe to call from "use client".
 */
export function htmlToPlainText(html: string): string {
  if (!html) return "";
  if (typeof window === "undefined") {
    // SSR fallback — strip tags naively (editor onChange only fires client-side).
    return html.replace(/<[^>]+>/g, "").trim();
  }
  const doc = new DOMParser().parseFromString(
    `<!doctype html><body>${html}</body>`,
    "text/html",
  );
  const lines: string[] = [];
  function walk(node: Node): void {
    if (node.nodeType === Node.TEXT_NODE) {
      lines.push(node.textContent ?? "");
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();
    if (tag === "br") {
      lines.push("\n");
      return;
    }
    const blockTags = new Set([
      "p",
      "div",
      "li",
      "h1",
      "h2",
      "h3",
      "h4",
      "tr",
      "blockquote",
    ]);
    el.childNodes.forEach(walk);
    if (blockTags.has(tag)) lines.push("\n");
    if (tag === "p" || tag === "div" || tag === "h1" || tag === "h2") {
      lines.push("\n");
    }
  }
  doc.body.childNodes.forEach(walk);
  return lines
    .join("")
    .replace(/ /g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ────────────────────────────────────────────────────────────────────────────
// ContractTemplateRichEditor — main component
// ────────────────────────────────────────────────────────────────────────────

interface ContractTemplateRichEditorProps {
  /** Plain-text initial content (from default-templates or DB override). */
  initialContent: string;
  /** Fired with plain-text body (already converted from TipTap HTML). */
  onChange: (plainText: string) => void;
  placeholder?: string;
  variableGroups?: VariableGroup[];
  /**
   * External reset signal — when this changes, editor resets content from
   * `initialContent` (used by "Hoàn tác Điều này" + "Reset toàn bộ" buttons).
   */
  resetSignal?: number;
}

export default function ContractTemplateRichEditor({
  initialContent,
  onChange,
  placeholder,
  variableGroups,
  resetSignal,
}: ContractTemplateRichEditorProps): React.ReactElement {
  const groups = variableGroups ?? F024_VARIABLE_GROUPS;

  // Source HTML toggle — admin can edit raw HTML (table tags, custom style).
  const [sourceMode, setSourceMode] = useState(false);
  const [sourceHtml, setSourceHtml] = useState(() =>
    plainTextToHtml(initialContent),
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Track when we trigger our own setContent to avoid feedback loops in onUpdate.
  const isResettingRef = useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({}),
      TextAlign.configure({
        types: ["heading", "paragraph"],
        defaultAlignment: "left",
      }),
      TextStyle,
      FontFamily,
      FontSize,
      Placeholder.configure({
        placeholder: placeholder ?? "Nhập nội dung điều khoản...",
      }),
      CharacterCount.configure({ limit: 100000 }),
    ],
    content: plainTextToHtml(initialContent),
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      if (isResettingRef.current) return;
      onChange(htmlToPlainText(editor.getHTML()));
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none min-h-[300px] p-4 focus:outline-none",
      },
    },
  });

  // Reset signal — external "Hoàn tác" button triggers content reload.
  useEffect(() => {
    if (resetSignal === undefined) return;
    if (!editor || editor.isDestroyed) return;
    const html = plainTextToHtml(initialContent);
    isResettingRef.current = true;
    editor.commands.setContent(html, { emitUpdate: false });
    setSourceHtml(html);
    isResettingRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetSignal]);

  if (!editor) {
    return (
      <div className="rounded-md border bg-muted/20 p-8 text-sm text-muted-foreground">
        Đang tải trình soạn thảo...
      </div>
    );
  }

  function toggleSourceMode(): void {
    if (!editor || editor.isDestroyed) return;
    if (sourceMode) {
      isResettingRef.current = true;
      editor.commands.setContent(sourceHtml, { emitUpdate: false });
      isResettingRef.current = false;
      setSourceMode(false);
      onChange(htmlToPlainText(sourceHtml));
    } else {
      const current = editor.getHTML();
      setSourceHtml(current);
      setSourceMode(true);
    }
  }

  function handleInsertTable(rows: number, cols: number): void {
    if (!editor || editor.isDestroyed) return;
    const tdStyle =
      "border:1px solid #d1d5db;padding:6pt 8pt;min-width:60pt;vertical-align:top;";
    const cells = Array.from(
      { length: cols },
      () => `<td style="${tdStyle}">&nbsp;</td>`,
    ).join("");
    const trs = Array.from(
      { length: rows },
      () => `<tr>${cells}</tr>`,
    ).join("");
    const tableHtml = `<table style="width:100%;border-collapse:collapse;margin:8pt 0;">${trs}</table>`;
    if (sourceMode) {
      const ta = textareaRef.current;
      const pos = ta?.selectionStart ?? sourceHtml.length;
      const newHtml =
        sourceHtml.slice(0, pos) +
        "\n" +
        tableHtml +
        "\n" +
        sourceHtml.slice(pos);
      setSourceHtml(newHtml);
      onChange(htmlToPlainText(newHtml));
    } else {
      const current = editor.getHTML();
      const newHtml = current + "\n" + tableHtml + "\n";
      setSourceHtml(newHtml);
      setSourceMode(true);
      onChange(htmlToPlainText(newHtml));
    }
  }

  return (
    <div className="rounded-md border bg-background">
      <Toolbar
        editor={editor}
        groups={groups}
        sourceMode={sourceMode}
        onToggleSource={toggleSourceMode}
        onInsertTable={handleInsertTable}
      />
      <style jsx global>{`
        .ProseMirror h1 { font-size: 1.5rem; font-weight: 700; margin-top: 0.75rem; margin-bottom: 0.5rem; }
        .ProseMirror h2 { font-size: 1.25rem; font-weight: 700; margin-top: 0.75rem; margin-bottom: 0.5rem; }
        .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: #9ca3af;
          pointer-events: none;
          height: 0;
        }
        .ProseMirror ul { list-style: disc; padding-left: 1.5rem; }
        .ProseMirror ol { list-style: decimal; padding-left: 1.5rem; }
        .ProseMirror { outline: none; }
        .ProseMirror [style*="text-align: center"] { text-align: center; }
        .ProseMirror [style*="text-align: right"]  { text-align: right; }
        .ProseMirror [style*="text-align: justify"] { text-align: justify; }
        .ProseMirror table { width: 100%; border-collapse: collapse; margin: 0.75rem 0; }
        .ProseMirror td, .ProseMirror th { border: 1px solid #e5e7eb; padding: 6px 10px; vertical-align: top; }
      `}</style>
      {sourceMode ? (
        <textarea
          ref={textareaRef}
          value={sourceHtml}
          onChange={(e) => {
            setSourceHtml(e.target.value);
            onChange(htmlToPlainText(e.target.value));
          }}
          spellCheck={false}
          className="block min-h-[300px] w-full resize-y p-4 font-mono text-xs leading-relaxed focus:outline-none"
          placeholder="Nhập HTML thô..."
        />
      ) : (
        <EditorContent editor={editor} />
      )}
      <div className="flex items-center justify-between border-t px-4 py-1.5 text-xs text-muted-foreground">
        {sourceMode ? (
          <span>{sourceHtml.length} ký tự (HTML thô)</span>
        ) : (
          <span>
            {editor.storage.characterCount.characters()} ký tự ·{" "}
            {editor.storage.characterCount.words()} từ
          </span>
        )}
        <span className="text-muted-foreground/70">
          {sourceMode
            ? "Chế độ HTML — table, style tags được giữ nguyên"
            : "Tip: chèn placeholder bằng nút \"Chèn biến\" ở trên"}
        </span>
      </div>
    </div>
  );
}

const FONT_FAMILIES = [
  { label: "Mặc định", value: "" },
  { label: "Times New Roman", value: "Times New Roman, Times, serif" },
  { label: "Arial", value: "Arial, Helvetica, sans-serif" },
  { label: "Tahoma", value: "Tahoma, sans-serif" },
];

const FONT_SIZES = [
  { label: "Mặc định", value: "" },
  { label: "10pt", value: "10pt" },
  { label: "11pt", value: "11pt" },
  { label: "12pt", value: "12pt" },
  { label: "13pt", value: "13pt" },
  { label: "14pt", value: "14pt" },
  { label: "16pt", value: "16pt" },
  { label: "18pt", value: "18pt" },
];

function Toolbar({
  editor,
  groups,
  sourceMode,
  onToggleSource,
  onInsertTable,
}: {
  editor: Editor;
  groups: VariableGroup[];
  sourceMode: boolean;
  onToggleSource: () => void;
  onInsertTable: (rows: number, cols: number) => void;
}): React.ReactElement {
  const dis = sourceMode;
  const currentFont = editor.getAttributes("textStyle").fontFamily ?? "";
  const currentSize = editor.getAttributes("textStyle").fontSize ?? "";

  function setFontFamily(value: string): void {
    if (value) editor.chain().focus().setFontFamily(value).run();
    else editor.chain().focus().unsetFontFamily().run();
  }
  function setFontSize(value: string): void {
    if (value) editor.chain().focus().setFontSize(value).run();
    else editor.chain().focus().unsetFontSize().run();
  }

  return (
    <div className="flex flex-wrap items-center gap-1 border-b bg-muted/30 px-2 py-1.5">
      <ToolbarButton
        active={!dis && editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
        label="Đậm (Ctrl+B)"
        disabled={dis}
      >
        <Bold className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        active={!dis && editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        label="Nghiêng (Ctrl+I)"
        disabled={dis}
      >
        <Italic className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        active={!dis && editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        label="Gạch chân (Ctrl+U)"
        disabled={dis}
      >
        <UnderlineIcon className="size-4" />
      </ToolbarButton>

      <Separator />

      <ToolbarButton
        active={!dis && editor.isActive("heading", { level: 1 })}
        onClick={() =>
          editor.chain().focus().toggleHeading({ level: 1 }).run()
        }
        label="Tiêu đề 1"
        disabled={dis}
      >
        <Heading1 className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        active={!dis && editor.isActive("heading", { level: 2 })}
        onClick={() =>
          editor.chain().focus().toggleHeading({ level: 2 }).run()
        }
        label="Tiêu đề 2"
        disabled={dis}
      >
        <Heading2 className="size-4" />
      </ToolbarButton>

      <Separator />

      <ToolbarButton
        active={!dis && editor.isActive({ textAlign: "left" })}
        onClick={() => editor.chain().focus().setTextAlign("left").run()}
        label="Căn trái"
        disabled={dis}
      >
        <AlignLeft className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        active={!dis && editor.isActive({ textAlign: "center" })}
        onClick={() => editor.chain().focus().setTextAlign("center").run()}
        label="Căn giữa"
        disabled={dis}
      >
        <AlignCenter className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        active={!dis && editor.isActive({ textAlign: "right" })}
        onClick={() => editor.chain().focus().setTextAlign("right").run()}
        label="Căn phải"
        disabled={dis}
      >
        <AlignRight className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        active={!dis && editor.isActive({ textAlign: "justify" })}
        onClick={() => editor.chain().focus().setTextAlign("justify").run()}
        label="Căn đều"
        disabled={dis}
      >
        <AlignJustify className="size-4" />
      </ToolbarButton>

      <Separator />

      <select
        disabled={dis}
        value={currentFont}
        onChange={(e) => setFontFamily(e.target.value)}
        title="Font chữ"
        className={cn(
          "h-8 rounded border border-input bg-background px-1.5 text-xs focus:outline-none",
          dis && "pointer-events-none opacity-40",
        )}
      >
        {FONT_FAMILIES.map((f) => (
          <option key={f.value} value={f.value}>
            {f.label}
          </option>
        ))}
      </select>

      <select
        disabled={dis}
        value={currentSize}
        onChange={(e) => setFontSize(e.target.value)}
        title="Cỡ chữ"
        className={cn(
          "h-8 w-20 rounded border border-input bg-background px-1.5 text-xs focus:outline-none",
          dis && "pointer-events-none opacity-40",
        )}
      >
        {FONT_SIZES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>

      <Separator />

      <ToolbarButton
        active={!dis && editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        label="Danh sách bullet"
        disabled={dis}
      >
        <List className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        active={!dis && editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        label="Danh sách số"
        disabled={dis}
      >
        <ListOrdered className="size-4" />
      </ToolbarButton>

      <Separator />

      <TableMenu onInsertTable={onInsertTable} />

      <Separator />

      <VariablePicker editor={editor} groups={groups} disabled={dis} />

      <div className="ml-auto">
        <ToolbarButton
          active={sourceMode}
          onClick={onToggleSource}
          label={sourceMode ? "Chuyển về WYSIWYG" : "Chỉnh sửa HTML thô"}
        >
          <Code2 className="size-4" />
        </ToolbarButton>
      </div>
    </div>
  );
}

function ToolbarButton({
  active,
  onClick,
  label,
  disabled,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  disabled?: boolean;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded hover:bg-accent",
        active && "bg-accent text-accent-foreground",
        disabled && "pointer-events-none opacity-40",
      )}
    >
      {children}
    </button>
  );
}

function Separator(): React.ReactElement {
  return <span className="mx-1 inline-block h-5 w-px bg-border" />;
}

function TableMenu({
  onInsertTable,
}: {
  onInsertTable: (rows: number, cols: number) => void;
}): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState("3");
  const [cols, setCols] = useState("3");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function insert(): void {
    const r = Math.max(1, Math.min(20, parseInt(rows, 10) || 3));
    const c = Math.max(1, Math.min(10, parseInt(cols, 10) || 3));
    onInsertTable(r, c);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        className="h-8 gap-1"
        title="Chèn bảng"
      >
        <Table2 className="size-4" />
        <span className="hidden sm:inline">Bảng</span>
        <ChevronDown className="size-3" />
      </Button>
      {open && (
        <div className="absolute left-0 top-9 z-50 w-56 rounded-md border bg-popover p-3 shadow-lg">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <LayoutGrid className="size-3.5" />
            Kích thước bảng
          </div>
          <div className="flex items-center gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Hàng</label>
              <input
                type="number"
                min={1}
                max={20}
                value={rows}
                onChange={(e) => setRows(e.target.value)}
                className="h-8 w-16 rounded border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1"
              />
            </div>
            <span className="mt-4 text-muted-foreground">×</span>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Cột</label>
              <input
                type="number"
                min={1}
                max={10}
                value={cols}
                onChange={(e) => setCols(e.target.value)}
                className="h-8 w-16 rounded border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={insert}
            className="mt-2 w-full rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Chèn bảng
          </button>
          <p className="mt-2 text-[10px] text-muted-foreground">
            Bảng mở chế độ HTML thô để giữ cấu trúc
          </p>
        </div>
      )}
    </div>
  );
}

function VariablePicker({
  editor,
  groups,
  disabled,
}: {
  editor: Editor;
  groups: VariableGroup[];
  disabled?: boolean;
}): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map((g) => ({
        ...g,
        items: g.items.filter(
          (it) =>
            it.key.toLowerCase().includes(q) ||
            it.hint.toLowerCase().includes(q),
        ),
      }))
      .filter((g) => g.items.length > 0);
  }, [query, groups]);

  function insert(key: string): void {
    // F-024 syntax: single-brace `{key}` (NOT `{{key}}` like TM).
    editor.chain().focus().insertContent(`{${key}}`).run();
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={containerRef} className="relative">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        className="h-8 gap-1"
      >
        Chèn biến <ChevronDown className="size-3" />
      </Button>
      {open && (
        <div className="absolute right-0 top-9 z-50 max-h-[420px] w-80 overflow-y-auto rounded-md border bg-popover shadow-lg">
          <div className="sticky top-0 border-b bg-popover p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm biến..."
                className="h-8 pl-7"
              />
            </div>
          </div>
          {filtered.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Không tìm thấy biến nào
            </div>
          ) : (
            filtered.map((group) => (
              <div key={group.label} className="p-1">
                <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.label}
                </div>
                {group.items.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => insert(item.key)}
                    className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
                  >
                    <code className="font-mono text-xs text-primary">
                      {"{" + item.key + "}"}
                    </code>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {item.hint}
                    </span>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
