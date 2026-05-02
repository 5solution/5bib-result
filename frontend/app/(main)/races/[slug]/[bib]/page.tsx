'use client';

import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Clock, Check, Calendar, Timer, TrendingUp, Award, Users, Tag, Trophy, Download, Loader2, AlertTriangle, Upload, X, Phone, Mail, User, FileText, XOctagon, Flag, Activity } from 'lucide-react';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import { useTranslation } from 'react-i18next';
import { countryToFlag } from '@/lib/country-flags';
import { useRaceBySlug, useAthleteDetail, useSubmitClaim, useUploadClaimAttachment } from '@/lib/api-hooks';
import ResultImageCreator from '@/components/result-image/ResultImageCreator';
import CelebrationOverlay, {
  hasCelebrationBeenSeen,
  markCelebrationSeen,
} from '@/components/result-image/CelebrationOverlay';
import { useAthleteBadges } from '@/lib/api-hooks/result-image';
import CertificateV2DownloadButtons from '@/components/CertificateV2DownloadButtons';
import CertificateWithPhotoCta from '@/components/CertificateWithPhotoCta';
import RankProgressionChart from '@/components/RankProgressionChart';
import PaceZoneChart from '@/components/PaceZoneChart';
import PercentileBadge, { PercentileGauge } from '@/components/PercentileBadge';
import RaceTheme from '@/components/RaceTheme';
import RaceHeroHeader from '@/components/RaceHeroHeader';
import FloatingActionBar from '@/components/FloatingActionBar';
import { useScrollRevealObserver } from '@/lib/useScrollRevealObserver';

// ── Nationality guard ────────────────────────────────────────────────────
// Upstream RaceResult sometimes sends placeholder values like "0", "-1",
// empty strings, or numeric IDs that never got mapped to a country name.
// Rendering those literally produces a confusing "0" pill in the hero.
// Accept only values that contain at least one alpha character and exclude
// known garbage strings.
function isValidNationality(n: unknown): n is string {
  if (typeof n !== 'string') return false;
  const trimmed = n.trim();
  if (!trimmed) return false;
  if (/^-?\d+$/.test(trimmed)) return false; // pure numeric (e.g. "0", "-1", "840")
  if (['null', 'undefined', 'unknown', 'n/a', 'na', '-'].includes(trimmed.toLowerCase())) return false;
  if (!/[a-zA-ZÀ-ỹ]/.test(trimmed)) return false; // needs at least one letter
  return true;
}

// ── Final race status derived from overall rank + chip time ──────────────
// Kept as module-level helpers so they're easy to move to a shared util
// later if another surface needs the same classification.
type FinalStatus = 'finisher' | 'dnf' | 'dsq' | 'dns' | 'in-progress';

/**
 * Vendor pushes live OverallRank tại các checkpoint (vd TM3) cho athletes
 * đang chạy giữa course. Chỉ dùng overallRank+chipTime sẽ mark họ là finisher.
 * Source-of-truth = TimingPoint: 'Finish' (any case) → finisher,
 * 'DNS'/'DSQ'/'DNF' → tương ứng, các giá trị khác (TM*, '', etc) → in-progress.
 */
function deriveFinalStatus(
  overallRank: string,
  chipTime: string,
  timingPoint?: string,
): FinalStatus {
  const tp = (timingPoint || '').trim().toUpperCase();
  if (tp === 'DNS') return 'dns';
  if (tp.startsWith('DSQ')) return 'dsq';
  if (tp === 'DNF') return 'dnf';
  if (!tp.startsWith('FINISH')) {
    // Athlete chưa qua Finish line — đang ở checkpoint giữa hoặc data thiếu.
    // Honest answer: in-progress (race còn chạy hoặc athlete bỏ cuộc).
    return 'in-progress';
  }
  // timingPoint='Finish' — verify rank/time, defend against vendor sentinels
  const r = (overallRank || '').trim().toUpperCase();
  if (r === 'DNS') return 'dns';
  if (r.startsWith('DSQ')) return 'dsq';
  if (r === 'DNF') return 'dnf';
  const rankNum = parseInt(r, 10);
  const hasTime = !!chipTime && chipTime !== '-' && chipTime !== '00:00:00';
  if (Number.isFinite(rankNum) && rankNum > 0 && hasTime) return 'finisher';
  return 'dnf';
}

const STATUS_CHIP: Record<
  FinalStatus,
  { bg: string; text: string; ring: string; Icon: typeof Flag; labelKey: string }
> = {
  finisher: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    ring: 'ring-emerald-200',
    Icon: Award,
    labelKey: 'athlete.statusBadge.status.finisher',
  },
  dnf: {
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    ring: 'ring-rose-200',
    Icon: XOctagon,
    labelKey: 'athlete.statusBadge.status.dnf',
  },
  dsq: {
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    ring: 'ring-amber-200',
    Icon: AlertTriangle,
    labelKey: 'athlete.statusBadge.status.dsq',
  },
  dns: {
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    ring: 'ring-slate-200',
    Icon: Flag,
    labelKey: 'athlete.statusBadge.status.dns',
  },
  'in-progress': {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    ring: 'ring-blue-200',
    Icon: Activity,
    labelKey: 'athlete.statusBadge.status.inProgress',
  },
};

interface AthleteResult {
  Bib: number;
  Name: string;
  OverallRank: string;
  GenderRank: string;
  CatRank: string;
  Gender: string;
  Category: string;
  ChipTime: string;
  GunTime: string;
  Pace: string;
  Gap: string;
  Nationality: string;
  Nation: string;
  Certificate: string;
  TimingPoint?: string;
  race_id: number;
  course_id: string;
  distance: string;
  splits?: SplitTime[];
  race_name?: string;
  avatarUrl?: string | null;
}

interface SplitTime {
  name: string;
  distance: string;
  time: string;
  pace: string;
  member?: string;
  timeOfDay?: string;
  overallRank?: string;
  genderRank?: string;
  // PRD Phase 1 — computed by backend
  rankDelta?: number;    // BR-01: positive = moved up (green), negative = dropped (red)
  isPaceAlert?: boolean; // BR-02: pace drop ≥ 20% below avg → bg-red-50
  speed?: number;        // km/h at this segment
  // PRD Phase 2C — checkpoint services
  services?: CheckpointServices;
}

interface CheckpointServices {
  water?: boolean;
  food?: boolean;
  sleep?: boolean;
  dropBag?: boolean;
  medical?: boolean;
  notes?: string;
}

interface CheckpointConfig {
  key: string;
  name: string;
  distance?: string;
  services?: CheckpointServices;
}

/** Parse Chiptimes/Paces JSON strings from API into SplitTime[], using checkpoint config for names */
function parseSplitsFromData(data: Record<string, unknown>, checkpoints?: CheckpointConfig[]): SplitTime[] | null {
  try {
    const chiptimesStr = data.Chiptimes as string;
    const pacesStr = data.Paces as string;
    if (!chiptimesStr) return null;

    const chiptimes: Record<string, string> = JSON.parse(chiptimesStr);
    const paces: Record<string, string> = pacesStr ? JSON.parse(pacesStr) : {};

    // Parse optional JSON fields
    let members: Record<string, string> = {};
    let tods: Record<string, string> = {};
    let overallRanks: Record<string, string> = {};
    let genderRanks: Record<string, string> = {};
    const memberStr = data.Member as string | undefined;
    if (memberStr) {
      try { members = JSON.parse(memberStr); } catch { /* ignore */ }
    }
    const todsStr = data.TODs as string | undefined;
    if (todsStr) {
      try { tods = JSON.parse(todsStr); } catch { /* ignore */ }
    }
    const overallRanksStr = data.OverallRanks as string | undefined;
    if (overallRanksStr) {
      try { overallRanks = JSON.parse(overallRanksStr); } catch { /* ignore */ }
    }
    const genderRanksStr = data.GenderRanks as string | undefined;
    if (genderRanksStr) {
      try { genderRanks = JSON.parse(genderRanksStr); } catch { /* ignore */ }
    }

    // Build a lookup map from checkpoint config
    const cpMap = new Map<string, CheckpointConfig>();
    if (checkpoints) {
      for (const cp of checkpoints) {
        cpMap.set(cp.key, cp);
      }
    }

    const keys = Object.keys(chiptimes);
    if (keys.length === 0) return null;

    const splits: SplitTime[] = keys
      .filter(key => chiptimes[key] !== '') // skip empty checkpoints
      .map((key) => {
        const cp = cpMap.get(key);
        const name = cp?.name
          || (key === 'Start' ? 'Xuất phát' : key === 'Finish' ? 'Về đích' : key);
        const distance = cp?.distance || '';
        return {
          name,
          distance,
          time: chiptimes[key] || '-',
          pace: paces[key] || '-',
          member: members[key] || undefined,
          timeOfDay: tods[key] || undefined,
          overallRank: overallRanks[key] || undefined,
          genderRank: genderRanks[key] || undefined,
          services: cp?.services,
        };
      });

    // BR-01: rankDelta = previous rank − current rank (positive = moved up).
    // Only meaningful when both ranks parse as positive integers (skip
    // sentinels like "-1", "DNF", "DNS").
    for (let i = 1; i < splits.length; i++) {
      const curr = parseInt(splits[i].overallRank ?? '', 10);
      const prev = parseInt(splits[i - 1].overallRank ?? '', 10);
      if (curr > 0 && prev > 0) {
        splits[i].rankDelta = prev - curr;
      }
    }

    return splits.length > 0 ? splits : null;
  } catch {
    return null;
  }
}

const DEMO_ATHLETE: AthleteResult = {
  Bib: 1001,
  Name: 'Nguyễn Văn An',
  OverallRank: '1',
  GenderRank: '1',
  CatRank: '1',
  Gender: 'Male',
  Category: 'M20-29',
  ChipTime: '02:00:15',
  GunTime: '02:01:30',
  Pace: '5:44',
  Gap: '-',
  Nationality: 'Vietnam',
  Nation: '🇻🇳',
  Certificate: '',
  race_id: 2,
  course_id: 'DUT21',
  distance: '21K',
  race_name: 'Dalat Ultra Trail 2026',
};

export default function AthleteDetailPage() {
  const { t, i18n } = useTranslation();
  const params = useParams();
  const slug = params.slug as string;
  const bib = params.bib as string;
  // v2: wire scroll-reveal across all [data-reveal] sections on this page.
  // Re-scans whenever slug/bib changes so SPA navigations still trigger it.
  useScrollRevealObserver([slug, bib]);

  // Data fetching via react-query hooks
  const { data: raceRaw, isLoading: loadingRace } = useRaceBySlug(slug);
  const raceData = useMemo(() => (raceRaw as any)?.data ?? raceRaw, [raceRaw]);
  const raceId = raceData?._id || raceData?.id || '';
  // Các biểu đồ cá nhân VĐV (RankProgression, PaceZone, PercentileGauge, PercentileBadge)
  // là thông tin của chính VĐV đó — không bị ẩn bởi bất kỳ privacy toggle nào.

  const { data: athleteRaw, isLoading: loadingAthlete } = useAthleteDetail(raceId, bib, { enabled: !!raceId });

  const { athlete, courseType } = useMemo(() => {
    const data = (athleteRaw as any)?.data ?? athleteRaw;

    if (!data) return { athlete: null as AthleteResult | null, courseType: 'split' };
    const courses = raceData?.courses || [];
    const matchedCourse = courses.find((c: any) => c.courseId === data.course_id);
    const checkpoints = matchedCourse?.checkpoints as CheckpointConfig[] | undefined;
    const detectedCourseType = (matchedCourse?.courseType as string) || 'split';
    const splits = parseSplitsFromData(data, checkpoints) || undefined;

    return {
      athlete: {
        ...data,
        splits,
        race_name: raceData?.title || slug.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
        avatarUrl: data.avatarUrl ?? null,
      } as AthleteResult,
      courseType: detectedCourseType,
    };
  }, [athleteRaw, raceData, slug]);

  console.log('Parsed athlete data:', athlete);

  const raceStatus = raceData?.status;
  const isUpcoming = raceStatus === 'upcoming' || raceStatus === 'pre_race';
  const loading = loadingRace || loadingAthlete;

  const [linkCopied, setLinkCopied] = useState(false);
  const linkCopiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Cleanup the reset timer if the component unmounts while it's running
  // (prevents setState on unmounted component in React strict mode).
  useEffect(() => {
    return () => { if (linkCopiedTimerRef.current) clearTimeout(linkCopiedTimerRef.current); };
  }, []);

  const handleCopyLink = useCallback(() => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setLinkCopied(true);
      toast.success(t('common.copiedLink'));
      // Clear any existing timer so rapid clicks don't stack.
      if (linkCopiedTimerRef.current) clearTimeout(linkCopiedTimerRef.current);
      linkCopiedTimerRef.current = setTimeout(() => setLinkCopied(false), 2000);
    });
  }, [t]);

  const handleShareFacebook = () => {
    const url = encodeURIComponent(window.location.href);
    const text = encodeURIComponent(
      athlete ? `${athlete.Name} - BIB ${athlete.Bib} - ${athlete.distance} - Chip Time: ${athlete.ChipTime}` : ''
    );
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}&quote=${text}`, '_blank', 'width=600,height=400');
  };

  const getPaceInSeconds = (paceStr: string): number => {
    if (!paceStr || paceStr === '-') return 0;
    const parts = paceStr.split(':');
    return parseInt(parts[0]) * 60 + parseInt(parts[1] || '0');
  };

  const formatName = (name: string) => {
    return name
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const getInitials = (name: string) => {
    console.log('Generating initials for name:', name);
    const words = name.trim().split(/\s+/);
    if (words.length >= 2) {
      return (words[0][0] + words[words.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const getAvatarColor = (bibVal: number | string, raceIdVal: string) => {
    const colors = ['#EF4444', '#F97316', '#EAB308', '#22C55E', '#3B82F6', '#8B5CF6'];
    let h = 0;
    const str = `${raceIdVal}-${bibVal}`;
    for (let i = 0; i < str.length; i++) { h = Math.imul(31, h) + str.charCodeAt(i) | 0; }
    return colors[Math.abs(h) % colors.length];
  };

  const formatRank = (rank: string) => {
    const num = parseInt(rank);
    if (num === 1) return '🥇';
    if (num === 2) return '🥈';
    if (num === 3) return '🥉';
    return `#${rank}`;
  };

  const getRankMedalColor = (rank: string) => {
    const num = parseInt(rank);
    if (num === 1) return 'from-yellow-400 to-amber-500';
    if (num === 2) return 'from-gray-300 to-gray-400';
    if (num === 3) return 'from-amber-600 to-amber-700';
    return 'from-blue-500 to-blue-600';
  };

  const [downloading, setDownloading] = useState(false);
  const [showImageEditor, setShowImageEditor] = useState(false);
  const celebrationAudioRef = useRef<HTMLAudioElement | null>(null);

  // Result Image Creator v1.0 — badges + first-open celebration
  const { data: athleteBadges = [] } = useAthleteBadges(
    raceId,
    String(athlete?.Bib ?? ''),
    { enabled: !!raceId && !!athlete?.Bib },
  );
  const CELEBRATION_WORTHY = ['PB', 'PODIUM', 'AG_PODIUM', 'ULTRA', 'SUB3H', 'SUB90M', 'SUB45M', 'SUB20M'];
  const hasCelebWorthyBadge = athleteBadges.some((b) => CELEBRATION_WORTHY.includes(b.type));

  const [showRicCelebration, setShowRicCelebration] = useState(false);
  // Stable callback so CelebrationOverlay's autoDismiss effect doesn't reset
  // its timer on every parent re-render (TanStack Query causes frequent re-renders).
  const handleDismissCelebration = useCallback(() => setShowRicCelebration(false), []);
  useEffect(() => {
    if (!raceId || !athlete?.Bib || athleteBadges.length === 0) return;
    if (!hasCelebWorthyBadge) return;
    if (hasCelebrationBeenSeen(raceId, String(athlete.Bib))) return;
    // Small delay so overlay appears after hero paints, not on first frame
    const t = setTimeout(() => {
      setShowRicCelebration(true);
      markCelebrationSeen(raceId, String(athlete.Bib));
    }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raceId, athlete?.Bib, hasCelebWorthyBadge]);

  // Claim form state
  const [showClaimForm, setShowClaimForm] = useState(false);
  const [claimName, setClaimName] = useState('');
  const [claimEmail, setClaimEmail] = useState('');
  const [claimPhone, setClaimPhone] = useState('');
  const [claimDescription, setClaimDescription] = useState('');
  const [claimAttachments, setClaimAttachments] = useState<string[]>([]);
  const [claimUploading, setClaimUploading] = useState(false);
  const [claimSubmitting, setClaimSubmitting] = useState(false);
  const [claimSubmitted, setClaimSubmitted] = useState(false);
  const claimFileRef = useRef<HTMLInputElement>(null);

  // Avatar upload state (P2-B-ii)
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [avatarStep, setAvatarStep] = useState<'email' | 'otp' | 'file'>('email');
  const [avatarEmail, setAvatarEmail] = useState('');
  const [avatarOtp, setAvatarOtp] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState<string | null>(null);
  const avatarFileRef = useRef<HTMLInputElement>(null);

  const uploadMutation = useUploadClaimAttachment();

  const handleClaimFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      toast.error(t('claim.fileTooLarge'));
      return;
    }
    setClaimUploading(true);
    try {
      const result = await uploadMutation.mutateAsync(file);
      setClaimAttachments(prev => [...prev, result.url]);
      toast.success(t('claim.uploadSuccess', { name: file.name }));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('claim.uploadFailed'));
    } finally {
      setClaimUploading(false);
      if (claimFileRef.current) claimFileRef.current.value = '';
    }
  }, [uploadMutation]);

  const submitClaimMutation = useSubmitClaim();

  const handleClaimSubmit = useCallback(async () => {
    if (!athlete) return;
    if (!claimName.trim() || !claimPhone.trim() || !claimDescription.trim()) {
      toast.error(t('claim.validationError'));
      return;
    }
    if (!raceId) {
      toast.error(t('claim.raceNotFound'));
      return;
    }
    setClaimSubmitting(true);
    try {
      await submitClaimMutation.mutateAsync({
        raceId,
        courseId: athlete.course_id || '',
        bib: String(athlete.Bib),
        name: claimName.trim(),
        email: claimEmail.trim(),
        phone: claimPhone.trim(),
        description: claimDescription.trim(),
        attachments: claimAttachments.length > 0 ? claimAttachments : undefined,
      });
      setClaimSubmitted(true);
      toast.success(t('claim.submitSuccess'));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('claim.submitFailed'));
    } finally {
      setClaimSubmitting(false);
    }
  }, [athlete, raceId, claimName, claimEmail, claimPhone, claimDescription, claimAttachments, submitClaimMutation]);

  const handleRequestOtp = useCallback(async () => {
    if (!avatarEmail.trim()) return;
    setAvatarLoading(true);
    try {
      const res = await fetch('/api/race-results/avatar/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raceId, bib: String(athlete?.Bib), email: avatarEmail.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Lỗi gửi OTP');
      toast.success('OTP đã được gửi đến email của bạn');
      setAvatarStep('otp');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Gửi OTP thất bại');
    } finally {
      setAvatarLoading(false);
    }
  }, [avatarEmail, raceId, athlete]);

  const handleVerifyOtp = useCallback(() => {
    if (avatarOtp.trim().length !== 6) {
      toast.error('Nhập đủ 6 số OTP');
      return;
    }
    setAvatarStep('file');
  }, [avatarOtp]);

  const handleAvatarFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) {
      toast.error('Chỉ hỗ trợ JPG, PNG, WebP');
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      toast.error('Ảnh tối đa 5MB');
      return;
    }
    setAvatarFile(f);
    const reader = new FileReader();
    reader.onload = (ev) => setAvatarPreview(ev.target?.result as string);
    reader.readAsDataURL(f);
  }, []);

  const handleAvatarUpload = useCallback(async () => {
    if (!avatarFile || !athlete) return;
    setAvatarLoading(true);
    try {
      const form = new FormData();
      form.append('raceId', raceId);
      form.append('bib', String(athlete.Bib));
      form.append('otp', avatarOtp.trim());
      form.append('file', avatarFile);
      const res = await fetch('/api/race-results/avatar/upload', { method: 'POST', body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Upload thất bại');
      setCurrentAvatarUrl(json.avatarUrl);
      toast.success('Đã cập nhật ảnh đại diện!');
      setShowAvatarModal(false);
      setAvatarStep('email');
      setAvatarEmail('');
      setAvatarOtp('');
      setAvatarFile(null);
      setAvatarPreview(null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Upload thất bại');
    } finally {
      setAvatarLoading(false);
    }
  }, [avatarFile, athlete, raceId, avatarOtp]);

  const fireCelebration = useCallback(() => {
    // Confetti burst
    const duration = 3000;
    const end = Date.now() + duration;
    const colors = ['#2563eb', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899'];

    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.7 },
        colors,
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.7 },
        colors,
      });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();

    // Big center burst
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors,
    });

    // Sound
    try {
      if (!celebrationAudioRef.current) {
        celebrationAudioRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2JkpGKgHJmYGZ0g4+WlI6EeW5mZnJ/jJaXk4p/cmZjZ3SAj5qYkoZ7bWNhZ3WDkpqZk4d7bGBdZHSCk5uak4h7a19cYXGAkpyblIp9bWBeYXF/kZyblYp+bmJfY3KAkZuak4p+bmNgZHOAkZqZkoiAcGRjZ3SAj5iXkYd/cWdmaHaAjZWUjoN9cmtqcHuGjZGOiIN+dnFwdXqCiIuKhoJ+endzdnmAhIeGhIF+e3l5en2AgoSEgoB+fXx8fYCBgoKBgH9+fn6AgIGBgYCAf39/f4CAgICAgIB/f39/gICAgICAgICAf3+AgICAgICAgICAf4CAgICAgICAgICAgICAgICAgIA=');
      }
      celebrationAudioRef.current.currentTime = 0;
      celebrationAudioRef.current.volume = 0.3;
      celebrationAudioRef.current.play().catch(() => { });
    } catch { }
  }, []);

  const downloadCertificateAsPng = useCallback(async () => {
    if (!athlete?.Certificate) {
      toast.info(t('athlete.certificateNotReady'));
      return;
    }

    setDownloading(true);
    toast.loading(t('athlete.loadingCertificate'), { id: 'cert-download' });

    try {
      const response = await fetch(`/api/race-results/certificate/${raceId}/${athlete.Bib}`);
      if (!response.ok) throw new Error('Failed to fetch certificate');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `certificate-${athlete.Name.replace(/\s+/g, '-')}-BIB${athlete.Bib}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(t('athlete.certificateSuccess'), { id: 'cert-download' });
      fireCelebration();
      setDownloading(false);
    } catch (err) {
      console.error('Certificate download error:', err);
      window.open(athlete.Certificate, '_blank');
      toast.dismiss('cert-download');
      setDownloading(false);
    }
  }, [athlete, fireCelebration]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pt-14">
        {/* Hero skeleton */}
        <div className="relative bg-gradient-to-br from-blue-600 to-blue-800 animate-pulse">
          <div className="max-w-4xl mx-auto px-4 py-12 md:py-16">
            <div className="h-4 w-32 bg-white/20 rounded mb-8" />
            <div className="flex flex-col items-center gap-4">
              <div className="w-24 h-24 rounded-full bg-white/20" />
              <div className="h-7 w-48 bg-white/20 rounded" />
              <div className="flex gap-2">
                {[1, 2, 3].map(i => <div key={i} className="h-6 w-16 bg-white/15 rounded-full" />)}
              </div>
              <div className="h-12 w-40 bg-white/20 rounded-lg mt-4" />
            </div>
          </div>
        </div>
        {/* Content skeleton */}
        <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <div key={i} className="h-20 bg-white rounded-xl animate-pulse" />)}
          </div>
          <div className="h-40 bg-white rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (!athlete) {
    return (
      <div className="min-h-screen bg-gray-50 pt-20 flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users className="w-10 h-10 text-gray-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('athlete.notFound')}</h2>
          <p className="text-gray-500 mb-6">{t('athlete.notFoundDetail', { bib })}</p>
          <Link href={`/races/${slug}`} className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-full font-semibold hover:bg-blue-700 transition-colors">
            <ChevronLeft className="w-4 h-4" /> {t('athlete.backToResults')}
          </Link>
        </div>
      </div>
    );
  }

  const splits = athlete.splits || [];
  const hasSplits = splits.length > 0;
  const paces = splits.filter((s) => s.pace !== '-').map((s) => getPaceInSeconds(s.pace));
  const maxPace = paces.length > 0 ? Math.max(...paces) : 0;
  const minPace = paces.length > 0 ? Math.min(...paces) : 0;

  // Final status — drives the status chip + whether to show the cert CTA.
  const finalStatus = deriveFinalStatus(athlete.OverallRank, athlete.ChipTime, athlete.TimingPoint);
  const statusChip = STATUS_CHIP[finalStatus];
  const StatusIcon = statusChip.Icon;
  const certCtaVisible =
    finalStatus === 'finisher' && raceData?.enableEcert !== false;

  const genderLabel = athlete.Gender === 'Male' || athlete.Gender === 'M' ? t('common.male') : t('common.female');
  const genderIcon = athlete.Gender === 'Male' || athlete.Gender === 'M' ? '♂' : '♀';
  const genderColor = athlete.Gender === 'Male' || athlete.Gender === 'M' ? 'bg-blue-600' : 'bg-pink-500';

  return (
    <RaceTheme brandColor={raceData?.brandColor} className="min-h-screen bg-gray-50">
      {/* ===== HERO SECTION (v2 — blurred race banner, 3 layers) ===== */}
      <RaceHeroHeader
        bannerUrl={raceData?.bannerUrl}
        brandColor={raceData?.brandColor}
      >

        {/* Navigation bar */}
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Link
              href={`/races/${slug}/ranking/${athlete.course_id}`}
              className="inline-flex items-center gap-1.5 text-sm text-white/80 hover:text-white transition-colors font-medium self-start"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>{t('athlete.resultDistance', { distance: athlete.distance })}</span>
            </Link>
            {/* Top nav actions: cert downloads only.
                Copy link, Ảnh KQ + Chia sẻ moved to FAB (persistent while scrolling). */}
            <div className="flex flex-wrap items-center gap-2 sm:justify-end [&>button]:flex-1 [&>button]:min-w-[104px] sm:[&>button]:flex-none sm:[&>button]:min-w-0">
              <CertificateV2DownloadButtons
                raceId={raceId}
                bib={String(athlete.Bib)}
                courseId={athlete.course_id}
                runnerName={athlete.Name}
                variant="glass"
              />
            </div>
          </div>
        </div>

        {/* Avatar & athlete info */}
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-24 pt-6 text-center">
          {/* Avatar — v2: conic-gradient spinner ring */}
          <div className="ap-avatar-ring relative inline-block mb-5">
            {(currentAvatarUrl || athlete.avatarUrl) ? (
              <img
                src={currentAvatarUrl || athlete.avatarUrl!}
                alt={athlete.Name}
                className="w-28 h-28 md:w-36 md:h-36 rounded-full border-4 border-white/40 object-cover mx-auto shadow-2xl"
              />
            ) : (
              <div
                className="w-28 h-28 md:w-36 md:h-36 rounded-full border-4 border-white/40 flex items-center justify-center mx-auto shadow-2xl"
                style={{ background: getAvatarColor(athlete.Bib, raceId) }}
              >
                <span className="text-4xl md:text-5xl font-black text-white tracking-tight drop-shadow-md">
                  {getInitials(athlete.Name)}
                </span>
              </div>
            )}
            {/* Camera upload button */}
            <button
              onClick={() => { setShowAvatarModal(true); setAvatarStep('email'); }}
              title="Đổi ảnh đại diện"
              className="absolute top-0 right-0 w-8 h-8 rounded-full bg-white/90 hover:bg-white flex items-center justify-center shadow-md border border-white/60 transition-colors"
            >
              <Upload className="w-3.5 h-3.5 text-blue-600" />
            </button>
            {/* Rank badge overlay */}
            {!isUpcoming && (
              <div className={`absolute -bottom-2 -right-10 md:-right-12 w-12 h-12 md:w-14 md:h-14 rounded-full bg-gradient-to-br ${getRankMedalColor(athlete.OverallRank)} flex items-center justify-center shadow-lg border-3 border-white`}>
                <span className="text-lg md:text-xl font-black text-white">
                  {parseInt(athlete.OverallRank) <= 3 ? formatRank(athlete.OverallRank) : `#${athlete.OverallRank}`}
                </span>
              </div>
            )}
            {/* Gender badge */}
            <div className={`absolute -bottom-2 -left-10 md:-left-12 w-10 h-10 md:w-11 md:h-11 rounded-full ${genderColor} flex items-center justify-center shadow-lg border-2 border-white`}>
              <span className="text-lg text-white font-bold">{genderIcon}</span>
            </div>
          </div>

          {/* Name */}
          <h1 className="text-3xl md:text-4xl font-black text-white mb-2 tracking-tight">
            {formatName(athlete.Name)}
          </h1>

          {/* Tags row */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-3">
            <span className="px-3 py-1 bg-white/20 backdrop-blur-sm text-white rounded-full text-sm font-black border border-white/30 tracking-wide" style={{ fontFamily: 'var(--font-mono)' }}>
              BIB: {athlete.Bib}
            </span>
            <span className="px-3 py-1 bg-white/20 backdrop-blur-sm text-white rounded-full text-sm font-semibold border border-white/30">
              {athlete.distance}
            </span>
            <span className="px-3 py-1 bg-white/20 backdrop-blur-sm text-white rounded-full text-sm font-semibold border border-white/30">
              {athlete.Category}
            </span>
            {isValidNationality(athlete.Nationality) && (
              <span className="px-3 py-1 bg-white/20 backdrop-blur-sm text-white rounded-full text-sm font-semibold border border-white/30">
                {countryToFlag(athlete.Nationality) || countryToFlag(athlete.Nation) || athlete.Nation} {athlete.Nationality}
              </span>
            )}
          </div>

          {/* Percentile badge (F-06). CountryBadge ("Đồng hương") removed —
              carried no signal for the athlete, just visual noise. Race name
              <p> also dropped since the new race-header row inside the time
              card shows the race title in full. */}
          {raceId && athlete.Bib != null && !isUpcoming && (
            <div className="flex justify-center flex-wrap gap-2 mt-2">
              <PercentileBadge raceId={raceId} bib={String(athlete.Bib)} hideAbsoluteCounts={raceData?.enablePrivateList ?? false} />
            </div>
          )}
        </div>
      </RaceHeroHeader>

      {/* ===== MAIN CONTENT (overlapping hero) =====
          pb-20 + -mt-20 (was pb-28 + -mt-16): tighter overlap so the time
          card sits closer to the avatar now that the country / race-name
          rows are gone. */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 -mt-20 relative z-10 pb-12 space-y-6">

        {/* === TIME CARD (floating over hero) === */}
        <div
          data-reveal
          className="ap-card-rise relative bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden"
          style={{ boxShadow: '0 -4px 40px rgba(26,86,219,0.12), 0 20px 56px rgba(0,0,0,0.14)' }}
        >
          {/* Status chip moved INTO the race header row below (was absolute
              top-right, now inline on the right of the dark header) — avoids
              the badge overlapping the race title / sub-strip when the card
              starts with the new header. */}

          {isUpcoming ? (
            <div className="text-center py-10 md:py-14 px-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-50 mb-4">
                <Calendar className="w-8 h-8 text-blue-400" />
              </div>
              <h3 className="text-xl md:text-2xl font-bold text-slate-700 mb-2">{t('athlete.upcomingTitle')}</h3>
              <p className="text-sm text-slate-400">{t('athlete.upcomingSubtitle')}</p>
            </div>
          ) : (
            <>
              {/* Race name header row — calmer dark gradient (no diagonal
                  stripes, the hero already supplies that texture). Holds the
                  race title + quick-glance strip AND the finisher status pill
                  inline on the right, so there's no absolute badge overlap. */}
              <div
                className="relative px-5 py-4 md:px-6 md:py-5 text-white"
                style={{
                  /* --race-accent is injected by RaceTheme (outer wrapper),
                     so it's in scope everywhere on the page — unlike
                     --race-brand-color which lives only inside RaceHeroHeader. */
                  background:
                    'linear-gradient(135deg, #0b1640 0%, var(--race-accent, #1d4ed8) 60%, #1e293b 100%)',
                }}
              >
                <div className="flex flex-col gap-2.5 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0 flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-lg ring-1 ring-white/20">
                      🏁
                    </span>
                    <div className="min-w-0">
                      <h2
                        className="truncate text-[18px] md:text-[20px] font-black uppercase tracking-wide leading-tight"
                        style={{ fontFamily: 'var(--font-heading, var(--font-sans))' }}
                      >
                        {raceData?.title || athlete.race_name || slug.replace(/-/g, ' ')}
                      </h2>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-white/75">
                        <span>{athlete.distance}</span>
                        {athlete.Category && (
                          <>
                            <span className="text-white/30">·</span>
                            <span>{athlete.Category}</span>
                          </>
                        )}
                        {raceData?.location && (
                          <>
                            <span className="text-white/30">·</span>
                            <span className="truncate max-w-[140px] md:max-w-[220px]">
                              {raceData.location}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  {!isUpcoming && (
                    <span
                      className={`inline-flex shrink-0 items-center gap-1.5 self-start rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider ring-1 ${statusChip.bg} ${statusChip.text} ${statusChip.ring} md:self-center md:text-xs`}
                    >
                      <StatusIcon className="h-3.5 w-3.5" />
                      {t(statusChip.labelKey)}
                    </span>
                  )}
                </div>
              </div>

              {/* Big time display — Gun Time is the headline (official race time);
                  Chip Time shown in the secondary row alongside pace/gap. */}
              <div className="text-center py-8 md:py-10 px-6 bg-gradient-to-b from-blue-50/80 to-white">
                <div className="text-xs uppercase tracking-[0.2em] text-gray-400 font-bold mb-2">{t('athlete.gunTime')}</div>
                <div
                  className="ap-time-shimmer text-5xl md:text-7xl font-black tracking-tight mb-3"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--race-accent, #1d4ed8)',
                  }}
                >
                  {athlete.GunTime}
                </div>
                <div className="flex items-center justify-center gap-4 md:gap-8 text-sm text-gray-500">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-gray-400" />
                    Chip: <span className="font-mono font-bold text-gray-700">{athlete.ChipTime}</span>
                  </span>
                  <span className="w-px h-4 bg-gray-200" />
                  <span className="flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-gray-400" />
                    Pace: <span className="font-mono font-bold text-gray-700">{athlete.Pace} /km</span>
                  </span>
                  {athlete.Gap && athlete.Gap !== '-' && (
                    <>
                      <span className="w-px h-4 bg-gray-200 hidden md:block" />
                      <span className="hidden md:flex items-center gap-1.5">
                        Gap: <span className="font-mono font-bold text-gray-700">{athlete.Gap}</span>
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Rank badges row */}
              <div className={`grid ${athlete.CatRank ? 'grid-cols-3' : 'grid-cols-2'} divide-x divide-gray-100 border-t border-gray-100`}>
                {[
                  { label: t('athlete.overallRank'), rank: athlete.OverallRank, icon: <Trophy className="w-5 h-5" />, color: 'text-amber-500', bg: 'bg-amber-50' },
                  { label: t('athlete.genderRank'), rank: athlete.GenderRank, icon: <Users className="w-5 h-5" />, color: 'text-blue-500', bg: 'bg-blue-50' },
                  ...(athlete.CatRank ? [{ label: t('athlete.catRank'), rank: athlete.CatRank, icon: <Tag className="w-5 h-5" />, color: 'text-emerald-500', bg: 'bg-emerald-50' }] : []),
                ].map((item) => (
                  <div key={item.label} className="py-5 md:py-6 text-center group hover:bg-gray-50/50 transition-colors">
                    <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl ${item.bg} ${item.color} mb-2`}>
                      {item.icon}
                    </div>
                    <div className="text-2xl md:text-3xl font-black text-gray-900">
                      {parseInt(item.rank) <= 3 ? formatRank(item.rank) : `#${item.rank}`}
                    </div>
                    <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider mt-1">{item.label}</div>
                  </div>
                ))}
              </div>

              {/* Pace strip — 4 quick-glance metrics between rank badges and
                  the cert CTA. Avg pace · distance · category · race date. */}
              <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-gray-100 border-t border-gray-100 bg-gray-50/60">
                {[
                  {
                    label: t('athlete.paceStrip.avgPace'),
                    value: athlete.Pace ? `${athlete.Pace}` : '—',
                    suffix: athlete.Pace ? '/km' : '',
                    mono: true,
                  },
                  {
                    label: t('athlete.paceStrip.distance'),
                    value: athlete.distance || '—',
                    suffix: '',
                    mono: false,
                  },
                  {
                    label: t('athlete.paceStrip.category'),
                    value: athlete.Category || '—',
                    suffix: '',
                    mono: false,
                  },
                  {
                    label: t('athlete.paceStrip.raceDate'),
                    value: raceData?.startDate
                      ? new Date(raceData.startDate).toLocaleDateString(
                        i18n.language?.startsWith('vi') ? 'vi-VN' : 'en-US',
                        { day: '2-digit', month: '2-digit', year: 'numeric' },
                      )
                      : '—',
                    suffix: '',
                    mono: true,
                  },
                ].map((item, idx) => (
                  <div
                    key={`${item.label}-${idx}`}
                    className="px-3 py-3 text-center"
                  >
                    <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-400">
                      {item.label}
                    </div>
                    <div
                      className="mt-1 text-sm font-black text-gray-900 tabular-nums"
                      style={item.mono ? { fontFamily: 'var(--font-mono)' } : undefined}
                    >
                      {item.value}
                      {item.suffix && (
                        <span className="ml-1 text-[10px] font-semibold text-gray-400">
                          {item.suffix}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Certificate CTA — integrated footer of the TIME CARD.
                  Shows only for finishers on races with cert feature on.
                  Reuses `downloadCertificateAsPng` (same endpoint + confetti
                  as the old cert section further down). */}
              {/* Achievement badges + image CTA — compact footer row, shown only
                  for finishers with at least one badge. Replaces the standalone
                  AchievementBanner card that lived above the time card. */}
              {finalStatus === 'finisher' && athleteBadges.length > 0 && (
                <div className="border-t border-gray-100 px-5 py-3 md:px-6 bg-gradient-to-r from-amber-50/50 to-white flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                  {/* Badges — label + 2-row wrap */}
                  <div className="min-w-0 sm:flex-1">
                    <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-amber-700/60 mb-1.5">
                      🏅 Thành tích
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {athleteBadges.map((b) => (
                        <span
                          key={b.type}
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold text-white"
                          style={{ backgroundColor: b.color ?? '#1d4ed8' }}
                        >
                          {b.label}
                        </span>
                      ))}
                    </div>
                  </div>
                  {/* CTA — full-width trên mobile, auto-width trên sm+ */}
                  <button
                    type="button"
                    onClick={() => setShowImageEditor(true)}
                    className={`w-full sm:w-auto shrink-0 inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-all active:scale-95 ${hasCelebWorthyBadge
                      ? 'bg-amber-500 text-white hover:bg-amber-600 shadow-md shadow-amber-200'
                      : 'bg-white text-amber-900 border border-amber-300 hover:bg-amber-50 shadow-sm'
                      }`}
                  >
                    <span aria-hidden>🎨</span>
                    <span>{hasCelebWorthyBadge ? 'Tạo ảnh ăn mừng' : 'Tạo ảnh kết quả'}</span>
                  </button>
                </div>
              )}

              {certCtaVisible && (
                <div className="border-t border-gray-100 bg-gradient-to-br from-amber-50/70 via-white to-emerald-50/40 px-5 py-4 md:px-6 md:py-5">
                  {/* Inline cert CTA intentionally NOT using ap-cert-frame:
                      the time card has overflow-hidden (needed for rounded
                      corners) which clips the frame's hover-lift transform.
                      The full ap-cert-frame treatment lives on the standalone
                      cert showcase section below (id="athlete-certificate-cta"). */}
                  <div className="flex flex-col items-center justify-between gap-3 sm:flex-row sm:gap-4">
                    <div className="flex items-center gap-2.5 text-left">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-600/10 text-emerald-700 ring-1 ring-emerald-200">
                        <Award className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700/80">
                          {t('athlete.certificateSubtitle')}
                        </div>
                        <div className="text-sm font-semibold text-stone-700">
                          {t('athlete.certificateTitle')}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={downloadCertificateAsPng}
                      disabled={downloading}
                      type="button"
                      className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-emerald-600 to-teal-700 px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-white shadow-md shadow-emerald-600/20 transition-all hover:shadow-lg hover:shadow-emerald-600/30 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
                    >
                      {downloading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4 transition-transform group-hover:-translate-y-0.5" />
                      )}
                      {downloading
                        ? t('common.processing')
                        : t('athlete.statusBadge.getCertificate')}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* === RANK PROGRESSION + PACE ZONE (F-01 / F-02) ===
            Grid rules:
            · Finisher + splits → 2-col: RankProgression | PaceZone side-by-side
            · DNF/DSQ/DNS + splits → 1-col: PaceZone only (rank chart is
              meaningless for non-finishers — they never finished the course)
            · No splits → neither chart renders */}
        {hasSplits && !isUpcoming && (
          <div
            data-reveal
            className={`grid gap-4 ${finalStatus === 'finisher' ? 'md:grid-cols-2' : ''}`}
          >
            {finalStatus === 'finisher' && (
              <RankProgressionChart
                splits={splits.map((s) => ({
                  name: s.name,
                  distance: s.distance,
                  overallRank: s.overallRank,
                  rankDelta: s.rankDelta,
                }))}
                finalRank={athlete.OverallRank}
              />
            )}
            <PaceZoneChart
              splits={splits.map((s) => ({
                name: s.name,
                distance: s.distance,
                pace: s.pace,
                isPaceAlert: s.isPaceAlert,
              }))}
              avgPace={athlete.Pace}
              distanceKm={(() => {
                const m = String(athlete.distance ?? '').match(/(\d+(?:\.\d+)?)/);
                return m ? parseFloat(m[1]) : undefined;
              })()}
            />
          </div>
        )}

        {/* === PERCENTILE GAUGE (F-06) === */}
        {!isUpcoming && (
          <div data-reveal>
            <PercentileGauge raceId={raceId} bib={String(athlete.Bib)} hideAbsoluteCounts={raceData?.enablePrivateList ?? false} />
          </div>
        )}

        {/* === SPLIT TIMES === */}
        {hasSplits && !isUpcoming && <div data-reveal className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
              <Timer className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                {courseType === 'team_relay' ? t('athlete.raceDetailTeam') : courseType === 'lap' ? t('athlete.raceDetailLap') : t('athlete.raceDetail')}
              </h2>
              <p className="text-xs text-gray-400">
                {courseType === 'team_relay' ? t('athlete.splitDescTeam') : courseType === 'lap' ? t('athlete.splitDescLap') : t('athlete.splitDescSplit')}
              </p>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="block md:hidden">
            {splits.map((split, i) => {
              const paceSeconds = getPaceInSeconds(split.pace);
              const isFastest = split.pace !== '-' && paceSeconds === minPace;
              const isSlowest = split.pace !== '-' && paceSeconds === maxPace;
              const isStart = split.pace === '-';
              const isPaceAlert = split.isPaceAlert === true;
              const delta = split.rankDelta ?? 0;

              return (
                <div
                  key={i}
                  className={`px-5 py-4 border-b border-gray-50 ${isPaceAlert
                    ? 'bg-red-50/80 border-l-4 border-l-red-400'
                    : isFastest
                      ? 'bg-emerald-50/50 border-l-4 border-l-emerald-500'
                      : isSlowest
                        ? 'bg-orange-50/50 border-l-4 border-l-orange-400'
                        : i % 2 === 1
                          ? 'bg-gray-50/50'
                          : ''
                    }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">{split.overallRank || (i + 1)}</span>
                      <span className="font-semibold text-gray-900 text-sm">{split.name}</span>
                      {/* Rank delta badge (BR-01) */}
                      {i > 0 && delta !== 0 && (
                        <span className={`text-[10px] font-bold ${delta > 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {delta > 0 ? `↑${delta}` : `↓${Math.abs(delta)}`}
                        </span>
                      )}
                      {isPaceAlert && <span className="text-[10px] font-bold text-red-600">⚠️</span>}
                    </div>
                  </div>
                  {courseType === 'team_relay' && split.member && (
                    <div className="pl-9 mb-1">
                      <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">{split.member}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between pl-9">
                    <span className="font-mono font-bold text-blue-600">{split.time}</span>
                    {!isStart && (
                      <div className="flex items-center gap-1">
                        {isFastest && <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded">FASTEST</span>}
                        {isSlowest && <span className="text-[10px] font-bold text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded">SLOWEST</span>}
                        <span className="font-mono text-sm text-gray-500">{split.pace} /km</span>
                      </div>
                    )}
                  </div>
                  {(split.timeOfDay || split.overallRank || split.genderRank) && (
                    <div className="flex items-center gap-3 pl-9 mt-1 text-xs text-gray-500">
                      {split.timeOfDay && <span>Thời gian thực: <span className="font-mono">{split.timeOfDay}</span></span>}
                      {split.overallRank && <span>Overall: <span className="font-mono font-semibold text-gray-700">{split.overallRank}</span></span>}
                      {split.genderRank && <span>Giới tính: <span className="font-mono font-semibold text-purple-600">{split.genderRank}</span></span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/80">
                  <th className="text-left px-6 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider w-16">Hạng ↕</th>
                  <th className="text-left px-6 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">
                    {courseType === 'lap' || courseType === 'team_relay' ? t('athlete.lap') : t('athlete.checkpoint')}
                  </th>
                  {courseType === 'team_relay' && (
                    <th className="text-left px-6 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">{t('athlete.member')}</th>
                  )}
                  <th className="text-right px-6 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">{t('ranking.time')}</th>
                  <th className="text-right px-6 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Thời gian thực</th>
                  <th className="text-right px-6 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Pace</th>
                  <th className="text-right px-6 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Tốc độ</th>
                  <th className="text-right px-6 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Overall</th>
                  <th className="text-right px-6 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider w-24"></th>
                </tr>
              </thead>
              <tbody>
                {splits.map((split, i) => {
                  const paceSeconds = getPaceInSeconds(split.pace);
                  const isFastest = split.pace !== '-' && paceSeconds === minPace;
                  const isSlowest = split.pace !== '-' && paceSeconds === maxPace;
                  // BR-02: pace alert takes priority for row bg
                  const isPaceAlert = split.isPaceAlert === true;
                  const delta = split.rankDelta ?? 0;

                  return (
                    <tr
                      key={i}
                      className={`border-b border-gray-50 transition-colors ${isPaceAlert
                        ? 'bg-red-50/80 hover:bg-red-50'
                        : isFastest
                          ? 'bg-emerald-50/60 hover:bg-emerald-50'
                          : isSlowest
                            ? 'bg-orange-50/60 hover:bg-orange-50'
                            : i % 2 === 1
                              ? 'bg-gray-50/30 hover:bg-gray-50/60'
                              : 'hover:bg-gray-50/40'
                        }`}
                    >
                      {/* Rank delta cell (BR-01) — show actual rank at checkpoint, not array index */}
                      <td className="px-6 py-3.5">
                        {(() => {
                          const rankLabel = split.overallRank || String(i + 1);
                          if (i === 0 || delta === 0) {
                            return (
                              <span className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">{rankLabel}</span>
                            );
                          }
                          return (
                            <div className="flex items-center gap-1">
                              <span className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">{rankLabel}</span>
                              <span className={`text-[10px] font-bold ${delta > 0 ? 'text-green-600' : 'text-red-500'}`}>
                                {delta > 0 ? `↑${delta}` : `↓${Math.abs(delta)}`}
                              </span>
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-6 py-3.5 font-semibold text-gray-900">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span>{split.name}</span>
                          {isPaceAlert && (
                            <span className="text-[10px] font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded">⚠️ pace drop</span>
                          )}
                        </div>
                        {split.services && (split.services.water || split.services.food || split.services.sleep || split.services.dropBag || split.services.medical) && (
                          <div className="flex items-center gap-1 mt-1">
                            {split.services.water && <span title="Nước/Đồ uống" className="text-sm">💧</span>}
                            {split.services.food && <span title="Thức ăn" className="text-sm">🍌</span>}
                            {split.services.sleep && <span title="Khu ngủ nghỉ" className="text-sm">🛏</span>}
                            {split.services.dropBag && <span title="Drop Bag" className="text-sm">🎒</span>}
                            {split.services.medical && <span title="Y tế" className="text-sm">🏥</span>}
                            {split.services.notes && <span className="text-[10px] text-gray-400 italic ml-1">{split.services.notes}</span>}
                          </div>
                        )}
                      </td>
                      {courseType === 'team_relay' && (
                        <td className="px-6 py-3.5">
                          {split.member ? (
                            <span className="text-sm font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full">{split.member}</span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                      )}
                      <td className="px-6 py-3.5 text-right font-mono font-bold text-blue-600">{split.time}</td>
                      <td className="px-6 py-3.5 text-right font-mono text-gray-500">{split.timeOfDay || '-'}</td>
                      <td className="px-6 py-3.5 text-right font-mono text-gray-600">{split.pace !== '-' ? `${split.pace} /km` : '-'}</td>
                      <td className="px-6 py-3.5 text-right font-mono text-gray-500 text-xs">
                        {split.speed != null ? `${split.speed.toFixed(1)} km/h` : '—'}
                      </td>
                      <td className="px-6 py-3.5 text-right font-mono text-gray-700 font-semibold">{split.overallRank || '-'}</td>
                      <td className="px-6 py-3.5 text-right">
                        {isFastest && <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-1 rounded-full">FASTEST</span>}
                        {isSlowest && <span className="text-[10px] font-bold text-orange-700 bg-orange-100 px-2 py-1 rounded-full">SLOWEST</span>}
                        {isPaceAlert && !isFastest && !isSlowest && <span className="text-[10px] font-bold text-red-700 bg-red-100 px-2 py-1 rounded-full">PACE ↓</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>}

        {/* === PACE CHART === */}
        {hasSplits && paces.length > 0 && <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">{t('athlete.paceChart')}</h2>
              <p className="text-xs text-gray-400">{t('athlete.paceAnalysis')}</p>
            </div>
          </div>
          <div className="p-6">
            <div className="space-y-3">
              {splits.filter((s) => s.pace !== '-').map((split, i) => {
                const paceSeconds = getPaceInSeconds(split.pace);
                const range = maxPace - minPace || 1;
                const percentage = maxPace > 0 ? Math.max(35, 100 - ((paceSeconds - minPace) / range) * 45) : 70;
                const isFastest = paceSeconds === minPace;
                const isSlowest = paceSeconds === maxPace;

                return (
                  <div key={i} className="flex items-center gap-3 group">
                    <div className="w-28 md:w-36 text-right shrink-0">
                      <span className="text-xs font-semibold text-gray-500">{split.name}</span>
                      {courseType === 'team_relay' && split.member ? (
                        <div className="text-[10px] text-indigo-500 font-medium">{split.member}</div>
                      ) : courseType === 'split' ? (
                        <div className="text-[10px] text-gray-400">{split.distance}</div>
                      ) : null}
                    </div>
                    <div className="flex-1">
                      <div className="relative h-10 bg-gray-100 rounded-xl overflow-hidden">
                        <div
                          className={`absolute left-0 top-0 h-full rounded-xl transition-all duration-700 ease-out flex items-center justify-end px-4 ${isFastest
                            ? 'bg-gradient-to-r from-emerald-400 to-emerald-500 shadow-lg shadow-emerald-200'
                            : isSlowest
                              ? 'bg-gradient-to-r from-orange-400 to-orange-500 shadow-lg shadow-orange-200'
                              : 'bg-gradient-to-r from-blue-400 to-blue-500'
                            }`}
                          style={{ width: `${percentage}%` }}
                        >
                          <span className="text-xs font-bold text-white whitespace-nowrap drop-shadow-sm">{split.pace} /km</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Legend */}
            <div className="flex items-center justify-center gap-6 mt-6 pt-4 border-t border-gray-100 text-xs text-gray-500">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500" />
                {t('athlete.fastestLegend')}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-gradient-to-r from-orange-400 to-orange-500" />
                {t('athlete.slowestLegend')}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-gradient-to-r from-blue-400 to-blue-500" />
                {t('athlete.normalLegend')}
              </span>
            </div>
          </div>
        </div>}

        {/* === CERTIFICATE === (finishers only — DNF/DSQ/DNS see nothing) */}
        {raceData?.enableEcert !== false && finalStatus === 'finisher' && (<div
          data-reveal
          id="athlete-certificate-cta"
          className="ap-cert-frame bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden scroll-mt-24"
        >
          <div className="px-6 py-5 border-b border-gray-100 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center">
              <Award className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">{t('athlete.certificate')}</h2>
              <p className="text-xs text-gray-400">{t('athlete.certificateSubtitle')}</p>
            </div>
          </div>
          <div className="p-6 md:p-8">
            <div className="relative bg-gradient-to-br from-amber-50 via-white to-emerald-50/60 border-2 border-amber-200/70 rounded-2xl p-8 md:p-10 text-center overflow-hidden">
              {/* Decorative corners — gold accents per spec */}
              <div className="absolute top-3 left-3 w-8 h-8 border-t-2 border-l-2 border-amber-400 rounded-tl-lg" />
              <div className="absolute top-3 right-3 w-8 h-8 border-t-2 border-r-2 border-amber-400 rounded-tr-lg" />
              <div className="absolute bottom-3 left-3 w-8 h-8 border-b-2 border-l-2 border-amber-400 rounded-bl-lg" />
              <div className="absolute bottom-3 right-3 w-8 h-8 border-b-2 border-r-2 border-amber-400 rounded-br-lg" />

              <div className="relative">
                <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center shadow-lg shadow-amber-200">
                  <Award className="w-8 h-8 text-white" />
                </div>
                <div className="text-[10px] uppercase tracking-[0.3em] text-gray-400 font-bold mb-3">{t('athlete.certificateTitle')}</div>
                <div className="text-2xl md:text-3xl font-black text-gray-900 mb-1">{formatName(athlete.Name)}</div>
                <div className="text-sm text-gray-400 mb-5">BIB: {athlete.Bib}</div>
                <div className="text-4xl md:text-5xl font-black text-blue-600 mb-2" style={{ fontFamily: 'var(--font-mono)' }}>{athlete.ChipTime}</div>
                <div className="text-sm text-gray-500 font-medium">
                  {athlete.distance} &middot; {athlete.race_name || slug.replace(/-/g, ' ')}
                </div>
              </div>
            </div>

            <div className="text-center mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={downloadCertificateAsPng}
                disabled={downloading}
                className="inline-flex items-center gap-2 px-8 py-3.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold rounded-full transition-all duration-300 shadow-lg shadow-blue-200 hover:shadow-xl hover:shadow-blue-300 transform hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
              >
                {downloading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                {downloading ? t('common.processing') : t('athlete.downloadCertificate')}
              </button>
              <CertificateWithPhotoCta
                raceId={raceId}
                bib={String(athlete.Bib)}
                courseId={athlete.course_id}
                runnerName={athlete.Name}
                initialPhotoUrl={currentAvatarUrl || athlete.avatarUrl}
              />
            </div>
          </div>
        </div>)}

        {/* === CLAIM / APPEAL SECTION === */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">{t('claim.title')}</h2>
                <p className="text-xs text-gray-400">{t('claim.subtitle')}</p>
              </div>
            </div>
            {!showClaimForm && !claimSubmitted && (
              <button
                onClick={() => { setShowClaimForm(true); if (athlete?.Name && !claimName) setClaimName(athlete.Name.toLowerCase().split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')); }}
                className="px-4 py-2 text-sm font-semibold text-orange-600 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors"
              >
                {t('claim.submit')}
              </button>
            )}
          </div>

          {claimSubmitted ? (
            <div className="p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-50 flex items-center justify-center">
                <Check className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">{t('claim.submitted')}</h3>
              <p className="text-sm text-gray-500 max-w-md mx-auto">
                {t('claim.submittedMessage')}
              </p>
            </div>
          ) : showClaimForm ? (
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                {/* Name */}
                <div>
                  <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
                    <User className="w-3.5 h-3.5" /> {t('claim.nameLabel')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={claimName}
                    onChange={(e) => setClaimName(e.target.value)}
                    placeholder={t('claim.namePlaceholder')}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
                  />
                </div>
                {/* Phone */}
                <div>
                  <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
                    <Phone className="w-3.5 h-3.5" /> {t('claim.phoneLabel')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={claimPhone}
                    onChange={(e) => setClaimPhone(e.target.value)}
                    placeholder={t('claim.phonePlaceholder')}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
                  />
                </div>
              </div>

              {/* Email (optional) */}
              <div className="mb-4">
                <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
                  <Mail className="w-3.5 h-3.5" /> {t('claim.emailLabel')} <span className="text-gray-400 text-xs font-normal">{t('claim.emailOptional')}</span>
                </label>
                <input
                  type="email"
                  value={claimEmail}
                  onChange={(e) => setClaimEmail(e.target.value)}
                  placeholder={t('claim.emailPlaceholder')}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
                />
              </div>

              {/* Description */}
              <div className="mb-4">
                <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
                  <FileText className="w-3.5 h-3.5" /> {t('claim.descriptionLabel')} <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={claimDescription}
                  onChange={(e) => setClaimDescription(e.target.value)}
                  placeholder={t('claim.descriptionPlaceholder')}
                  rows={4}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all resize-none"
                />
              </div>

              {/* File upload */}
              <div className="mb-6">
                <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
                  <Upload className="w-3.5 h-3.5" /> {t('claim.uploadLabel')} <span className="text-gray-400 text-xs font-normal">{t('claim.uploadHint')}</span>
                </label>
                <input
                  ref={claimFileRef}
                  type="file"
                  accept=".gpx,.kml,.kmz,.fit,.tcx,.jpg,.jpeg,.png,.webp,.pdf,.zip"
                  onChange={handleClaimFileUpload}
                  className="hidden"
                />
                <button
                  onClick={() => claimFileRef.current?.click()}
                  disabled={claimUploading}
                  className="flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-gray-200 hover:border-blue-300 rounded-xl text-sm text-gray-500 hover:text-blue-600 transition-all w-full justify-center"
                >
                  {claimUploading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> {t('claim.uploading')}</>
                  ) : (
                    <><Upload className="w-4 h-4" /> {t('claim.uploadButton')}</>
                  )}
                </button>
                {claimAttachments.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    {claimAttachments.map((url, i) => {
                      const fileName = url.split('/').pop() || `File ${i + 1}`;
                      return (
                        <div key={i} className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg text-sm">
                          <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                          <span className="text-blue-700 truncate flex-1">{fileName}</span>
                          <button
                            onClick={() => setClaimAttachments(prev => prev.filter((_, idx) => idx !== i))}
                            className="text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleClaimSubmit}
                  disabled={claimSubmitting || claimUploading}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-bold rounded-xl transition-all duration-300 shadow-lg shadow-orange-200 hover:shadow-xl disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {claimSubmitting ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> {t('claim.submitting')}</>
                  ) : (
                    t('claim.submit')
                  )}
                </button>
                <button
                  onClick={() => { setShowClaimForm(false); setClaimName(''); setClaimEmail(''); setClaimPhone(''); setClaimDescription(''); setClaimAttachments([]); }}
                  className="px-6 py-3 text-sm font-medium text-gray-500 hover:text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          ) : (
            <div className="px-6 py-5 text-sm text-gray-500">
              {t('claim.helpText')}
            </div>
          )}
        </div>

        {/* === BACK NAVIGATION === */}
        <div className="text-center py-4">
          <Link
            href={`/races/${slug}`}
            className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-blue-600 transition-colors font-medium"
          >
            <ChevronLeft className="w-4 h-4" />
            {t('athlete.backToRanking')}
          </Link>
        </div>
      </div>

      {/* Result Image Creator Modal — v2 (Phase 2) */}
      {showImageEditor && (
        <ResultImageCreator
          athlete={athlete}
          raceId={raceId}
          raceName={raceData?.title || athlete.race_name}
          onClose={() => setShowImageEditor(false)}
        />
      )}

      {/* Celebration overlay — fires once per bib on first visit if a
          celebration-worthy badge is present (PB / Podium / Ultra / Sub-X). */}
      {raceId && athlete?.Bib != null && (
        <CelebrationOverlay
          show={showRicCelebration}
          raceId={raceId}
          bib={athlete.Bib}
          badges={athleteBadges}
          onDismiss={handleDismissCelebration}
        />
      )}

      {/* Avatar Upload Modal (P2-B-ii) */}
      {showAvatarModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowAvatarModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-900">Đổi ảnh đại diện</h3>
              <button onClick={() => setShowAvatarModal(false)} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Step indicators */}
            <div className="flex items-center gap-2 mb-6">
              {(['email', 'otp', 'file'] as const).map((s, i) => (
                <div key={s} className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${avatarStep === s ? 'bg-blue-600 text-white' : ['email', 'otp', 'file'].indexOf(avatarStep) > i ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-400'}`}>{i + 1}</div>
                  {i < 2 && <div className="flex-1 h-px bg-gray-200 w-6" />}
                </div>
              ))}
              <span className="ml-2 text-xs text-gray-500">{avatarStep === 'email' ? 'Xác thực email' : avatarStep === 'otp' ? 'Nhập OTP' : 'Chọn ảnh'}</span>
            </div>

            {avatarStep === 'email' && (
              <div className="space-y-4">
                <p className="text-sm text-gray-500">Nhập email đã đăng ký khi tham gia giải. Chúng tôi sẽ gửi mã xác thực.</p>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Email đăng ký</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="email"
                      value={avatarEmail}
                      onChange={e => setAvatarEmail(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleRequestOtp()}
                      placeholder="email@example.com"
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <button
                  onClick={handleRequestOtp}
                  disabled={avatarLoading || !avatarEmail.trim()}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
                >
                  {avatarLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                  Gửi mã OTP
                </button>
              </div>
            )}

            {avatarStep === 'otp' && (
              <div className="space-y-4">
                <p className="text-sm text-gray-500">Nhập mã 6 số đã được gửi đến <strong>{avatarEmail}</strong>. Mã có hiệu lực trong 10 phút.</p>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Mã OTP</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={avatarOtp}
                    onChange={e => setAvatarOtp(e.target.value.replace(/\D/g, ''))}
                    onKeyDown={e => e.key === 'Enter' && handleVerifyOtp()}
                    placeholder="000000"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-center text-2xl font-mono font-bold tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setAvatarStep('email')} className="flex-1 py-2.5 border border-gray-200 text-gray-600 font-semibold rounded-xl text-sm hover:bg-gray-50 transition-colors">
                    Quay lại
                  </button>
                  <button
                    onClick={handleVerifyOtp}
                    disabled={avatarOtp.length !== 6}
                    className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition-colors"
                  >
                    Xác nhận
                  </button>
                </div>
              </div>
            )}

            {avatarStep === 'file' && (
              <div className="space-y-4">
                <p className="text-sm text-gray-500">Chọn ảnh đại diện. Ảnh sẽ được crop thành hình vuông 200×200.</p>
                <div
                  onClick={() => avatarFileRef.current?.click()}
                  className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors"
                >
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="preview" className="w-24 h-24 rounded-full object-cover mx-auto mb-2 shadow-md" />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-2">
                      <Upload className="w-6 h-6 text-gray-400" />
                    </div>
                  )}
                  <p className="text-sm font-medium text-gray-700">{avatarFile ? avatarFile.name : 'Nhấn để chọn ảnh'}</p>
                  <p className="text-xs text-gray-400 mt-1">JPG, PNG, WebP · Tối đa 5MB</p>
                </div>
                <input ref={avatarFileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleAvatarFileChange} />
                <div className="flex gap-2">
                  <button onClick={() => setAvatarStep('otp')} className="flex-1 py-2.5 border border-gray-200 text-gray-600 font-semibold rounded-xl text-sm hover:bg-gray-50 transition-colors">
                    Quay lại
                  </button>
                  <button
                    onClick={handleAvatarUpload}
                    disabled={avatarLoading || !avatarFile}
                    className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
                  >
                    {avatarLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    Tải lên
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* === FLOATING ACTION BAR (v2 — appears after scrollY ≥ 360px) === */}
      {!isUpcoming && (
        <FloatingActionBar
          bib={athlete.Bib}
          name={formatName(athlete.Name)}
          rankingHref={`/races/${slug}/ranking/${athlete.course_id}`}
          onResultImage={() => setShowImageEditor(true)}
          onShare={handleShareFacebook}
          hasCertificate={certCtaVisible}
          onCertificate={() => {
            const el = document.getElementById('athlete-certificate-cta');
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }}
          onCopyLink={handleCopyLink}
          linkCopied={linkCopied}
        />
      )}
    </RaceTheme>
  );
}
