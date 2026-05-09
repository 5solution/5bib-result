'use client';

import * as React from 'react';
import { dl } from './s2-shared';

const PHONE_REGEX = /^(0|\+84)[0-9]{9,10}$/;

type State =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'success'; leadNumber?: number }
  | { kind: 'error'; message: string };

export function S2ContactModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [org, setOrg] = React.useState('');
  const [scale, setScale] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [website, setWebsite] = React.useState('');
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [state, setState] = React.useState<State>({ kind: 'idle' });

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    dl({ event: 'contact_modal_open' });
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  function validate() {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Vui lòng nhập họ tên';
    if (!phone.trim()) e.phone = 'Vui lòng nhập số điện thoại';
    else if (!PHONE_REGEX.test(phone.trim())) e.phone = 'Số điện thoại không hợp lệ';
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = 'Email không hợp lệ';
    if (!org.trim()) e.org = 'Vui lòng nhập tên tổ chức / giải';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function onSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validate()) return;
    setState({ kind: 'submitting' });
    try {
      const res = await fetch('/api/5solution-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: name.trim(),
          phone: phone.trim(),
          email: email.trim() || undefined,
          // Reuse umbrella endpoint with module=5bib + event_type=race
          event_type: 'race',
          modules: ['5bib'],
          notes: `[5BIB Manager] ${org.trim()}${scale ? ` · ${scale}` : ''}${notes ? ` — ${notes.trim()}` : ''}`,
          website,
        }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; lead_number?: number } | null;
      if (res.status === 429) {
        setState({ kind: 'error', message: 'Bạn vừa gửi yêu cầu. Vui lòng thử lại sau ít phút.' });
        return;
      }
      if (!res.ok || !data?.ok) {
        setState({ kind: 'error', message: 'Hệ thống đang bận. Vui lòng gọi 0986 587 345 hoặc thử lại sau.' });
        return;
      }
      setState({ kind: 'success', leadNumber: data.lead_number });
      dl({
        event: 'form_submit_success',
        form_name: '5bib-manager',
        conversion_type: 'manager_demo_requested',
        lead_number: data.lead_number,
      });
      dl({ event: 'generate_lead', currency: 'VND', value: 1 });
    } catch {
      setState({ kind: 'error', message: 'Không kết nối được máy chủ.' });
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="s2-contact-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: 'rgba(2, 3, 10, 0.7)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        animation: 's2-fade-in 240ms ease',
      }}
      onClick={onClose}
    >
      <style>{`@keyframes s2-fade-in{from{opacity:0}to{opacity:1}}@keyframes s2-modal-in{from{opacity:0;transform:translateY(20px) scale(0.98)}to{opacity:1;transform:translateY(0) scale(1)}}`}</style>
      <div
        onClick={(e) => e.stopPropagation()}
        className="s2-card-glass"
        style={{
          maxWidth: 540,
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          background: 'var(--s2-surface)',
          border: '1px solid var(--s2-border-strong)',
          padding: 32,
          animation: 's2-modal-in 320ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
          <div>
            <div className="s2-eyebrow" style={{ marginBottom: 8 }}><span className="dot" /> demo 15 phút</div>
            <h3 id="s2-contact-title" className="s2-h3">Đặt lịch demo</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            data-cursor="hover"
            aria-label="Đóng"
            style={{
              width: 36, height: 36,
              border: '1px solid var(--s2-border)',
              background: 'transparent',
              borderRadius: 9999,
              color: 'var(--s2-text)',
              cursor: 'pointer',
              fontSize: 18,
              lineHeight: 1,
            }}
          >×</button>
        </div>

        {state.kind === 'success' ? (
          <div style={{ padding: '32px 0', textAlign: 'center' }}>
            <div style={{ width: 72, height: 72, borderRadius: 9999, background: 'var(--s2-lime)', color: '#000', margin: '0 auto 18px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, fontWeight: 800 }}>✓</div>
            <h4 className="s2-h3" style={{ marginBottom: 10 }}>Cảm ơn bạn!</h4>
            <p style={{ color: 'var(--s2-text-muted)', fontSize: 14 }}>
              Đã nhận thông tin{state.leadNumber ? ` (#${state.leadNumber})` : ''}. BD team sẽ gọi trong 24h làm việc.
            </p>
          </div>
        ) : (
          <form onSubmit={onSubmit} noValidate>
            <div style={{ position: 'absolute', left: -10000, width: 1, height: 1, overflow: 'hidden' }} aria-hidden="true">
              <input tabIndex={-1} value={website} onChange={(e) => setWebsite(e.target.value)} autoComplete="off" />
            </div>

            <Field label="Họ và tên" required error={errors.name}>
              <input className="s2-input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={80} />
            </Field>
            <Field label="Số điện thoại" required error={errors.phone}>
              <input className="s2-input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0912 345 678" autoComplete="tel" />
            </Field>
            <Field label="Email" error={errors.email}>
              <input className="s2-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" maxLength={100} />
            </Field>
            <Field label="Tên tổ chức / giải" required error={errors.org}>
              <input className="s2-input" value={org} onChange={(e) => setOrg(e.target.value)} placeholder="VD: Hanoi Marathon" maxLength={200} />
            </Field>
            <Field label="Quy mô dự kiến (VĐV)">
              <select className="s2-input" value={scale} onChange={(e) => setScale(e.target.value)}>
                <option value="">— Chọn quy mô —</option>
                <option value="<500">Dưới 500 VĐV</option>
                <option value="500-2000">500 – 2.000 VĐV</option>
                <option value="2000-10000">2.000 – 10.000 VĐV</option>
                <option value=">10000">Trên 10.000 VĐV</option>
              </select>
            </Field>
            <Field label="Lời nhắn">
              <textarea className="s2-input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
            </Field>

            {state.kind === 'error' ? (
              <div role="alert" style={{ padding: 12, marginBottom: 14, background: 'rgba(255, 14, 101, 0.12)', border: '1px solid var(--s2-magenta)', borderRadius: 10, color: 'var(--s2-magenta-soft)', fontSize: 13 }}>
                {state.message}
              </div>
            ) : null}

            <button
              type="submit"
              data-cursor="magnetic"
              className="s2-btn s2-btn-magenta"
              style={{ width: '100%', marginTop: 8 }}
              disabled={state.kind === 'submitting'}
            >
              {state.kind === 'submitting' ? 'Đang gửi...' : 'Đặt lịch demo →'}
            </button>
          </form>
        )}
      </div>

      <style>{`
        .s2-input {
          width: 100%;
          padding: 12px 14px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--s2-border);
          border-radius: 10px;
          color: var(--s2-text);
          font-family: var(--s2-font-body);
          font-size: 14px;
          line-height: 1.4;
          transition: border-color 200ms;
        }
        .s2-input:focus { outline: none; border-color: var(--s2-blue); box-shadow: 0 0 0 3px rgba(29, 73, 255, 0.18); }
        .s2-input::placeholder { color: var(--s2-text-subtle); }
        textarea.s2-input { resize: vertical; min-height: 80px; }
        select.s2-input { appearance: none; background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 8' fill='none' stroke='%23ffffff' stroke-width='2'><path d='M1 1l5 5 5-5'/></svg>"); background-position: right 12px center; background-repeat: no-repeat; padding-right: 38px; }
      `}</style>
    </div>
  );
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600, color: 'var(--s2-text-muted)', letterSpacing: '0.05em' }}>
        {label} {required ? <span style={{ color: 'var(--s2-magenta)' }}>*</span> : null}
      </label>
      {children}
      {error ? <div style={{ marginTop: 4, fontSize: 12, color: 'var(--s2-magenta-soft)' }}>{error}</div> : null}
    </div>
  );
}
