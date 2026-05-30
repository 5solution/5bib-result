// tutorial-screens.jsx — Page mockups for 5bib.com tutorials.
// Matches the real product UI from selling-web codebase.
// Components: LoginPage, MyTicketsPage, TicketDetailPage, SuccessOverlay,
//             GuideIntro, GuideOutro.

const { BibWebHeader, BibLogoSvg, TicketRow, StatusBadge } = window;

// ── Avatar helper ───────────────────────────────────────────────────────
function Avatar({ name = 'NA', size = 36 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'rgba(255,255,255,0.15)',
      border: '2px solid rgba(255,255,255,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontFamily: 'var(--font-body)', fontWeight: 700,
      fontSize: size * 0.36,
    }}>{name}</div>
  );
}

// ── Reusable form bits ──────────────────────────────────────────────────
function FieldLabel({ children, required }) {
  return (
    <label style={{
      display: 'block',
      fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 500,
      color: 'var(--5s-text)', marginBottom: 6,
    }}>{children}{required && <span style={{ color: 'var(--5s-danger)', marginLeft: 2 }}>*</span>}</label>
  );
}

function FormField({ children, focused, error }) {
  return (
    <div style={{
      padding: '12px 14px',
      border: error
        ? '1.5px solid var(--5s-danger)'
        : focused ? '1.5px solid var(--5s-text)' : '1.5px solid var(--5s-border-soft)',
      borderRadius: 8,
      fontFamily: 'var(--font-body)', fontSize: 15,
      color: 'var(--5s-text)',
      background: '#fff',
      minHeight: 22, lineHeight: 1.4,
      transition: 'all 150ms',
    }}>{children}</div>
  );
}

function Caret() {
  return (
    <span style={{
      display: 'inline-block', width: 2, height: 18,
      background: 'var(--5s-blue)',
      verticalAlign: 'middle', marginLeft: 1,
      animation: 'cb 0.8s steps(2) infinite',
    }}/>
  );
}

// ── LOGIN PAGE — matches modal-login.tsx (2-column split) ───────────────
function LoginPage({ typedEmail = '', typedPass = '', highlightLoginBtn = false,
                    highlightGoogle = false, focusEmail = false, focusPass = false }) {
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#fff', display: 'flex' }}>
      {/* Left: form */}
      <div style={{ width: '50%', padding: '60px 80px', display: 'flex', flexDirection: 'column' }}>
        <BibLogoSvg width={88} color="var(--5s-blue-700)" accent="#DB3069" style={{ margin: '0 auto 32px' }} />

        <div style={{
          fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 36,
          color: 'var(--5s-text)', letterSpacing: '-0.02em',
        }}>Đăng nhập</div>

        <div style={{ marginTop: 32 }}>
          <FieldLabel required>Email</FieldLabel>
          <FormField focused={focusEmail}>
            {typedEmail || <span style={{ color: 'var(--5s-text-light)' }}>name@company.com</span>}
            {focusEmail && typedEmail.length < 20 && <Caret/>}
          </FormField>
        </div>

        <div style={{ marginTop: 18 }}>
          <FieldLabel required>Mật khẩu</FieldLabel>
          <FormField focused={focusPass}>
            <span style={{ letterSpacing: 3 }}>{typedPass}</span>
            {focusPass && typedPass.length < 12 && <Caret/>}
            {!typedPass && <span style={{ color: 'var(--5s-text-light)' }}>••••••••</span>}
          </FormField>
        </div>

        <div style={{
          marginTop: 14, textAlign: 'right',
          fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 500,
          color: 'var(--5s-blue)',
        }}>Quên mật khẩu?</div>

        <button style={{
          width: '100%', marginTop: 24,
          padding: '14px 22px',
          background: 'var(--5s-blue)', color: '#fff',
          border: 'none', borderRadius: 8,
          fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 700,
          boxShadow: highlightLoginBtn
            ? '0 0 0 4px rgba(219,48,105,0.3), 0 6px 20px rgba(37,99,235,0.25)'
            : '0 4px 12px rgba(37,99,235,0.15)',
          transition: 'all 200ms',
        }}>Đăng nhập</button>

        <button style={{
          width: '100%', marginTop: 14,
          padding: '12px 22px',
          background: '#fff', color: 'var(--5s-text)',
          border: '1px solid var(--5s-border-soft)',
          borderRadius: 8,
          fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 500,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          boxShadow: highlightGoogle ? '0 0 0 4px rgba(219,48,105,0.3)' : 'none',
          transition: 'all 200ms',
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M21.35 11.1H12v3.2h5.35c-.23 1.4-1.66 4.1-5.35 4.1-3.22 0-5.85-2.67-5.85-5.95s2.63-5.95 5.85-5.95c1.83 0 3.06.78 3.76 1.45l2.56-2.46C16.62 4.16 14.5 3.2 12 3.2c-4.97 0-9 4.03-9 9s4.03 9 9 9c5.2 0 8.62-3.65 8.62-8.78 0-.59-.06-1.04-.15-1.32z"/>
          </svg>
          Đăng nhập với Google
        </button>

        <div style={{
          marginTop: 22, textAlign: 'center',
          fontFamily: 'var(--font-body)', fontSize: 14,
          color: 'var(--5s-blue)', fontWeight: 500,
        }}>Tạo tài khoản mới</div>
      </div>

      {/* Right: banner (blue gradient from sky → primary) */}
      <div style={{
        width: '50%',
        background: 'linear-gradient(180deg, #0BA5EC 10%, var(--5s-blue) 100%)',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `radial-gradient(circle at 30% 20%, rgba(255,255,255,0.1), transparent 40%),
                            radial-gradient(circle at 80% 80%, rgba(255,14,101,0.15), transparent 50%)`,
        }}/>
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: 80, color: '#fff', textAlign: 'center',
        }}>
          <div style={{ fontSize: 200, marginBottom: 24, opacity: 0.9 }}>🏃‍♂️</div>
          <div style={{
            fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 28,
            letterSpacing: '-0.02em', lineHeight: 1.2,
          }}>
            Tìm trải nghiệm<br/>của bạn
          </div>
          <div style={{
            marginTop: 14, fontFamily: 'var(--font-body)', fontSize: 15,
            opacity: 0.85, maxWidth: 320,
          }}>
            Find Your Experience · Mua vé giải chạy, tra kết quả real-time, chia sẻ thành tích.
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Homepage (logged in) — simple hero area ─────────────────────────────
function HomepageLoggedIn({ highlightTicket = false }) {
  return (
    <>
      <BibWebHeader highlightTicket={highlightTicket} />
      <div style={{ padding: '50px 80px 40px', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{
          fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 700,
          color: 'var(--5s-magenta)', letterSpacing: '.02em', marginBottom: 14,
        }}>
          🔴 Giải đang diễn ra · 3 races live
        </div>
        <div style={{
          fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 54,
          letterSpacing: '-0.025em', color: 'var(--5s-text)', lineHeight: 1.05,
        }}>
          Find Your<br/>Experiences Live
        </div>
        <div style={{
          marginTop: 18, fontFamily: 'var(--font-body)', fontSize: 17,
          color: 'var(--5s-text-muted)', maxWidth: 640, lineHeight: 1.55,
        }}>
          Real-time race results từ mọi giải chạy lớn tại Việt Nam — tra BIB tức thì, share kết quả ngay.
        </div>
      </div>
    </>
  );
}

// ── Standard tickets data ───────────────────────────────────────────────
const STD_TICKETS = [
  { name: 'Saigon Half Marathon 2026', dist: '5KM', bib: '1247',
    date: '13.04.2026', color: '#2563eb', color2: '#1d4ed8',
    statusKey: 'register', actionLabel: 'Xem chi tiết',
    course: 'Standard Course' },
  { name: 'Da Nang Beach Run 2026', dist: '10KM', bib: '0892',
    date: '22.06.2026', color: '#DB3069', color2: '#9C1F4E',
    statusKey: 'new', actionLabel: 'Ghi danh',
    course: 'Coastal Track' },
  { name: 'Hanoi City Trail', dist: '21KM', bib: '3214',
    date: '08.09.2026', color: '#15803D', color2: '#0F5B2C',
    statusKey: 'checkedIn', actionLabel: 'Xem QR',
    course: 'Trail Course' },
];

// ── My Tickets list page (matches the real /tickets layout) ─────────────
function MyTicketsPage({ highlightIdx = -1, statusFilter = 'all' }) {
  const filters = [
    { id: 'all', label: 'Tất cả' },
    { id: 'new', label: 'Chưa ghi danh' },
    { id: 'transferring', label: 'Chờ chuyển nhượng' },
    { id: 'register', label: 'Đã ghi danh' },
    { id: 'remind', label: 'Chờ xác nhận tham gia' },
    { id: 'checkedIn', label: 'Đã check in' },
    { id: 'racekit', label: 'Đã nhận racekit' },
  ];

  return (
    <>
      <BibWebHeader />
      {/* Breadcrumb-ish title row */}
      <div style={{ padding: '32px 80px 20px', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          fontFamily: 'var(--font-body)', fontSize: 16, fontWeight: 700,
          color: 'var(--5s-text)',
        }}>
          <img src="assets/icon.svg" alt="ticket" style={{ width: 24, height: 24 }}
               onError={(e) => { e.target.style.display = 'none'; }} />
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--5s-blue)" strokeWidth="2">
            <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z"/>
            <line x1="13" x2="13" y1="5" y2="7"/><line x1="13" x2="13" y1="11" y2="13"/><line x1="13" x2="13" y1="17" y2="19"/>
          </svg>
          <span style={{
            fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22,
            color: 'var(--5s-text)',
          }}>Vé của tôi</span>
        </div>

        {/* Filter pills */}
        <div style={{
          marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 8,
        }}>
          {filters.map(f => {
            const active = f.id === statusFilter;
            return (
              <div key={f.id} style={{
                padding: '5px 14px',
                border: active ? '2px solid var(--5s-blue)' : '2px solid var(--5s-text-subtle)',
                color: active ? 'var(--5s-blue)' : 'var(--5s-text-subtle)',
                borderRadius: 9999,
                fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 700,
              }}>{f.label}</div>
            );
          })}
        </div>

        {/* Ticket list */}
        <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {STD_TICKETS.map((tk, i) => (
            <TicketRow key={i} ticket={tk} highlight={i === highlightIdx} />
          ))}
        </div>
      </div>
    </>
  );
}

// ── Ticket Detail Page (matches athlete-status-checked-in.tsx) ──────────
// Two-column: left = race image + tags + title + race detail
// Right = white card with BIB display + athlete info + action buttons
function TicketDetailPage({ ticket = STD_TICKETS[0], highlightAction = null,
                            showActionMenu = false }) {
  const actions = [
    { id: 'doi-cu-ly', label: 'Đổi cự ly', icon: 'refresh' },
    { id: 'sua-thong-tin', label: 'Sửa thông tin', icon: 'edit' },
    { id: 'chuyen-nhuong', label: 'Chuyển nhượng', icon: 'send' },
    { id: 'ky-mien-tru', label: 'Ký miễn trừ', icon: 'pen' },
    { id: 'quay-bib', label: 'Quay BIB', icon: 'dice' },
    { id: 'uy-quyen', label: 'Ủy quyền nhận racekit', icon: 'user-plus' },
    { id: 'ghi-danh', label: 'Ghi danh', icon: 'edit' },
  ];

  return (
    <>
      <BibWebHeader />
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px 80px' }}>
        {/* Breadcrumb */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          fontFamily: 'var(--font-body)', fontSize: 14,
          color: 'var(--5s-blue)', fontWeight: 500,
        }}>
          <span>Vé của tôi</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m9 6 6 6-6 6"/></svg>
          <span style={{ color: 'var(--5s-text-muted)' }}>BIB-{ticket.bib}</span>
        </div>

        <div style={{
          marginTop: 18, display: 'grid',
          gridTemplateColumns: '1fr 380px', gap: 24,
        }}>
          {/* LEFT column: race image, tags, title */}
          <div>
            <div style={{
              width: '100%', aspectRatio: '16/9', borderRadius: 14,
              background: `linear-gradient(135deg, ${ticket.color}, ${ticket.color2})`,
              position: 'relative', overflow: 'hidden',
            }}>
              <div style={{
                position: 'absolute', inset: 0,
                background: 'radial-gradient(circle at 70% 30%, rgba(255,255,255,0.15), transparent 50%)',
              }}/>
              <div style={{
                position: 'absolute', bottom: 24, left: 24, color: '#fff',
              }}>
                <div style={{
                  fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18,
                  opacity: 0.85,
                }}>RACE EVENT</div>
                <div style={{
                  fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 36,
                  letterSpacing: '-0.02em', textTransform: 'uppercase',
                }}>{ticket.dist}</div>
              </div>
            </div>

            <div style={{ marginTop: 18, display: 'flex', gap: 8 }}>
              <span style={{
                padding: '4px 14px',
                border: '1.5px solid var(--5s-blue)',
                borderRadius: 9999,
                color: 'var(--5s-blue)',
                fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700,
              }}>Đang mở đăng ký</span>
              <span style={{
                padding: '4px 14px',
                border: '1.5px solid var(--5s-blue)',
                borderRadius: 9999,
                color: 'var(--5s-blue)',
                fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700,
              }}>Marathon</span>
            </div>

            <div style={{
              marginTop: 14,
              fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 28,
              color: '#1D2939', textTransform: 'uppercase', letterSpacing: '-0.02em',
              lineHeight: 1.15,
            }}>{ticket.name}</div>

            <div style={{
              marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4,
              fontFamily: 'var(--font-body)', fontSize: 14, color: '#1D2939',
            }}>
              <DetailRow icon="calendar" text={ticket.date} />
              <DetailRow icon="pin" text="TP. Hồ Chí Minh, Việt Nam" />
            </div>
          </div>

          {/* RIGHT column: athlete card with BIB display */}
          <div>
            <div style={{
              background: '#fff', borderRadius: 8,
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              padding: '20px 24px',
            }}>
              {/* Header */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                paddingBottom: 12, borderBottom: '1px solid #D0D5DD',
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--5s-blue)" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                </svg>
                <div style={{
                  fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 16,
                  color: 'var(--5s-text)',
                }}>Thông tin VĐV</div>
              </div>

              {/* BIB display — matches BIBNumber component */}
              <div style={{
                marginTop: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                borderRadius: 4, overflow: 'hidden',
              }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  background: 'var(--5s-blue)', color: '#fff',
                  fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18,
                  padding: '8px 16px',
                }}>
                  <span>BIB</span>
                  <span>{ticket.dist}</span>
                </div>
                <div style={{
                  padding: '20px 24px', textAlign: 'center',
                }}>
                  <div style={{
                    fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 64,
                    color: 'var(--5s-blue)', lineHeight: 1, letterSpacing: '-0.04em',
                  }}>{ticket.bib}</div>
                  <div style={{
                    marginTop: 8, fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 700,
                    color: 'var(--5s-text)', textTransform: 'uppercase',
                  }}>{ticket.name}</div>
                </div>
                <div style={{ height: 12, background: 'var(--5s-blue)' }}/>
              </div>

              {/* Athlete info grid */}
              <div style={{ marginTop: 18 }}>
                <div style={{
                  fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 500,
                  color: '#98A2B3', letterSpacing: '.04em', textTransform: 'uppercase',
                }}>HỌ VÀ TÊN</div>
                <div style={{
                  fontFamily: 'var(--font-body)', fontSize: 18, fontWeight: 700,
                  color: 'var(--5s-blue)', marginTop: 2,
                }}>Nguyễn Minh Anh</div>

                <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <InfoPair label="Email" value="minhanh@gmail.com" />
                  <InfoPair label="SĐT" value="0901 234 567" />
                  <InfoPair label="Ngày sinh" value="15/08/1992" />
                  <InfoPair label="Giới tính" value="Nam" />
                  <InfoPair label="Cự ly" value={ticket.dist} />
                  <InfoPair label="Áo size" value="M" />
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid #D0D5DD',
                display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(showActionMenu ? actions : actions.slice(0, 4)).map(a => {
                  const isHi = a.id === highlightAction;
                  return (
                    <button key={a.id} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 16px',
                      background: isHi ? 'var(--5s-blue)' : '#fff',
                      color: isHi ? '#fff' : 'var(--5s-blue)',
                      border: '1.5px solid var(--5s-blue)',
                      borderRadius: 9999,
                      fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 14,
                      boxShadow: isHi ? '0 0 0 4px rgba(219,48,105,0.3)' : 'none',
                      transition: 'all 200ms',
                    }}>
                      <ActionIcon name={a.icon} />
                      {a.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function DetailRow({ icon, text }) {
  const icons = {
    calendar: <><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></>,
    pin: <><path d="M20 10c0 7-8 13-8 13s-8-6-8-13a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></>,
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        {icons[icon] || icons.calendar}
      </svg>
      {text}
    </div>
  );
}

function ActionIcon({ name }) {
  const props = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 };
  if (name === 'refresh') return <svg {...props}><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/></svg>;
  if (name === 'edit') return <svg {...props}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="m18.5 2.5 3 3L12 15l-4 1 1-4z"/></svg>;
  if (name === 'send') return <svg {...props}><path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/></svg>;
  if (name === 'pen') return <svg {...props}><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/></svg>;
  if (name === 'dice') return <svg {...props}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1" fill="currentColor"/><circle cx="16" cy="16" r="1" fill="currentColor"/><circle cx="16" cy="8" r="1" fill="currentColor"/><circle cx="8" cy="16" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/></svg>;
  if (name === 'user-plus') return <svg {...props}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>;
  return null;
}

function InfoPair({ label, value }) {
  return (
    <div>
      <div style={{
        fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 500,
        color: '#98A2B3', letterSpacing: '.04em', textTransform: 'uppercase',
      }}>{label}</div>
      <div style={{
        fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 700,
        color: 'var(--5s-text)', marginTop: 2,
      }}>{value}</div>
    </div>
  );
}

// ── Success overlay ────────────────────────────────────────────────────
function SuccessOverlay({ scale, checkProgress, title = 'Hoàn tất!', sub }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.65)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
    }}>
      <div style={{
        width: 140, height: 140, borderRadius: '50%',
        background: 'var(--5s-success)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transform: `scale(${scale})`,
        boxShadow: '0 20px 60px rgba(34,197,94,0.6)',
        marginBottom: 28,
      }}>
        <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12l5 5L20 7" strokeDasharray="30" strokeDashoffset={(1 - checkProgress) * 30}/>
        </svg>
      </div>
      <div style={{
        fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 56,
        letterSpacing: '-0.025em', lineHeight: 1, color: '#fff',
      }}>{title}</div>
      {sub && (
        <div style={{
          marginTop: 18, fontFamily: 'var(--font-body)', fontSize: 20,
          color: 'rgba(255,255,255,0.85)',
        }}>{sub}</div>
      )}
    </div>
  );
}

// ── Standard intro scene ───────────────────────────────────────────────
function GuideIntro({ title, subtitle, eyebrow = 'Hướng dẫn · How to', tags = [], t, dur }) {
  const { AmbientDots } = window;
  const progress = t / dur;
  const push = 1 + progress * 0.04;
  const eyeOp = window.clamp((t - 0.1) / 0.4, 0, 1);
  const titleOp = window.clamp((t - 0.4) / 0.5, 0, 1);
  const subOp = window.clamp((t - 0.9) / 0.5, 0, 1);
  const tagsOp = window.clamp((t - 1.3) / 0.5, 0, 1);
  const exitOp = window.clamp(1 - (t - (dur - 0.6)) / 0.6, 0, 1);

  return (
    <div style={{ position: 'absolute', inset: 0, opacity: exitOp,
      background: `linear-gradient(135deg, var(--5s-blue) 0%, var(--5s-blue-700) 100%)`,
      overflow: 'hidden',
    }}>
      {/* texture overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(circle at 20% 30%, rgba(255,255,255,0.1), transparent 40%),
                     radial-gradient(circle at 80% 70%, rgba(219,48,105,0.18), transparent 50%)`,
        transform: `scale(${push})`, transformOrigin: 'center',
      }}/>
      <AmbientDots t={t} count={36} color="rgba(255,255,255,0.18)" />

      <div style={{ position: 'absolute', left: 100, top: 220, right: 100 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 14,
          opacity: eyeOp,
        }}>
          <div style={{ width: 56, height: 3, background: 'var(--5s-magenta)' }}/>
          <div style={{
            fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 16,
            letterSpacing: '.18em', textTransform: 'uppercase', color: '#fff',
          }}>{eyebrow}</div>
        </div>
        <div style={{
          marginTop: 26,
          fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 144,
          letterSpacing: '-0.04em', color: '#fff', lineHeight: 0.95,
          textTransform: 'uppercase',
          opacity: titleOp,
          transform: `translateY(${(1 - titleOp) * 24}px)`,
        }}>
          {title}
        </div>
        {subtitle && (
          <div style={{
            marginTop: 28, fontFamily: 'var(--font-body)', fontSize: 24, fontWeight: 400,
            color: 'rgba(255,255,255,0.85)', maxWidth: 1100, lineHeight: 1.45,
            opacity: subOp,
          }}>
            {subtitle}
          </div>
        )}
        {tags.length > 0 && (
          <div style={{ display: 'flex', gap: 12, marginTop: 32, opacity: tagsOp }}>
            {tags.map((tag, i) => (
              <div key={i} style={{
                padding: '10px 22px',
                background: 'rgba(255,255,255,0.18)',
                border: '1.5px solid rgba(255,255,255,0.3)',
                borderRadius: 9999,
                fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 17,
                color: '#fff',
              }}>
                {tag}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{
        position: 'absolute', right: 100, bottom: 100,
        display: 'flex', alignItems: 'center', gap: 14,
        opacity: subOp, color: '#fff',
      }}>
        <BibLogoSvg width={72} color="#fff" accent="#fff" />
        <div style={{
          fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 22,
          letterSpacing: '-0.02em', opacity: 0.85,
        }}>hotro.5bib.com</div>
      </div>
    </div>
  );
}

// ── Standard outro scene ──────────────────────────────────────────────
function GuideOutro({ t, dur }) {
  const { AmbientDots, Confetti } = window;
  const push = 1 + (t / dur) * 0.04;
  const t1 = window.clamp((t - 0.2) / 0.5, 0, 1);
  const t2 = window.clamp((t - 0.5) / 0.5, 0, 1);
  const t3 = window.clamp((t - 1.0) / 0.5, 0, 1);

  return (
    <div style={{ position: 'absolute', inset: 0,
      background: 'linear-gradient(135deg, var(--5s-blue) 0%, var(--5s-blue-700) 100%)',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(circle at 20% 30%, rgba(255,255,255,0.1), transparent 40%),
                     radial-gradient(circle at 80% 70%, rgba(219,48,105,0.18), transparent 50%)`,
        transform: `scale(${push})`,
      }}/>
      <AmbientDots t={t} count={28} color="rgba(255,255,255,0.16)"/>
      <Confetti active={t > 0.2} t={t - 0.2} originX={960} originY={540} count={80}/>

      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: 80, color: '#fff', textAlign: 'center',
      }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 14,
          padding: '8px 20px',
          background: 'rgba(255,255,255,0.18)', borderRadius: 9999,
          opacity: t1,
        }}>
          <span style={{ width: 8, height: 8, background: 'var(--5s-magenta)', borderRadius: '50%' }}/>
          <span style={{
            fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 14,
            letterSpacing: '.18em', textTransform: 'uppercase',
          }}>
            Cần hỗ trợ?
          </span>
        </div>
        <div style={{
          marginTop: 28, fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 120,
          letterSpacing: '-0.04em', lineHeight: 0.95, textTransform: 'uppercase',
          opacity: t2, transform: `translateY(${(1 - t2) * 24}px)`,
        }}>
          Hỗ trợ 24/7
        </div>

        <div style={{
          marginTop: 44, display: 'flex', gap: 50, alignItems: 'center', opacity: t3,
        }}>
          <ContactBox icon="mail" label="Email" value="info@5bib.com"/>
          <div style={{ width: 1, height: 60, background: 'rgba(255,255,255,0.3)' }}/>
          <ContactBox icon="phone" label="Hotline" value="0373 398 986"/>
        </div>

        <div style={{
          marginTop: 40, display: 'flex', alignItems: 'center', gap: 14, opacity: t3,
        }}>
          <BibLogoSvg width={60} color="#fff" accent="#fff" />
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 32,
            letterSpacing: '-0.02em' }}>hotro.5bib.com</div>
        </div>
      </div>
    </div>
  );
}

function ContactBox({ icon, label, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ width: 60, height: 60, borderRadius: 12,
        background: 'rgba(255,255,255,0.18)',
        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {icon === 'mail' ? (
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 5L2 7"/></svg>
        ) : (
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
        )}
      </div>
      <div style={{ textAlign: 'left' }}>
        <div style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 13,
          opacity: 0.7, letterSpacing: '.18em', textTransform: 'uppercase' }}>{label}</div>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 28,
          letterSpacing: '-0.01em', marginTop: 2 }}>{value}</div>
      </div>
    </div>
  );
}

window.Avatar = Avatar;
window.FieldLabel = FieldLabel;
window.FormField = FormField;
window.Caret = Caret;
window.LoginPage = LoginPage;
window.HomepageLoggedIn = HomepageLoggedIn;
window.MyTicketsPage = MyTicketsPage;
window.TicketDetailPage = TicketDetailPage;
window.SuccessOverlay = SuccessOverlay;
window.GuideIntro = GuideIntro;
window.GuideOutro = GuideOutro;
window.STD_TICKETS = STD_TICKETS;

// Global cursor blink CSS (inject once)
if (!document.getElementById('cursor-blink-css')) {
  const s = document.createElement('style');
  s.id = 'cursor-blink-css';
  s.textContent = '@keyframes cb { 50% { opacity: 0; } }';
  document.head.appendChild(s);
}
