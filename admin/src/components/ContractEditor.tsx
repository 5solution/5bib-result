"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle, FontFamily, FontSize } from "@tiptap/extension-text-style";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import Image from "@tiptap/extension-image";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { uploadEditorImage } from "@/lib/team-api";
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
  PenLine,
  LayoutGrid,
  ImagePlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface VariableGroup {
  label: string;
  items: Array<{ key: string; hint: string }>;
}

/**
 * Canonical list of template variables — MUST mirror
 * backend VALID_VARIABLES in team-contract.service.ts.
 * Grouping is UI-only — backend does not care.
 *
 * Reusable: callers can pass their own `variableGroups` prop (e.g. the
 * schedule-email editor needs extra placeholders like `reporting_time`).
 */
const DEFAULT_VARIABLE_GROUPS: VariableGroup[] = [
  {
    label: "Thông tin cá nhân",
    items: [
      { key: "full_name", hint: "Họ tên đầy đủ" },
      { key: "phone", hint: "Số điện thoại" },
      { key: "email", hint: "Email" },
      { key: "cccd", hint: "Số CCCD" },
      { key: "cccd_number", hint: "Số CCCD (alias — dùng trong mẫu DOCX gốc)" },
      { key: "dob", hint: "Ngày sinh" },
      { key: "birth_date", hint: "Ngày sinh (định dạng DD/MM/YYYY)" },
      { key: "cccd_issue_date", hint: "Ngày cấp CCCD" },
      { key: "cccd_issue_place", hint: "Nơi cấp CCCD" },
      { key: "address", hint: "Địa chỉ thường trú" },
      { key: "bank_account_number", hint: "Số tài khoản ngân hàng" },
      { key: "bank_name", hint: "Tên ngân hàng" },
      { key: "tax_code", hint: "Mã số thuế (= số CCCD với cá nhân)" },
    ],
  },
  {
    label: "Sự kiện",
    items: [
      { key: "event_name", hint: "Tên sự kiện" },
      { key: "event_start_date", hint: "Ngày bắt đầu" },
      { key: "event_end_date", hint: "Ngày kết thúc" },
      { key: "event_location", hint: "Địa điểm" },
    ],
  },
  {
    label: "Vai trò",
    items: [
      { key: "role_name", hint: "Tên vai trò" },
      { key: "daily_rate", hint: "Đơn giá / ngày" },
      { key: "working_days", hint: "Số ngày làm" },
      { key: "total_compensation", hint: "Tổng thù lao" },
    ],
  },
  {
    label: "Hợp đồng",
    items: [
      { key: "signed_date",      hint: "Ngày ký (định dạng chuẩn)" },
      { key: "sign_date",        hint: "Ngày ký (alias — dùng trong mẫu DOCX gốc)" },
      { key: "contract_number",  hint: "Số hợp đồng" },
      { key: "work_content",     hint: "Nội dung công việc (mô tả vai trò)" },
      { key: "work_location",    hint: "Địa điểm làm việc" },
      { key: "work_period",      hint: "Thời gian làm việc (ngày bắt đầu – kết thúc)" },
      { key: "unit_price",       hint: "Đơn giá / ngày (bằng số)" },
      { key: "unit_price_words", hint: "Đơn giá bằng chữ (tiếng Việt)" },
    ],
  },
  {
    label: "Bên A (Pháp nhân ký)",
    items: [
      { key: "party_a_company_name",  hint: "Tên công ty Bên A" },
      { key: "party_a_address",        hint: "Địa chỉ Bên A" },
      { key: "party_a_tax_code",       hint: "Mã số thuế Bên A" },
      { key: "party_a_representative", hint: "Người đại diện Bên A" },
      { key: "party_a_position",       hint: "Chức vụ người đại diện" },
    ],
  },
  {
    label: "Nghiệm thu (Biên bản NT)",
    items: [
      { key: "acceptance_date",        hint: "Ngày nghiệm thu" },
      { key: "acceptance_value",       hint: "Giá trị nghiệm thu (số)" },
      { key: "acceptance_value_words", hint: "Giá trị nghiệm thu bằng chữ" },
      { key: "signature_image",        hint: "Chữ ký Bên B (data URL PNG)" },
    ],
  },
];

export const VALID_VARIABLES: string[] = DEFAULT_VARIABLE_GROUPS.flatMap((g) =>
  g.items.map((i) => i.key),
);

/**
 * Pre-built 2-column signature table for contracts/acceptances.
 * Renders side-by-side Bên A / Bên B signature blocks with spacing
 * for handwritten signatures + placeholder for digital signature image.
 */
export const SIGNATURE_TABLE_HTML = `<table style="width:100%;border-collapse:collapse;margin-top:24pt;">
  <tr>
    <td style="width:50%;text-align:center;vertical-align:top;padding:8pt 12pt;border:none;">
      <p><strong>ĐẠI DIỆN BÊN A</strong></p>
      <p><em>(Ký và ghi rõ họ tên)</em></p>
      <p style="margin-top:72pt;"><strong>{{party_a_representative}}</strong></p>
    </td>
    <td style="width:50%;text-align:center;vertical-align:top;padding:8pt 12pt;border:none;">
      <p><strong>ĐẠI DIỆN BÊN B</strong></p>
      <p><em>(Ký và ghi rõ họ tên)</em></p>
      <img src="{{signature_image}}" alt="Chữ ký Bên B" style="max-width:160px;max-height:80px;" />
      <p><strong>{{full_name}}</strong></p>
    </td>
  </tr>
</table>`;

/** Generate a blank NxM table HTML string. */
function generateBlankTable(rows: number, cols: number): string {
  const tdStyle =
    "border:1px solid #d1d5db;padding:6pt 8pt;min-width:60pt;vertical-align:top;";
  const cells = Array.from({ length: cols }, () => `<td style="${tdStyle}">&nbsp;</td>`).join("\n      ");
  const trs = Array.from(
    { length: rows },
    () => `    <tr>\n      ${cells}\n    </tr>`,
  ).join("\n");
  return `<table style="width:100%;border-collapse:collapse;margin:8pt 0;">\n${trs}\n</table>`;
}

interface ContractEditorProps {
  initialContent: string;
  onChange: (html: string) => void;
  placeholder?: string;
  /**
   * Override the variable picker groups. Defaults to the contract-template
   * variable set. Callers like TeamEmailEditor pass their own 18-variable
   * list for v1.4 schedule emails.
   */
  variableGroups?: VariableGroup[];
}

export default function ContractEditor({
  initialContent,
  onChange,
  placeholder,
  variableGroups,
}: ContractEditorProps): React.ReactElement {
  const groups = variableGroups ?? DEFAULT_VARIABLE_GROUPS;

  // Source HTML toggle — lets admin edit raw HTML directly, preserving
  // <table>, style="text-align:center", font-family, etc. that Tiptap strips.
  const [sourceMode, setSourceMode] = useState(false);
  const [sourceHtml, setSourceHtml] = useState(initialContent);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const editor = useEditor({
    // StarterKit already supplies bold/italic/bullet/ordered/heading/etc.
    // Underline is NOT in StarterKit by default — but user only asked for
    // bold/italic/underline. We implement underline via toggleMark once
    // strike works. Fallback: use <u> via HTML input handled by CSS.
    // To keep deps minimal we register underline via HTML tag: StarterKit
    // v3 includes Underline as part of starter. Confirmed in docs.
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
        placeholder: placeholder ?? "Nhập nội dung hợp đồng...",
      }),
      CharacterCount.configure({ limit: 100000 }),
      // Image extension — required for <img> tags to render in WYSIWYG mode.
      // inline: true lets images sit inside paragraphs (not just between blocks),
      // which is required for insertContent() to succeed at any cursor position.
      // allowBase64: true — needed for {{signature_image}} data URLs.
      Image.configure({ inline: true, allowBase64: true }),
    ],
    content: initialContent,
    // SSR guard — editor must only mount on the client. Parent route
    // already uses next/dynamic ssr:false, this is belt-and-suspenders.
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none min-h-[500px] p-4 focus:outline-none",
      },
    },
  });

  // External prop changes after mount — e.g. DOCX import resets HTML. Only
  // replace content if it genuinely differs to avoid stealing cursor focus.
  // Also sync sourceHtml so the textarea stays current.
  useEffect(() => {
    if (!initialContent) return;
    setSourceHtml(initialContent);
    if (!editor || editor.isDestroyed) return;
    const current = editor.getHTML();
    if (current !== initialContent) {
      editor.commands.setContent(initialContent, { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialContent, editor]);

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
      // Switching source → WYSIWYG: load textarea HTML into Tiptap.
      // NOTE: Tiptap will strip unsupported tags/styles again, but the
      // canonical value (sourceHtml) is what gets saved — not Tiptap's
      // stripped version. onChange is NOT fired here to avoid overwriting
      // the sourceHtml that the parent already received via textarea onChange.
      editor.commands.setContent(sourceHtml, { emitUpdate: false });
      setSourceMode(false);
    } else {
      // Switching WYSIWYG → source: capture current Tiptap HTML so the
      // textarea starts from the editor's state (not a potentially stale prop).
      const current = editor.getHTML();
      setSourceHtml(current);
      setSourceMode(true);
    }
  }

  /**
   * Insert arbitrary HTML (table snippet) into the document.
   * Strategy:
   *  - If already in source mode → splice at textarea cursor position.
   *  - If in WYSIWYG mode → auto-switch to source first (table tags would
   *    be stripped by Tiptap since we don't have the Table extension), then
   *    append the HTML.
   */
  function handleInsertTable(tableHtml: string): void {
    if (!editor || editor.isDestroyed) return;

    if (sourceMode) {
      // Insert at textarea cursor (selectionStart) if available, else append.
      const ta = textareaRef.current;
      const pos = ta?.selectionStart ?? sourceHtml.length;
      const newHtml =
        sourceHtml.slice(0, pos) + "\n" + tableHtml + "\n" + sourceHtml.slice(pos);
      setSourceHtml(newHtml);
      onChange(newHtml);
      // Restore focus + cursor after the inserted snippet.
      setTimeout(() => {
        if (!ta) return;
        ta.focus();
        const end = pos + tableHtml.length + 2;
        ta.setSelectionRange(end, end);
      }, 0);
    } else {
      // Switch to source mode and append the table.
      const current = editor.getHTML();
      const newHtml = current + "\n" + tableHtml + "\n";
      setSourceHtml(newHtml);
      setSourceMode(true);
      onChange(newHtml);
    }
  }

  /**
   * Insert an <img> tag into the document.
   * - WYSIWYG mode: use Tiptap's Image extension command (setImage).
   *   Image is rendered in-editor with CSS max-width.
   * - Source mode: splice <img> HTML at textarea cursor.
   */
  function handleInsertImage(src: string, alt: string): void {
    if (!editor || editor.isDestroyed) return;

    const imgHtml = `<img src="${src}"${alt ? ` alt="${alt}"` : ""} style="max-width:100%;height:auto;" />`;

    if (sourceMode) {
      // Source mode: splice at textarea cursor position.
      const ta = textareaRef.current;
      const pos = ta?.selectionStart ?? sourceHtml.length;
      const newHtml =
        sourceHtml.slice(0, pos) + "\n" + imgHtml + "\n" + sourceHtml.slice(pos);
      setSourceHtml(newHtml);
      onChange(newHtml);
      setTimeout(() => {
        if (!ta) return;
        ta.focus();
        const end = pos + imgHtml.length + 2;
        ta.setSelectionRange(end, end);
      }, 0);
    } else {
      // WYSIWYG mode: insertContent with raw HTML string.
      // We use insertContent (not setImage) so the style attribute is preserved.
      // inline: true on the Image extension lets this succeed at any cursor position.
      // focus() restores the editor's last known selection before inserting.
      editor.chain().focus().insertContent(imgHtml).run();
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
        onInsertImage={handleInsertImage}
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
        /* Text alignment — TextAlign extension injects style attr directly */
        .ProseMirror [style*="text-align: center"] { text-align: center; }
        .ProseMirror [style*="text-align: right"]  { text-align: right; }
        .ProseMirror [style*="text-align: justify"] { text-align: justify; }
        /* Table styles — show tables in WYSIWYG preview (no Table extension,
           so cells are non-editable but at least visible for reference) */
        .ProseMirror table { width: 100%; border-collapse: collapse; margin: 0.75rem 0; }
        .ProseMirror td, .ProseMirror th { border: 1px solid #e5e7eb; padding: 6px 10px; vertical-align: top; }
        /* Image styles — max-width prevents overflow; selected state shows outline */
        .ProseMirror img { max-width: 100%; height: auto; display: block; margin: 0.5rem 0; }
        .ProseMirror img.ProseMirror-selectednode { outline: 2px solid #3b82f6; outline-offset: 2px; }
      `}</style>
      {sourceMode ? (
        <textarea
          ref={textareaRef}
          value={sourceHtml}
          onChange={(e) => {
            setSourceHtml(e.target.value);
            onChange(e.target.value);
          }}
          spellCheck={false}
          className="block min-h-[500px] w-full resize-y p-4 font-mono text-xs leading-relaxed focus:outline-none"
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
            ? "Chế độ HTML — style, table, và mọi thẻ đều được giữ nguyên"
            : "Tip: chèn biến bằng nút \"Chèn biến\" ở trên"}
        </span>
      </div>
    </div>
  );
}

const FONT_FAMILIES = [
  { label: "Mặc định", value: "" },
  { label: "Times New Roman", value: "Times New Roman, Times, serif" },
  { label: "Arial", value: "Arial, Helvetica, sans-serif" },
  { label: "Calibri", value: "Calibri, sans-serif" },
  { label: "Verdana", value: "Verdana, sans-serif" },
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
  { label: "20pt", value: "20pt" },
  { label: "24pt", value: "24pt" },
];

function Toolbar({
  editor,
  groups,
  sourceMode,
  onToggleSource,
  onInsertTable,
  onInsertImage,
}: {
  editor: Editor;
  groups: VariableGroup[];
  sourceMode: boolean;
  onToggleSource: () => void;
  onInsertTable: (html: string) => void;
  onInsertImage: (src: string, alt: string) => void;
}): React.ReactElement {
  const dis = sourceMode;

  // Detect current font/size from selection
  const currentFont =
    editor.getAttributes("textStyle").fontFamily ?? "";
  const currentSize =
    editor.getAttributes("textStyle").fontSize ?? "";

  function setFontFamily(value: string): void {
    if (value) {
      editor.chain().focus().setFontFamily(value).run();
    } else {
      editor.chain().focus().unsetFontFamily().run();
    }
  }

  function setFontSize(value: string): void {
    if (value) {
      editor.chain().focus().setFontSize(value).run();
    } else {
      editor.chain().focus().unsetFontSize().run();
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1 border-b bg-muted/30 px-2 py-1.5">
      {/* Bold / Italic / Underline */}
      <ToolbarButton active={!dis && editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} label="Đậm (Ctrl+B)" disabled={dis}>
        <Bold className="size-4" />
      </ToolbarButton>
      <ToolbarButton active={!dis && editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} label="Nghiêng (Ctrl+I)" disabled={dis}>
        <Italic className="size-4" />
      </ToolbarButton>
      <ToolbarButton active={!dis && editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} label="Gạch chân (Ctrl+U)" disabled={dis}>
        <UnderlineIcon className="size-4" />
      </ToolbarButton>

      <Separator />

      {/* Headings */}
      <ToolbarButton active={!dis && editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} label="Tiêu đề 1" disabled={dis}>
        <Heading1 className="size-4" />
      </ToolbarButton>
      <ToolbarButton active={!dis && editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} label="Tiêu đề 2" disabled={dis}>
        <Heading2 className="size-4" />
      </ToolbarButton>

      <Separator />

      {/* Text alignment */}
      <ToolbarButton active={!dis && editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()} label="Căn trái" disabled={dis}>
        <AlignLeft className="size-4" />
      </ToolbarButton>
      <ToolbarButton active={!dis && editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()} label="Căn giữa" disabled={dis}>
        <AlignCenter className="size-4" />
      </ToolbarButton>
      <ToolbarButton active={!dis && editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()} label="Căn phải" disabled={dis}>
        <AlignRight className="size-4" />
      </ToolbarButton>
      <ToolbarButton active={!dis && editor.isActive({ textAlign: "justify" })} onClick={() => editor.chain().focus().setTextAlign("justify").run()} label="Căn đều" disabled={dis}>
        <AlignJustify className="size-4" />
      </ToolbarButton>

      <Separator />

      {/* Font family */}
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
          <option key={f.value} value={f.value}>{f.label}</option>
        ))}
      </select>

      {/* Font size */}
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
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </select>

      <Separator />

      {/* Lists */}
      <ToolbarButton active={!dis && editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} label="Danh sách ký hiệu" disabled={dis}>
        <List className="size-4" />
      </ToolbarButton>
      <ToolbarButton active={!dis && editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} label="Danh sách số" disabled={dis}>
        <ListOrdered className="size-4" />
      </ToolbarButton>

      <Separator />

      <TableMenu onInsertTable={onInsertTable} />

      <Separator />

      <ImageMenu onInsertImage={onInsertImage} />

      <Separator />

      <VariablePicker editor={editor} groups={groups} disabled={dis} />

      {/* Source HTML toggle */}
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

/**
 * TableMenu — dropdown for inserting table HTML snippets.
 * Clicking any option auto-switches to source mode if needed (via onInsertTable),
 * then splices the HTML at the cursor position.
 */
function TableMenu({
  onInsertTable,
}: {
  onInsertTable: (html: string) => void;
}): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [customRows, setCustomRows] = useState("3");
  const [customCols, setCustomCols] = useState("3");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setShowCustom(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") { setOpen(false); setShowCustom(false); }
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  function insertSignature(): void {
    onInsertTable(SIGNATURE_TABLE_HTML);
    setOpen(false);
  }

  function insertCustom(): void {
    const rows = Math.max(1, Math.min(20, parseInt(customRows) || 3));
    const cols = Math.max(1, Math.min(10, parseInt(customCols) || 3));
    onInsertTable(generateBlankTable(rows, cols));
    setOpen(false);
    setShowCustom(false);
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
        <div className="absolute left-0 top-9 z-50 w-56 rounded-md border bg-popover shadow-lg">
          {/* Option 1: Signature table */}
          <button
            type="button"
            onClick={insertSignature}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
          >
            <PenLine className="size-4 shrink-0 text-muted-foreground" />
            <div>
              <div className="font-medium">Bảng chữ ký (2 cột)</div>
              <div className="text-xs text-muted-foreground">Bên A ← → Bên B</div>
            </div>
          </button>

          <div className="mx-3 my-1 border-t" />

          {/* Option 2: Custom table */}
          {!showCustom ? (
            <button
              type="button"
              onClick={() => setShowCustom(true)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
            >
              <LayoutGrid className="size-4 shrink-0 text-muted-foreground" />
              <div>
                <div className="font-medium">Bảng tùy chỉnh…</div>
                <div className="text-xs text-muted-foreground">Chọn số hàng × cột</div>
              </div>
            </button>
          ) : (
            <div className="p-3">
              <div className="mb-2 text-xs font-semibold text-muted-foreground">Kích thước bảng</div>
              <div className="flex items-center gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">Hàng</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={customRows}
                    onChange={(e) => setCustomRows(e.target.value)}
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
                    value={customCols}
                    onChange={(e) => setCustomCols(e.target.value)}
                    className="h-8 w-16 rounded border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={insertCustom}
                className="mt-2 w-full rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Chèn bảng
              </button>
            </div>
          )}

          <div className="px-3 pb-2 pt-1">
            <p className="text-[10px] text-muted-foreground">
              Bảng sẽ mở chế độ HTML thô để giữ nguyên cấu trúc
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * ImageMenu — toolbar button + popover with two tabs:
 *   - "Từ thiết bị": file picker → upload to S3 → auto-insert
 *   - "Từ URL": paste URL → insert
 */
function ImageMenu({
  onInsertImage,
  disabled,
}: {
  onInsertImage: (src: string, alt: string) => void;
  disabled?: boolean;
}): React.ReactElement {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"upload" | "url">("upload");
  const [src, setSrc] = useState("");
  const [alt, setAlt] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !token) return;
      setUploadError("");
      setUploading(true);
      try {
        const { url } = await uploadEditorImage(token, file);
        onInsertImage(url, file.name.replace(/\.[^.]+$/, ""));
        setOpen(false);
      } catch (err) {
        setUploadError((err as Error).message ?? "Upload thất bại");
      } finally {
        setUploading(false);
        // Reset so the same file can be re-selected
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [token, onInsertImage],
  );

  function handleInsertUrl(): void {
    const trimmed = src.trim();
    if (!trimmed) return;
    onInsertImage(trimmed, alt.trim());
    setSrc("");
    setAlt("");
    setOpen(false);
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
        title="Chèn ảnh"
      >
        <ImagePlus className="size-4" />
        <span className="hidden sm:inline">Ảnh</span>
      </Button>

      {open && (
        <div className="absolute left-0 top-9 z-50 w-72 rounded-md border bg-popover shadow-lg">
          {/* Tabs */}
          <div className="flex border-b text-xs font-medium">
            <button
              type="button"
              onClick={() => setTab("upload")}
              className={cn(
                "flex-1 py-2 hover:bg-accent",
                tab === "upload" && "border-b-2 border-primary text-primary",
              )}
            >
              Từ thiết bị
            </button>
            <button
              type="button"
              onClick={() => setTab("url")}
              className={cn(
                "flex-1 py-2 hover:bg-accent",
                tab === "url" && "border-b-2 border-primary text-primary",
              )}
            >
              Từ URL
            </button>
          </div>

          <div className="p-3">
            {tab === "upload" ? (
              <>
                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => void handleFileChange(e)}
                />
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full flex-col items-center justify-center gap-1.5 rounded-md border-2 border-dashed border-muted-foreground/30 py-6 text-sm hover:border-primary/50 hover:bg-accent disabled:opacity-50"
                >
                  <ImagePlus className="size-6 text-muted-foreground" />
                  <span className="font-medium">
                    {uploading ? "Đang upload..." : "Chọn ảnh từ thiết bị"}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    JPG · PNG · WebP · GIF · tối đa 10MB
                  </span>
                </button>
                {uploadError ? (
                  <p className="mt-2 text-xs text-red-500">{uploadError}</p>
                ) : null}
                <p className="mt-2 text-[10px] text-muted-foreground">
                  Ảnh upload lên S3 — link public, hiển thị được trong email.
                </p>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">
                      URL ảnh <span className="text-red-500">*</span>
                    </label>
                    <input
                      autoFocus
                      type="url"
                      value={src}
                      onChange={(e) => setSrc(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleInsertUrl(); }}
                      placeholder="https://..."
                      className="h-8 w-full rounded border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">
                      Alt text
                    </label>
                    <input
                      type="text"
                      value={alt}
                      onChange={(e) => setAlt(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleInsertUrl(); }}
                      placeholder="Mô tả ngắn..."
                      className="h-8 w-full rounded border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleInsertUrl}
                  disabled={!src.trim()}
                  className="mt-3 w-full rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Chèn ảnh
                </button>
              </>
            )}
          </div>
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
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const filteredGroups = useMemo(() => {
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
    // insertContent serializes a raw string as-is (plain text), keeping
    // the literal "{{key}}" in the HTML — exactly what renderTemplate
    // expects at render time.
    editor.chain().focus().insertContent(`{{${key}}}`).run();
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
          {filteredGroups.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Không tìm thấy biến nào
            </div>
          ) : (
            filteredGroups.map((group) => (
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
                      {"{{" + item.key + "}}"}
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
