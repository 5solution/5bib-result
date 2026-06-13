'use client';

/**
 * FEATURE-083 — Course section ("Cung đường").
 * Interactive distance tabs switch the active course; right card shows an
 * elevation area+line chart built from `course.elevation` (number[]), stat
 * cards + terrain badge. Left card is a stylized GPX "map" placeholder.
 * Map/chart geometry ported from the HTML prototype #course `draw()` fn.
 */

import { useMemo, useState } from 'react';
import type { SectionProps } from '../types';
import styles from './course.module.css';

interface CourseItem {
  key: string;
  label: string;
  terrainLabel?: string;
  dist: string;
  gain: number;
  aid: number;
  cutoff: string;
  terrain: string;
  elevation: number[];
}

interface CourseData {
  kicker?: string;
  title?: string;
  lead?: string;
  courses?: CourseItem[];
}

const EL_W = 600;
const EL_H = 200;
const EL_P = 10;

/** Build elevation area + line paths and evenly-spaced aid markers. */
function buildElevation(elevation: number[], aidCount: number) {
  const e = elevation.length ? elevation : [0, 0];
  const max = Math.max(...e);
  const min = Math.min(...e);
  const span = max - min || 1;
  const x = (i: number) =>
    EL_P + (i * (EL_W - 2 * EL_P)) / Math.max(e.length - 1, 1);
  const y = (v: number) => EL_H - 14 - ((v - min) / span) * (EL_H - 40);

  let line = `M${x(0).toFixed(1)},${y(e[0]).toFixed(1)}`;
  for (let i = 1; i < e.length; i++) {
    line += ` L${x(i).toFixed(1)},${y(e[i]).toFixed(1)}`;
  }
  const area = `${line} L${x(e.length - 1).toFixed(1)},${EL_H} L${x(0).toFixed(1)},${EL_H} Z`;

  const aids: { cx: number; cy: number }[] = [];
  const n = Math.max(0, Math.floor(aidCount));
  for (let k = 1; k <= n; k++) {
    const i = Math.round((k * (e.length - 1)) / (n + 1));
    aids.push({ cx: x(i), cy: y(e[i]) });
  }

  return { line, area, aids };
}

export default function CourseSection({ section }: SectionProps) {
  const d = section.data as CourseData;
  const courses = Array.isArray(d.courses) ? d.courses : [];

  const kicker = d.kicker ?? 'Cung đường · Courses';
  const title = d.title;
  const lead = d.lead;

  const [activeKey, setActiveKey] = useState<string>(courses[0]?.key ?? '');

  const active = useMemo(
    () => courses.find((c) => c.key === activeKey) ?? courses[0],
    [courses, activeKey],
  );

  const chart = useMemo(
    () =>
      active
        ? buildElevation(active.elevation ?? [], active.aid ?? 0)
        : null,
    [active],
  );

  return (
    <section className={`landing-sec ${styles.course}`}>
      <div className="landing-shell">
        <span className="landing-kicker">{kicker}</span>
        <h2 className="landing-h2">
          {title ?? (
            <>
              Chinh phục{' '}
              <em>
                {courses.length || 'các'} cự ly
              </em>
            </>
          )}
        </h2>
        <p className="landing-lead">
          {lead ?? (
            <>
              Bản đồ &amp; biểu đồ độ cao lấy{' '}
              <b>tự động từ dữ liệu GPX của giải</b> trên 5BIB — thứ mà builder
              thường không làm được.
            </>
          )}
        </p>

        {courses.length === 0 || !active || !chart ? (
          <div className={styles.empty}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 20l-5.5 2V6L9 4m0 16 6-2m-6 2V4m6 14 5.5 2V4l-5.5 2m0 12V6m0 0L9 4" />
            </svg>
            <span>Cung đường đang cập nhật</span>
          </div>
        ) : (
          <>
            {/* distance tabs */}
            <div className={styles.tabs} role="tablist" aria-label="Cự ly">
              {courses.map((c) => {
                const on = c.key === active.key;
                return (
                  <button
                    key={c.key}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    className={`${styles.tab} ${on ? styles.tabOn : ''}`}
                    onClick={() => setActiveKey(c.key)}
                  >
                    {c.label}
                    {c.terrainLabel ? (
                      <span className={styles.km}> · {c.terrainLabel}</span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            <div className={styles.coursegrid}>
              {/* left — stylized GPX map placeholder */}
              <div className={styles.card}>
                <div className={styles.ct}>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M9 20l-5.5 2V6L9 4m0 16 6-2m-6 2V4m6 14 5.5 2V4l-5.5 2m0 12V6m0 0L9 4" />
                  </svg>
                  Bản đồ GPX · auto từ dữ liệu giải
                </div>
                <div className={styles.mapwrap}>
                  <svg
                    className={styles.topo2}
                    viewBox="0 0 400 280"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                  >
                    <path d="M-10,60 C120,20 240,90 410,50" />
                    <path d="M-10,130 C140,90 250,160 410,120" />
                    <path d="M-10,200 C120,160 260,230 410,190" />
                  </svg>
                  <svg
                    viewBox="0 0 400 280"
                    width="100%"
                    height="100%"
                    aria-label="Bản đồ cung đường"
                  >
                    <path
                      key={active.key}
                      className={styles.route}
                      d="M60,210 C110,120 150,180 190,120 230,60 280,130 320,70"
                    />
                    <circle
                      className={`${styles.pin} ${styles.pinStart}`}
                      cx="60"
                      cy="210"
                      r="8"
                    />
                    <circle className={styles.aid} cx="150" cy="155" r="4.5" />
                    <circle className={styles.aid} cx="230" cy="92" r="4.5" />
                    <circle
                      className={`${styles.pin} ${styles.pinFin}`}
                      cx="320"
                      cy="70"
                      r="8"
                    />
                  </svg>
                </div>
              </div>

              {/* right — elevation chart + stats + terrain */}
              <div className={styles.card}>
                <div className={styles.ct}>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M3 17l5-6 4 4 5-8 4 5" />
                  </svg>
                  Biểu đồ độ cao ·{' '}
                  <span className={styles.elKm}>{active.label}</span>
                </div>
                <svg
                  className={styles.elev}
                  viewBox={`0 0 ${EL_W} ${EL_H}`}
                  aria-label="Biểu đồ độ cao"
                >
                  <defs>
                    <linearGradient id="course-eg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor="var(--sec)" stopOpacity=".24" />
                      <stop offset="1" stopColor="var(--sec)" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <line className={styles.grid} x1="8" y1="60" x2="592" y2="60" />
                  <line
                    className={styles.grid}
                    x1="8"
                    y1="120"
                    x2="592"
                    y2="120"
                  />
                  <line
                    className={styles.grid}
                    x1="8"
                    y1="178"
                    x2="592"
                    y2="178"
                  />
                  <path className={styles.area} d={chart.area} />
                  <path
                    key={active.key}
                    className={styles.ln}
                    d={chart.line}
                  />
                  <g>
                    {chart.aids.map((a, i) => (
                      <circle
                        key={i}
                        className={styles.as}
                        cx={a.cx}
                        cy={a.cy}
                        r="3.5"
                      />
                    ))}
                  </g>
                </svg>

                <div className={styles.stats}>
                  <div className={styles.stat}>
                    <div className={styles.l}>Cự ly</div>
                    <div className={styles.v}>
                      {active.dist} <small>km</small>
                    </div>
                  </div>
                  <div className={styles.stat}>
                    <div className={styles.l}>Tích lũy D+</div>
                    <div className={styles.v}>
                      {active.gain} <small>m</small>
                    </div>
                  </div>
                  <div className={styles.stat}>
                    <div className={styles.l}>Trạm tiếp nước</div>
                    <div className={styles.v}>{active.aid}</div>
                  </div>
                  <div className={styles.stat}>
                    <div className={styles.l}>Cut-off</div>
                    <div className={styles.v}>{active.cutoff}</div>
                  </div>
                </div>

                {active.terrain ? (
                  <span className={styles.terr}>● {active.terrain}</span>
                ) : null}
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
