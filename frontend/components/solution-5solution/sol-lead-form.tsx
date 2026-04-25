'use client';

import * as React from 'react';
import { Reveal, ICheck } from './sol-shared';

type EventType = 'race' | 'concert' | 'tournament' | 'other';
type EventScale = 'lt500' | '500-2000' | '2000-10000' | 'gt10000';
type SolModule = '5bib' | '5ticket' | '5pix' | '5sport' | '5tech';

const EVENT_TYPES: { value: EventType; label: string }[] = [
  { value: 'race', label: 'Giải chạy / Marathon' },
  { value: 'concert', label: 'Concert / Sự kiện âm nhạc' },
  { value: 'tournament', label: 'Giải đấu thể thao (cầu lông, pickleball...)' },
  { value: 'other', label: 'Khác' },
];

const SCALES: { value: EventScale; label: string }[] = [
  { value: 'lt500', label: 'Dưới 500 người' },
  { value: '500-2000', label: '500 – 2.000 người' },
  { value: '2000-10000', label: '2.000 – 10.000 người' },
  { value: 'gt10000', label: 'Trên 10.000 người' },
];

const MODULES: { value: SolModule; label: string }[] = [
  { value: '5bib', label: '5BIB' },
  { value: '5ticket', label: '5Ticket' },
  { value: '5pix', label: '5Pix' },
  { value: '5sport', label: '5Sport' },
  { value: '5tech', label: '5Tech' },
];

const PHONE_REGEX = /^(0|\+84)[0-9]{9,10}$/;
const COOKIE_KEY = '5sol_lead_submitted';

function fireGtm(payload: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  const w = window as Window & { dataLayer?: Record<string, unknown>[] };
  w.dataLayer = w.dataLayer ?? [];
  w.dataLayer.push(payload);
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name: string, value: string, days: number) {
  if (typeof document === 'undefined') return;
  const maxAge = days * 24 * 60 * 60;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

type SubmitState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'success'; leadNumber?: number }
  | { kind: 'error'; message: string };

export function SolLeadForm() {
  const [fullName, setFullName] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [eventType, setEventType] = React.useState<EventType | ''>('');
  const [scale, setScale] = React.useState<EventScale | ''>('');
  const [modules, setModules] = React.useState<SolModule[]>([]);
  const [notes, setNotes] = React.useState('');
  const [website, setWebsite] = React.useState(''); // honeypot
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [state, setState] = React.useState<SubmitState>({ kind: 'idle' });

  const formStarted = React.useRef(false);
  const onFieldFocus = React.useCallback(() => {
    if (formStarted.current) return;
    formStarted.current = true;
    fireGtm({ event: 'form_start', form_name: '5solution-umbrella' });
  }, []);
  const onFieldBlur = (field: string) => (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    if (e.target.value.trim()) {
      fireGtm({
        event: 'form_field_complete',
        form_name: '5solution-umbrella',
        field_name: field,
      });
    }
  };

  React.useEffect(() => {
    if (readCookie(COOKIE_KEY) === '1') {
      setState({ kind: 'success' });
    }
  }, []);

  function toggleModule(m: SolModule) {
    setModules((prev) => {
      const next = prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m];
      fireGtm({
        event: 'module_interest_selected',
        module_id: m,
        selected: next.includes(m),
      });
      return next;
    });
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!fullName.trim()) e.full_name = 'Vui lòng nhập họ tên';
    else if (fullName.trim().length > 80) e.full_name = 'Họ tên tối đa 80 ký tự';

    if (!phone.trim()) e.phone = 'Vui lòng nhập số điện thoại';
    else if (!PHONE_REGEX.test(phone.trim()))
      e.phone = 'Số điện thoại không hợp lệ (VD: 0912345678)';

    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      e.email = 'Email không hợp lệ';

    if (!eventType) e.event_type = 'Vui lòng chọn loại sự kiện';

    if (notes.length > 500) e.notes = 'Lời nhắn tối đa 500 ký tự';

    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function onSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (state.kind === 'submitting') return;

    if (!validate()) {
      fireGtm({ event: 'form_validation_failed', form_name: '5solution-umbrella' });
      return;
    }

    fireGtm({
      event: 'form_submit',
      form_name: '5solution-umbrella',
      event_type: eventType,
      event_scale: scale || 'unspecified',
      modules_count: modules.length,
    });

    setState({ kind: 'submitting' });

    try {
      const res = await fetch('/api/5solution-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName.trim(),
          phone: phone.trim(),
          email: email.trim() || undefined,
          event_type: eventType,
          event_scale: scale || undefined,
          modules,
          notes: notes.trim() || undefined,
          website, // honeypot — server drops if non-empty
        }),
      });

      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; lead_number?: number; error?: string }
        | null;

      if (res.status === 429) {
        setState({
          kind: 'error',
          message: 'Bạn vừa gửi yêu cầu rồi. Vui lòng thử lại sau ít phút.',
        });
        fireGtm({ event: 'form_submit_error', form_name: '5solution-umbrella', error_code: 'rate_limited' });
        return;
      }
      if (!res.ok || !data?.ok) {
        setState({
          kind: 'error',
          message:
            'Hệ thống đang bận. Vui lòng gọi 0986 587 345 hoặc thử lại sau.',
        });
        fireGtm({
          event: 'form_submit_error',
          form_name: '5solution-umbrella',
          error_code: data?.error ?? `http_${res.status}`,
        });
        return;
      }

      setCookie(COOKIE_KEY, '1', 7);
      setState({ kind: 'success', leadNumber: data.lead_number });

      fireGtm({
        event: 'form_submit_success',
        form_name: '5solution-umbrella',
        conversion_type: 'umbrella_lead_generated',
        lead_number: data.lead_number,
        event_type: eventType,
        event_scale: scale || 'unspecified',
      });
      // GA4 standard event — fires alongside dataLayer for direct GA4 tracking
      fireGtm({ event: 'generate_lead', currency: 'VND', value: 1 });
    } catch {
      setState({
        kind: 'error',
        message: 'Không kết nối được máy chủ. Kiểm tra kết nối mạng và thử lại.',
      });
      fireGtm({
        event: 'form_submit_error',
        form_name: '5solution-umbrella',
        error_code: 'network',
      });
    }
  }

  function reset() {
    setFullName('');
    setPhone('');
    setEmail('');
    setEventType('');
    setScale('');
    setModules([]);
    setNotes('');
    setErrors({});
    setState({ kind: 'idle' });
  }

  if (state.kind === 'success') {
    return (
      <Reveal>
        <div
          className="sol-card"
          style={{
            textAlign: 'center',
            padding: 'clamp(32px, 5vw, 56px)',
            borderColor: 'var(--sol-success)',
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              margin: '0 auto 20px',
              borderRadius: 9999,
              background: 'var(--sol-success)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ICheck s={28} sw={3} />
          </div>
          <h3 className="sol-h3" style={{ marginBottom: 10 }}>
            Cảm ơn bạn!
          </h3>
          <p
            className="sol-body"
            style={{ marginBottom: 20, maxWidth: '40ch', margin: '0 auto 20px' }}
          >
            Chúng tôi đã nhận thông tin
            {state.leadNumber ? ` (#${state.leadNumber})` : ''} và sẽ liên hệ trong
            vòng 24 giờ làm việc.
          </p>
          <button type="button" className="sol-btn sol-btn-ghost" onClick={reset}>
            Gửi yêu cầu khác
          </button>
        </div>
      </Reveal>
    );
  }

  return (
    <Reveal>
      <form
        onSubmit={onSubmit}
        className="sol-card"
        noValidate
        style={{ padding: 'clamp(24px, 3vw, 40px)' }}
      >
        <h3 className="sol-h3" style={{ marginBottom: 8 }}>
          Liên hệ tư vấn
        </h3>
        <p
          className="sol-body"
          style={{ marginBottom: 28, fontSize: 14 }}
        >
          Để lại thông tin, BD team sẽ liên hệ trong 24 giờ làm việc.
        </p>

        {/* Honeypot — visually hidden, bots will fill */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: -10000,
            width: 1,
            height: 1,
            overflow: 'hidden',
          }}
        >
          <label>
            Website (leave blank)
            <input
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </label>
        </div>

        <div className="sol-form-grid">
          <div className="sol-form-group">
            <label htmlFor="sol-name" className="sol-label">
              Họ và tên <span className="sol-required">*</span>
            </label>
            <input
              id="sol-name"
              type="text"
              className="sol-input"
              maxLength={80}
              placeholder="Nguyễn Văn A"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              onFocus={onFieldFocus}
              onBlur={onFieldBlur('full_name')}
              aria-invalid={!!errors.full_name}
              autoComplete="name"
              required
            />
            {errors.full_name ? (
              <div className="sol-error-msg">{errors.full_name}</div>
            ) : null}
          </div>

          <div className="sol-form-group">
            <label htmlFor="sol-phone" className="sol-label">
              Số điện thoại <span className="sol-required">*</span>
            </label>
            <input
              id="sol-phone"
              type="tel"
              className="sol-input"
              maxLength={20}
              placeholder="0912 345 678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onFocus={onFieldFocus}
              onBlur={onFieldBlur('phone')}
              aria-invalid={!!errors.phone}
              autoComplete="tel"
              required
            />
            {errors.phone ? <div className="sol-error-msg">{errors.phone}</div> : null}
          </div>

          <div className="sol-form-group">
            <label htmlFor="sol-email" className="sol-label">
              Email
            </label>
            <input
              id="sol-email"
              type="email"
              className="sol-input"
              maxLength={100}
              placeholder="email@cong-ty.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onFocus={onFieldFocus}
              onBlur={onFieldBlur('email')}
              aria-invalid={!!errors.email}
              autoComplete="email"
            />
            {errors.email ? <div className="sol-error-msg">{errors.email}</div> : null}
          </div>

          <div className="sol-form-group">
            <label htmlFor="sol-event" className="sol-label">
              Loại sự kiện <span className="sol-required">*</span>
            </label>
            <select
              id="sol-event"
              className="sol-input"
              value={eventType}
              onChange={(e) => setEventType(e.target.value as EventType)}
              onFocus={onFieldFocus}
              onBlur={onFieldBlur('event_type')}
              aria-invalid={!!errors.event_type}
              required
            >
              <option value="">— Chọn loại sự kiện —</option>
              {EVENT_TYPES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {errors.event_type ? (
              <div className="sol-error-msg">{errors.event_type}</div>
            ) : null}
          </div>

          <div className="sol-form-group" style={{ gridColumn: '1 / -1' }}>
            <label htmlFor="sol-scale" className="sol-label">
              Quy mô dự kiến
            </label>
            <select
              id="sol-scale"
              className="sol-input"
              value={scale}
              onChange={(e) => {
                const v = e.target.value as EventScale | '';
                setScale(v);
                if (v) {
                  fireGtm({
                    event: 'event_scale_selected',
                    form_name: '5solution-umbrella',
                    event_scale: v,
                  });
                }
              }}
              onFocus={onFieldFocus}
            >
              <option value="">— Chọn quy mô —</option>
              {SCALES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="sol-form-group" style={{ gridColumn: '1 / -1' }}>
            <span className="sol-label">Module quan tâm (chọn nhiều)</span>
            <div className="sol-checkbox-grid">
              {MODULES.map((m) => {
                const checked = modules.includes(m.value);
                return (
                  <label
                    key={m.value}
                    className={`sol-checkbox ${checked ? 'is-checked' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleModule(m.value)}
                    />
                    {m.label}
                  </label>
                );
              })}
            </div>
          </div>

          <div className="sol-form-group" style={{ gridColumn: '1 / -1' }}>
            <label htmlFor="sol-notes" className="sol-label">
              Lời nhắn
            </label>
            <textarea
              id="sol-notes"
              className="sol-input"
              maxLength={500}
              rows={4}
              placeholder="Mô tả ngắn nhu cầu của bạn (tuỳ chọn)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onFocus={onFieldFocus}
              onBlur={onFieldBlur('notes')}
              aria-invalid={!!errors.notes}
            />
            {errors.notes ? <div className="sol-error-msg">{errors.notes}</div> : null}
            <div
              style={{
                marginTop: 4,
                fontSize: 12,
                color: 'var(--sol-text-subtle)',
                textAlign: 'right',
              }}
            >
              {notes.length}/500
            </div>
          </div>
        </div>

        {state.kind === 'error' ? (
          <div
            role="alert"
            style={{
              padding: 14,
              marginBottom: 18,
              background: 'var(--sol-magenta-100)',
              border: '1px solid var(--sol-magenta)',
              borderRadius: 10,
              color: 'var(--sol-magenta-600)',
              fontSize: 14,
            }}
          >
            {state.message}
          </div>
        ) : null}

        <button
          type="submit"
          className="sol-btn sol-btn-primary"
          disabled={state.kind === 'submitting'}
          style={{ width: '100%', padding: '16px 28px', fontSize: 15 }}
        >
          {state.kind === 'submitting' ? 'Đang gửi...' : 'Gửi yêu cầu liên hệ →'}
        </button>

        <p
          style={{
            marginTop: 14,
            marginBottom: 0,
            fontSize: 12,
            color: 'var(--sol-text-subtle)',
            textAlign: 'center',
          }}
        >
          Bằng việc gửi, bạn đồng ý với chính sách bảo mật của 5Solution.
        </p>
      </form>
    </Reveal>
  );
}
