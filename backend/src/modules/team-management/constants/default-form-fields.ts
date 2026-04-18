import type { FormFieldConfig } from '../entities/vol-role.entity';
import { VN_BANKS } from './banks';

/**
 * Default `form_fields` for roles created via the import flow. Mirrors
 * admin/src/lib/team-api.ts → `DEFAULT_FORM_FIELDS`. Kept in sync with
 * migrations 001 / 003 / 006 so new roles have the same field shape as
 * backfilled existing roles.
 */
export const DEFAULT_FORM_FIELDS: FormFieldConfig[] = [
  { key: 'cccd', label: 'Số CCCD/CMND', type: 'text', required: true },
  { key: 'dob', label: 'Ngày sinh', type: 'date', required: true },
  {
    key: 'shirt_size',
    label: 'Size áo vận hành',
    type: 'shirt_size',
    required: true,
    options: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'],
  },
  {
    key: 'cccd_photo',
    label: 'Ảnh CCCD/CMND',
    type: 'photo',
    required: true,
    hint: 'Chụp rõ mặt CCCD — bắt buộc để lập hợp đồng',
  },
  {
    key: 'avatar_photo',
    label: 'Ảnh chân dung (tùy chọn)',
    type: 'photo',
    required: false,
    hint: 'Không bắt buộc. Nếu có sẽ dùng làm avatar.',
  },
  {
    key: 'experience',
    label: 'Kinh nghiệm tình nguyện',
    type: 'textarea',
    required: false,
  },
  {
    key: 'bank_account_number',
    label: 'Số tài khoản ngân hàng',
    type: 'text',
    required: true,
    hint: 'Chỉ số, 6–20 chữ số',
  },
  {
    key: 'bank_holder_name',
    label: 'Tên chủ tài khoản',
    type: 'text',
    required: true,
    hint: 'Phải khớp với họ tên ở trên (viết hoa không dấu)',
  },
  {
    key: 'bank_name',
    label: 'Ngân hàng',
    type: 'select',
    required: true,
    options: [...VN_BANKS],
  },
  {
    key: 'bank_branch',
    label: 'Chi nhánh',
    type: 'text',
    required: false,
  },
];
