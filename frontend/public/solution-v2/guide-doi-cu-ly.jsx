// guide-doi-cu-ly.jsx — "Đổi cự ly vé" tutorial, web-only, ~40s, with effects

(function() {
  const { useSprite, Easing, clamp, interpolate,
          BrowserFrame, BibWebHeader, TicketCard, StepIndicator, Cursor,
          MyTicketsPage, TicketDetailPage, SuccessOverlay,
          GuideIntro, GuideOutro,
          Sparkles, Confetti, AttentionPulse, SlideInPage, Wobble,
          STD_TICKETS } = window;

  const STEPS = [
    { at: 3,  dur: 4, title: 'Vé của tôi · Chọn vé cần đổi',          sub: 'Trong danh sách vé, bấm vào vé chưa diễn ra' },
    { at: 7,  dur: 4, title: 'Bấm [Đổi cự ly]',                       sub: 'Chỉ đổi được trong thời gian BTC quy định' },
    { at: 11, dur: 5, title: 'Chọn cự ly mới (5K → 10K) → [Tiếp tục]', sub: 'Vé mới giữ thông tin VĐV, đổi BIB và cự ly' },
    { at: 16, dur: 4, title: 'Bổ sung thông tin vé mới → [Tiếp tục]', sub: 'Đối chiếu thông tin VĐV và thanh toán' },
    { at: 20, dur: 5, title: 'Chọn thanh toán → [Thanh toán]',         sub: 'Thanh toán phí chênh lệch (cự ly cao hơn)' },
    { at: 25, dur: 5, title: 'Hoàn tất đổi cự ly! 🎉',                  sub: 'Vé mới đã sẵn sàng trong [Vé của tôi]' },
  ];

  function GuideDoiCuLy() {
    const { localTime: t } = useSprite();

    if (t < 3) return <GuideIntro
      title={<>Đổi cự ly<br/>vé chạy</>}
      subtitle="Đổi sang cự ly khác trong cùng giải (5K → 10K → 21K → 42K). Chỉ đổi được trong thời gian BTC quy định."
      tags={['6 bước', 'Web only', 'Phí chênh lệch']}
      eyebrow="Hướng dẫn · Quản lý vé"
      t={t} dur={3}
    />;

    if (t >= 30) return <GuideOutro t={t - 30} dur={5} />;

    const step = STEPS.findIndex(s => t >= s.at && t < s.at + s.dur);
    const cur = STEPS[step] ?? STEPS[STEPS.length - 1];
    const localT = t - cur.at;

    return (
      <div style={{ position: 'absolute', inset: 0, background: 'var(--5s-bg)' }}>
        <div style={{ position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse at 50% 30%, rgba(29,73,255,0.05), transparent 60%)' }} />
        <div style={{ position: 'absolute', left: 210, top: 80 }}>
          <BrowserFrame width={1500} height={770} url="https://5bib.com/me/tickets">
            {step === 0 && <Step1 t={localT} />}
            {step === 1 && <Step2 t={localT} />}
            {step === 2 && <Step3 t={localT} />}
            {step === 3 && <Step4 t={localT} />}
            {step === 4 && <Step5 t={localT} />}
            {step === 5 && <Step6 t={localT} />}
          </BrowserFrame>
        </div>
        <StepIndicator step={(step ?? 0) + 1} total={6} title={cur.title} sub={cur.sub} />
      </div>
    );
  }

  function Step1({ t }) {
    const cx = 100 + (285 - 100) * Easing.easeOutCubic(clamp((t - 0.6) / 1.4, 0, 1));
    const cy = 600 + (290 - 600) * Easing.easeOutCubic(clamp((t - 0.6) / 1.4, 0, 1));
    const pressed = t > 2.2 && t < 2.7;
    return (
      <SlideInPage t={t} dur={0.4} direction="right">
        <MyTicketsPage highlightIdx={t > 1.6 ? 0 : -1} />
        <Cursor x={cx} y={cy} pressed={pressed} />
        <Sparkles x={cx} y={cy} active={pressed} t={t - 2.2} />
      </SlideInPage>
    );
  }

  function Step2({ t }) {
    const cx = 100 + (1180 - 100) * Easing.easeOutCubic(clamp((t - 0.5) / 1.5, 0, 1));
    const cy = 700 + (480 - 700) * Easing.easeOutCubic(clamp((t - 0.5) / 1.5, 0, 1));
    const pressed = t > 2.2 && t < 2.7;
    return (
      <SlideInPage t={t} dur={0.4} direction="right">
        <TicketDetailPage ticket={STD_TICKETS[0]} highlightAction="doi-cu-ly" />
        <Cursor x={cx} y={cy} pressed={pressed} />
        <Sparkles x={cx} y={cy} active={pressed} t={t - 2.2} />
      </SlideInPage>
    );
  }

  function Step3({ t }) {
    const distances = [
      { d: '5K', price: '350.000₫', current: true },
      { d: '10K', price: '550.000₫', diff: '+200.000₫' },
      { d: '21K', price: '750.000₫', diff: '+400.000₫' },
      { d: '42K', price: '1.250.000₫', diff: '+900.000₫' },
    ];

    let cx, cy, pressed = false;
    if (t < 1.0) { cx = 600; cy = 580; }
    else if (t < 2.5) {
      const k = Easing.easeOutCubic(clamp((t - 1.0) / 1.0, 0, 1));
      cx = 600 + (715 - 600) * k;
      cy = 580 + (440 - 580) * k;
      pressed = t > 2.0 && t < 2.4;
    } else {
      const k = Easing.easeOutCubic(clamp((t - 2.5) / 1.0, 0, 1));
      cx = 715 + (1280 - 715) * k;
      cy = 440 + (620 - 440) * k;
      pressed = t > 3.2 && t < 3.7;
    }
    const tenKSelected = t > 2.0;

    return (
      <SlideInPage t={t} dur={0.4} direction="up">
        <BibWebHeader />
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.45)', top: 56 }} />
        <div style={{
          position: 'absolute', left: '50%', top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 760, background: '#fff', borderRadius: 18,
          boxShadow: '0 30px 80px rgba(0,0,0,0.25)',
          overflow: 'hidden',
        }}>
          <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--5s-border)' }}>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 800,
              letterSpacing: '.22em', textTransform: 'uppercase', color: 'var(--5s-text-subtle)' }}>
              BIB 1247 · Saigon Half Marathon 2026
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 28,
              letterSpacing: '-0.02em', marginTop: 6, color: 'var(--5s-text)' }}>
              Chọn cự ly mới
            </div>
          </div>
          <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {distances.map((d, i) => {
              const selected = (d.d === '10K' && tenKSelected);
              return (
                <div key={d.d} style={{
                  display: 'flex', alignItems: 'center',
                  padding: '16px 18px',
                  background: selected ? 'rgba(29,73,255,0.06)' : (d.current ? 'rgba(28,25,23,0.04)' : '#fff'),
                  border: selected ? '2px solid var(--5s-blue)' : '1.5px solid var(--5s-border)',
                  borderRadius: 10,
                  gap: 14, transition: 'all 200ms',
                  boxShadow: selected ? '0 0 0 4px rgba(29,73,255,0.1)' : 'none',
                }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%',
                    border: selected ? '6px solid var(--5s-blue)' : '2px solid var(--5s-border)',
                    background: '#fff', transition: 'all 200ms',
                  }} />
                  <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 26,
                    color: 'var(--5s-text)', minWidth: 70 }}>{d.d}</div>
                  <div style={{ flex: 1 }} />
                  {d.current && (
                    <div style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 10,
                      letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--5s-text-muted)',
                      background: 'rgba(28,25,23,0.08)', padding: '4px 9px', borderRadius: 5 }}>
                      Hiện tại
                    </div>
                  )}
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 17,
                      color: 'var(--5s-text)' }}>{d.price}</div>
                    {d.diff && (
                      <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 12,
                        color: 'var(--5s-magenta)', marginTop: 2 }}>{d.diff}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ padding: '0 22px 22px', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button style={{
              padding: '13px 22px',
              background: 'transparent', color: 'var(--5s-text-muted)',
              border: '1.5px solid var(--5s-border)', borderRadius: 10,
              fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 700,
              letterSpacing: '.06em', textTransform: 'uppercase',
            }}>Hủy</button>
            <button style={{
              padding: '13px 26px',
              background: 'var(--5s-blue)', color: '#fff',
              border: 'none', borderRadius: 10,
              fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 900,
              letterSpacing: '.08em', textTransform: 'uppercase',
              boxShadow: t > 3.0 ? '0 0 0 4px rgba(255,14,101,0.3)' : 'none',
              transform: t > 3.2 && t < 3.7 ? 'scale(0.97)' : 'scale(1)',
              transition: 'all 200ms',
            }}>Tiếp tục →</button>
          </div>
        </div>
        <Cursor x={cx} y={cy} pressed={pressed} />
        <Sparkles x={cx} y={cy} active={pressed} t={t - 3.2} />
      </SlideInPage>
    );
  }

  function Step4({ t }) {
    let cx = 600, cy = 600, pressed = false;
    if (t < 1.5) {
      cx = 600 + Math.sin(t * 4) * 10; cy = 580;
    } else {
      const k = Easing.easeOutCubic(clamp((t - 1.5) / 1.3, 0, 1));
      cx = 600 + (1280 - 600) * k;
      cy = 580 + (660 - 580) * k;
      pressed = t > 2.6 && t < 3.1;
    }

    return (
      <SlideInPage t={t} dur={0.4} direction="up">
        <BibWebHeader />
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.45)', top: 56 }} />
        <div style={{
          position: 'absolute', left: '50%', top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 800, background: '#fff', borderRadius: 18,
          boxShadow: '0 30px 80px rgba(0,0,0,0.25)',
        }}>
          <div style={{ padding: '22px 28px', borderBottom: '1px solid var(--5s-border)' }}>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 800,
              letterSpacing: '.22em', textTransform: 'uppercase', color: 'var(--5s-text-subtle)' }}>
              Bước 4 / 6 · Bổ sung thông tin
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 24,
              letterSpacing: '-0.02em', marginTop: 6, color: 'var(--5s-text)' }}>
              Vé mới · 10K · BIB sẽ được cấp lại
            </div>
          </div>
          <div style={{ padding: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {[
              ['Họ và tên', 'Nguyễn Minh Anh'],
              ['Email', 'minhanh@gmail.com'],
              ['Số điện thoại', '0901 234 567'],
              ['Ngày sinh', '15.08.1992'],
              ['Giới tính', 'Nam'],
              ['Áo size', 'M'],
              ['Hạng mục', 'M30-39'],
              ['Liên hệ khẩn cấp', '0912 345 678'],
            ].map(([k, v]) => (
              <div key={k}>
                <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 800,
                  letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--5s-text-subtle)',
                  marginBottom: 5 }}>{k}</div>
                <div style={{
                  padding: '11px 14px', border: '1.5px solid var(--5s-border)', borderRadius: 8,
                  fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 14,
                  color: 'var(--5s-text)', background: '#FAF8F5',
                }}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{ padding: '0 24px 22px', display: 'flex', gap: 10, justifyContent: 'space-between' }}>
            <button style={{
              padding: '13px 22px',
              background: 'transparent', color: 'var(--5s-text-muted)',
              border: '1.5px solid var(--5s-border)', borderRadius: 10,
              fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 700,
              letterSpacing: '.06em', textTransform: 'uppercase',
            }}>← Quay lại</button>
            <button style={{
              padding: '13px 30px',
              background: 'var(--5s-blue)', color: '#fff',
              border: 'none', borderRadius: 10,
              fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 900,
              letterSpacing: '.08em', textTransform: 'uppercase',
              boxShadow: t > 2.4 ? '0 0 0 4px rgba(255,14,101,0.3)' : 'none',
              transform: t > 2.6 && t < 3.1 ? 'scale(0.97)' : 'scale(1)',
              transition: 'all 200ms',
            }}>Tiếp tục →</button>
          </div>
        </div>
        <Cursor x={cx} y={cy} pressed={pressed} />
        <Sparkles x={cx} y={cy} active={pressed} t={t - 2.6} />
      </SlideInPage>
    );
  }

  function Step5({ t }) {
    let cx, cy, pressed = false;
    if (t < 1.0) { cx = 600; cy = 580; }
    else if (t < 2.4) {
      const k = Easing.easeOutCubic(clamp((t - 1.0) / 1.4, 0, 1));
      cx = 600 + (480 - 600) * k;
      cy = 580 + (350 - 580) * k;
      pressed = t > 2.1 && t < 2.4;
    } else {
      const k = Easing.easeOutCubic(clamp((t - 2.4) / 1.3, 0, 1));
      cx = 480 + (1180 - 480) * k;
      cy = 350 + (640 - 350) * k;
      pressed = t > 3.5 && t < 3.9;
    }

    const methods = [
      { name: 'VietQR · Momo · ZaloPay', icon: 'qr', selected: t > 2.2 },
      { name: 'Thẻ Visa / Mastercard', icon: 'card' },
      { name: 'Internet Banking', icon: 'bank' },
    ];

    return (
      <SlideInPage t={t} dur={0.4} direction="up">
        <BibWebHeader />
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.45)', top: 56 }} />
        <div style={{
          position: 'absolute', left: '50%', top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 760, background: '#fff', borderRadius: 18,
          boxShadow: '0 30px 80px rgba(0,0,0,0.25)',
        }}>
          <div style={{ padding: '22px 28px', borderBottom: '1px solid var(--5s-border)' }}>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 800,
              letterSpacing: '.22em', textTransform: 'uppercase', color: 'var(--5s-text-subtle)' }}>
              Bước 5 / 6 · Thanh toán phí chênh lệch
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 32,
              letterSpacing: '-0.02em', marginTop: 6, color: 'var(--5s-text)' }}>
              <span style={{ color: 'var(--5s-blue)' }}>200.000₫</span> để hoàn tất
            </div>
          </div>
          <div style={{ padding: 24 }}>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 800,
              letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--5s-text-subtle)',
              marginBottom: 12 }}>
              Phương thức thanh toán
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {methods.map((m, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 18px',
                  background: m.selected ? 'rgba(29,73,255,0.06)' : '#fff',
                  border: m.selected ? '2px solid var(--5s-blue)' : '1.5px solid var(--5s-border)',
                  borderRadius: 10, transition: 'all 200ms',
                }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%',
                    border: m.selected ? '6px solid var(--5s-blue)' : '2px solid var(--5s-border)',
                    background: '#fff',
                  }} />
                  <PayIcon kind={m.icon} />
                  <div style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 15,
                    color: 'var(--5s-text)' }}>{m.name}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 18, padding: 16, background: 'var(--5s-surface)',
              borderRadius: 10, display: 'grid', gridTemplateColumns: '1fr auto', gap: 6, rowGap: 5 }}>
              <Row k="Giá vé 10K" v="550.000₫"/>
              <Row k="Đã thanh toán (5K)" v="− 350.000₫"/>
              <Row k="Phí đổi cự ly" v="0₫"/>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 15,
                color: 'var(--5s-text)', paddingTop: 6, borderTop: '1px solid var(--5s-border)' }}>
                Cần thanh toán
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 20,
                color: 'var(--5s-blue)', paddingTop: 6, borderTop: '1px solid var(--5s-border)' }}>
                200.000₫
              </div>
            </div>
          </div>
          <div style={{ padding: '0 24px 22px', display: 'flex', justifyContent: 'flex-end' }}>
            <button style={{
              padding: '13px 28px',
              background: 'var(--5s-blue)', color: '#fff',
              border: 'none', borderRadius: 10,
              fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 900,
              letterSpacing: '.08em', textTransform: 'uppercase',
              boxShadow: t > 3.2 ? '0 0 0 4px rgba(255,14,101,0.3)' : 'none',
              transform: t > 3.5 && t < 3.9 ? 'scale(0.97)' : 'scale(1)',
              transition: 'all 200ms',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              💳 Thanh toán 200.000₫
            </button>
          </div>
        </div>
        <Cursor x={cx} y={cy} pressed={pressed} />
        <Sparkles x={cx} y={cy} active={pressed} t={t - 3.5} />
      </SlideInPage>
    );
  }

  function Step6({ t }) {
    const scale = Easing.easeOutBack(clamp(t / 0.6, 0, 1));
    const checkProgress = clamp((t - 0.4) / 0.5, 0, 1);
    return (
      <SlideInPage t={t} dur={0.4} direction="up">
        <MyTicketsPage highlightIdx={-1} />
        <SuccessOverlay scale={scale} checkProgress={checkProgress}
          title="Đã đổi cự ly!"
          sub="Vé mới · 10K · BIB sẽ được cấp lại trong 5 phút"
        />
        <Confetti active={t > 0.5} t={t - 0.5} originX={960} originY={420}
          colors={['#1D49FF','#FF0E65','#22C55E','#D97706','#fff']}
          count={90} durationSec={3.5} />
      </SlideInPage>
    );
  }

  function PayIcon({ kind }) {
    if (kind === 'qr') return (
      <div style={{ width: 28, height: 28, background: '#1C1917', borderRadius: 5,
        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff">
          <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
          <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="3" height="3"/>
          <rect x="18" y="14" width="3" height="3"/><rect x="14" y="18" width="3" height="3"/>
          <rect x="18" y="18" width="3" height="3"/>
        </svg>
      </div>
    );
    if (kind === 'card') return (
      <div style={{ width: 28, height: 28, background: 'var(--5s-blue)', borderRadius: 5,
        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
          <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
        </svg>
      </div>
    );
    return (
      <div style={{ width: 28, height: 28, background: 'var(--5s-success)', borderRadius: 5,
        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
          <path d="m12 2 10 5v6c0 5-4 8-10 9-6-1-10-4-10-9V7l10-5z"/>
        </svg>
      </div>
    );
  }

  function Row({ k, v }) {
    return (<>
      <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--5s-text-muted)' }}>{k}</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, textAlign: 'right' }}>{v}</div>
    </>);
  }

  window.GUIDE_DOI_CU_LY = {
    slug: 'doi-cu-ly',
    title: 'Đổi cự ly vé chạy',
    subtitle: 'Đổi 5K → 10K → 21K → 42K trong cùng giải',
    duration: 35,
    icon: '🔄',
    color: 'var(--5s-blue)',
    Component: GuideDoiCuLy,
    persistKey: 'guide-doi-cu-ly',
    faq: [
      { q: 'Tôi có thể đổi cự ly mấy lần?', a: 'Tối đa 1 lần / vé, trong thời gian BTC quy định.' },
      { q: 'Đổi sang cự ly có giá cao hơn?', a: 'Bạn cần thanh toán thêm phần chênh lệch. Hệ thống tự tính trước khi xác nhận.' },
      { q: 'Đổi sang cự ly có giá thấp hơn?', a: 'Tuỳ chính sách BTC từng giải. Một số giải hoàn tiền chênh lệch, một số không.' },
      { q: 'BIB có giữ nguyên không?', a: 'BIB sẽ được cấp lại tương ứng với cự ly mới. BIB cũ không còn hiệu lực.' },
      { q: 'Đã check-in / ký miễn trừ rồi có đổi được không?', a: 'Không. Vé đã ký sẽ khoá lại.' },
    ],
  };
})();
