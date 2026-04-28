"use client";

import { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Link as LinkIcon,
  List,
  ListOrdered,
  Quote,
  Code2,
  Image as ImageIconLucide,
} from "lucide-react";

interface ArticleEditorProps {
  initialContent: string;
  onChange: (html: string) => void;
  onPickImage: () => Promise<string | null>;
}

export function ArticleEditor({
  initialContent,
  onChange,
  onPickImage,
}: ArticleEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Image.configure({ inline: false, allowBase64: false }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      }),
      Placeholder.configure({
        placeholder: 'Bắt đầu viết… Gõ "/" để chèn block.',
      }),
      CharacterCount,
    ],
    content: initialContent || "",
    editorProps: {
      attributes: {
        class:
          "prose prose-stone max-w-none min-h-[400px] focus:outline-none prose-headings:font-[var(--font-heading)] prose-headings:tracking-tight prose-h2:text-2xl prose-h2:font-bold prose-h2:mt-10 prose-h2:mb-3 prose-h3:text-xl prose-h3:mt-6 prose-h3:mb-2 prose-p:text-base prose-p:leading-[1.78] prose-img:rounded-xl prose-img:border prose-img:my-6 prose-a:text-[var(--primary)] prose-a:underline prose-a:underline-offset-2",
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  // Re-set content when initialContent changes (e.g., after async load)
  useEffect(() => {
    if (editor && initialContent && editor.isEmpty) {
      editor.commands.setContent(initialContent, { emitUpdate: false });
    }
  }, [editor, initialContent]);

  const insertImage = async () => {
    if (!editor) return;
    const url = await onPickImage();
    if (url) editor.chain().focus().setImage({ src: url }).run();
  };

  const setLink = () => {
    if (!editor) return;
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL link:", prev ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    }
  };

  if (!editor) {
    return <div className="h-96 animate-pulse rounded-lg bg-muted" />;
  }

  const wordCount = editor.storage.characterCount.words();
  const readMin = Math.max(1, Math.ceil(wordCount / 200));

  return (
    <div className="flex flex-col">
      {/* Toolbar */}
      <div className="sticky top-[60px] z-10 -mx-1 mb-4 flex flex-wrap items-center gap-1 rounded-lg border bg-muted/50 p-1.5 backdrop-blur">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          active={editor.isActive("heading", { level: 1 })}
          label="Heading 1"
        >
          <span className="font-serif text-sm font-extrabold">H1</span>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive("heading", { level: 2 })}
          label="Heading 2"
        >
          <span className="font-serif text-sm font-bold">H2</span>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor.isActive("heading", { level: 3 })}
          label="Heading 3"
        >
          <span className="font-serif text-xs font-bold">H3</span>
        </ToolbarButton>
        <Sep />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive("bold")}
          label="Bold"
        >
          <Bold className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive("italic")}
          label="Italic"
        >
          <Italic className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          active={editor.isActive("strike")}
          label="Strike"
        >
          <Strikethrough className="size-3.5" />
        </ToolbarButton>
        <Sep />
        <ToolbarButton onClick={setLink} active={editor.isActive("link")} label="Link">
          <LinkIcon className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive("bulletList")}
          label="Bullet list"
        >
          <List className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive("orderedList")}
          label="Ordered list"
        >
          <ListOrdered className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive("blockquote")}
          label="Quote"
        >
          <Quote className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          active={editor.isActive("codeBlock")}
          label="Code"
        >
          <Code2 className="size-3.5" />
        </ToolbarButton>
        <Sep />
        <ToolbarButton onClick={insertImage} label="Image">
          <ImageIconLucide className="size-3.5" />
        </ToolbarButton>

        <span className="ml-auto px-2 font-mono text-[11px] text-muted-foreground">
          {wordCount} từ · ~{readMin} phút đọc
        </span>
      </div>

      <EditorContent editor={editor} />
    </div>
  );
}

function ToolbarButton({
  children,
  onClick,
  active,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`grid h-8 min-w-8 place-items-center rounded-md px-2 text-foreground transition-colors ${
        active ? "bg-card shadow-sm" : "hover:bg-card hover:shadow-sm"
      }`}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <span aria-hidden className="mx-0.5 h-4 w-px bg-border" />;
}
