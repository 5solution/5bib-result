'use client'
import { createContext, useCallback, useContext, useRef, useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface PromptOptions {
  title: string
  description?: string
  placeholder?: string
  defaultValue?: string
  inputType?: 'text' | 'email'
  confirmText?: string
  cancelText?: string
  /** true = field is required — OK disabled until non-empty */
  required?: boolean
}

const PromptContext = createContext<(opts: PromptOptions) => Promise<string | null>>(
  async () => null,
)

export function PromptProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [opts, setOpts] = useState<PromptOptions>({ title: '' })
  const [value, setValue] = useState('')
  const resolveRef = useRef<(v: string | null) => void>(() => {})
  const inputRef = useRef<HTMLInputElement>(null)

  const prompt = useCallback((options: PromptOptions): Promise<string | null> => {
    setOpts(options)
    setValue(options.defaultValue ?? '')
    setOpen(true)
    return new Promise<string | null>((resolve) => {
      resolveRef.current = resolve
    })
  }, [])

  // Auto-focus the input when dialog opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  function handleConfirm() {
    resolveRef.current(value)
    setOpen(false)
  }

  function handleCancel() {
    resolveRef.current(null)
    setOpen(false)
  }

  const canConfirm = !opts.required || value.trim().length > 0

  return (
    <PromptContext.Provider value={prompt}>
      {children}
      <Dialog open={open} onOpenChange={(v) => { if (!v) handleCancel() }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{opts.title}</DialogTitle>
          </DialogHeader>

          <div className="space-y-2 py-2">
            {opts.description ? (
              <p className="text-sm text-muted-foreground">{opts.description}</p>
            ) : null}
            <Label className="sr-only">{opts.title}</Label>
            <Input
              ref={inputRef}
              type={opts.inputType ?? 'text'}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={opts.placeholder ?? ''}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canConfirm) handleConfirm()
                if (e.key === 'Escape') handleCancel()
              }}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCancel}>
              {opts.cancelText ?? 'Hủy'}
            </Button>
            <Button onClick={handleConfirm} disabled={!canConfirm}>
              {opts.confirmText ?? 'OK'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PromptContext.Provider>
  )
}

export function usePrompt() {
  return useContext(PromptContext)
}
