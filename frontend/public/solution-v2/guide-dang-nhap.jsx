// guide-dang-nhap.jsx — "Đăng nhập 5bib.com" tutorial video (web only, ~30s)

(function() {
  const { useSprite, Sprite, Easing, clamp, interpolate,
          BrowserFrame, StepIndicator, Cursor,
          LoginPage, HomepageLoggedIn, SuccessOverlay,
          GuideIntro, GuideOutro,
          Sparkles, Confetti, AttentionPulse, SlideInPage } = window;

  // Total scene: ~30s
  // 0-3s Intro
  // 3-10s Step 1: click "Đăng nhập" button (top-right)
  // 10-20s Step 2: type email + pass + click button
  // 20-26s Step 3: welcome page (success)
  // 26-30s Outro

  const STEPS = [
    { at: 3,  dur: 7,  title: 'Bấm [Đăng nhập] góc phải',         sub: 'Truy cập 5bib.com, click nút Đăng nhập trên header' },
    { at: 10, dur: 10, title: 'Nhập email + mật khẩu → [Đăng nhập]', sub: 'Hoặc bấm "Đăng nhập với Google" để dùng tài khoản Gmail' },
    { at: 20, dur: 6,  title: 'Hoàn tất! Bắt đầu sử dụng 5BIB',   sub: 'Bây giờ bạn có thể mua vé, ghi danh, tra kết quả' },
  ];

  function GuideDangNhap() {
    const { localTime: t } = useSprite();

    if (t < 3) return <GuideIntro
      title={<>Đăng nhập<br/>5bib.com</>}
      subtitle="3 cách: email/mật khẩu, tài khoản Google, hoặc đăng ký mới."
      tags={['Email / SĐT', 'Google', '30 giây']}
      eyebrow="Hướng dẫn · Bắt đầu"
      t={t} dur={3}
    />;

    if (t >= 26) return <GuideOutro t={t - 26} dur={4} />;

    const step = STEPS.findIndex(s => t >= s.at && t < s.at + s.dur);
    const cur = STEPS[step] ?? STEPS[STEPS.length - 1];
    const localT = t - cur.at;

    return (
      <div style={{ position: 'absolute', inset: 0, background: 'var(--5s-bg)' }}>
        <div style={{ position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse at 50% 30%, rgba(29,73,255,0.05), transparent 60%)' }} />
        <div style={{ position: 'absolute', left: 210, top: 80 }}>
          <BrowserFrame width={1500} height={770} url="https://5bib.com">
            {step === 0 && <Step1 t={localT} />}
            {step === 1 && <Step2 t={localT} />}
            {step === 2 && <Step3 t={localT} />}
          </BrowserFrame>
        </div>
        <StepIndicator step={(step ?? 0) + 1} total={3} title={cur.title} sub={cur.sub} />
      </div>
    );
  }

  function Step1({ t }) {
    // Homepage shown, cursor moves to "Đăng nhập" button top-right then clicks
    const startX = 700, startY = 580;
    const endX = 1330, endY = 100;
    const k = Easing.easeOutCubic(clamp((t - 1.0) / 1.5, 0, 1));
    const cx = startX + (endX - startX) * k;
    const cy = startY + (endY - startY) * k;
    const pressed = t > 2.6 && t < 3.0;
    const sparkleActive = t > 2.6 && t < 3.4;

    return (
      <SlideInPage t={t} dur={0.4} direction="right">
        <HomepageLoggedIn />
        {/* Override the header right button to show "Đăng nhập" instead of "Vé của tôi" */}
        <div style={{ position: 'absolute', top: 12, right: 80, zIndex: 5 }}>
          <button style={{
            padding: '10px 22px',
            background: t > 2.0 ? '#fff' : 'rgba(255,255,255,0.12)',
            color: t > 2.0 ? 'var(--5s-blue)' : '#fff',
            border: t > 2.0 ? '2px solid #fff' : '1px solid rgba(255,255,255,0.2)',
            borderRadius: 8,
            fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 800,
            letterSpacing: '.08em', textTransform: 'uppercase',
            transform: pressed ? 'scale(0.96)' : 'scale(1)',
            transition: 'all 200ms',
            boxShadow: t > 2.0 ? '0 0 0 4px rgba(255,14,101,0.3)' : 'none',
          }}>Đăng nhập</button>
        </div>
        <Cursor x={cx} y={cy} pressed={pressed} />
        <Sparkles x={cx} y={cy} active={sparkleActive} t={t - 2.6} />
      </SlideInPage>
    );
  }

  function Step2({ t }) {
    // Login page
    const fullEmail = 'minhanh@gmail.com';
    const fullPass = '••••••••';

    let cx, cy, pressed = false, focusEmail = false, focusPass = false;
    // Cursor & focus timeline:
    // 0.0-0.8: cursor moves to email field
    // 0.8-2.6: typing email (focusEmail = true)
    // 2.6-3.4: cursor moves to pass field
    // 3.4-4.8: typing pass (focusPass = true)
    // 4.8-5.6: cursor moves to login button
    // 5.6-6.0: press
    // 6.0+: hold

    if (t < 0.8) {
      const k = Easing.easeOutCubic(clamp(t / 0.8, 0, 1));
      cx = 100 + (1200 - 100) * k;
      cy = 700 + (380 - 700) * k;
    } else if (t < 2.6) {
      cx = 1200; cy = 380; focusEmail = true;
    } else if (t < 3.4) {
      const k = Easing.easeOutCubic(clamp((t - 2.6) / 0.8, 0, 1));
      cx = 1200; cy = 380 + (470 - 380) * k; focusEmail = true;
    } else if (t < 4.8) {
      cx = 1200; cy = 470; focusPass = true;
    } else if (t < 5.6) {
      const k = Easing.easeOutCubic(clamp((t - 4.8) / 0.8, 0, 1));
      cx = 1200; cy = 470 + (590 - 470) * k;
    } else {
      cx = 1200; cy = 590;
      pressed = t > 5.6 && t < 6.1;
    }

    // Typed text
    const emailChars = Math.floor(clamp((t - 0.85) / 1.5, 0, 1) * fullEmail.length);
    const passChars = Math.floor(clamp((t - 3.45) / 1.0, 0, 1) * fullPass.length);
    const typedEmail = fullEmail.slice(0, emailChars);
    const typedPass = fullPass.slice(0, passChars);
    const highlightLoginBtn = t > 5.0;
    const sparkleActive = t > 5.6 && t < 6.5;

    return (
      <SlideInPage t={t} dur={0.4} direction="up">
        <LoginPage
          typedEmail={typedEmail}
          typedPass={typedPass}
          focusEmail={focusEmail}
          focusPass={focusPass}
          highlightLoginBtn={highlightLoginBtn}
        />
        <Cursor x={cx} y={cy} pressed={pressed} />
        <Sparkles x={cx} y={cy} active={sparkleActive} t={t - 5.6} />
      </SlideInPage>
    );
  }

  function Step3({ t }) {
    // Welcome page with success animation
    const scale = Easing.easeOutBack(clamp(t / 0.6, 0, 1));
    const checkProgress = clamp((t - 0.4) / 0.5, 0, 1);
    return (
      <SlideInPage t={t} dur={0.4} direction="up">
        <HomepageLoggedIn />
        <SuccessOverlay scale={scale} checkProgress={checkProgress}
          title="Chào, Minh Anh!"
          sub="Bạn đã đăng nhập thành công vào 5BIB"
        />
        <Confetti active={t > 0.6} t={t - 0.6} originX={960} originY={540} count={70} durationSec={3} />
      </SlideInPage>
    );
  }

  window.GUIDE_DANG_NHAP = {
    slug: 'dang-nhap',
    title: 'Đăng nhập 5BIB',
    subtitle: 'Đăng nhập trên web bằng email hoặc Google',
    duration: 30,
    icon: '🔑',
    color: 'var(--5s-blue)',
    Component: GuideDangNhap,
    persistKey: 'guide-dang-nhap',
    faq: [
      { q: 'Quên mật khẩu phải làm sao?', a: 'Bấm "Quên mật khẩu?" tại trang đăng nhập, nhập email — hệ thống gửi OTP để bạn đặt lại mật khẩu.' },
      { q: 'Đăng nhập Google có an toàn không?', a: '5BIB chỉ nhận thông tin cơ bản (email, tên, avatar) từ Google. Không truy cập email, danh bạ, file.' },
      { q: 'Đăng xuất ở đâu?', a: 'Di chuột lên avatar góc phải header → bấm "Đăng xuất".' },
    ],
  };
})();
