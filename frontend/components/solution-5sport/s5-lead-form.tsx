'use client';

import * as React from 'react';
import { Lang, useT, ICheck, IArr, IMail, IPhone, IPin } from './s5-shared';

type Track = '5sport-btc' | '5sport-athlete';
type Status = 'idle' | 'submitting' | 'success' | 'error';

interface FormState {
  full_name: string;
  phone: string;
  email: string;
  organization: string;
  sport_type: '' | 'pickleball' | 'badminton' | 'both';
  tournament_scale: '' | 'lt50' | '50-200' | 'gt200';
  tournament_timing: '' | '1-3m' | '3-6m' | 'tbd';
  city: string;
  website: string; // honeypot
}

const initial: FormState = {
  full_name: '',
  phone: '',
  email: '',
  organization: '',
  sport_type: '',
  tournament_scale: '',
  tournament_timing: '',
  city: '',
  website: '',
};

function useForm(): [FormState, <K extends keyof FormState>(k: K, v: FormState[K]) => void, () => void] {
  const [s, setS] = React.useState<FormState>(initial);
  const set = React.useCallback(<K extends keyof FormState>(k: K, v: FormState[K]) => {
    setS((prev) => ({ ...prev, [k]: v }));
  }, []);
  const reset = React.useCallback(() => setS(initial), []);
  return [s, set, reset];
}

async function submit(track: Track, data: FormState) {
  const res = await fetch('/api/5sport-leads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...data, track }),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => null);
    throw new Error(j?.error || 'submit_failed');
  }
  return res.json();
}

export function S5LeadForm({ lang }: { lang: Lang }) {
  const t = useT(lang);

  return (
    <section
      id="lead-form"
      style={{
        background: 'linear-gradient(140deg, var(--s5-navy) 0%, #0F1337 55%, #06082A 100%)',
        color: '#fff',
        padding: '120px 24px 96px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse at top right, rgba(200,255,0,0.12), transparent 50%), radial-gradient(ellipse at bottom left, rgba(20,0,255,0.35), transparent 55%)',
          pointerEvents: 'none',
        }}
      />
      <div style={{ maxWidth: 1240, margin: '0 auto', position: 'relative' }}>
        <div style={{ textAlign: 'center', maxWidth: 720, margin: '0 auto 48px' }}>
          <span
            className="type-eyebrow"
            style={{ color: 'var(--s5-lime)', marginBottom: 14, display: 'inline-block' }}
          >
            {t('Sẵn sàng?', 'Ready?')}
          </span>
          <h2 className="type-h1" style={{ color: '#fff', marginBottom: 16 }}>
            {t('Sẵn sàng ', 'Ready to ')}
            <span style={{ color: 'var(--s5-lime)' }}>{t('Level Up?', 'Level Up?')}</span>
          </h2>
          <p className="type-lead" style={{ color: 'rgba(255,255,255,0.72)' }}>
            {t(
              'Dù bạn là BTC muốn tổ chức giải chuyên nghiệp hơn, hay VĐV muốn tìm bạn chơi và xây thành tích — 5Sport là nơi bắt đầu.',
              'Whether you run tournaments or you just want to play more — 5Sport is where it starts.',
            )}
          </p>
        </div>

        <div
          className="s5-2col"
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}
        >
          <BtcForm lang={lang} />
          <AthleteForm lang={lang} />
        </div>

        <div
          style={{
            marginTop: 40,
            textAlign: 'center',
            color: 'rgba(255,255,255,0.72)',
            fontSize: 14,
            display: 'flex',
            gap: 22,
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <IMail /> hello@5sport.vn
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <IPhone /> 1900-5BIB
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <IPin /> {t('TP.HCM & Hà Nội', 'HCMC & Hanoi')}
          </span>
        </div>
      </div>
    </section>
  );
}

function FormCard({
  id,
  accent,
  tag,
  title,
  subtitle,
  children,
  status,
  onReset,
  lang,
}: {
  id: string;
  accent: string;
  tag: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  status: Status;
  onReset: () => void;
  lang: Lang;
}) {
  const t = useT(lang);
  return (
    <div
      id={id}
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: `1px solid ${accent}`,
        borderRadius: 22,
        padding: 28,
        backdropFilter: 'blur(8px)',
      }}
    >
      <span
        style={{
          display: 'inline-block',
          background: accent,
          color: accent === 'var(--s5-lime)' ? 'var(--s5-navy)' : '#fff',
          fontSize: 10,
          fontWeight: 900,
          padding: '4px 10px',
          borderRadius: 6,
          letterSpacing: '.16em',
          textTransform: 'uppercase',
          marginBottom: 14,
        }}
      >
        {tag}
      </span>
      <h3 className="type-h3" style={{ color: '#fff', marginBottom: 8, fontSize: 22 }}>
        {title}
      </h3>
      <p style={{ color: 'rgba(255,255,255,0.66)', fontSize: 14, marginBottom: 22, lineHeight: 1.55 }}>
        {subtitle}
      </p>
      {status === 'success' ? (
        <div
          style={{
            background: 'rgba(200,255,0,0.1)',
            border: '1px solid rgba(200,255,0,0.35)',
            borderRadius: 14,
            padding: 20,
            color: 'var(--s5-lime)',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 8 }}>✓</div>
          <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 6, color: '#fff' }}>
            {t('Đã nhận thông tin!', 'We got your info!')}
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', marginBottom: 14 }}>
            {t(
              'Team 5Sport sẽ liên hệ trong 24h làm việc.',
              'Our team will reach out within one business day.',
            )}
          </div>
          <button
            onClick={onReset}
            style={{
              background: 'transparent',
              color: 'var(--s5-lime)',
              border: '1px solid var(--s5-lime)',
              padding: '8px 16px',
              borderRadius: 8,
              cursor: 'pointer',
              fontFamily: 'var(--font-body-5s)',
              fontWeight: 700,
              fontSize: 12,
              letterSpacing: '.1em',
              textTransform: 'uppercase',
            }}
          >
            {t('Gửi thêm', 'Submit another')}
          </button>
        </div>
      ) : (
        children
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.18)',
  borderRadius: 10,
  color: '#fff',
  fontFamily: 'var(--font-body-5s)',
  fontSize: 14,
  outline: 'none',
  transition: 'border-color 160ms, background 160ms',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 700,
  color: 'rgba(255,255,255,0.7)',
  letterSpacing: '.12em',
  textTransform: 'uppercase',
  marginBottom: 6,
};

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

function BtcForm({ lang }: { lang: Lang }) {
  const t = useT(lang);
  const [form, set, reset] = useForm();
  const [status, setStatus] = React.useState<Status>('idle');
  const [err, setErr] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('submitting');
    setErr(null);
    try {
      await submit('5sport-btc', form);
      setStatus('success');
    } catch (e) {
      setStatus('error');
      setErr(e instanceof Error ? e.message : 'error');
    }
  }

  return (
    <FormCard
      id="lead-form-btc"
      accent="var(--s5-blue-400)"
      tag="🏆 BTC"
      title={t('Tôi muốn đưa giải lên 5Sport', 'Bring my event to 5Sport')}
      subtitle={t(
        'Team sẽ gọi tư vấn miễn phí trong 24h.',
        'We\u2019ll call with free consultation within 24h.',
      )}
      status={status}
      onReset={() => {
        reset();
        setStatus('idle');
      }}
      lang={lang}
    >
      <form onSubmit={onSubmit} noValidate>
        <input
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={form.website}
          onChange={(e) => set('website', e.target.value)}
          style={{ position: 'absolute', left: '-10000px', width: 1, height: 1 }}
          aria-hidden
        />

        <Field label={t('Tên / Tổ chức', 'Name / organization')}>
          <input
            required
            style={inputStyle}
            value={form.full_name}
            onChange={(e) => set('full_name', e.target.value)}
            placeholder="Nguyễn Văn A"
          />
        </Field>
        <Field label={t('Tên CLB / Đơn vị', 'Club / organization name')}>
          <input
            required
            style={inputStyle}
            value={form.organization}
            onChange={(e) => set('organization', e.target.value)}
            placeholder={t('VD: CLB Pickleball Q7', 'e.g. Pickleball Club Q7')}
          />
        </Field>
        <Field label={t('Số điện thoại', 'Phone')}>
          <input
            required
            style={inputStyle}
            type="tel"
            value={form.phone}
            onChange={(e) => set('phone', e.target.value)}
            placeholder="09xx xxx xxx"
          />
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field label={t('Môn thi đấu', 'Sport')}>
            <select
              style={inputStyle}
              value={form.sport_type}
              onChange={(e) => set('sport_type', e.target.value as FormState['sport_type'])}
            >
              <option value="">—</option>
              <option value="pickleball">Pickleball</option>
              <option value="badminton">{t('Cầu lông', 'Badminton')}</option>
              <option value="both">{t('Cả hai', 'Both')}</option>
            </select>
          </Field>
          <Field label={t('Quy mô VĐV', 'Scale')}>
            <select
              style={inputStyle}
              value={form.tournament_scale}
              onChange={(e) => set('tournament_scale', e.target.value as FormState['tournament_scale'])}
            >
              <option value="">—</option>
              <option value="lt50">&lt; 50</option>
              <option value="50-200">50–200</option>
              <option value="gt200">200+</option>
            </select>
          </Field>
        </div>

        <Field label={t('Thời gian tổ chức', 'Timing')}>
          <select
            style={inputStyle}
            value={form.tournament_timing}
            onChange={(e) => set('tournament_timing', e.target.value as FormState['tournament_timing'])}
          >
            <option value="">—</option>
            <option value="1-3m">{t('1–3 tháng tới', 'Next 1–3 months')}</option>
            <option value="3-6m">{t('3–6 tháng', '3–6 months')}</option>
            <option value="tbd">{t('Chưa xác định', 'To be decided')}</option>
          </select>
        </Field>

        {err && (
          <div style={{ color: '#FFB4B4', fontSize: 12, marginBottom: 12 }}>
            {t('Gửi không thành công', 'Submission failed')}: {err}
          </div>
        )}

        <button
          type="submit"
          className="s5-btn s5-btn-lime"
          disabled={status === 'submitting'}
          style={{ width: '100%', marginTop: 6 }}
        >
          {status === 'submitting'
            ? t('Đang gửi…', 'Sending…')
            : t('Đăng ký tư vấn miễn phí', 'Book free consultation')}{' '}
          <IArr s={14} />
        </button>
      </form>
    </FormCard>
  );
}

function AthleteForm({ lang }: { lang: Lang }) {
  const t = useT(lang);
  const [form, set, reset] = useForm();
  const [status, setStatus] = React.useState<Status>('idle');
  const [err, setErr] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('submitting');
    setErr(null);
    try {
      await submit('5sport-athlete', form);
      setStatus('success');
    } catch (e) {
      setStatus('error');
      setErr(e instanceof Error ? e.message : 'error');
    }
  }

  return (
    <FormCard
      id="lead-form-vdv"
      accent="var(--s5-lime)"
      tag="🏸 VĐV"
      title={t('Tham gia Early Access', 'Join Early Access')}
      subtitle={t(
        'Tạo profile, nhận invite khi 5Sport mở bản beta.',
        'Get your profile + beta invite when we launch.',
      )}
      status={status}
      onReset={() => {
        reset();
        setStatus('idle');
      }}
      lang={lang}
    >
      <form onSubmit={onSubmit} noValidate>
        <input
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={form.website}
          onChange={(e) => set('website', e.target.value)}
          style={{ position: 'absolute', left: '-10000px', width: 1, height: 1 }}
          aria-hidden
        />
        <Field label={t('Họ tên', 'Full name')}>
          <input
            required
            style={inputStyle}
            value={form.full_name}
            onChange={(e) => set('full_name', e.target.value)}
            placeholder={t('Tên của bạn', 'Your name')}
          />
        </Field>
        <Field label="Email">
          <input
            required
            type="email"
            style={inputStyle}
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            placeholder="you@example.com"
          />
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field label={t('Môn chơi', 'Sport')}>
            <select
              style={inputStyle}
              value={form.sport_type}
              onChange={(e) => set('sport_type', e.target.value as FormState['sport_type'])}
            >
              <option value="">—</option>
              <option value="pickleball">Pickleball</option>
              <option value="badminton">{t('Cầu lông', 'Badminton')}</option>
              <option value="both">{t('Cả hai', 'Both')}</option>
            </select>
          </Field>
          <Field label={t('Thành phố', 'City')}>
            <input
              style={inputStyle}
              value={form.city}
              onChange={(e) => set('city', e.target.value)}
              placeholder="TP.HCM"
            />
          </Field>
        </div>

        <div style={{ marginTop: 6, marginBottom: 14, display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 12, color: 'rgba(255,255,255,0.66)' }}>
          {[t('5Sport Rating', '5Sport Rating'), t('Court Finder', 'Court Finder'), t('Match với VĐV cùng trình', 'Skill-matched partners')].map((it) => (
            <span key={it} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: 'var(--s5-lime)' }}><ICheck s={14} sw={2.5} /></span>
              {it}
            </span>
          ))}
        </div>

        {err && (
          <div style={{ color: '#FFB4B4', fontSize: 12, marginBottom: 12 }}>
            {t('Gửi không thành công', 'Submission failed')}: {err}
          </div>
        )}

        <button
          type="submit"
          className="s5-btn s5-btn-primary"
          disabled={status === 'submitting'}
          style={{ width: '100%', marginTop: 6 }}
        >
          {status === 'submitting' ? t('Đang gửi…', 'Sending…') : t('Đăng ký Early Access', 'Join Early Access')} <IArr s={14} />
        </button>
      </form>
    </FormCard>
  );
}
