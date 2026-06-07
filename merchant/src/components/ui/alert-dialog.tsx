"use client"

/**
 * AlertDialog — thin wrapper around Dialog that exposes the Radix-compatible
 * AlertDialog API surface used by confirm-dialog.tsx.
 * Built on top of the existing @base-ui/react Dialog primitive.
 */

import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// Root — same API as Radix AlertDialog.Root
function AlertDialog({
  open,
  onOpenChange,
  children,
}: {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children?: React.ReactNode
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {children}
    </Dialog>
  )
}

// Content — no close-X button (alert dialogs should be intentionally dismissed)
function AlertDialogContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DialogContent>) {
  return (
    <DialogContent showCloseButton={false} className={cn(className)} {...props}>
      {children}
    </DialogContent>
  )
}

const AlertDialogHeader = DialogHeader
const AlertDialogFooter = DialogFooter
const AlertDialogTitle = DialogTitle
const AlertDialogDescription = DialogDescription

// Action — primary button (confirm)
function AlertDialogAction({
  className,
  children,
  onClick,
  ...props
}: React.ComponentProps<"button">) {
  return (
    <Button
      className={cn(className)}
      onClick={onClick}
      {...props}
    >
      {children}
    </Button>
  )
}

// Cancel — outline button
function AlertDialogCancel({
  className,
  children,
  onClick,
  ...props
}: React.ComponentProps<"button">) {
  return (
    <Button
      variant="outline"
      className={cn(className)}
      onClick={onClick}
      {...props}
    >
      {children}
    </Button>
  )
}

export {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
}
