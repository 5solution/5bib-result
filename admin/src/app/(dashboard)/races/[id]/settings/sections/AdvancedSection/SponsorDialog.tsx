'use client';

/**
 * F-014 — Sponsor add/edit dialog (6 fields).
 *
 * Verbatim port of legacy sponsor dialog (lines 1617–1664).
 *   - name (required)
 *   - logoUrl (required, ImageUpload composite)
 *   - website (optional)
 *   - level (silver/gold/diamond — default silver)
 *   - order (number, default 0)
 *
 * Note legacy used `<Select items=…>` prop which isn't standard shadcn.
 * F-014 normalized to `<SelectContent>` children form (BR-AS-46 cleanup).
 */

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import ImageUpload from '@/components/ImageUpload';

export interface SponsorFormState {
  name: string;
  logoUrl: string;
  website: string;
  level: string;
  order: number;
}

interface SponsorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isEdit: boolean;
  form: SponsorFormState;
  setForm: (next: SponsorFormState) => void;
  saving: boolean;
  onSave: () => Promise<void> | void;
}

export function SponsorDialog(props: SponsorDialogProps) {
  const { open, onOpenChange, isEdit, form, setForm, saving, onSave } = props;
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onOpenChange(false);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Sửa nhà tài trợ' : 'Thêm nhà tài trợ'}
          </DialogTitle>
          <DialogDescription>
            Logo sẽ hiển thị ở bảng xếp hạng giải đấu
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-4">
          <div className="flex flex-col gap-2">
            <Label>Tên nhà tài trợ *</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="VD: Adidas Vietnam"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Logo URL *</Label>
            <ImageUpload
              value={form.logoUrl}
              onChange={(url) => setForm({ ...form, logoUrl: url })}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Website</Label>
            <Input
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
              placeholder="https://..."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label>Cấp độ</Label>
              <Select
                value={form.level}
                onValueChange={(v) => setForm({ ...form, level: v ?? 'silver' })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="diamond">Kim cương</SelectItem>
                  <SelectItem value="gold">Vàng</SelectItem>
                  <SelectItem value="silver">Bạc</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Thứ tự</Label>
              <Input
                type="number"
                value={form.order}
                onChange={(e) =>
                  setForm({
                    ...form,
                    order: parseInt(e.target.value) || 0,
                  })
                }
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button
            onClick={onSave}
            disabled={saving || !form.name || !form.logoUrl}
            data-testid="sponsor-save"
          >
            {saving ? 'Đang lưu...' : 'Lưu'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default SponsorDialog;
