"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
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
      { key: "dob", hint: "Ngày sinh" },
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
    label: "Khác",
    items: [{ key: "signed_date", hint: "Ngày ký" }],
  },
];

export const VALID_VARIABLES: string[] = DEFAULT_VARIABLE_GROUPS.flatMap((g) =>
  g.items.map((i) => i.key),
);

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
  const editor = useEditor({
    // StarterKit already supplies bold/italic/bullet/ordered/heading/etc.
    // Underline is NOT in StarterKit by default — but user only asked for
    // bold/italic/underline. We implement underline via toggleMark once
    // strike works. Fallback: use <u> via HTML input handled by CSS.
    // To keep deps minimal we register underline via HTML tag: StarterKit
    // v3 includes Underline as part of starter. Confirmed in docs.
    extensions: [
      StarterKit.configure({
        // Let our own Placeholder extension handle empty-state text.
        // Underline is included in StarterKit v3.
      }),
      Placeholder.configure({
        placeholder: placeholder ?? "Nhập nội dung hợp đồng...",
      }),
      CharacterCount.configure({ limit: 100000 }),
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
  useEffect(() => {
    if (!editor) return;
    if (editor.isDestroyed) return;
    const current = editor.getHTML();
    if (current !== initialContent && initialContent) {
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

  return (
    <div className="rounded-md border bg-background">
      <Toolbar editor={editor} groups={groups} />
      <style jsx global>{`
        /* Highlight {{vars}} that are NOT in the canonical list in red.
           Tiptap doesn't give us DOM hooks on plain text, so we style via
           a CSS attribute selector on rendered spans added by the post-
           process step in ContractPreview. Inside the editor we can't
           easily decorate plain text without a custom extension — so we
           rely on the preview to surface typos. Trade-off: acceptable for
           v1.4. */
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
      `}</style>
      <EditorContent editor={editor} />
      <div className="flex items-center justify-between border-t px-4 py-1.5 text-xs text-muted-foreground">
        <span>
          {editor.storage.characterCount.characters()} ký tự ·{" "}
          {editor.storage.characterCount.words()} từ
        </span>
        <span className="text-muted-foreground/70">
          Tip: chèn biến bằng nút &ldquo;Chèn biến&rdquo; ở trên
        </span>
      </div>
    </div>
  );
}

function Toolbar({
  editor,
  groups,
}: {
  editor: Editor;
  groups: VariableGroup[];
}): React.ReactElement {
  return (
    <div className="flex flex-wrap items-center gap-1 border-b bg-muted/30 px-2 py-1.5">
      <ToolbarButton
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
        label="Đậm (Ctrl+B)"
      >
        <Bold className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        label="Nghiêng (Ctrl+I)"
      >
        <Italic className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        label="Gạch chân (Ctrl+U)"
      >
        <UnderlineIcon className="size-4" />
      </ToolbarButton>
      <Separator />
      <ToolbarButton
        active={editor.isActive("heading", { level: 1 })}
        onClick={() =>
          editor.chain().focus().toggleHeading({ level: 1 }).run()
        }
        label="Tiêu đề 1"
      >
        <Heading1 className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("heading", { level: 2 })}
        onClick={() =>
          editor.chain().focus().toggleHeading({ level: 2 }).run()
        }
        label="Tiêu đề 2"
      >
        <Heading2 className="size-4" />
      </ToolbarButton>
      <Separator />
      <ToolbarButton
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        label="Danh sách ký hiệu"
      >
        <List className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        label="Danh sách số"
      >
        <ListOrdered className="size-4" />
      </ToolbarButton>
      <Separator />
      <VariablePicker editor={editor} groups={groups} />
    </div>
  );
}

function ToolbarButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded hover:bg-accent",
        active && "bg-accent text-accent-foreground",
      )}
    >
      {children}
    </button>
  );
}

function Separator(): React.ReactElement {
  return <span className="mx-1 inline-block h-5 w-px bg-border" />;
}

function VariablePicker({
  editor,
  groups,
}: {
  editor: Editor;
  groups: VariableGroup[];
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
        onClick={() => setOpen((v) => !v)}
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
