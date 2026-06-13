import type { LandingData } from './types';

/** FEATURE-083 — Self-contained landing footer ("Powered by 5BIB"). */
export default function LandingFooter({ data }: { data: LandingData }) {
  const title = data.meta?.title ?? 'Giải chạy';
  return (
    <footer className="landing-footer">
      <div className="foot">
        <div>
          <div className="fb">{title}</div>
          <p>Trang giải chạy — vận hành trên nền tảng 5BIB.</p>
        </div>
        <div>
          <h4>Liên kết</h4>
          <a href="#course">Cung đường</a>
          <a href="#pricing">Đăng ký</a>
          <a href="#results_embed">Kết quả</a>
        </div>
        <div>
          <h4>Theo dõi</h4>
          <a href="#contact_social">Liên hệ</a>
        </div>
      </div>
      <div className="footbar">
        <span>© {title}</span>
        <span className="pw">
          Powered by <b>5BIB</b> · result.5bib.com · 5pix
        </span>
      </div>
    </footer>
  );
}
