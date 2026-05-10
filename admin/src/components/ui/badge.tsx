import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Badge variants — FEATURE-022 BR-DESIGN-14.
 *
 * Default + 6 status pill tones (gray/blue/green/amber/red/violet) + dark.
 * KHONG doi API — variants giu nguyen ten cu (default/secondary/destructive/outline/
 * ghost/link) + them 7 tones moi.
 *
 * Padding tang nhe (px-2 py-0.5 → px-2.5 py-0.5) cho readable hon.
 */
const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2.5 py-0.5 text-[11px] font-bold whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
        secondary:
          "bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80",
        destructive:
          "bg-[var(--admin-danger-bg)] text-[var(--admin-danger)] border-[#FCA5A5] [a]:hover:bg-[var(--admin-danger-bg)]/80",
        outline:
          "border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",
        ghost:
          "hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
        link: "text-primary underline-offset-4 hover:underline",
        // FEATURE-022 BR-DESIGN-14 — 6 status pill tones.
        gray:
          "bg-[#F3F4F6] text-[#6B7280] border-[#D1D5DB]",
        blue:
          "bg-[var(--admin-blue-50)] text-[var(--admin-blue)] border-[var(--admin-blue-100)]",
        green:
          "bg-[var(--admin-success-bg)] text-[var(--admin-success)] border-[#86EFAC]",
        amber:
          "bg-[var(--admin-warning-bg)] text-[var(--admin-warning)] border-[#FCD34D]",
        red:
          "bg-[var(--admin-danger-bg)] text-[var(--admin-danger)] border-[#FCA5A5]",
        violet:
          "bg-[var(--admin-violet-bg)] text-[var(--admin-violet)] border-[#C4B5FD]",
        dark:
          "bg-[#1C1917] text-white border-[#1C1917]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
