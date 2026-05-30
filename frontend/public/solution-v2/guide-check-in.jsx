// guide-check-in.jsx — "Ký miễn trừ + lấy QR check-in" tutorial (~33s)

(function() {
  const { useSprite, Sprite, Easing, clamp, interpolate,
          BrowserFrame, StepIndicator, Cursor,
          MyTicketsPage, TicketDetailPage, SuccessOverlay,
          GuideIntro, GuideOutro,
          Sparkles, Confetti, AttentionPulse, SlideInPage,
          STD_TICKETS } = window;

  const STEPS = [
    { at: 3,  dur: 5, title: 'Vé của tôi · Chọn vé cần ký miễn trừ', sub: 'Vé sẽ có badge "Chờ ký miễn trừ"' },
    { at: 8,  dur: 4, title: 'Bấm [Ký miễn trừ] trong chi tiết vé',  sub: 'Lưu ý: sau khi ký sẽ không sửa được thông tin' },
    { at: 12, dur: 11, title: 'Đọc điều khoản → đồng ý → ký tên',     sub: 'Ký bằng chuột / ngón tay / bút cảm ứng' },
    { at: 23, dur: 5, title: 'Hoàn tất — mã QR check-in sẵn sàng',   sub: 'Mã QR sẽ được quét tại điểm check-in ngày race' },
  ];

  function GuideCheckIn() {
    const { localTime: t } = useSprite();

    if (t < 3) return <GuideIntro
      title={<>Ký miễn trừ<br/>& QR check-in</>}
      subtitle="Ký miễn trừ trách nhiệm trên web — nhận mã QR check-in ngày race."
      tags={['Chữ ký số', 'QR check-in', '4 bước']}
      eyebrow="Hướng dẫn · Race day prep"
      t={t} dur={3}
    />;

    if (t >= 28) return <GuideOutro t={t - 28} dur={5} />;

    const step = STEPS.findIndex(s => t >= s.at && t < s.at + s.dur);
    const cur = STEPS[step] ?? STEPS[STEPS.length - 1];
    const localT = t - cur.at;

    return (
      <div style={{ position: 'absolute', inset: 0, background: 'var(--5s-bg)' }}>
        <div style={{ position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse at 50% 30%, rgba(255,14,101,0.05), transparent 60%)' }} />
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
    const cx = 100 + (285 - 100) * Easing.easeOutCubic(clamp((t - 0.6) / 1.6, 0, 1));
    const cy = 600 + (290 - 600) * Easing.easeOutCubic(clamp((t - 0.6) / 1.6, 0, 1));
    const pressed = t > 2.4 && t < 2.9;
    return (
      <SlideInPage t={t} dur={0.4} direction="right">
        <MyTicketsPage highlightIdx={t > 1.8 ? 0 : -1} />
        <div style={{
          position: 'absolute', top: 235, left: 260, zIndex: 5,
          background: 'var(--5s-magenta)', color: '#fff',
          padding: '4px 10px', borderRadius: 6,
          fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 11,
          letterSpacing: '.14em', textTransform: 'uppercase',
          transform: `rotate(${Math.sin(t * 2) * 3}deg)`,
        }}>✍️ Chờ ký miễn trừ</div>
        <Cursor x={cx} y={cy} pressed={pressed} />
        <Sparkles x={cx} y={cy} active={pressed} t={t - 2.4} />
      </SlideInPage>
    );
  }

  function Step2({ t }) {
    const cx = 100 + (1180 - 100) * Easing.easeOutCubic(clamp((t - 0.5) / 1.5, 0, 1));
    const cy = 700 + (590 - 700) * Easing.easeOutCubic(clamp((t - 0.5) / 1.5, 0, 1));
    const pressed = t > 2.2 && t < 2.7;
    return (
      <SlideInPage t={t} dur={0.4} direction="right">
        <TicketDetailPage ticket={STD_TICKETS[0]} highlightAction="ky-mien-tru" />
        <Cursor x={cx} y={cy} pressed={pressed} />
        <Sparkles x={cx} y={cy} active={pressed} t={t - 2.2} />
      </SlideInPage>
    );
  }

  function Step3({ t }) {
    // Signature pad
    // 0.0-1.5: page fades in, ToS scroll
    // 1.5-2.5: cursor moves to "Đồng ý" checkbox
    // 2.5-3.5: cursor moves to signature pad
    // 3.5-8.5: signature drawing animation
    // 8.5-9.5: cursor moves to "Xác nhận"
    // 9.5-10: confirm press

    let cx, cy, pressed = false, agreed = false, signing = false;
    if (t < 1.5) {
      cx = 750; cy = 760;
    } else if (t < 2.5) {
      const k = Easing.easeOutCubic(clamp((t - 1.5) / 1.0, 0, 1));
      cx = 750 + (300 - 750) * k;
      cy = 760 + (520 - 760) * k;
      pressed = t > 2.3 && t < 2.5;
    } else if (t < 3.5) {
      agreed = true;
      const k = Easing.easeOutCubic(clamp((t - 2.5) / 1.0, 0, 1));
      cx = 300 + (600 - 300) * k;
      cy = 520 + (560 - 520) * k;
    } else if (t < 8.5) {
      agreed = true;
      signing = true;
      // Cursor follows signature path
      const sigT = clamp((t - 3.5) / 5.0, 0, 1);
      const [px, py] = signaturePoint(sigT);
      cx = 600 + px; cy = 560 + py;
    } else if (t < 9.5) {
      agreed = true; signing = true;
      const k = Easing.easeOutCubic(clamp((t - 8.5) / 1.0, 0, 1));
      cx = 600 + signaturePoint(1)[0] + (550 - signaturePoint(1)[0]) * k;
      cy = 560 + signaturePoint(1)[1] + (760 - signaturePoint(1)[1]) * k;
    } else {
      agreed = true; signing = true;
      cx = 1150; cy = 760; pressed = t > 9.6 && t < 10.1;
    }

    return (
      <SlideInPage t={t} dur={0.4} direction="up">
        <SignaturePadScreen t={t} agreed={agreed} signing={signing} signProgress={clamp((t - 3.5) / 5.0, 0, 1)} />
        <Cursor x={cx} y={cy} pressed={pressed} />
      </SlideInPage>
    );
  }

  function Step4({ t }) {
    // QR code reveal + success
    const scale = Easing.easeOutBack(clamp(t / 0.6, 0, 1));
    const qrProgress = clamp((t - 0.5) / 0.8, 0, 1);
    return (
      <SlideInPage t={t} dur={0.4} direction="up">
        <QRCheckInScreen t={t} qrProgress={qrProgress} />
        <Confetti active={t > 0.6} t={t - 0.6} originX={960} originY={400} count={70} durationSec={3} />
      </SlideInPage>
    );
  }

  // ── Signature pad screen ───────────────────────────────────────────
  function SignaturePadScreen({ t, agreed, signing, signProgress }) {
    return (
      <div style={{ width: '100%', height: '100%', background: '#fff', display: 'flex' }}>
        {/* Left: Terms scroll */}
        <div style={{ flex: 1, padding: '32px 40px', overflow: 'hidden', borderRight: '1px solid var(--5s-border)' }}>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 800,
            letterSpacing: '.22em', textTransform: 'uppercase', color: 'var(--5s-text-subtle)' }}>
            Bước 1 · Đọc cam kết
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 32,
            letterSpacing: '-0.02em', marginTop: 6, color: 'var(--5s-text)' }}>
            Cam kết miễn trừ trách nhiệm
          </div>
          <div style={{
            marginTop: 14, padding: 20,
            background: 'var(--5s-surface)', borderRadius: 12,
            fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--5s-text-muted)',
            lineHeight: 1.65, maxHeight: 380, overflow: 'hidden', position: 'relative',
            transform: `translateY(${t < 1.5 ? -clamp(t / 1.5, 0, 1) * 30 : -30}px)`,
            transition: 'transform 200ms',
          }}>
            Tôi tự nguyện đăng ký và tham gia giải chạy Saigon Half Marathon 2026
            do BTC tổ chức. Tôi xác nhận đã đọc và hiểu rõ các điều khoản về
            an toàn, sức khoẻ và rủi ro khi tham gia.<br/><br/>

            Tôi cam kết:<br/>
            • Đảm bảo đủ sức khoẻ để hoàn thành cự ly đã đăng ký.<br/>
            • Tuân thủ tất cả hướng dẫn của BTC và lực lượng y tế trên đường chạy.<br/>
            • Chịu trách nhiệm cá nhân về mọi rủi ro, thương tích trong quá trình tham gia.<br/><br/>

            Tôi miễn trừ trách nhiệm của BTC, đơn vị tổ chức, đơn vị bảo hiểm và
            các đối tác trong các trường hợp ngoài tầm kiểm soát hợp lý của họ.
            Hình ảnh, video, kết quả thi đấu của tôi có thể được BTC sử dụng cho
            mục đích truyền thông và quảng bá sự kiện...
          </div>

          {/* Agreement checkbox */}
          <label style={{
            display: 'flex', alignItems: 'flex-start', gap: 12, marginTop: 18,
            padding: '14px 16px',
            background: agreed ? 'rgba(29,73,255,0.06)' : 'var(--5s-surface)',
            border: agreed ? '2px solid var(--5s-blue)' : '1.5px solid var(--5s-border)',
            borderRadius: 10,
            cursor: 'pointer', transition: 'all 200ms',
          }}>
            <div style={{
              width: 22, height: 22, borderRadius: 5,
              background: agreed ? 'var(--5s-blue)' : '#fff',
              border: agreed ? 'none' : '2px solid var(--5s-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              {agreed && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><path d="M5 12l5 5L20 7"/></svg>}
            </div>
            <span style={{
              fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 600,
              color: 'var(--5s-text)', lineHeight: 1.45,
            }}>
              Tôi đã đọc, hiểu rõ và đồng ý với các điều khoản của cam kết miễn trừ trách nhiệm trên.
            </span>
          </label>
        </div>

        {/* Right: Signature pad */}
        <div style={{ width: 620, padding: '32px 40px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 800,
            letterSpacing: '.22em', textTransform: 'uppercase', color: 'var(--5s-magenta)' }}>
            Bước 2 · Ký tên
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 30,
            letterSpacing: '-0.02em', marginTop: 6, color: 'var(--5s-text)' }}>
            Chữ ký của bạn
          </div>
          <div style={{ marginTop: 4, fontFamily: 'var(--font-body)', fontSize: 13,
            color: 'var(--5s-text-muted)', fontWeight: 500 }}>
            Ký bằng chuột / ngón tay / bút cảm ứng
          </div>

          <div style={{
            marginTop: 18, flex: 1,
            background: '#FAFAF8',
            border: signing ? '2px solid var(--5s-blue)' : '2px dashed var(--5s-border)',
            borderRadius: 14,
            position: 'relative', overflow: 'hidden',
            transition: 'border 200ms',
            minHeight: 240,
          }}>
            {!signing && (
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-display)', fontSize: 20,
                color: 'var(--5s-text-subtle)', fontWeight: 600,
                fontStyle: 'italic',
              }}>
                Ký vào đây
              </div>
            )}
            <SignatureSVG progress={signing ? signProgress : 0} />
            {/* Baseline */}
            <div style={{
              position: 'absolute', left: 30, right: 30, bottom: 60,
              borderTop: '1px dashed var(--5s-border)',
              opacity: 0.5,
            }}/>
            <div style={{
              position: 'absolute', left: 30, bottom: 30,
              fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 700,
              letterSpacing: '.18em', textTransform: 'uppercase',
              color: 'var(--5s-text-subtle)',
            }}>
              x ___________________________
            </div>
          </div>

          <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
            <button style={{
              padding: '12px 20px',
              background: 'transparent', color: 'var(--5s-text-muted)',
              border: '1.5px solid var(--5s-border)', borderRadius: 10,
              fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 700,
              letterSpacing: '.06em', textTransform: 'uppercase',
            }}>↻ Ký lại</button>
            <div style={{ flex: 1 }}/>
            <button style={{
              padding: '12px 28px',
              background: signing && signProgress > 0.9 ? 'var(--5s-blue)' : 'var(--5s-border)',
              color: '#fff',
              border: 'none', borderRadius: 10,
              fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 900,
              letterSpacing: '.08em', textTransform: 'uppercase',
              boxShadow: signing && signProgress > 0.9 ? '0 0 0 4px rgba(255,14,101,0.3)' : 'none',
              transition: 'all 200ms',
            }}>Xác nhận chữ ký</button>
          </div>
        </div>
      </div>
    );
  }

  // Approximate the cursor's position along the signature path at progress p (0-1)
  function signaturePoint(p) {
    // The signature SVG goes left to right over ~440px wide, 80px tall, starting from (40, 40) in local coords
    const x = 40 + p * 440;
    // Vary y based on the cursive shape (sine waves with diminishing amplitude)
    const y = 40 + Math.sin(p * Math.PI * 4) * 20 - p * 8;
    return [x - 220, y - 40]; // offset so cursor anchors near center of pad
  }

  function SignatureSVG({ progress }) {
    // A fake "handwritten" path that resembles "Minh Anh"
    const d = "M 40 65 C 50 30, 70 30, 75 55 C 80 80, 95 80, 100 60 C 110 25, 130 25, 135 55 C 140 75, 155 75, 160 55 Q 170 40, 185 60 Q 195 85, 215 65 C 235 40, 260 50, 270 65 Q 280 80, 295 60 C 310 35, 335 40, 345 60 C 355 80, 370 75, 380 55 Q 395 30, 415 50 C 430 75, 455 60, 470 55";
    // Approximate path length for stroke-dashoffset
    const pathLen = 850;
    return (
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} viewBox="0 0 540 200" preserveAspectRatio="xMidYMid meet">
        <path d={d}
          stroke="var(--5s-blue)"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          strokeDasharray={pathLen}
          strokeDashoffset={pathLen - pathLen * progress}
          style={{ filter: 'drop-shadow(0 1px 2px rgba(29,73,255,0.3))' }}
        />
      </svg>
    );
  }

  // ── QR check-in screen ─────────────────────────────────────────────
  function QRCheckInScreen({ t, qrProgress }) {
    return (
      <div style={{ width: '100%', height: '100%', background: 'var(--5s-bg)', position: 'relative' }}>
        <div style={{ height: 56, background: 'var(--5s-blue)' }}/>
        <div style={{ padding: '40px 60px', textAlign: 'center' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 10,
            padding: '8px 18px',
            background: 'rgba(22,101,52,0.12)',
            border: '1px solid rgba(22,101,52,0.3)',
            borderRadius: 9999,
            color: 'var(--5s-success)',
            fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 13,
            letterSpacing: '.22em', textTransform: 'uppercase',
          }}>
            ✓ Đã ký miễn trừ
          </div>
          <div style={{
            marginTop: 16, fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 64,
            letterSpacing: '-0.03em', textTransform: 'uppercase', color: 'var(--5s-text)',
            lineHeight: 1,
          }}>
            Mã QR check-in
          </div>
          <div style={{
            marginTop: 12, fontFamily: 'var(--font-body)', fontSize: 18,
            color: 'var(--5s-text-muted)', fontWeight: 500,
          }}>
            Đưa mã này cho tình nguyện viên BTC vào ngày race
          </div>

          {/* QR card */}
          <div style={{
            margin: '40px auto 0',
            width: 380, padding: 32,
            background: '#fff', borderRadius: 18,
            border: '1px solid var(--5s-border)',
            boxShadow: '0 24px 60px rgba(0,0,0,0.15)',
            transform: `scale(${Easing.easeOutBack(clamp(qrProgress, 0, 1))})`,
            transformOrigin: 'center top',
          }}>
            <div style={{
              fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 22,
              color: 'var(--5s-blue)', letterSpacing: '-0.02em',
            }}>BIB 1247</div>
            <div style={{
              fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16,
              color: 'var(--5s-text)', marginTop: 4, textTransform: 'uppercase',
              letterSpacing: '-0.01em',
            }}>
              Saigon Half Marathon 2026
            </div>
            {/* QR pattern */}
            <div style={{
              width: 240, height: 240, margin: '20px auto',
              background: '#fff',
              border: '3px solid var(--5s-text)', borderRadius: 8,
              position: 'relative', padding: 8,
              opacity: clamp((qrProgress - 0.2) / 0.5, 0, 1),
            }}>
              <QRPattern />
              <div style={{
                position: 'absolute', left: '50%', top: '50%',
                transform: 'translate(-50%, -50%)',
                background: '#fff', padding: 6, borderRadius: 4,
              }}>
                <img src="assets/5bib-logo.png" style={{ width: 36, display: 'block' }} />
              </div>
            </div>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600,
              color: 'var(--5s-text-subtle)', letterSpacing: '.06em',
            }}>5BIB · 1247 · 13.04.2026 · Verified ✓</div>
          </div>

          <button style={{
            marginTop: 24, padding: '14px 28px',
            background: 'var(--5s-blue)', color: '#fff',
            border: 'none', borderRadius: 10,
            fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 900,
            letterSpacing: '.14em', textTransform: 'uppercase',
            opacity: qrProgress,
          }}>📲 Lưu vào Wallet</button>
        </div>
      </div>
    );
  }

  function QRPattern() {
    const cells = 19;
    const grid = [];
    for (let y = 0; y < cells; y++) {
      for (let x = 0; x < cells; x++) {
        const corner = (x < 6 && y < 6) || (x >= cells - 6 && y < 6) || (x < 6 && y >= cells - 6);
        let on = false;
        if (corner) {
          on = (x === 0 || x === 5 || (x >= 2 && x <= 3))
            && (y === 0 || y === 5 || (y >= 2 && y <= 3));
          // For top-right corner, mirror
          if (x >= cells - 6) {
            const lx = cells - 1 - x;
            on = (lx === 0 || lx === 5 || (lx >= 2 && lx <= 3)) && (y === 0 || y === 5 || (y >= 2 && y <= 3));
          }
          // For bottom-left
          if (y >= cells - 6) {
            const ly = cells - 1 - y;
            on = (x === 0 || x === 5 || (x >= 2 && x <= 3)) && (ly === 0 || ly === 5 || (ly >= 2 && ly <= 3));
          }
        } else {
          const n = (x * 13 + y * 23 + x * y * 7) % 11;
          on = n < 4;
        }
        grid.push(on);
      }
    }
    return (
      <div style={{ position: 'absolute', inset: 8, display: 'grid',
        gridTemplateColumns: `repeat(${cells}, 1fr)`, gap: 0 }}>
        {grid.map((on, i) => (
          <div key={i} style={{ aspectRatio: 1, background: on ? '#0A0A0A' : '#fff' }} />
        ))}
      </div>
    );
  }

  window.GUIDE_CHECK_IN = {
    slug: 'check-in',
    title: 'Ký miễn trừ & QR check-in',
    subtitle: 'Ký miễn trừ trách nhiệm và lấy mã QR check-in',
    duration: 33,
    icon: '✍️',
    color: 'var(--5s-magenta)',
    Component: GuideCheckIn,
    persistKey: 'guide-check-in',
    faq: [
      { q: 'Đã ký rồi có sửa thông tin được không?', a: 'Không. Sau khi ký miễn trừ, vé bị khoá và không sửa được thông tin.' },
      { q: 'Cổng ký miễn trừ mở khi nào?', a: 'Hệ thống mở trong vòng 1 tuần trước sự kiện. Bạn sẽ nhận email thông báo.' },
      { q: 'Tôi không nhận được email?', a: 'Kiểm tra thư mục Spam/Promotions. Hoặc đăng nhập 5bib.com → Vé của tôi để ký trực tiếp.' },
      { q: 'Ký miễn trừ có bắt buộc không?', a: 'Bắt buộc. Không có chữ ký miễn trừ, bạn không được nhận racekit và tham gia thi đấu.' },
      { q: 'Quên mã QR ngày race?', a: 'Mở app 5BIB → Vé của tôi → tab "Đã check-in" → bấm "Xem QR".' },
    ],
  };
})();
