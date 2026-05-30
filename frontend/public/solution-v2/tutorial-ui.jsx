// tutorial-ui.jsx — Mockups matching the REAL selling-web codebase.
// Real header: blue (#2563eb) with top utility row (links + login) + bottom row (logo + search + "Vé của tôi" button)
// Real ticket card: horizontal layout with image, info, status badge, outline action button

const { clamp: tClamp, LivePulse: tLivePulse } = window;

// ── Real 5BIB logo SVG (inline) ────────────────────────────────────────
function BibLogoSvg({ width = 90, color, accent = '#DB3069', style = {} }) {
  return (
    <svg width={width} viewBox="0 0 83 35" xmlns="http://www.w3.org/2000/svg"
         fill={color || 'currentColor'} aria-hidden="true" style={style}>
      <path d="M53.5701 6.30328C51.8456 6.30328 50.4458 4.89596 50.4458 3.1586C50.4458 1.4228 51.844 0.013916 53.5701 0.013916C55.2947 0.013916 56.6945 1.42124 56.6945 3.1586C56.6929 4.89596 55.2947 6.30328 53.5701 6.30328Z"/>
      <path d="M50.5555 8.46265H56.4716C56.6047 8.46265 56.7129 8.57162 56.7129 8.7055V27.7215C56.7129 31.1448 53.9567 33.919 50.5555 33.919C50.4225 33.919 50.3142 33.81 50.3142 33.6762V8.7055C50.3142 8.57162 50.4225 8.46265 50.5555 8.46265Z"/>
      <path d="M10.6692 33.9705C5.08557 33.5844 0.586201 29.1647 0.0355742 23.5899C0.0201072 23.4451 0.00773352 23.2988 0 23.1509V18.8168C0 18.7452 0.0572281 18.6876 0.128376 18.6876H1.8545C3.55123 18.6876 6.20228 20.5729 6.20228 23.0637C6.20692 23.0777 6.21002 23.0917 6.21157 23.1073C6.53947 25.7289 8.76827 27.7636 11.4626 27.7636C14.3813 27.7636 16.7554 25.374 16.7554 22.4363C16.7554 19.575 14.5019 17.232 11.6854 17.1137H6.14815C2.8181 17.1137 0.106723 14.4501 0.00309341 11.1233C0.0015467 11.1217 0.0015467 11.1217 0.00309341 11.1201C0.0015467 11.0594 0 10.994 0 10.9287V0.269424C0 0.163564 0.0850688 0.0810547 0.190245 0.0810547C3.91316 0.0810547 6.35386 3.3316 6.35386 6.11978V10.8664L11.7008 10.882C11.7147 10.882 11.7287 10.8835 11.7426 10.8835C17.7221 11.0267 22.585 15.7951 22.9283 21.7622C23.3382 28.8751 17.7314 34.4577 10.6692 33.9705Z"/>
      <path d="M35.9145 33.8894C30.3309 33.5033 25.8316 29.0836 25.2809 23.5088C25.2655 23.3641 25.2531 23.2177 25.2454 23.0698V18.7358C25.2454 18.6642 25.3026 18.6066 25.3737 18.6066H27.0999C28.7966 18.6066 31.4476 20.4918 31.4476 22.9827C31.4523 22.9967 31.4554 23.0107 31.4569 23.0262C31.7848 25.6478 34.0136 27.6826 36.708 27.6826C39.6266 27.6826 42.0008 25.2929 42.0008 22.3553C42.0008 19.4939 39.7473 17.151 36.9307 17.0327H31.3935C28.0635 17.0327 25.3521 14.369 25.2485 11.0422C25.2469 11.0406 25.2469 11.0406 25.2485 11.0391C25.2454 10.9737 25.2454 10.9099 25.2454 10.8445V0.18837C25.2454 0.082509 25.3304 0 25.4356 0C29.1585 0 31.5992 3.25054 31.5992 6.03873V10.7838L36.9462 10.7993C36.9601 10.7993 36.974 10.8009 36.9879 10.8009C42.9675 10.9441 47.8303 15.7125 48.1737 21.6796C48.5836 28.7941 42.9768 34.3767 35.9145 33.8894Z"/>
      <path d="M69.6064 33.8894C64.0228 33.5033 59.5235 29.0836 58.9728 23.5088C58.9574 23.3641 58.945 23.2177 58.9373 23.0698V18.7358C58.9373 18.6642 58.9945 18.6066 59.0656 18.6066H60.7918C62.4885 18.6066 65.1395 20.4918 65.1395 22.9827C65.1442 22.9967 65.1473 23.0107 65.1488 23.0262C65.4767 25.6478 67.7055 27.6826 70.3999 27.6826C73.3185 27.6826 75.6927 25.2929 75.6927 22.3553C75.6927 19.4939 73.4392 17.151 70.6226 17.0327H65.0854C61.7554 17.0327 59.044 14.369 58.9404 11.0422C58.9388 11.0406 58.9388 11.0406 58.9404 11.0391C58.9373 10.9737 58.9373 10.9099 58.9373 10.8445V0.18837C58.9373 0.082509 59.0223 0 59.1275 0C62.8504 0 65.2911 3.25054 65.2911 6.03873V10.7838L70.6381 10.7993C70.652 10.7993 70.6659 10.8009 70.6798 10.8009C76.6594 10.9441 81.5222 15.7125 81.8656 21.6796C82.2755 28.7941 76.6702 34.3767 69.6064 33.8894Z"/>
      <path d="M19.708 0.0466309H20.95C20.95 3.56805 18.5634 6.42318 14.6147 6.42318H7.45035C7.58182 3.28161 6.25939 1.30917 4.07544 0.0466309H19.708Z" fill={accent} stroke={accent}/>
    </svg>
  );
}

// ── Browser window chrome ─────────────────────────────────────────────────
function BrowserFrame({ width = 1500, height = 920, url = 'https://5bib.com', children, style = {} }) {
  return (
    <div style={{
      width, height,
      background: '#fff',
      borderRadius: 16,
      overflow: 'hidden',
      boxShadow: '0 40px 80px -10px rgba(0,0,0,0.35), 0 0 0 1px rgba(0,0,0,0.06)',
      display: 'flex', flexDirection: 'column',
      ...style,
    }}>
      <div style={{
        height: 44,
        background: '#E5E1DA',
        display: 'flex', alignItems: 'center',
        padding: '0 16px', gap: 12, flexShrink: 0,
      }}>
        <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#FF5F57' }}/>
        <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#FEBC2E' }}/>
        <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#28C840' }}/>
        <div style={{
          flex: 1, marginLeft: 24,
          background: '#fff', borderRadius: 8,
          height: 28,
          display: 'flex', alignItems: 'center',
          padding: '0 14px',
          fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 500,
          color: 'var(--5s-text-muted)',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 8, color: 'var(--5s-success)' }}>
            <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          {url}
        </div>
      </div>
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: 'var(--5s-bg)' }}>
        {children}
      </div>
    </div>
  );
}

// ── REAL 5BIB header (matches HomeHeader from header.tsx) ────────────────
// Two-row blue header: top utility row (lang/login/avatar), bottom (logo + search + ticket button)
function BibWebHeader({ loggedIn = true, highlightTicket = false, hidePrimaryNav = false }) {
  return (
    <div style={{
      background: 'var(--5s-blue)',
      padding: '14px 0 14px',
      color: '#fff',
    }}>
      {/* Top utility row */}
      <div style={{
        maxWidth: 1200, margin: '0 auto', padding: '0 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 14,
      }}>
        <nav style={{
          display: 'flex', alignItems: 'center',
          fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 13,
          color: '#EDF4FF',
        }}>
          {['Trang chủ', 'Giải đấu', 'Kết quả', 'Liên hệ', 'E-Waiver', 'E-Ticket'].map((item, i) => (
            <React.Fragment key={item}>
              {i > 0 && <span style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.25)' }}/>}
              <span style={{ padding: '0 14px', cursor: 'pointer' }}>{item}</span>
            </React.Fragment>
          ))}
        </nav>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Locale switcher */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '4px 8px',
            fontSize: 13, fontWeight: 500,
          }}>
            <div style={{
              width: 20, height: 14, borderRadius: 2, overflow: 'hidden',
              background: '#DA251D',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, color: '#FFCD00',
            }}>★</div>
            Tiếng Việt
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m6 9 6 6 6-6"/></svg>
          </div>
          {loggedIn ? (
            <>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: 'rgba(255,255,255,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 13,
                border: '2px solid rgba(255,255,255,0.4)',
              }}>NA</div>
              <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 500, color: '#fff', marginLeft: 4 }}>
                Nguyễn Minh Anh
              </div>
            </>
          ) : (
            <>
              <button style={{
                background: 'var(--5s-blue-deep)',
                color: '#fff', border: 'none',
                padding: '6px 22px',
                borderRadius: 9999,
                fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 700,
              }}>Đăng nhập</button>
              <button style={{
                background: '#fff',
                color: '#0f172a', border: 'none',
                padding: '6px 22px',
                borderRadius: 9999,
                fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 700,
              }}>Đăng ký</button>
            </>
          )}
        </div>
      </div>

      {/* Bottom row: logo + search + tickets button */}
      <div style={{
        maxWidth: 1200, margin: '0 auto', padding: '0 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 24,
      }}>
        <BibLogoSvg width={88} color="#fff" accent="#DB3069" />

        {/* Search box */}
        <div style={{
          flex: 1, maxWidth: 600,
          display: 'flex', alignItems: 'center',
          background: '#fff', borderRadius: 9999,
          padding: '4px 6px 4px 18px',
          gap: 10,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--5s-text-subtle)' }}>
            <circle cx="11" cy="11" r="7"/><path d="m21 21-6-6"/>
          </svg>
          <input style={{
            flex: 1, border: 'none', outline: 'none',
            fontFamily: 'var(--font-body)', fontSize: 14,
            color: 'var(--5s-text)', background: 'transparent',
          }} placeholder="Tìm giải chạy..." disabled />
          <button style={{
            background: 'var(--5s-blue)', color: '#fff',
            padding: '8px 22px',
            border: 'none', borderRadius: 9999,
            fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 700,
          }}>Tìm</button>
        </div>

        {/* Vé của tôi button (highlighted) */}
        {loggedIn && (
          <button style={{
            background: highlightTicket ? '#fff' : 'rgba(255,255,255,0.12)',
            color: highlightTicket ? 'var(--5s-blue)' : '#fff',
            border: highlightTicket ? '2px solid #fff' : '1.5px solid rgba(255,255,255,0.3)',
            padding: '10px 18px',
            borderRadius: 9999,
            fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 700,
            display: 'flex', alignItems: 'center', gap: 8,
            boxShadow: highlightTicket ? '0 0 0 4px rgba(255,255,255,0.3)' : 'none',
            transition: 'all 200ms',
            whiteSpace: 'nowrap',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z"/>
              <line x1="13" x2="13" y1="5" y2="7"/><line x1="13" x2="13" y1="11" y2="13"/><line x1="13" x2="13" y1="17" y2="19"/>
            </svg>
            Vé của tôi
          </button>
        )}
      </div>
    </div>
  );
}

// ── Status badge (matches BadgetStatus from real code) ──────────────────
function StatusBadge({ status }) {
  const styles = {
    new:        { bg: 'rgba(245,158,11,0.12)',  fg: '#B45309', label: 'Chưa ghi danh' },
    register:   { bg: 'rgba(34,197,94,0.12)',   fg: '#15803D', label: 'Đã ghi danh' },
    transferring: { bg: 'rgba(139,92,246,0.12)', fg: '#6D28D9', label: 'Chờ chuyển nhượng' },
    remind:     { bg: 'rgba(37,99,235,0.12)',   fg: 'var(--5s-blue)', label: 'Chờ xác nhận' },
    checkedIn:  { bg: 'rgba(22,101,52,0.12)',   fg: '#15803D', label: 'Đã check in' },
    waitingBib: { bg: 'rgba(217,119,6,0.12)',   fg: 'var(--5s-gold)', label: 'Quay BIB' },
    racekit:    { bg: 'rgba(37,99,235,0.12)',   fg: 'var(--5s-blue)', label: 'Đã nhận racekit' },
    inactive:   { bg: 'rgba(239,68,68,0.12)',   fg: '#B91C1C', label: 'Vô hiệu' },
  };
  const s = styles[status] || styles.new;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '4px 12px', borderRadius: 9999,
      background: s.bg, color: s.fg,
      fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 700,
      letterSpacing: '.02em',
    }}>{s.label}</span>
  );
}

// ── Horizontal ticket card (matches TicketItem from real code) ──────────
function TicketRow({ ticket, highlight = false, dim = false }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      padding: '16px 24px',
      background: '#fff',
      borderRadius: 8,
      boxShadow: highlight ? '0 0 0 3px var(--5s-magenta), 0 14px 30px rgba(219,48,105,0.18)' : '0 4px 12px rgba(0,0,0,0.06)',
      opacity: dim ? 0.5 : 1,
      transform: highlight ? 'translateY(-2px) scale(1.01)' : 'translateY(0)',
      transition: 'all 200ms',
      gap: 20,
    }}>
      {/* Race image */}
      <div style={{
        width: 96, height: 96,
        borderRadius: 12,
        background: `linear-gradient(135deg, ${ticket.color || '#1d4ed8'}, ${ticket.color2 || '#0026B3'})`,
        flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff',
        fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 24,
        letterSpacing: '-0.04em',
      }}>{ticket.dist}</div>

      {/* Info */}
      <div style={{ flex: 1 }}>
        <div style={{
          fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 16,
          color: 'var(--5s-text)', textTransform: 'uppercase',
          lineHeight: 1.25,
        }}>{ticket.name}</div>
        <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <RowLabel icon="user" text={ticket.athlete || 'Nguyễn Minh Anh'} />
          <RowLabel icon="bib" text={`BIB ${ticket.bib} · ${ticket.dist}`} />
          <RowLabel icon="course" text={ticket.course || ticket.race_course_name || 'Standard Course'} />
        </div>
      </div>

      {/* Right column: status + action */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 12 }}>
        <StatusBadge status={ticket.statusKey || 'register'} />
        <button style={{
          padding: '8px 18px',
          background: 'transparent', color: 'var(--5s-blue)',
          border: '1.5px solid var(--5s-blue)',
          borderRadius: 9999,
          fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 700,
          cursor: 'pointer',
        }}>{ticket.actionLabel || 'Xem chi tiết'}</button>
      </div>
    </div>
  );
}

function RowLabel({ icon, text }) {
  const icons = {
    user: <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>,
    bib:  <><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></>,
    course: <><path d="M3 6h18"/><path d="M3 12h18"/><path d="M3 18h18"/></>,
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
           style={{ color: 'var(--5s-text-subtle)', flexShrink: 0 }}>
        {icons[icon] || icons.user}
      </svg>
      <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--5s-text-muted)' }}>
        {text}
      </span>
    </div>
  );
}

// ── Step indicator + caption overlay (caption box at bottom-center of stage) ─
function StepIndicator({ step, total, title, sub, position = 'bottom' }) {
  const isBottom = position === 'bottom';
  return (
    <div style={{
      position: 'absolute',
      left: 60, right: 60,
      [isBottom ? 'bottom' : 'top']: 50,
      display: 'flex', alignItems: 'center', gap: 22,
      pointerEvents: 'none',
    }}>
      <div style={{
        background: 'var(--5s-magenta)',
        color: '#fff',
        fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 36,
        padding: '14px 22px',
        borderRadius: 14,
        boxShadow: '0 14px 30px rgba(219,48,105,0.35)',
        letterSpacing: '-0.04em',
        flexShrink: 0,
        minWidth: 130, textAlign: 'center',
        lineHeight: 1,
      }}>
        <span style={{ fontSize: 44 }}>{String(step).padStart(2, '0')}</span>
        <span style={{ opacity: 0.65, fontSize: 22 }}> / {String(total).padStart(2, '0')}</span>
      </div>
      <div style={{
        background: 'rgba(255,255,255,0.97)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(0,0,0,0.06)',
        padding: '18px 26px',
        borderRadius: 14,
        boxShadow: '0 14px 30px rgba(0,0,0,0.12)',
        flex: 1,
      }}>
        <div style={{
          fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 26,
          letterSpacing: '-0.02em',
          color: 'var(--5s-text)', lineHeight: 1.2,
        }}>{title}</div>
        {sub && (
          <div style={{
            marginTop: 4,
            fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 400,
            color: 'var(--5s-text-muted)', lineHeight: 1.4,
          }}>{sub}</div>
        )}
      </div>
    </div>
  );
}

// ── Cursor pointer ──────────────────────────────────────────────────────
function Cursor({ x, y, pressed = false }) {
  return (
    <div style={{
      position: 'absolute', left: x, top: y,
      transform: 'translate(-20%, -8%)',
      pointerEvents: 'none', zIndex: 100,
      transition: 'left 600ms cubic-bezier(0.16,1,0.3,1), top 600ms cubic-bezier(0.16,1,0.3,1)',
      willChange: 'transform',
    }}>
      <div style={{
        position: 'absolute', left: -10, top: -10,
        width: 56, height: 56, borderRadius: '50%',
        background: 'rgba(37,99,235,0.3)',
        opacity: pressed ? 1 : 0,
        transform: `scale(${pressed ? 1.4 : 0.5})`,
        transition: 'all 350ms cubic-bezier(0.16,1,0.3,1)',
      }} />
      <svg width="32" height="40" viewBox="0 0 32 40" fill="none" style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.4))' }}>
        <path d="M2 2 L2 28 L8 22 L12 34 L17 32 L13 21 L22 21 Z" fill="#fff" stroke="#0A0A0A" strokeWidth="1.5" strokeLinejoin="round"/>
      </svg>
    </div>
  );
}

function HighlightRing({ x, y, w, h, opacity = 1 }) {
  return (
    <div style={{
      position: 'absolute', left: x - 8, top: y - 8,
      width: w + 16, height: h + 16,
      border: '3px solid var(--5s-magenta)', borderRadius: 12,
      opacity, pointerEvents: 'none',
      boxShadow: '0 0 0 4px rgba(219,48,105,0.2), 0 0 30px rgba(219,48,105,0.3)',
      zIndex: 50,
    }} />
  );
}

window.BibLogoSvg = BibLogoSvg;
window.BrowserFrame = BrowserFrame;
window.BibWebHeader = BibWebHeader;
window.StatusBadge = StatusBadge;
window.TicketRow = TicketRow;
window.TicketCard = TicketRow; // alias for backward compat with existing scenes
window.StepIndicator = StepIndicator;
window.Cursor = Cursor;
window.HighlightRing = HighlightRing;
