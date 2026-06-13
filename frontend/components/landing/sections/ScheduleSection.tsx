import type { SectionProps } from '../types';
import styles from './schedule.module.css';

type ScheduleItem = {
  day?: string;
  time: string;
  title: string;
  location?: string;
  key?: boolean;
};

type ScheduleData = {
  kicker?: string;
  heading?: string;
  lead?: string;
  items?: ScheduleItem[];
  image?: string;
  imageNote?: string;
};

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M21 10c0 6-9 12-9 12s-9-6-9-12a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
    </svg>
  );
}

export default function ScheduleSection({ section }: SectionProps) {
  const d = section.data as ScheduleData;
  const variant = section.variant === 'image' ? 'image' : 'timeline';

  const kicker = d.kicker?.trim() || 'Lịch trình';
  const heading = d.heading?.trim() || 'Cuối tuần đua';

  // ===== IMAGE VARIANT =====
  if (variant === 'image') {
    if (!d.image) {
      return (
        <section className="landing-sec" id={section.anchor || 'schedule'}>
          <div className="landing-shell">
            <span className="landing-kicker">{kicker}</span>
            <h2 className="landing-h2">{heading}</h2>
            <div className={styles.empty}>
              BTC chưa tải lên ảnh lịch trình.
            </div>
          </div>
        </section>
      );
    }

    return (
      <section className="landing-sec" id={section.anchor || 'schedule'}>
        <div className="landing-shell">
          <span className="landing-kicker">{kicker}</span>
          <h2 className="landing-h2">{heading}</h2>
          {d.lead ? <p className="landing-lead">{d.lead}</p> : null}

          <div className={styles.schedimg}>
            <div className={styles.poster}>
              <img src={d.image} alt={heading} />
            </div>
            <div className={styles.schednote}>
              <p className={styles.schednoteText}>
                <b>Chế độ Ảnh:</b> 5BIB hiển thị nguyên ảnh lịch trình do BTC tự
                thiết kế &amp; tải lên — responsive, giữ đúng bố cục gốc.
              </p>
              <span className={styles.uploadtag}>
                <UploadIcon />
                {d.imageNote?.trim() || 'Ảnh lịch trình do BTC tải lên'}
              </span>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // ===== TIMELINE VARIANT =====
  const items = Array.isArray(d.items) ? d.items : [];

  if (items.length === 0) {
    return (
      <section className="landing-sec" id={section.anchor || 'schedule'}>
        <div className="landing-shell">
          <span className="landing-kicker">{kicker}</span>
          <h2 className="landing-h2">{heading}</h2>
          {d.lead ? <p className="landing-lead">{d.lead}</p> : null}
          <div className={styles.empty}>
            Lịch trình sự kiện sẽ được BTC cập nhật sớm.
          </div>
        </div>
      </section>
    );
  }

  // Group consecutive items by their `day` label so each day renders one header.
  type Group = { day?: string; entries: ScheduleItem[] };
  const groups: Group[] = [];
  let currentDay: string | undefined;
  for (const item of items) {
    const day = item.day?.trim() || undefined;
    if (groups.length === 0 || day !== currentDay) {
      groups.push({ day, entries: [item] });
      currentDay = day;
    } else {
      groups[groups.length - 1].entries.push(item);
    }
  }

  return (
    <section className="landing-sec" id={section.anchor || 'schedule'}>
      <div className="landing-shell">
        <span className="landing-kicker">{kicker}</span>
        <h2 className="landing-h2">{heading}</h2>
        {d.lead ? <p className="landing-lead">{d.lead}</p> : null}

        <div className={styles.tl}>
          {groups.map((group, gi) => (
            <div key={gi}>
              {group.day ? (
                <div className={styles.daylabel}>{group.day}</div>
              ) : null}
              {group.entries.map((entry, ei) => (
                <div
                  key={`${gi}-${ei}`}
                  className={
                    entry.key ? `${styles.tlitem} ${styles.key}` : styles.tlitem
                  }
                >
                  <div className={styles.tltime}>{entry.time}</div>
                  <div className={styles.tltitle}>{entry.title}</div>
                  {entry.location ? (
                    <div className={styles.tlloc}>
                      <PinIcon />
                      {entry.location}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
