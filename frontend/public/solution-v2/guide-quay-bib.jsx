// guide-quay-bib.jsx — "Quay BIB" tutorial with slot machine animation (~35s)

(function() {
  const { useSprite, Sprite, Easing, clamp, interpolate,
          BrowserFrame, StepIndicator, Cursor,
          MyTicketsPage, TicketDetailPage, SuccessOverlay,
          GuideIntro, GuideOutro,
          Sparkles, Confetti, Wobble, AttentionPulse, SlideInPage,
          STD_TICKETS } = window;

  const STEPS = [
    { at: 3,  dur: 5, title: 'Vào [Vé của tôi] → chọn vé chưa có BIB', sub: 'Vé chưa quay BIB sẽ có nhãn "Quay BIB"' },
    { at: 8,  dur: 5, title: 'Bấm nút [Quay BIB] trong chi tiết vé',    sub: 'Hệ thống mở giao diện quay BIB ngẫu nhiên' },
    { at: 13, dur: 12, title: 'Quay BIB — bấm bao nhiêu lần tuỳ thích', sub: 'Bấm [Quay BIB] để random — có thể quay lại nếu không ưng' },
    { at: 25, dur: 5, title: 'Bấm [Xác nhận] để hoàn tất',              sub: 'Hết thời gian đếm ngược, hệ thống lấy số BIB cuối cùng' },
  ];

  function GuideQuayBib() {
    const { localTime: t } = useSprite();

    if (t < 3) return <GuideIntro
      title={<>Quay BIB<br/>ngẫu nhiên</>}
      subtitle="Random số BIB cho giải chạy. Quay lại bao nhiêu lần tuỳ bạn — đến khi nào ưng ý."
      tags={['🎰 Slot machine', '4 bước', 'Random fair']}
      eyebrow="Hướng dẫn · Lucky draw"
      t={t} dur={3}
    />;

    if (t >= 30) return <GuideOutro t={t - 30} dur={5} />;

    const step = STEPS.findIndex(s => t >= s.at && t < s.at + s.dur);
    const cur = STEPS[step] ?? STEPS[STEPS.length - 1];
    const localT = t - cur.at;

    return (
      <div style={{ position: 'absolute', inset: 0, background: 'var(--5s-bg)' }}>
        <div style={{ position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse at 50% 30%, rgba(217,119,6,0.06), transparent 60%)' }} />
        <div style={{ position: 'absolute', left: 210, top: 80 }}>
          <BrowserFrame width={1500} height={770} url="https://5bib.com/me/tickets">
            {step === 0 && <Step1 t={localT} />}
            {step === 1 && <Step2 t={localT} />}
            {step === 2 && <Step3 t={localT} />}
            {step === 3 && <Step4 t={localT} />}
          </BrowserFrame>
        </div>
        <StepIndicator step={(step ?? 0) + 1} total={4} title={cur.title} sub={cur.sub} />
      </div>
    );
  }

  function Step1({ t }) {
    // Vé của tôi list, ticket 0 needs BIB spin
    const cx = 100 + (285 - 100) * Easing.easeOutCubic(clamp((t - 0.6) / 1.6, 0, 1));
    const cy = 600 + (290 - 600) * Easing.easeOutCubic(clamp((t - 0.6) / 1.6, 0, 1));
    const pressed = t > 2.4 && t < 2.9;
    const sparkleActive = t > 2.4 && t < 3.2;
    const highlight = t > 1.8;
    return (
      <SlideInPage t={t} dur={0.4} direction="right">
        <MyTicketsPage highlightIdx={highlight ? 0 : -1} />
        {/* "Quay BIB" pill badge on first ticket */}
        <div style={{
          position: 'absolute', top: 235, left: 260, zIndex: 5,
          background: 'var(--5s-gold)', color: '#fff',
          padding: '4px 10px', borderRadius: 6,
          fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 11,
          letterSpacing: '.14em', textTransform: 'uppercase',
          transform: `rotate(${Math.sin(t * 2) * 3}deg)`,
        }}>🎰 Cần quay BIB</div>
        <Cursor x={cx} y={cy} pressed={pressed} />
        <Sparkles x={cx} y={cy} active={sparkleActive} t={t - 2.4} color="#D97706" />
      </SlideInPage>
    );
  }

  function Step2({ t }) {
    // Ticket detail with "Quay BIB" highlighted
    const cx = 100 + (1180 - 100) * Easing.easeOutCubic(clamp((t - 0.5) / 1.5, 0, 1));
    const cy = 700 + (520 - 700) * Easing.easeOutCubic(clamp((t - 0.5) / 1.5, 0, 1));
    const pressed = t > 2.2 && t < 2.7;
    const sparkleActive = t > 2.2 && t < 3.0;

    // Ticket without BIB
    const ticket = { ...STD_TICKETS[0], bib: '????', status: 'Cần quay BIB' };
    return (
      <SlideInPage t={t} dur={0.4} direction="right">
        <TicketDetailPage ticket={ticket} highlightAction="quay-bib" />
        <Cursor x={cx} y={cy} pressed={pressed} />
        <Sparkles x={cx} y={cy} active={sparkleActive} t={t - 2.2} color="#D97706" />
      </SlideInPage>
    );
  }

  function Step3({ t }) {
    // The slot machine!
    // 0-0.5: page fade-in
    // 0.5-1.5: cursor moves to "Quay BIB" button
    // 1.5-2.0: tap, spin starts
    // 2.0-8.0: digits spin, settling sequentially
    // 8.0-9.0: BIB revealed
    // 9.0-11.0: hold, sparkles
    // 11.0-12.0: cursor moves to "Xác nhận" button (next step)

    const cx = 100 + (650 - 100) * Easing.easeOutCubic(clamp((t - 0.6) / 1.2, 0, 1));
    const cy = 700 + (560 - 700) * Easing.easeOutCubic(clamp((t - 0.6) / 1.2, 0, 1));
    const buttonPressed = t > 1.6 && t < 2.1;
    const spinning = t > 1.8;

    // Each digit settles at a different time (cascade)
    const settleStarts = [3.0, 4.0, 5.0, 6.0]; // when each digit locks
    const finalDigits = ['1', '2', '4', '7'];

    return (
      <SlideInPage t={t} dur={0.4} direction="up">
        <SlotMachineScreen t={t}
          spinning={spinning}
          settleStarts={settleStarts}
          finalDigits={finalDigits}
          buttonPressed={buttonPressed}
        />
        <Cursor x={cx} y={cy} pressed={buttonPressed} />
        <Sparkles x={cx} y={cy} active={buttonPressed} t={t - 1.6} color="#D97706" />
        {/* Confetti on reveal */}
        <Confetti active={t > 7.0} t={t - 7.0} originX={750} originY={400}
          colors={['#D97706','#FF0E65','#1D49FF','#22C55E','#FBBF24']}
          count={60} durationSec={4} />
      </SlideInPage>
    );
  }

  function Step4({ t }) {
    // Final state: BIB revealed, cursor moves to Xác nhận, then success overlay
    let cx, cy, pressed = false;
    if (t < 1.2) {
      const k = Easing.easeOutCubic(clamp(t / 1.2, 0, 1));
      cx = 200 + (1100 - 200) * k;
      cy = 700 + (560 - 700) * k;
    } else {
      cx = 1100; cy = 560;
      pressed = t > 1.4 && t < 1.9;
    }
    const successPhase = t > 1.9;
    const scale = successPhase ? Easing.easeOutBack(clamp((t - 1.9) / 0.6, 0, 1)) : 0;
    const checkProgress = clamp((t - 2.3) / 0.5, 0, 1);

    return (
      <SlideInPage t={t} dur={0.4} direction="up">
        <SlotMachineScreen t={t + 100}
          spinning={false}
          settleStarts={[0, 0, 0, 0]}
          finalDigits={['1', '2', '4', '7']}
          highlightConfirm={t > 0.6}
        />
        {!successPhase && <Cursor x={cx} y={cy} pressed={pressed} />}
        {successPhase && (
          <SuccessOverlay scale={scale} checkProgress={checkProgress}
            title="BIB của bạn: 1247"
            sub="Đã được gán cho vé Saigon Half Marathon 2026"
          />
        )}
        <Confetti active={successPhase} t={t - 1.9} originX={960} originY={540}
          colors={['#D97706','#FF0E65','#1D49FF','#22C55E','#FBBF24']} count={80} durationSec={3.5} />
      </SlideInPage>
    );
  }

  // ── The slot machine UI ────────────────────────────────────────────
  function SlotMachineScreen({ t, spinning, settleStarts, finalDigits, buttonPressed, highlightConfirm }) {
    return (
      <div style={{ width: '100%', height: '100%', background: 'var(--5s-bg)', position: 'relative' }}>
        <div style={{ height: 56, background: 'var(--5s-blue)', display: 'flex',
          alignItems: 'center', padding: '0 32px', gap: 16 }}>
          <img src="assets/5bib-logo-white.png" style={{ height: 22 }} />
          <div style={{ flex: 1 }}/>
          <div style={{ color: 'rgba(255,255,255,0.8)', fontFamily: 'var(--font-body)',
            fontWeight: 700, fontSize: 13 }}>Saigon Half Marathon 2026</div>
        </div>
        <div style={{ padding: '40px 80px', textAlign: 'center' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 10,
            padding: '6px 16px',
            background: 'rgba(217,119,6,0.1)',
            border: '1px solid rgba(217,119,6,0.3)',
            borderRadius: 9999,
            color: 'var(--5s-gold)',
            fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 12,
            letterSpacing: '.22em', textTransform: 'uppercase',
          }}>
            <Wobble t={t} amp={4} freq={2}>🎰</Wobble> Lucky BIB Draw
          </div>
          <div style={{
            marginTop: 14, fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 56,
            letterSpacing: '-0.03em', textTransform: 'uppercase', color: 'var(--5s-text)',
            lineHeight: 1,
          }}>
            Số BIB của bạn
          </div>
          <div style={{
            marginTop: 8, fontFamily: 'var(--font-body)', fontSize: 17,
            color: 'var(--5s-text-muted)', fontWeight: 500,
          }}>
            Quay ngẫu nhiên — quay lại tuỳ thích đến khi ưng ý
          </div>

          {/* Slot reels */}
          <div style={{
            margin: '36px auto 24px',
            display: 'flex', gap: 18, justifyContent: 'center',
            padding: '32px 40px',
            background: 'linear-gradient(180deg, #1B2238 0%, #0a0e1a 100%)',
            borderRadius: 24,
            boxShadow: 'inset 0 6px 20px rgba(0,0,0,0.5), 0 20px 50px rgba(0,0,0,0.25)',
            width: 'fit-content',
          }}>
            {finalDigits.map((d, i) => (
              <SlotReel key={i}
                t={t}
                spinning={spinning}
                settleAt={settleStarts[i]}
                finalDigit={d}
              />
            ))}
          </div>

          {/* Action buttons */}
          <div style={{ marginTop: 24, display: 'flex', gap: 14, justifyContent: 'center' }}>
            <button style={{
              padding: '16px 36px',
              background: 'var(--5s-gold)', color: '#fff',
              border: 'none', borderRadius: 12,
              fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 900,
              letterSpacing: '.14em', textTransform: 'uppercase',
              boxShadow: '0 8px 20px rgba(217,119,6,0.35)',
              transform: buttonPressed ? 'scale(0.96)' : 'scale(1)',
              transition: 'all 200ms',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <Wobble t={t} amp={6} freq={2}>🎰</Wobble> Quay BIB
            </button>
            <button style={{
              padding: '16px 36px',
              background: highlightConfirm ? 'var(--5s-success)' : 'var(--5s-blue)',
              color: '#fff',
              border: 'none', borderRadius: 12,
              fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 900,
              letterSpacing: '.14em', textTransform: 'uppercase',
              boxShadow: highlightConfirm ? '0 0 0 4px rgba(255,14,101,0.3), 0 8px 20px rgba(22,101,52,0.3)' : '0 4px 12px rgba(29,73,255,0.2)',
              transition: 'all 200ms',
            }}>Xác nhận</button>
          </div>

          {spinning && (
            <div style={{
              marginTop: 18,
              fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--5s-text-subtle)',
              fontWeight: 600,
            }}>
              ⏱ {Math.max(0, 10 - Math.floor(t - 1.8))}s còn lại để xác nhận
            </div>
          )}
        </div>
      </div>
    );
  }

  function SlotReel({ t, spinning, settleAt, finalDigit }) {
    // Reel shows random digit when spinning, locks to final after settleAt
    const isSettled = t >= settleAt && settleAt > 0;
    let digit = '?';
    if (isSettled || settleAt === 0) {
      digit = finalDigit;
    } else if (spinning) {
      // rapid changing digit
      digit = String(Math.floor((t * 30 + settleAt * 7) % 10));
    }
    // Settle bounce
    const justSettled = isSettled && (t - settleAt) < 0.4;
    const bounceScale = justSettled
      ? 1 + Math.sin((t - settleAt) * 16) * 0.06 * (1 - (t - settleAt) / 0.4)
      : 1;

    return (
      <div style={{
        width: 110, height: 160,
        background: '#fff',
        borderRadius: 14,
        border: '4px solid rgba(255,255,255,0.18)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative', overflow: 'hidden',
        boxShadow: isSettled ? '0 0 0 3px var(--5s-gold), 0 6px 14px rgba(217,119,6,0.35)' : '0 4px 14px rgba(0,0,0,0.4)',
        transition: 'box-shadow 250ms',
      }}>
        <div style={{
          fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 110,
          color: isSettled ? 'var(--5s-blue)' : 'var(--5s-text)',
          letterSpacing: '-0.04em', lineHeight: 1,
          transform: `scale(${bounceScale})`,
          transition: isSettled ? 'color 200ms' : 'none',
        }}>
          {digit}
        </div>
        {/* "shine" sweep when settled */}
        {justSettled && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(110deg, transparent 40%, rgba(255,255,255,0.6) 50%, transparent 60%)',
            transform: `translateX(${-100 + (t - settleAt) * 400}%)`,
          }}/>
        )}
      </div>
    );
  }

  window.GUIDE_QUAY_BIB = {
    slug: 'quay-bib',
    title: 'Quay BIB ngẫu nhiên',
    subtitle: 'Random số BIB cho giải chạy — quay lại tuỳ ý',
    duration: 35,
    icon: '🎰',
    color: 'var(--5s-gold)',
    Component: GuideQuayBib,
    persistKey: 'guide-quay-bib',
    faq: [
      { q: 'Tôi có thể quay lại bao nhiêu lần?', a: 'Không giới hạn — trong khoảng thời gian đếm ngược, bạn cứ bấm "Quay BIB" đến khi ưng ý.' },
      { q: 'Hết thời gian mà chưa xác nhận?', a: 'Hệ thống tự động lấy số BIB gần nhất bạn quay được.' },
      { q: 'BIB có bị trùng không?', a: 'Không. Hệ thống đảm bảo mỗi BIB là duy nhất trong giải.' },
      { q: 'Đã xác nhận BIB có đổi được không?', a: 'Không thể đổi sau khi xác nhận. Cân nhắc kỹ trước khi bấm "Xác nhận".' },
    ],
  };
})();
