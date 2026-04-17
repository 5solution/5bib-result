"use client";

/**
 * Imperative confirmation dialog — thay thế cho `window.confirm()`.
 *
 * Dùng:
 *   const confirm = useConfirm();
 *   if (!(await confirm({ title: "Xoá?", description: "..." }))) return;
 *
 * Root app cần wrap với <ConfirmProvider>.
 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface ConfirmOptions {
  title?: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** "destructive" = button đỏ; "default" = button xanh mặc định */
  variant?: "default" | "destructive";
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmCtx = createContext<ConfirmFn | null>(null);

export function useConfirm(): ConfirmFn {
  const fn = useContext(ConfirmCtx);
  if (!fn) {
    throw new Error(
      "useConfirm() phải được gọi trong <ConfirmProvider>. Bọc app root."
    );
  }
  return fn;
}

interface PendingState {
  options: ConfirmOptions;
  resolve: (result: boolean) => void;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingState | null>(null);
  // Stable ref so the exposed fn identity never changes.
  const pendingRef = useRef<PendingState | null>(null);
  pendingRef.current = pending;

  const confirm = useCallback<ConfirmFn>(
    (options) =>
      new Promise<boolean>((resolve) => {
        setPending({ options, resolve });
      }),
    []
  );

  const resolveAndClose = useCallback((result: boolean) => {
    const current = pendingRef.current;
    if (current) current.resolve(result);
    setPending(null);
  }, []);

  const value = useMemo(() => confirm, [confirm]);

  const opts = pending?.options;
  const variant = opts?.variant ?? "default";

  return (
    <ConfirmCtx.Provider value={value}>
      {children}
      <Dialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) resolveAndClose(false);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{opts?.title ?? "Xác nhận"}</DialogTitle>
          </DialogHeader>
          {opts?.description && (
            <div className="py-2 text-sm text-muted-foreground">
              {opts.description}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => resolveAndClose(false)}
            >
              {opts?.cancelLabel ?? "Hủy"}
            </Button>
            <Button
              variant={variant === "destructive" ? "destructive" : "default"}
              onClick={() => resolveAndClose(true)}
              autoFocus
            >
              {opts?.confirmLabel ?? "OK"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfirmCtx.Provider>
  );
}
