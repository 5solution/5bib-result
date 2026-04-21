'use client';

import { useState } from 'react';

type FormState = {
  full_name: string;
  phone: string;
  organization: string;
  athlete_count_range: string;
  package_interest: 'basic' | 'advanced' | 'professional' | 'unspecified';
  notes: string;
  website: string; // honeypot
};

const initial: FormState = {
  full_name: '',
  phone: '',
  organization: '',
  athlete_count_range: '',
  package_interest: 'unspecified',
  notes: '',
  website: '',
};

const PHONE_RE = /^(0|\+84)[0-9]{8,10}$/;

export default function ContactForm() {
  const [form, setForm] = useState<FormState>(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);

  const update = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const validate = (): boolean => {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (!form.full_name.trim()) next.full_name = 'Vui lòng nhập họ tên';
    else if (form.full_name.trim().length > 100) next.full_name = 'Họ tên tối đa 100 ký tự';
    const phone = form.phone.trim().replace(/\s+/g, '');
    if (!phone) next.phone = 'Vui lòng nhập số điện thoại';
    else if (!PHONE_RE.test(phone))
      next.phone = 'Số điện thoại không hợp lệ (vd: 0909000000 hoặc +84909000000)';
    if (!form.organization.trim()) next.organization = 'Vui lòng nhập tên tổ chức';
    else if (form.organization.trim().length > 200) next.organization = 'Tên tổ chức tối đa 200 ký tự';
    if (form.notes.length > 2000) next.notes = 'Ghi chú tối đa 2000 ký tự';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);
    if (!validate()) return;
    setSubmitting(true);
    try {
      const phone = form.phone.trim().replace(/\s+/g, '');
      const res = await fetch('/api/timing/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: form.full_name.trim(),
          phone,
          organization: form.organization.trim(),
          athlete_count_range: form.athlete_count_range,
          package_interest: form.package_interest,
          notes: form.notes.trim(),
          website: form.website, // honeypot
        }),
      });
      if (res.status === 429) {
        setGeneralError('Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau 1 giờ.');
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const msg =
          (data && (data.message as string)) || 'Không gửi được. Vui lòng thử lại sau ít phút.';
        setGeneralError(Array.isArray(msg) ? msg.join(', ') : msg);
        return;
      }
      setDone(true);
      setForm(initial);
    } catch {
      setGeneralError('Không kết nối được máy chủ. Vui lòng thử lại sau ít phút.');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="tl-contact-form">
        <div className="tl-form-success">
          <div className="tl-form-success-icon">✅</div>
          <div className="tl-form-success-title">Đã nhận yêu cầu của bạn!</div>
          <div className="tl-form-success-body">
            Đội ngũ 5BIB sẽ liên hệ trong vòng 24 giờ với báo giá chi tiết.
            <br />
            Cảm ơn bạn đã quan tâm.
          </div>
        </div>
      </div>
    );
  }

  return (
    <form className="tl-contact-form" onSubmit={onSubmit} noValidate>
      <div className="tl-form-title">📋 Yêu cầu báo giá</div>

      {generalError && <div className="tl-form-general-error">⚠️ {generalError}</div>}

      <div className="tl-form-row">
        <div className={`tl-form-group ${errors.full_name ? 'tl-error' : ''}`}>
          <label htmlFor="tl-full-name">Họ và tên *</label>
          <input
            id="tl-full-name"
            type="text"
            placeholder="Nguyễn Văn A"
            value={form.full_name}
            onChange={update('full_name')}
            maxLength={100}
            autoComplete="name"
          />
          {errors.full_name && <div className="tl-form-error-msg">{errors.full_name}</div>}
        </div>
        <div className={`tl-form-group ${errors.phone ? 'tl-error' : ''}`}>
          <label htmlFor="tl-phone">Số điện thoại *</label>
          <input
            id="tl-phone"
            type="tel"
            placeholder="0909 000 000"
            value={form.phone}
            onChange={update('phone')}
            maxLength={20}
            autoComplete="tel"
          />
          {errors.phone && <div className="tl-form-error-msg">{errors.phone}</div>}
        </div>
      </div>

      <div className={`tl-form-group ${errors.organization ? 'tl-error' : ''}`}>
        <label htmlFor="tl-org">Tên tổ chức / BTC *</label>
        <input
          id="tl-org"
          type="text"
          placeholder="VD: CLB Chạy Bộ Hà Nội"
          value={form.organization}
          onChange={update('organization')}
          maxLength={200}
          autoComplete="organization"
        />
        {errors.organization && <div className="tl-form-error-msg">{errors.organization}</div>}
      </div>

      <div className="tl-form-row">
        <div className="tl-form-group">
          <label htmlFor="tl-athletes">Số lượng VĐV dự kiến</label>
          <select
            id="tl-athletes"
            value={form.athlete_count_range}
            onChange={update('athlete_count_range')}
          >
            <option value="">— Chọn --</option>
            <option>Dưới 500 VĐV</option>
            <option>500 – 1,000 VĐV</option>
            <option>1,000 – 3,000 VĐV</option>
            <option>3,000 – 5,000 VĐV</option>
            <option>Trên 5,000 VĐV</option>
          </select>
        </div>
        <div className="tl-form-group">
          <label htmlFor="tl-pkg">Gói quan tâm</label>
          <select id="tl-pkg" value={form.package_interest} onChange={update('package_interest')}>
            <option value="unspecified">Chưa xác định</option>
            <option value="basic">Basic</option>
            <option value="advanced">Advanced</option>
            <option value="professional">Professional</option>
          </select>
        </div>
      </div>

      <div className={`tl-form-group ${errors.notes ? 'tl-error' : ''}`}>
        <label htmlFor="tl-notes">Thông tin thêm</label>
        <textarea
          id="tl-notes"
          placeholder="Ngày giải, địa điểm, số cự ly, yêu cầu đặc biệt..."
          value={form.notes}
          onChange={update('notes')}
          maxLength={2000}
        />
        {errors.notes && <div className="tl-form-error-msg">{errors.notes}</div>}
      </div>

      {/* Honeypot — ẩn khỏi người dùng, bot sẽ fill */}
      <div className="tl-hp-field" aria-hidden="true">
        <label htmlFor="tl-website">Website</label>
        <input
          id="tl-website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={form.website}
          onChange={update('website')}
        />
      </div>

      <button type="submit" className="tl-form-submit" disabled={submitting}>
        {submitting ? 'Đang gửi...' : 'Gửi yêu cầu báo giá →'}
      </button>
      <div className="tl-form-note">🔒 Thông tin của bạn được bảo mật hoàn toàn</div>
    </form>
  );
}
