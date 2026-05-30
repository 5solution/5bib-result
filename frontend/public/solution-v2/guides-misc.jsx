// guides-misc.jsx — 5 remaining guides: chuyen-nhuong, nhan-chuyen-nhuong,
// uy-quyen, chinh-sua, them-ho-so. Web-only, ~25-30s each.

(function() {
  const { useSprite, Easing, clamp,
          BrowserFrame, BibWebHeader, StepIndicator, Cursor,
          MyTicketsPage, TicketDetailPage, SuccessOverlay,
          GuideIntro, GuideOutro,
          Sparkles, Confetti, SlideInPage, FormField, FieldLabel, Caret,
          STD_TICKETS } = window;

  // ── Reusable modal shell ───────────────────────────────────────────
  function Modal({ children, w = 720 }) {
    return (
      <>
        <BibWebHeader />
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.45)', top: 56 }} />
        <div style={{
          position: 'absolute', left: '50%', top: '50%',
          transform: 'translate(-50%, -50%)',
          width: w, background: '#fff', borderRadius: 18,
          boxShadow: '0 30px 80px rgba(0,0,0,0.25)',
        }}>
          {children}
        </div>
      </>
    );
  }

  function ModalHeader({ step, total, title }) {
    return (
      <div style={{ padding: '22px 28px', borderBottom: '1px solid var(--5s-border)' }}>
        <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 800,
          letterSpacing: '.22em', textTransform: 'uppercase', color: 'var(--5s-text-subtle)' }}>
          Bước {step} / {total}
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 28,
          letterSpacing: '-0.02em', marginTop: 6, color: 'var(--5s-text)' }}>
          {title}
        </div>
      </div>
    );
  }

  function CTAButton({ children, pressed, highlighted, onSurface }) {
    return (
      <button style={{
        padding: '13px 26px',
        background: 'var(--5s-blue)', color: '#fff',
        border: 'none', borderRadius: 10,
        fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 900,
        letterSpacing: '.08em', textTransform: 'uppercase',
        boxShadow: highlighted ? '0 0 0 4px rgba(255,14,101,0.3)' : 'none',
        transform: pressed ? 'scale(0.97)' : 'scale(1)',
        transition: 'all 200ms',
      }}>{children}</button>
    );
  }

  // ═════════════════════════════════════════════════════════════════
  // 1. CHUYỂN NHƯỢNG VÉ — 30s
  // ═════════════════════════════════════════════════════════════════
  function GuideChuyenNhuong() {
    const { localTime: t } = useSprite();
    if (t < 3) return <GuideIntro
      title={<>Chuyển nhượng<br/>vé chạy</>}
      subtitle="Chuyển vé cho người khác qua email. Người nhận cần đã có tài khoản trên 5BIB."
      tags={['4 bước', 'Theo email', 'Cần xác nhận']}
      eyebrow="Hướng dẫn · Chuyển vé"
      t={t} dur={3}
    />;
    if (t >= 25) return <GuideOutro t={t - 25} dur={5} />;

    const STEPS = [
      { at: 3, dur: 4, title: 'Vé của tôi · Chọn vé cần chuyển',     sub: 'Vé đã ghi danh hoặc chưa ghi danh đều được' },
      { at: 7, dur: 4, title: 'Bấm [Chuyển nhượng]',                 sub: 'Trong menu Quản lý vé' },
      { at: 11, dur: 9, title: 'Nhập email người nhận → [Gửi]',       sub: 'Thêm lời nhắn cá nhân (tuỳ chọn)' },
      { at: 20, dur: 5, title: 'Đã gửi! Chờ người nhận xác nhận',     sub: 'Người nhận cần đăng nhập để chấp nhận' },
    ];
    const step = STEPS.findIndex(s => t >= s.at && t < s.at + s.dur);
    const cur = STEPS[step] ?? STEPS[STEPS.length - 1];
    const lt = t - cur.at;

    return <GuideShell step={step} cur={cur} STEPS={STEPS} url="https://5bib.com/me/tickets">
      {step === 0 && <PickTicketStep t={lt} idx={0} />}
      {step === 1 && <TicketDetailStep t={lt} action="chuyen-nhuong" buttonY={555} />}
      {step === 2 && <ChuyenNhuongFormStep t={lt} />}
      {step === 3 && <FinalSuccess t={lt} title="Đã gửi yêu cầu!" sub="Vé sẽ tạm khoá đến khi người nhận xác nhận" emojis={['📧','💌','✉️']} />}
    </GuideShell>;
  }

  function ChuyenNhuongFormStep({ t }) {
    const email = 'lan.nguyen@gmail.com';
    const msg = 'Mình không tham gia được, tặng cậu nhé!';
    let cx, cy, pressed = false, focusEmail = false, focusMsg = false;
    if (t < 0.8) { cx = 400; cy = 720; }
    else if (t < 2.0) {
      const k = Easing.easeOutCubic(clamp((t - 0.8) / 1.2, 0, 1));
      cx = 400 + (560 - 400) * k; cy = 720 + (340 - 720) * k;
      focusEmail = t > 1.4;
    } else if (t < 3.8) {
      cx = 560; cy = 340; focusEmail = true;
    } else if (t < 4.6) {
      const k = Easing.easeOutCubic(clamp((t - 3.8) / 0.8, 0, 1));
      cx = 560; cy = 340 + (480 - 340) * k; focusMsg = true;
    } else if (t < 7.0) {
      cx = 560; cy = 480; focusMsg = true;
    } else {
      const k = Easing.easeOutCubic(clamp((t - 7.0) / 1.0, 0, 1));
      cx = 560 + (1230 - 560) * k; cy = 480 + (640 - 480) * k;
      pressed = t > 7.8 && t < 8.3;
    }
    const emailChars = Math.floor(clamp((t - 1.6) / 1.8, 0, 1) * email.length);
    const msgChars = Math.floor(clamp((t - 4.4) / 2.0, 0, 1) * msg.length);

    return (
      <SlideInPage t={t} dur={0.4} direction="up">
        <Modal w={780}>
          <ModalHeader step={3} total={4} title="Chuyển nhượng vé cho ai?" />
          <div style={{ padding: 26 }}>
            <div style={{ marginBottom: 16 }}>
              <FieldLabel>Email người nhận</FieldLabel>
              <FormField focused={focusEmail}>
                {email.slice(0, emailChars)}{focusEmail && emailChars < email.length && <Caret/>}
              </FormField>
              <div style={{ marginTop: 6, fontFamily: 'var(--font-body)', fontSize: 12,
                color: 'var(--5s-text-subtle)' }}>
                Người nhận phải có tài khoản 5BIB sẵn
              </div>
            </div>
            <div>
              <FieldLabel>Lời nhắn (tuỳ chọn)</FieldLabel>
              <div style={{
                padding: '14px 16px', minHeight: 80,
                border: focusMsg ? '2px solid var(--5s-blue)' : '1.5px solid var(--5s-border)',
                borderRadius: 10,
                fontFamily: 'var(--font-body)', fontSize: 14,
                background: '#FAF8F5',
                boxShadow: focusMsg ? '0 0 0 4px rgba(29,73,255,0.12)' : 'none',
                transition: 'all 200ms',
                color: 'var(--5s-text)',
              }}>
                {msg.slice(0, msgChars)}
                {focusMsg && msgChars < msg.length && <Caret/>}
              </div>
            </div>
          </div>
          <div style={{ padding: '0 26px 22px', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button style={{
              padding: '13px 22px',
              background: 'transparent', color: 'var(--5s-text-muted)',
              border: '1.5px solid var(--5s-border)', borderRadius: 10,
              fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 700,
              letterSpacing: '.06em', textTransform: 'uppercase',
            }}>Hủy</button>
            <CTAButton pressed={pressed} highlighted={t > 7.4}>
              📨 Gửi yêu cầu
            </CTAButton>
          </div>
        </Modal>
        <Cursor x={cx} y={cy} pressed={pressed} />
        <Sparkles x={cx} y={cy} active={pressed} t={t - 7.8} />
      </SlideInPage>
    );
  }

  // ═════════════════════════════════════════════════════════════════
  // 2. NHẬN CHUYỂN NHƯỢNG — 28s
  // ═════════════════════════════════════════════════════════════════
  function GuideNhanChuyenNhuong() {
    const { localTime: t } = useSprite();
    if (t < 3) return <GuideIntro
      title={<>Nhận<br/>chuyển nhượng</>}
      subtitle="Chấp nhận vé được chuyển nhượng và ghi danh thông tin VĐV."
      tags={['4 bước', 'Cần ghi danh', 'Email mời']}
      eyebrow="Hướng dẫn · Nhận vé"
      t={t} dur={3}
    />;
    if (t >= 24) return <GuideOutro t={t - 24} dur={5} />;

    const STEPS = [
      { at: 3, dur: 4, title: 'Đăng nhập → Vé của tôi',           sub: 'Vé chuyển nhượng có nhãn "Đang chờ chấp nhận"' },
      { at: 7, dur: 5, title: 'Chọn vé · Bấm [Ghi danh]',          sub: 'Mở form đăng ký thông tin VĐV' },
      { at: 12, dur: 7, title: 'Điền thông tin VĐV',                sub: 'Họ tên, ngày sinh, size áo, hạng mục...' },
      { at: 19, dur: 5, title: 'Tích đồng ý điều khoản → [Xác nhận]', sub: 'Hoàn tất nhận vé chuyển nhượng' },
    ];
    const step = STEPS.findIndex(s => t >= s.at && t < s.at + s.dur);
    const cur = STEPS[step] ?? STEPS[STEPS.length - 1];
    const lt = t - cur.at;

    return <GuideShell step={step} cur={cur} STEPS={STEPS} url="https://5bib.com/me/tickets">
      {step === 0 && <PickTicketStep t={lt} idx={1} badge="📨 Đang chờ chấp nhận" badgeColor="var(--5s-warning)" />}
      {step === 1 && <TicketDetailStep t={lt} action="ghi-danh" ticket={STD_TICKETS[1]} buttonY={480} />}
      {step === 2 && <RegistrationFormStep t={lt} />}
      {step === 3 && <FinalSuccess t={lt} title="Đã nhận vé!" sub="Vé đã được thêm vào tài khoản của bạn" emojis={['🎉','🎁','✨']} />}
    </GuideShell>;
  }

  function RegistrationFormStep({ t }) {
    let cx, cy, pressed = false;
    if (t < 4.0) { cx = 600 + Math.sin(t * 2) * 20; cy = 500; }
    else {
      const k = Easing.easeOutCubic(clamp((t - 4.0) / 1.3, 0, 1));
      cx = 600 + (1180 - 600) * k;
      cy = 500 + (680 - 500) * k;
      pressed = t > 5.2 && t < 5.6;
    }

    const fields = [
      ['Họ và tên', 'Nguyễn Lan'],
      ['Email', 'lan.nguyen@gmail.com'],
      ['Số điện thoại', '0987 654 321'],
      ['Ngày sinh', '20.03.1995'],
      ['Giới tính', 'Nữ'],
      ['Áo size', 'S'],
      ['Hạng mục', 'F20-29'],
      ['Liên hệ khẩn cấp', '0912 345 678'],
    ];

    return (
      <SlideInPage t={t} dur={0.4} direction="up">
        <Modal w={820}>
          <ModalHeader step={3} total={4} title="Ghi danh thông tin VĐV" />
          <div style={{ padding: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {fields.map(([k, v], i) => {
              const filled = t > 0.4 + i * 0.18;
              return (
                <div key={k}>
                  <FieldLabel>{k}</FieldLabel>
                  <div style={{
                    padding: '11px 14px',
                    border: '1.5px solid var(--5s-border)', borderRadius: 8,
                    fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 14,
                    color: filled ? 'var(--5s-text)' : 'var(--5s-text-subtle)',
                    background: '#FAF8F5',
                    transition: 'color 200ms',
                  }}>{filled ? v : '...'}</div>
                </div>
              );
            })}
          </div>
          <div style={{ padding: '0 24px 22px', display: 'flex', justifyContent: 'flex-end' }}>
            <CTAButton pressed={pressed} highlighted={t > 4.8}>Tiếp tục →</CTAButton>
          </div>
        </Modal>
        <Cursor x={cx} y={cy} pressed={pressed} />
        <Sparkles x={cx} y={cy} active={pressed} t={t - 5.2} />
      </SlideInPage>
    );
  }

  // ═════════════════════════════════════════════════════════════════
  // 3. ỦY QUYỀN NHẬN RACEKIT — 25s
  // ═════════════════════════════════════════════════════════════════
  function GuideUyQuyen() {
    const { localTime: t } = useSprite();
    if (t < 3) return <GuideIntro
      title={<>Ủy quyền<br/>nhận racekit</>}
      subtitle="Bận không đến lấy racekit được? Ủy quyền cho người khác đại diện nhận."
      tags={['3 bước', 'Sau khi ký', 'CCCD bắt buộc']}
      eyebrow="Hướng dẫn · Pre-race"
      t={t} dur={3}
    />;
    if (t >= 22) return <GuideOutro t={t - 22} dur={5} />;

    const STEPS = [
      { at: 3, dur: 4, title: 'Chọn vé đã ký miễn trừ',                sub: 'Chỉ ủy quyền được sau khi đã ký' },
      { at: 7, dur: 4, title: 'Bấm [Ủy quyền nhận racekit]',           sub: 'Trong menu Quản lý vé' },
      { at: 11, dur: 8, title: 'Điền thông tin người được ủy quyền',    sub: 'Họ tên, CCCD/CMND, SĐT' },
      { at: 19, dur: 3, title: 'Bấm [Thêm thông tin] để hoàn tất',     sub: 'Người được ủy quyền cần mang CCCD/CMND khi đi nhận' },
    ];
    const step = STEPS.findIndex(s => t >= s.at && t < s.at + s.dur);
    const cur = STEPS[step] ?? STEPS[STEPS.length - 1];
    const lt = t - cur.at;

    return <GuideShell step={step} cur={cur} STEPS={STEPS} url="https://5bib.com/me/tickets">
      {step === 0 && <PickTicketStep t={lt} idx={2} badge="✓ Đã ký miễn trừ" badgeColor="var(--5s-success)" />}
      {step === 1 && <TicketDetailStep t={lt} action="uy-quyen" ticket={STD_TICKETS[2]} buttonY={744} />}
      {step === 2 && <ProxyFormStep t={lt} />}
      {step === 3 && <FinalSuccess t={lt} title="Ủy quyền thành công!" sub="Người được ủy quyền có thể đến nhận racekit thay bạn" emojis={['🎽','🏃','👍']} />}
    </GuideShell>;
  }

  function ProxyFormStep({ t }) {
    let cx, cy, pressed = false;
    if (t < 4.5) { cx = 600 + Math.sin(t * 2) * 20; cy = 500; }
    else {
      const k = Easing.easeOutCubic(clamp((t - 4.5) / 1.3, 0, 1));
      cx = 600 + (1100 - 600) * k;
      cy = 500 + (680 - 500) * k;
      pressed = t > 5.7 && t < 6.1;
    }

    const fields = [
      ['Họ và tên người được ủy quyền', 'Trần Văn Nam'],
      ['CCCD / CMND', '012345678910'],
      ['Số điện thoại', '0938 123 456'],
      ['Email (tuỳ chọn)', 'nam.tran@gmail.com'],
      ['Mối quan hệ', 'Anh / Bạn / Đồng nghiệp'],
    ];

    return (
      <SlideInPage t={t} dur={0.4} direction="up">
        <Modal w={680}>
          <ModalHeader step={3} total={4} title="Thông tin người được ủy quyền" />
          <div style={{
            margin: '0 26px',
            padding: 14, background: 'rgba(217,119,6,0.08)',
            border: '1px solid rgba(217,119,6,0.25)',
            borderRadius: 8,
            display: 'flex', alignItems: 'center', gap: 10,
            fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--5s-warning)',
          }}>
            ⚠️ Người được ủy quyền phải mang CCCD/CMND bản gốc khi đến nhận racekit.
          </div>
          <div style={{ padding: 24, display: 'grid', gridTemplateColumns: '1fr', gap: 14 }}>
            {fields.map(([k, v], i) => {
              const filled = t > 0.4 + i * 0.25;
              return (
                <div key={k}>
                  <FieldLabel>{k}</FieldLabel>
                  <div style={{
                    padding: '11px 14px',
                    border: '1.5px solid var(--5s-border)', borderRadius: 8,
                    fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 14,
                    color: filled ? 'var(--5s-text)' : 'var(--5s-text-subtle)',
                    background: '#FAF8F5', transition: 'color 200ms',
                  }}>{filled ? v : '...'}</div>
                </div>
              );
            })}
          </div>
          <div style={{ padding: '0 24px 22px', display: 'flex', justifyContent: 'flex-end' }}>
            <CTAButton pressed={pressed} highlighted={t > 5.3}>+ Thêm thông tin</CTAButton>
          </div>
        </Modal>
        <Cursor x={cx} y={cy} pressed={pressed} />
        <Sparkles x={cx} y={cy} active={pressed} t={t - 5.7} />
      </SlideInPage>
    );
  }

  // ═════════════════════════════════════════════════════════════════
  // 4. CHỈNH SỬA THÔNG TIN — 22s
  // ═════════════════════════════════════════════════════════════════
  function GuideChinhSua() {
    const { localTime: t } = useSprite();
    if (t < 3) return <GuideIntro
      title={<>Chỉnh sửa<br/>thông tin vé</>}
      subtitle="Sửa thông tin VĐV (size áo, hạng mục, liên hệ khẩn cấp...). Chỉ sửa được vé đã ghi danh."
      tags={['3 bước', 'Đã ghi danh', 'Trước khi ký']}
      eyebrow="Hướng dẫn · Cập nhật"
      t={t} dur={3}
    />;
    if (t >= 19) return <GuideOutro t={t - 19} dur={5} />;

    const STEPS = [
      { at: 3, dur: 4, title: 'Chọn vé đã ghi danh',                sub: 'Vé chưa ghi danh không sửa được thông tin' },
      { at: 7, dur: 4, title: 'Bấm [Sửa thông tin]',                sub: 'Trong menu Quản lý vé' },
      { at: 11, dur: 5, title: 'Sửa thông tin → [Lưu lại]',          sub: 'Chỉ sửa được trước khi ký miễn trừ' },
      { at: 16, dur: 3, title: 'Đã lưu thay đổi!',                   sub: 'Thông tin mới đã cập nhật trên vé' },
    ];
    const step = STEPS.findIndex(s => t >= s.at && t < s.at + s.dur);
    const cur = STEPS[step] ?? STEPS[STEPS.length - 1];
    const lt = t - cur.at;

    return <GuideShell step={step} cur={cur} STEPS={STEPS} url="https://5bib.com/me/tickets">
      {step === 0 && <PickTicketStep t={lt} idx={0} />}
      {step === 1 && <TicketDetailStep t={lt} action="sua-thong-tin" buttonY={620} />}
      {step === 2 && <EditFormStep t={lt} />}
      {step === 3 && <FinalSuccess t={lt} title="Đã cập nhật!" sub="Thông tin vé đã được lưu" emojis={['✏️','💾','✓']} />}
    </GuideShell>;
  }

  function EditFormStep({ t }) {
    let cx, cy, pressed = false;
    if (t < 1.5) { cx = 700; cy = 380; }
    else if (t < 3.0) {
      cx = 700; cy = 380;
      // pretend typing in size field
    } else {
      const k = Easing.easeOutCubic(clamp((t - 3.0) / 1.3, 0, 1));
      cx = 700 + (1180 - 700) * k;
      cy = 380 + (680 - 380) * k;
      pressed = t > 4.2 && t < 4.6;
    }
    const newSize = t > 2.5 ? 'L' : 'M';
    const sizeChanged = t > 2.5;

    return (
      <SlideInPage t={t} dur={0.4} direction="up">
        <Modal w={760}>
          <ModalHeader step={3} total={4} title="Sửa thông tin VĐV" />
          <div style={{ padding: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {[
              ['Họ và tên', 'Nguyễn Minh Anh', false],
              ['Số điện thoại', '0901 234 567', false],
              ['Áo size', newSize, sizeChanged],
              ['Hạng mục', 'M30-39', false],
              ['Email', 'minhanh@gmail.com', false],
              ['Liên hệ khẩn cấp', '0912 345 678', false],
            ].map(([k, v, hi], i) => (
              <div key={k}>
                <FieldLabel>{k}</FieldLabel>
                <div style={{
                  padding: '11px 14px',
                  border: hi ? '2px solid var(--5s-magenta)' : '1.5px solid var(--5s-border)',
                  borderRadius: 8,
                  fontFamily: 'var(--font-body)', fontWeight: hi ? 800 : 600, fontSize: 14,
                  color: hi ? 'var(--5s-magenta)' : 'var(--5s-text)',
                  background: hi ? 'rgba(255,14,101,0.05)' : '#FAF8F5',
                  boxShadow: hi ? '0 0 0 4px rgba(255,14,101,0.15)' : 'none',
                  transition: 'all 250ms',
                }}>{v}{hi && <span style={{ fontSize: 11, marginLeft: 8, opacity: 0.7 }}>← đã sửa</span>}</div>
              </div>
            ))}
          </div>
          <div style={{ padding: '0 24px 22px', display: 'flex', justifyContent: 'flex-end' }}>
            <CTAButton pressed={pressed} highlighted={t > 3.8}>💾 Lưu lại</CTAButton>
          </div>
        </Modal>
        <Cursor x={cx} y={cy} pressed={pressed} />
        <Sparkles x={cx} y={cy} active={pressed} t={t - 4.2} />
      </SlideInPage>
    );
  }

  // ═════════════════════════════════════════════════════════════════
  // 5. THÊM HỒ SƠ VĐV — 28s
  // ═════════════════════════════════════════════════════════════════
  function GuideThemHoSo() {
    const { localTime: t } = useSprite();
    if (t < 3) return <GuideIntro
      title={<>Thêm hồ sơ<br/>vận động viên</>}
      subtitle="Lưu hồ sơ VĐV cho bạn hoặc người thân — dùng lại nhanh khi ghi danh giải sau."
      tags={['Hồ sơ nhanh', 'Tái sử dụng', 'Nhiều VĐV / tài khoản']}
      eyebrow="Hướng dẫn · Hồ sơ"
      t={t} dur={3}
    />;
    if (t >= 24) return <GuideOutro t={t - 24} dur={5} />;

    const STEPS = [
      { at: 3, dur: 4, title: 'Vé của tôi · Chọn vé cần ghi danh',  sub: 'Mở form ghi danh thông tin VĐV' },
      { at: 7, dur: 3, title: 'Bấm [Ghi danh]',                      sub: 'Hiện danh sách hồ sơ có sẵn' },
      { at: 10, dur: 4, title: 'Bấm [+ Thêm hồ sơ mới]',              sub: 'Hồ sơ mới sẽ được lưu cho lần sau' },
      { at: 14, dur: 7, title: 'Điền thông tin → [Xác nhận]',         sub: 'Hồ sơ tự lưu cho các lần ghi danh tiếp theo' },
      { at: 21, dur: 3, title: 'Đã thêm hồ sơ!',                      sub: 'Hồ sơ mới sẽ xuất hiện ở những giải tiếp theo' },
    ];
    const step = STEPS.findIndex(s => t >= s.at && t < s.at + s.dur);
    const cur = STEPS[step] ?? STEPS[STEPS.length - 1];
    const lt = t - cur.at;

    return <GuideShell step={step} cur={cur} STEPS={STEPS} url="https://5bib.com/me/tickets">
      {step === 0 && <PickTicketStep t={lt} idx={0} />}
      {step === 1 && <TicketDetailStep t={lt} action="ghi-danh" buttonY={480} />}
      {step === 2 && <ProfileListStep t={lt} />}
      {step === 3 && <ProfileFormStep t={lt} />}
      {step === 4 && <FinalSuccess t={lt} title="Đã thêm hồ sơ!" sub="Hồ sơ mới: Trần Hoàng Long" emojis={['👤','📋','✨']} />}
    </GuideShell>;
  }

  function ProfileListStep({ t }) {
    let cx, cy, pressed = false;
    if (t < 1.0) { cx = 400; cy = 700; }
    else {
      const k = Easing.easeOutCubic(clamp((t - 1.0) / 1.4, 0, 1));
      cx = 400 + (960 - 400) * k;
      cy = 700 + (440 - 700) * k;
      pressed = t > 2.4 && t < 2.8;
    }

    const profiles = [
      { name: 'Nguyễn Minh Anh', age: 32, cat: 'M30-39' },
      { name: 'Lê Thị Hương', age: 28, cat: 'F20-29' },
    ];

    return (
      <SlideInPage t={t} dur={0.4} direction="up">
        <Modal w={720}>
          <ModalHeader step={2} total={4} title="Chọn hồ sơ VĐV" />
          <div style={{ padding: 24 }}>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 800,
              letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--5s-text-subtle)',
              marginBottom: 12 }}>Hồ sơ có sẵn ({profiles.length})</div>
            {profiles.map((p, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '14px 18px', marginBottom: 8,
                background: '#fff',
                border: '1.5px solid var(--5s-border)', borderRadius: 12,
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--5s-blue), var(--5s-blue-700))',
                  color: '#fff', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>{p.name.split(' ').map(x => x[0]).slice(-2).join('')}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16,
                    color: 'var(--5s-text)' }}>{p.name}</div>
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: 12,
                    color: 'var(--5s-text-subtle)' }}>{p.age} tuổi · {p.cat}</div>
                </div>
                <div style={{
                  width: 20, height: 20, borderRadius: '50%',
                  border: '2px solid var(--5s-border)',
                }}/>
              </div>
            ))}
            {/* Add new card */}
            <div style={{
              padding: '14px 18px',
              background: t > 2.0 ? 'rgba(29,73,255,0.06)' : '#fff',
              border: t > 2.0 ? '2px dashed var(--5s-blue)' : '1.5px dashed var(--5s-border)',
              borderRadius: 12,
              display: 'flex', alignItems: 'center', gap: 12,
              color: t > 2.0 ? 'var(--5s-blue)' : 'var(--5s-text-muted)',
              fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 15,
              boxShadow: t > 2.2 ? '0 0 0 4px rgba(255,14,101,0.2)' : 'none',
              transition: 'all 200ms',
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                background: t > 2.0 ? 'var(--5s-blue)' : 'var(--5s-surface)',
                color: t > 2.0 ? '#fff' : 'var(--5s-text-muted)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 24, fontWeight: 800,
              }}>+</div>
              Thêm hồ sơ mới
            </div>
          </div>
        </Modal>
        <Cursor x={cx} y={cy} pressed={pressed} />
        <Sparkles x={cx} y={cy} active={pressed} t={t - 2.4} />
      </SlideInPage>
    );
  }

  function ProfileFormStep({ t }) {
    let cx, cy, pressed = false;
    if (t < 4.0) { cx = 600 + Math.sin(t * 1.5) * 20; cy = 500; }
    else {
      const k = Easing.easeOutCubic(clamp((t - 4.0) / 1.3, 0, 1));
      cx = 600 + (1100 - 600) * k;
      cy = 500 + (680 - 500) * k;
      pressed = t > 5.2 && t < 5.7;
    }

    const fields = [
      ['Họ và tên', 'Trần Hoàng Long'],
      ['Ngày sinh', '10.12.1996'],
      ['Giới tính', 'Nam'],
      ['Áo size', 'L'],
      ['Email', 'long.tran@gmail.com'],
      ['Số điện thoại', '0987 111 222'],
    ];

    return (
      <SlideInPage t={t} dur={0.4} direction="up">
        <Modal w={700}>
          <ModalHeader step={3} total={4} title="Thông tin VĐV mới" />
          <div style={{ padding: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {fields.map(([k, v], i) => {
              const filled = t > 0.4 + i * 0.32;
              return (
                <div key={k}>
                  <FieldLabel>{k}</FieldLabel>
                  <div style={{
                    padding: '11px 14px',
                    border: '1.5px solid var(--5s-border)', borderRadius: 8,
                    fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 14,
                    color: filled ? 'var(--5s-text)' : 'var(--5s-text-subtle)',
                    background: '#FAF8F5', transition: 'color 200ms',
                  }}>{filled ? v : '...'}</div>
                </div>
              );
            })}
          </div>
          <div style={{ padding: '0 24px 22px', display: 'flex', justifyContent: 'flex-end' }}>
            <CTAButton pressed={pressed} highlighted={t > 4.8}>Xác nhận</CTAButton>
          </div>
        </Modal>
        <Cursor x={cx} y={cy} pressed={pressed} />
        <Sparkles x={cx} y={cy} active={pressed} t={t - 5.2} />
      </SlideInPage>
    );
  }

  // ═════════════════════════════════════════════════════════════════
  // Shared helpers
  // ═════════════════════════════════════════════════════════════════
  function GuideShell({ step, cur, STEPS, url, children }) {
    return (
      <div style={{ position: 'absolute', inset: 0, background: 'var(--5s-bg)' }}>
        <div style={{ position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse at 50% 30%, rgba(29,73,255,0.05), transparent 60%)' }} />
        <div style={{ position: 'absolute', left: 210, top: 80 }}>
          <BrowserFrame width={1500} height={770} url={url}>
            {children}
          </BrowserFrame>
        </div>
        <StepIndicator step={(step ?? 0) + 1} total={STEPS.length} title={cur.title} sub={cur.sub} />
      </div>
    );
  }

  function PickTicketStep({ t, idx = 0, badge, badgeColor = 'var(--5s-magenta)' }) {
    const xs = [285, 590, 895];
    const cx = 100 + (xs[idx] - 100) * Easing.easeOutCubic(clamp((t - 0.6) / 1.4, 0, 1));
    const cy = 600 + (290 - 600) * Easing.easeOutCubic(clamp((t - 0.6) / 1.4, 0, 1));
    const pressed = t > 2.2 && t < 2.7;
    const offsetX = idx * 305;
    return (
      <SlideInPage t={t} dur={0.4} direction="right">
        <MyTicketsPage highlightIdx={t > 1.6 ? idx : -1} />
        {badge && (
          <div style={{
            position: 'absolute', top: 235, left: 260 + offsetX, zIndex: 5,
            background: badgeColor, color: '#fff',
            padding: '4px 10px', borderRadius: 6,
            fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 11,
            letterSpacing: '.14em', textTransform: 'uppercase',
            transform: `rotate(${Math.sin(t * 2) * 3}deg)`,
          }}>{badge}</div>
        )}
        <Cursor x={cx} y={cy} pressed={pressed} />
        <Sparkles x={cx} y={cy} active={pressed} t={t - 2.2} />
      </SlideInPage>
    );
  }

  function TicketDetailStep({ t, action, ticket = STD_TICKETS[0], buttonY }) {
    const cx = 100 + (1180 - 100) * Easing.easeOutCubic(clamp((t - 0.5) / 1.5, 0, 1));
    const cy = 700 + (buttonY - 700) * Easing.easeOutCubic(clamp((t - 0.5) / 1.5, 0, 1));
    const pressed = t > 2.2 && t < 2.7;
    return (
      <SlideInPage t={t} dur={0.4} direction="right">
        <TicketDetailPage ticket={ticket} highlightAction={action} />
        <Cursor x={cx} y={cy} pressed={pressed} />
        <Sparkles x={cx} y={cy} active={pressed} t={t - 2.2} />
      </SlideInPage>
    );
  }

  function FinalSuccess({ t, title, sub, emojis = ['🎉'] }) {
    const scale = Easing.easeOutBack(clamp(t / 0.6, 0, 1));
    const checkProgress = clamp((t - 0.4) / 0.5, 0, 1);
    return (
      <SlideInPage t={t} dur={0.4} direction="up">
        <BibWebHeader />
        <SuccessOverlay scale={scale} checkProgress={checkProgress} title={title} sub={sub} />
        <Confetti active={t > 0.5} t={t - 0.5} originX={960} originY={420}
          count={75} durationSec={3} />
        {/* floating emojis */}
        {emojis.map((e, i) => {
          const lt = t - 0.8 - i * 0.15;
          if (lt < 0) return null;
          const x = 960 + Math.sin(i * 1.2 + lt * 0.5) * 200 + (i - 1) * 100;
          const y = 540 - lt * 80;
          const op = clamp(1 - lt / 2.5, 0, 1);
          return (
            <div key={i} style={{
              position: 'absolute', left: x, top: y, fontSize: 60,
              opacity: op, transform: `rotate(${Math.sin(lt * 2) * 12}deg) scale(${1 + Math.sin(lt * 3) * 0.1})`,
              pointerEvents: 'none',
            }}>{e}</div>
          );
        })}
      </SlideInPage>
    );
  }

  // Register all 5 guides
  window.GUIDE_CHUYEN_NHUONG = {
    slug: 'chuyen-nhuong', title: 'Chuyển nhượng vé',
    subtitle: 'Chuyển vé cho người khác qua email',
    duration: 30, icon: '📨', color: 'var(--5s-magenta)',
    Component: GuideChuyenNhuong, persistKey: 'guide-chuyen-nhuong',
    faq: [
      { q: 'Người nhận có cần tài khoản 5BIB không?', a: 'Có. Người nhận phải có tài khoản trên 5BIB để chấp nhận chuyển nhượng.' },
      { q: 'Chuyển nhượng có mất phí không?', a: 'Tuỳ chính sách từng giải. Đa số giải miễn phí chuyển nhượng.' },
      { q: 'Đã ký miễn trừ có chuyển nhượng được không?', a: 'Không. Vé đã ký miễn trừ sẽ khoá và không chuyển nhượng được.' },
      { q: 'Người nhận không xác nhận thì sao?', a: 'Bạn có thể huỷ yêu cầu chuyển nhượng và vé trở lại bình thường.' },
    ],
  };
  window.GUIDE_NHAN_CHUYEN_NHUONG = {
    slug: 'nhan-chuyen-nhuong', title: 'Nhận chuyển nhượng',
    subtitle: 'Chấp nhận vé được chuyển nhượng',
    duration: 29, icon: '🎁', color: 'var(--5s-success)',
    Component: GuideNhanChuyenNhuong, persistKey: 'guide-nhan-chuyen-nhuong',
    faq: [
      { q: 'Tôi không nhận được email mời?', a: 'Kiểm tra Spam. Hoặc đăng nhập 5bib.com → Vé của tôi để xem vé đang chờ.' },
      { q: 'Có thể từ chối nhận chuyển nhượng không?', a: 'Có. Vé sẽ trả về cho người gửi.' },
      { q: 'Sau khi nhận có cần ký miễn trừ lại không?', a: 'Có. Người nhận cần ký miễn trừ riêng cho vé của mình.' },
    ],
  };
  window.GUIDE_UY_QUYEN = {
    slug: 'uy-quyen', title: 'Ủy quyền nhận racekit',
    subtitle: 'Ủy quyền người khác đại diện nhận racekit',
    duration: 27, icon: '🤝', color: 'var(--5s-warning)',
    Component: GuideUyQuyen, persistKey: 'guide-uy-quyen',
    faq: [
      { q: 'Phải ký miễn trừ trước không?', a: 'Có. Chỉ vé đã ký miễn trừ mới ủy quyền được.' },
      { q: 'Cần giấy tờ gì để nhận racekit?', a: 'Người được ủy quyền cần mang CCCD/CMND bản gốc đến điểm nhận.' },
      { q: 'Có thể ủy quyền cho mấy người?', a: '1 vé chỉ ủy quyền cho 1 người. Có thể chỉnh sửa thông tin trước ngày race.' },
    ],
  };
  window.GUIDE_CHINH_SUA = {
    slug: 'chinh-sua', title: 'Chỉnh sửa thông tin vé',
    subtitle: 'Sửa thông tin VĐV (size áo, hạng mục, SĐT...)',
    duration: 24, icon: '✏️', color: 'var(--5s-blue)',
    Component: GuideChinhSua, persistKey: 'guide-chinh-sua',
    faq: [
      { q: 'Vé chưa ghi danh có sửa được không?', a: 'Không. Cần ghi danh thông tin VĐV trước khi mới sửa được.' },
      { q: 'Đã ký miễn trừ có sửa được không?', a: 'Không. Vé đã ký bị khoá thông tin.' },
      { q: 'Size áo lỡ chọn sai phải làm sao?', a: 'Vào Vé của tôi → chọn vé → Sửa thông tin → đổi size → Lưu (trước khi ký miễn trừ).' },
    ],
  };
  window.GUIDE_THEM_HO_SO = {
    slug: 'them-ho-so', title: 'Thêm hồ sơ vận động viên',
    subtitle: 'Lưu hồ sơ VĐV để dùng lại nhanh',
    duration: 29, icon: '👤', color: 'var(--5s-blue)',
    Component: GuideThemHoSo, persistKey: 'guide-them-ho-so',
    faq: [
      { q: 'Một tài khoản lưu được mấy hồ sơ?', a: 'Không giới hạn. Bạn có thể lưu nhiều hồ sơ cho bạn + gia đình + bạn bè.' },
      { q: 'Hồ sơ dùng cho giải nào?', a: 'Hồ sơ dùng được cho tất cả giải khi ghi danh — không phải nhập lại thông tin.' },
      { q: 'Có thể xoá hồ sơ không?', a: 'Có. Vào Tài khoản → Hồ sơ VĐV → biểu tượng xoá.' },
    ],
  };
})();
