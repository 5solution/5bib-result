'use client';

import * as React from 'react';
import type { Lang } from './solution-icons';
import { useT } from './solution-icons';

type Props = {
  open: boolean;
  onClose: () => void;
  lang: Lang;
  accent?: string;
};

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

export default function SolutionContactModal({ open, onClose, lang, accent = '#FF0E65' }: Props) {
  const t = useT(lang);
  const [form, setForm] = React.useState<FormState>(initial);
  const [errors, setErrors] = React.useState<Partial<Record<keyof FormState, string>>>({});
  const [submitting, setSubmitting] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [generalError, setGeneralError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      // reset on close
      setDone(false);
      setGeneralError(null);
      setErrors({});
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const update = (k: keyof FormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    if (errors[k]) setErrors((prev) => ({ ...prev, [k]: undefined }));
  };

  const validate = (): boolean => {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (!form.full_name.trim()) next.full_name = t('Vui lòng nhập họ tên', 'Please enter your name');
    if (!form.phone.trim() || !PHONE_RE.test(form.phone.trim().replace(/\s+/g, '')))
      next.phone = t('Số điện thoại không hợp lệ (vd: 0909000000)', 'Invalid phone number (e.g. 0909000000)');
    if (!form.organization.trim()) next.organization = t('Vui lòng nhập tên tổ chức / BTC', 'Please enter your organization');
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
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: form.full_name.trim(),
          phone,
          organization: form.organization.trim(),
          athlete_count_range: form.athlete_count_range || '',
          package_interest: form.package_interest,
          notes: form.notes.trim(),
          website: form.website,
        }),
      });
      if (res.status === 429) {
        setGeneralError(t('Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau 1 giờ.', 'Too many requests. Please try again in an hour.'));
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const msg = data?.message ?? data?.error ?? t('Không gửi được. Vui lòng thử lại sau.', 'Failed to submit. Please try again.');
        setGeneralError(Array.isArray(msg) ? msg.join(', ') : String(msg));
        return;
      }
      setDone(true);
      setForm(initial);
    } catch {
      setGeneralError(t('Không kết nối được máy chủ. Vui lòng thử lại.', 'Connection failed. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  const inp: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    borderRadius: 10,
    border: '1.5px solid var(--5s-border)',
    fontFamily: 'var(--font-body)',
    fontSize: 14,
    color: 'var(--5s-text)',
    background: '#fff',
    outline: 'none',
    transition: 'border-color 180ms',
  };
  const inpErr: React.CSSProperties = { ...inp, borderColor: '#dc2626' };
  const label: React.CSSProperties = {
    display: 'block',
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    fontSize: 12,
    letterSpacing: '.06em',
    textTransform: 'uppercase',
    color: 'var(--5s-text-muted)',
    marginBottom: 6,
  };
  const errMsg: React.CSSProperties = {
    fontFamily: 'var(--font-body)',
    fontSize: 12,
    color: '#dc2626',
    marginTop: 4,
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(10,10,10,0.62)',
          backdropFilter: 'blur(4px)',
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 560,
          maxHeight: '90vh',
          overflowY: 'auto',
          background: '#fff',
          borderRadius: 20,
          boxShadow: '0 32px 80px rgba(0,0,0,0.28)',
          fontFamily: 'var(--font-body)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '28px 28px 0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
          }}
        >
          <div>
            <div
              style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 900,
                fontSize: 11,
                letterSpacing: '.18em',
                textTransform: 'uppercase',
                color: accent,
                marginBottom: 6,
              }}
            >
              {t('Đặt lịch demo', 'Book a demo')}
            </div>
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 900,
                fontSize: 22,
                letterSpacing: '-0.02em',
                color: 'var(--5s-text)',
                margin: 0,
              }}
            >
              {t('Nhận báo giá từ 5BIB', 'Get a quote from 5BIB')}
            </h2>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 13.5, color: 'var(--5s-text-muted)', margin: '6px 0 0' }}>
              {t('Đội ngũ sẽ liên hệ trong vòng 24h với đề xuất phù hợp mùa giải.', 'Our team will reach out within 24h with a tailored proposal.')}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'var(--5s-surface)',
              border: 'none',
              borderRadius: 9999,
              width: 36,
              height: 36,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
              color: 'var(--5s-text-muted)',
              flexShrink: 0,
              marginLeft: 12,
            }}
          >
            ✕
          </button>
        </div>

        {done ? (
          <div style={{ padding: '40px 28px 36px', textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 20, letterSpacing: '-0.02em', marginBottom: 10 }}>
              {t('Đã nhận yêu cầu!', 'Request received!')}
            </div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 14.5, color: 'var(--5s-text-muted)', lineHeight: 1.6, marginBottom: 28 }}>
              {t('Đội ngũ 5BIB sẽ liên hệ trong vòng 24 giờ với báo giá chi tiết. Cảm ơn bạn đã quan tâm.', 'The 5BIB team will contact you within 24 hours with a detailed quote. Thank you for your interest.')}
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'var(--5s-blue)',
                color: '#fff',
                border: 'none',
                padding: '12px 24px',
                borderRadius: 10,
                fontFamily: 'var(--font-display)',
                fontWeight: 900,
                fontSize: 13,
                textTransform: 'uppercase',
                letterSpacing: '.06em',
                cursor: 'pointer',
              }}
            >
              {t('Đóng', 'Close')}
            </button>
          </div>
        ) : (
          <form onSubmit={onSubmit} noValidate style={{ padding: '24px 28px 28px' }}>
            {generalError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '10px 14px', fontFamily: 'var(--font-body)', fontSize: 13.5, color: '#dc2626', marginBottom: 18 }}>
                ⚠️ {generalError}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div>
                <label style={label} htmlFor="sl-name">{t('Họ và tên', 'Full name')} *</label>
                <input id="sl-name" type="text" placeholder="Nguyễn Văn A" value={form.full_name} onChange={update('full_name')} maxLength={100} autoComplete="name" style={errors.full_name ? inpErr : inp} />
                {errors.full_name && <div style={errMsg}>{errors.full_name}</div>}
              </div>
              <div>
                <label style={label} htmlFor="sl-phone">{t('Số điện thoại', 'Phone number')} *</label>
                <input id="sl-phone" type="tel" placeholder="0909 000 000" value={form.phone} onChange={update('phone')} maxLength={20} autoComplete="tel" style={errors.phone ? inpErr : inp} />
                {errors.phone && <div style={errMsg}>{errors.phone}</div>}
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={label} htmlFor="sl-org">{t('Tên tổ chức / BTC', 'Organization / Race org')} *</label>
              <input id="sl-org" type="text" placeholder={t('VD: CLB Chạy Bộ Hà Nội', 'e.g. Hanoi Running Club')} value={form.organization} onChange={update('organization')} maxLength={200} autoComplete="organization" style={errors.organization ? inpErr : inp} />
              {errors.organization && <div style={errMsg}>{errors.organization}</div>}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div>
                <label style={label} htmlFor="sl-size">{t('Quy mô VĐV', 'Athlete count')}</label>
                <select id="sl-size" value={form.athlete_count_range} onChange={update('athlete_count_range')} style={{ ...inp, cursor: 'pointer' }}>
                  <option value="">— {t('Chọn', 'Select')} —</option>
                  <option>{t('Dưới 500 VĐV', 'Under 500')}</option>
                  <option>{t('500 – 1,000 VĐV', '500 – 1,000')}</option>
                  <option>{t('1,000 – 3,000 VĐV', '1,000 – 3,000')}</option>
                  <option>{t('3,000 – 5,000 VĐV', '3,000 – 5,000')}</option>
                  <option>{t('Trên 5,000 VĐV', 'Over 5,000')}</option>
                </select>
              </div>
              <div>
                <label style={label} htmlFor="sl-pkg">{t('Gói quan tâm', 'Package interest')}</label>
                <select id="sl-pkg" value={form.package_interest} onChange={update('package_interest')} style={{ ...inp, cursor: 'pointer' }}>
                  <option value="unspecified">{t('Chưa xác định', 'Not sure yet')}</option>
                  <option value="basic">Basic</option>
                  <option value="advanced">Advanced</option>
                  <option value="professional">Professional</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={label} htmlFor="sl-notes">{t('Ghi chú thêm', 'Additional notes')}</label>
              <textarea
                id="sl-notes"
                placeholder={t('Ngày giải, địa điểm, số cự ly, yêu cầu đặc biệt...', 'Race date, venue, distances, special requirements...')}
                value={form.notes}
                onChange={update('notes')}
                maxLength={2000}
                rows={3}
                style={{ ...inp, resize: 'vertical', minHeight: 80 }}
              />
            </div>

            {/* Honeypot */}
            <div style={{ position: 'absolute', left: '-9999px', top: 'auto', width: 1, height: 1, overflow: 'hidden' }} aria-hidden="true">
              <input tabIndex={-1} type="text" autoComplete="off" value={form.website} onChange={update('website')} />
            </div>

            <button
              type="submit"
              disabled={submitting}
              style={{
                width: '100%',
                background: submitting ? 'var(--5s-slate-200)' : 'var(--5s-blue)',
                color: submitting ? 'var(--5s-text-muted)' : '#fff',
                border: 'none',
                padding: '14px 24px',
                borderRadius: 12,
                fontFamily: 'var(--font-display)',
                fontWeight: 900,
                fontSize: 14,
                textTransform: 'uppercase',
                letterSpacing: '.06em',
                cursor: submitting ? 'not-allowed' : 'pointer',
                transition: 'background 200ms',
              }}
            >
              {submitting ? t('Đang gửi...', 'Submitting...') : t('Gửi yêu cầu báo giá →', 'Submit request →')}
            </button>

            <div style={{ textAlign: 'center', fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--5s-text-subtle)', marginTop: 12 }}>
              🔒 {t('Thông tin của bạn được bảo mật hoàn toàn', 'Your information is kept strictly confidential')}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
