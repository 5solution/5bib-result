'use client';

import { useEffect } from 'react';

// Scroll reveal + counter animation + nav glass + smooth scroll.
// Ported from the mockup's JS, adapted for React.
export default function TimingEffects() {
  useEffect(() => {
    const nav = document.querySelector<HTMLElement>('.tl-nav');
    const onScroll = () => {
      if (nav) nav.classList.toggle('scrolled', window.scrollY > 60);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    // Scroll reveal
    const rules: { sel: string; dir: string; base?: number; stagger?: number }[] = [
      { sel: '.tl-section-label', dir: 'fade', base: 0 },
      { sel: '.tl-section-title', dir: 'up', base: 0.05 },
      { sel: '.tl-section-sub', dir: 'fade', base: 0.12 },
      { sel: '.tl-why-card', dir: 'up', stagger: 0.12 },
      { sel: '.tl-pkg-card', dir: 'up', stagger: 0.14 },
      { sel: '.tl-eco-card', dir: 'up', stagger: 0.14 },
      { sel: '.tl-spec-row', dir: 'left', stagger: 0.09 },
      { sel: '.tl-tech-chip-item', dir: 'up', stagger: 0.1 },
      { sel: '.tl-step-item', dir: 'up', stagger: 0.11 },
      { sel: '.tl-stat-box', dir: 'scale', stagger: 0.1 },
      { sel: '.tl-pkg-includes', dir: 'fade', base: 0 },
      { sel: '.tl-contact-info', dir: 'left', base: 0 },
      { sel: '.tl-contact-form', dir: 'right', base: 0 },
      { sel: '.tl-tech-visual', dir: 'right', base: 0 },
      { sel: '.tl-tech-specs', dir: 'left', base: 0 },
      { sel: '.tl-mockup-window', dir: 'right', base: 0 },
      { sel: '.tl-showcase-feat', dir: 'left', stagger: 0.08 },
    ];

    const tagged = new WeakSet<Element>();
    rules.forEach(({ sel, dir, base = 0, stagger = 0 }) => {
      const els = document.querySelectorAll(sel);
      els.forEach((el, i) => {
        if (tagged.has(el)) return;
        tagged.add(el);
        el.setAttribute('data-reveal', dir);
        const delay = (base + i * stagger).toFixed(2);
        if (+delay > 0) (el as HTMLElement).style.transitionDelay = delay + 's';
      });
    });

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('is-visible');
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' },
    );
    document.querySelectorAll('[data-reveal]').forEach((el) => io.observe(el));

    // Counter animation
    const counterIO = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target as HTMLElement;
          const target = parseInt(el.dataset.target || '0', 10);
          const suffix = el.dataset.suffix || '';
          const duration = 1800;
          const start = performance.now();
          const ease = (t: number) => 1 - Math.pow(1 - t, 3);
          const tick = (now: number) => {
            const pct = Math.min((now - start) / duration, 1);
            el.textContent = Math.floor(ease(pct) * target) + suffix;
            if (pct < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
          counterIO.unobserve(el);
        });
      },
      { threshold: 0.6 },
    );
    document
      .querySelectorAll('.tl-counter[data-target]')
      .forEach((el) => counterIO.observe(el));

    // Hero card parallax
    const heroCard = document.querySelector<HTMLElement>('.tl-hero-card');
    const heroSec = document.querySelector<HTMLElement>('.tl-hero');
    let ticking = false;
    const onMove = (e: MouseEvent) => {
      if (!heroCard || !heroSec || ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const r = heroSec.getBoundingClientRect();
        const cx = (e.clientX - r.left) / r.width - 0.5;
        const cy = (e.clientY - r.top) / r.height - 0.5;
        heroCard.style.transform = `translateY(${cy * 10}px) rotateY(${cx * 6}deg) rotateX(${-cy * 4}deg)`;
        ticking = false;
      });
    };
    const onLeave = () => {
      if (!heroCard) return;
      heroCard.style.transition = 'transform .8s cubic-bezier(.22,.68,0,1.2)';
      heroCard.style.transform = '';
      setTimeout(() => {
        if (heroCard) heroCard.style.transition = '';
      }, 800);
    };
    heroSec?.addEventListener('mousemove', onMove, { passive: true });
    heroSec?.addEventListener('mouseleave', onLeave);

    // Smooth scroll for hash links inside the landing
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest(
        'a[href^="#"]',
      ) as HTMLAnchorElement | null;
      if (!a) return;
      const href = a.getAttribute('href');
      if (!href || href === '#') return;
      const t = document.querySelector(href);
      if (t) {
        e.preventDefault();
        (t as HTMLElement).scrollIntoView({ behavior: 'smooth' });
      }
    };
    document.addEventListener('click', onClick);

    return () => {
      window.removeEventListener('scroll', onScroll);
      heroSec?.removeEventListener('mousemove', onMove);
      heroSec?.removeEventListener('mouseleave', onLeave);
      document.removeEventListener('click', onClick);
      io.disconnect();
      counterIO.disconnect();
    };
  }, []);

  return null;
}
