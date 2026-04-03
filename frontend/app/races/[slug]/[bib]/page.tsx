'use client';

import { useState, useCallback, useRef, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Clock, Share2, Link2, Check, MapPin, Calendar, Timer, TrendingUp, Award, Users, Tag, Trophy, Download, ChevronRight, Loader2, AlertTriangle, Upload, X, Phone, Mail, User, FileText } from 'lucide-react';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import { countryToFlag } from '@/lib/country-flags';
import { useRaceBySlug, useAthleteDetail, useSubmitClaim, useUploadClaimAttachment } from '@/lib/api-hooks';

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
  race_id: number;
  course_id: string;
  distance: string;
  splits?: SplitTime[];
  race_name?: string;
}

interface SplitTime {
  name: string;
  distance: string;
  time: string;
  pace: string;
  member?: string;
}

interface CheckpointConfig {
  key: string;
  name: string;
  distance?: string;
}

/** Parse Chiptimes/Paces JSON strings from API into SplitTime[], using checkpoint config for names */
function parseSplitsFromData(data: Record<string, unknown>, checkpoints?: CheckpointConfig[]): SplitTime[] | null {
  try {
    const chiptimesStr = data.Chiptimes as string;
    const pacesStr = data.Paces as string;
    if (!chiptimesStr) return null;

    const chiptimes: Record<string, string> = JSON.parse(chiptimesStr);
    const paces: Record<string, string> = pacesStr ? JSON.parse(pacesStr) : {};

    // Parse Member field if present (for team_relay races)
    let members: Record<string, string> = {};
    const memberStr = data.Member as string | undefined;
    if (memberStr) {
      try {
        members = JSON.parse(memberStr);
      } catch {
        // ignore invalid Member JSON
      }
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
        };
      });

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
  const params = useParams();
  const slug = params.slug as string;
  const bib = params.bib as string;

  // Data fetching via react-query hooks
  const { data: raceRaw, isLoading: loadingRace } = useRaceBySlug(slug);
  const raceData = useMemo(() => (raceRaw as any)?.data ?? raceRaw, [raceRaw]);
  const raceId = raceData?._id || '';

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
      } as AthleteResult,
      courseType: detectedCourseType,
    };
  }, [athleteRaw, raceData, slug]);

  const raceStatus = raceData?.status;
  const isUpcoming = raceStatus === 'upcoming' || raceStatus === 'pre_race';
  const loading = loadingRace || loadingAthlete;

  const [linkCopied, setLinkCopied] = useState(false);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setLinkCopied(true);
      toast.success('Đã sao chép liên kết!');
      setTimeout(() => setLinkCopied(false), 2000);
    });
  };

  const handleShareFacebook = () => {
    const url = encodeURIComponent(window.location.href);
    const text = encodeURIComponent(
      athlete ? `${athlete.Name} - BIB ${athlete.Bib} - ${athlete.distance} - Chip Time: ${athlete.ChipTime}` : ''
    );
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}&quote=${text}`, '_blank', 'width=600,height=400');
  };

  const handleShareAsImage = useCallback(async () => {
    if (!shareCardRef.current || !athlete) return;
    setSharingImage(true);
    try {
      const html2canvas = (await import('html2canvas-pro')).default;
      const canvas = await html2canvas(shareCardRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#1e40af',
      });
      canvas.toBlob(async (blob) => {
        if (!blob) {
          toast.error('Không thể tạo ảnh');
          setSharingImage(false);
          return;
        }
        const fileName = `result-${athlete.Name.replace(/\s+/g, '-')}-BIB${athlete.Bib}.png`;

        // Try native share if available
        if (navigator.share && navigator.canShare) {
          const file = new File([blob], fileName, { type: 'image/png' });
          const shareData = { files: [file] };
          if (navigator.canShare(shareData)) {
            try {
              await navigator.share(shareData);
              setSharingImage(false);
              return;
            } catch {
              // User cancelled or share failed, fall through to download
            }
          }
        }

        // Fallback: download
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success('Đã tải ảnh kết quả!');
        setSharingImage(false);
      }, 'image/png');
    } catch {
      toast.error('Không thể tạo ảnh chia sẻ');
      setSharingImage(false);
    }
  }, [athlete]);

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
    const words = name.trim().split(/\s+/);
    if (words.length >= 2) {
      return (words[0][0] + words[words.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
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
  const [sharingImage, setSharingImage] = useState(false);
  const shareCardRef = useRef<HTMLDivElement>(null);
  const celebrationAudioRef = useRef<HTMLAudioElement | null>(null);

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

  const uploadMutation = useUploadClaimAttachment();

  const handleClaimFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      toast.error('File quá lớn. Giới hạn 20MB.');
      return;
    }
    setClaimUploading(true);
    try {
      const result = await uploadMutation.mutateAsync(file);
      setClaimAttachments(prev => [...prev, result.url]);
      toast.success(`Đã tải lên: ${file.name}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Tải file thất bại');
    } finally {
      setClaimUploading(false);
      if (claimFileRef.current) claimFileRef.current.value = '';
    }
  }, [uploadMutation]);

  const submitClaimMutation = useSubmitClaim();

  const handleClaimSubmit = useCallback(async () => {
    if (!athlete) return;
    if (!claimName.trim() || !claimPhone.trim() || !claimDescription.trim()) {
      toast.error('Vui lòng điền đầy đủ: Họ tên, Số điện thoại, và Nội dung khiếu nại.');
      return;
    }
    if (!raceId) {
      toast.error('Không tìm thấy giải đấu');
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
      toast.success('Khiếu nại đã được gửi thành công! Chúng tôi sẽ liên hệ bạn sớm nhất.');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Gửi khiếu nại thất bại');
    } finally {
      setClaimSubmitting(false);
    }
  }, [athlete, raceId, claimName, claimEmail, claimPhone, claimDescription, claimAttachments, submitClaimMutation]);

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
      toast.info('Chứng nhận chưa sẵn sàng. Vui lòng thử lại sau.');
      return;
    }

    setDownloading(true);
    toast.loading('Đang tải chứng nhận...', { id: 'cert-download' });

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

      toast.success('Tải chứng nhận thành công! 🎉', { id: 'cert-download' });
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
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Không tìm thấy vận động viên</h2>
          <p className="text-gray-500 mb-6">BIB #{bib} không tồn tại trong cuộc đua này</p>
          <Link href={`/races/${slug}`} className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-full font-semibold hover:bg-blue-700 transition-colors">
            <ChevronLeft className="w-4 h-4" /> Quay lại kết quả
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

  const genderLabel = athlete.Gender === 'Male' || athlete.Gender === 'M' ? 'Nam' : 'Nữ';
  const genderIcon = athlete.Gender === 'Male' || athlete.Gender === 'M' ? '♂' : '♀';
  const genderColor = athlete.Gender === 'Male' || athlete.Gender === 'M' ? 'bg-blue-600' : 'bg-pink-500';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ===== HERO SECTION ===== */}
      <div className="relative bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 overflow-hidden">
        {/* Background decorative elements */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-white rounded-full blur-3xl -translate-y-1/2" />
          <div className="absolute bottom-0 right-1/4 w-72 h-72 bg-blue-300 rounded-full blur-3xl translate-y-1/2" />
        </div>
        <div className="absolute inset-0" style={{
          backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 30px, rgba(255,255,255,0.03) 30px, rgba(255,255,255,0.03) 60px)',
        }} />

        {/* Navigation bar */}
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-4">
          <div className="flex items-center justify-between">
            <Link
              href={`/races/${slug}`}
              className="inline-flex items-center gap-1.5 text-sm text-white/70 hover:text-white transition-colors font-medium"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Kết quả {athlete.distance}</span>
            </Link>
            {/* Share buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleShareAsImage}
                disabled={sharingImage}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 backdrop-blur-sm text-white rounded-full text-xs font-semibold transition-all border border-white/20 disabled:opacity-50"
              >
                {sharingImage ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                Ảnh KQ
              </button>
              <button
                onClick={handleShareFacebook}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 backdrop-blur-sm text-white rounded-full text-xs font-semibold transition-all border border-white/20"
              >
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
                Chia sẻ
              </button>
              <button
                onClick={handleCopyLink}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 backdrop-blur-sm text-white rounded-full text-xs font-semibold transition-all border border-white/20"
              >
                {linkCopied ? <Check className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
                {linkCopied ? 'Đã sao chép' : 'Copy link'}
              </button>
            </div>
          </div>
        </div>

        {/* Avatar & athlete info */}
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-28 pt-6 text-center">
          {/* Avatar */}
          <div className="relative inline-block mb-5">
            <div className="w-28 h-28 md:w-36 md:h-36 rounded-full bg-white/20 backdrop-blur-sm border-4 border-white/40 flex items-center justify-center mx-auto shadow-2xl">
              <span className="text-4xl md:text-5xl font-black text-white tracking-tight">
                {getInitials(athlete.Name)}
              </span>
            </div>
            {/* Rank badge overlay */}
            {!isUpcoming && (
              <div className={`absolute -bottom-2 -right-2 w-12 h-12 md:w-14 md:h-14 rounded-full bg-gradient-to-br ${getRankMedalColor(athlete.OverallRank)} flex items-center justify-center shadow-lg border-3 border-white`}>
                <span className="text-lg md:text-xl font-black text-white">
                  {parseInt(athlete.OverallRank) <= 3 ? formatRank(athlete.OverallRank) : `#${athlete.OverallRank}`}
                </span>
              </div>
            )}
            {/* Gender badge */}
            <div className={`absolute -bottom-2 -left-2 w-10 h-10 md:w-11 md:h-11 rounded-full ${genderColor} flex items-center justify-center shadow-lg border-2 border-white`}>
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
            {athlete.Nationality && (
              <span className="px-3 py-1 bg-white/20 backdrop-blur-sm text-white rounded-full text-sm font-semibold border border-white/30">
                {countryToFlag(athlete.Nationality) || countryToFlag(athlete.Nation) || athlete.Nation} {athlete.Nationality}
              </span>
            )}
          </div>

          {/* Race name */}
          {athlete.race_name && (
            <p className="text-white/60 text-sm font-medium">{athlete.race_name}</p>
          )}
        </div>
      </div>

      {/* ===== MAIN CONTENT (overlapping hero) ===== */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 -mt-16 relative z-10 pb-12 space-y-6">

        {/* === TIME CARD (floating over hero) === */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          {isUpcoming ? (
            <div className="text-center py-10 md:py-14 px-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-50 mb-4">
                <Calendar className="w-8 h-8 text-blue-400" />
              </div>
              <h3 className="text-xl md:text-2xl font-bold text-slate-700 mb-2">Giải chưa diễn ra</h3>
              <p className="text-sm text-slate-400">Kết quả sẽ được cập nhật khi giải bắt đầu</p>
            </div>
          ) : (
            <>
              {/* Big time display */}
              <div className="text-center py-8 md:py-10 px-6 bg-gradient-to-b from-blue-50/80 to-white">
                <div className="text-xs uppercase tracking-[0.2em] text-gray-400 font-bold mb-2">Chip Time</div>
                <div className="text-5xl md:text-7xl font-black text-blue-600 tracking-tight mb-3" style={{ fontFamily: 'var(--font-mono)' }}>
                  {athlete.ChipTime}
                </div>
                <div className="flex items-center justify-center gap-4 md:gap-8 text-sm text-gray-500">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-gray-400" />
                    Gun: <span className="font-mono font-bold text-gray-700">{athlete.GunTime}</span>
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
                  { label: 'Overall Rank', rank: athlete.OverallRank, icon: <Trophy className="w-5 h-5" />, color: 'text-amber-500', bg: 'bg-amber-50' },
                  { label: 'Gender Rank', rank: athlete.GenderRank, icon: <Users className="w-5 h-5" />, color: 'text-blue-500', bg: 'bg-blue-50' },
                  ...(athlete.CatRank ? [{ label: 'Cat Rank', rank: athlete.CatRank, icon: <Tag className="w-5 h-5" />, color: 'text-emerald-500', bg: 'bg-emerald-50' }] : []),
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
            </>
          )}
        </div>

        {/* === SPLIT TIMES === */}
        {hasSplits && !isUpcoming && <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
              <Timer className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                {courseType === 'team_relay' ? 'Thời gian các vòng (Đội)' : courseType === 'lap' ? 'Thời gian các vòng' : 'Chi tiết cuộc đua'}
              </h2>
              <p className="text-xs text-gray-400">
                {courseType === 'team_relay' ? 'Lap times theo từng thành viên' : courseType === 'lap' ? 'Lap times qua các vòng' : 'Split times tại các checkpoint'}
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

              return (
                <div
                  key={i}
                  className={`px-5 py-4 border-b border-gray-50 ${i % 2 === 1 ? 'bg-gray-50/50' : ''} ${isFastest ? 'bg-emerald-50/50 border-l-4 border-l-emerald-500' : isSlowest ? 'bg-orange-50/50 border-l-4 border-l-orange-400' : ''}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">{i + 1}</span>
                      <span className="font-semibold text-gray-900 text-sm">{split.name}</span>
                    </div>
                    {courseType === 'split' && (
                      <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{split.distance}</span>
                    )}
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
                </div>
              );
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/80">
                  <th className="text-left px-6 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider w-8">#</th>
                  <th className="text-left px-6 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">
                    {courseType === 'lap' || courseType === 'team_relay' ? 'Vòng' : 'Checkpoint'}
                  </th>
                  {courseType === 'team_relay' && (
                    <th className="text-left px-6 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Thành viên</th>
                  )}
                  {courseType === 'split' && (
                    <th className="text-left px-6 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Cự ly</th>
                  )}
                  <th className="text-right px-6 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Thời gian</th>
                  <th className="text-right px-6 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Pace</th>
                  <th className="text-right px-6 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider w-24"></th>
                </tr>
              </thead>
              <tbody>
                {splits.map((split, i) => {
                  const paceSeconds = getPaceInSeconds(split.pace);
                  const isFastest = split.pace !== '-' && paceSeconds === minPace;
                  const isSlowest = split.pace !== '-' && paceSeconds === maxPace;

                  return (
                    <tr
                      key={i}
                      className={`border-b border-gray-50 transition-colors ${isFastest ? 'bg-emerald-50/60 hover:bg-emerald-50' : isSlowest ? 'bg-orange-50/60 hover:bg-orange-50' : i % 2 === 1 ? 'bg-gray-50/30 hover:bg-gray-50/60' : 'hover:bg-gray-50/40'
                        }`}
                    >
                      <td className="px-6 py-3.5">
                        <span className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">{i + 1}</span>
                      </td>
                      <td className="px-6 py-3.5 font-semibold text-gray-900">{split.name}</td>
                      {courseType === 'team_relay' && (
                        <td className="px-6 py-3.5">
                          {split.member ? (
                            <span className="text-sm font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full">{split.member}</span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                      )}
                      {courseType === 'split' && (
                        <td className="px-6 py-3.5 text-gray-500 font-medium">{split.distance}</td>
                      )}
                      <td className="px-6 py-3.5 text-right font-mono font-bold text-blue-600">{split.time}</td>
                      <td className="px-6 py-3.5 text-right font-mono text-gray-600">{split.pace !== '-' ? `${split.pace} /km` : '-'}</td>
                      <td className="px-6 py-3.5 text-right">
                        {isFastest && <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-1 rounded-full">FASTEST</span>}
                        {isSlowest && <span className="text-[10px] font-bold text-orange-700 bg-orange-100 px-2 py-1 rounded-full">SLOWEST</span>}
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
              <h2 className="text-lg font-bold text-gray-900">Biểu đồ Pace</h2>
              <p className="text-xs text-gray-400">Phân tích tốc độ qua từng chặng</p>
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
                Nhanh nhất
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-gradient-to-r from-orange-400 to-orange-500" />
                Chậm nhất
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-gradient-to-r from-blue-400 to-blue-500" />
                Bình thường
              </span>
            </div>
          </div>
        </div>}

        {/* === CERTIFICATE === */}
        {raceData?.enableEcert !== false && (<div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center">
              <Award className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Chứng nhận hoàn thành</h2>
              <p className="text-xs text-gray-400">E-Certificate of Completion</p>
            </div>
          </div>
          <div className="p-6 md:p-8">
            <div className="relative bg-gradient-to-br from-blue-50 via-white to-indigo-50 border-2 border-blue-100 rounded-2xl p-8 md:p-10 text-center overflow-hidden">
              {/* Decorative corners */}
              <div className="absolute top-3 left-3 w-8 h-8 border-t-2 border-l-2 border-blue-300 rounded-tl-lg" />
              <div className="absolute top-3 right-3 w-8 h-8 border-t-2 border-r-2 border-blue-300 rounded-tr-lg" />
              <div className="absolute bottom-3 left-3 w-8 h-8 border-b-2 border-l-2 border-blue-300 rounded-bl-lg" />
              <div className="absolute bottom-3 right-3 w-8 h-8 border-b-2 border-r-2 border-blue-300 rounded-br-lg" />

              <div className="relative">
                <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center shadow-lg shadow-amber-200">
                  <Award className="w-8 h-8 text-white" />
                </div>
                <div className="text-[10px] uppercase tracking-[0.3em] text-gray-400 font-bold mb-3">Certificate of Completion</div>
                <div className="text-2xl md:text-3xl font-black text-gray-900 mb-1">{formatName(athlete.Name)}</div>
                <div className="text-sm text-gray-400 mb-5">BIB: {athlete.Bib}</div>
                <div className="text-4xl md:text-5xl font-black text-blue-600 mb-2" style={{ fontFamily: 'var(--font-mono)' }}>{athlete.ChipTime}</div>
                <div className="text-sm text-gray-500 font-medium">
                  {athlete.distance} &middot; {athlete.race_name || slug.replace(/-/g, ' ')}
                </div>
              </div>
            </div>

            <div className="text-center mt-6">
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
                {downloading ? 'Đang xử lý...' : 'Tải chứng nhận (PNG)'}
              </button>
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
                <h2 className="text-lg font-bold text-gray-900">Khiếu nại kết quả</h2>
                <p className="text-xs text-gray-400">Gửi yêu cầu xem xét lại thành tích</p>
              </div>
            </div>
            {!showClaimForm && !claimSubmitted && (
              <button
                onClick={() => { setShowClaimForm(true); if (athlete?.Name && !claimName) setClaimName(athlete.Name.toLowerCase().split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')); }}
                className="px-4 py-2 text-sm font-semibold text-orange-600 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors"
              >
                Gửi khiếu nại
              </button>
            )}
          </div>

          {claimSubmitted ? (
            <div className="p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-50 flex items-center justify-center">
                <Check className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Đã gửi khiếu nại</h3>
              <p className="text-sm text-gray-500 max-w-md mx-auto">
                Yêu cầu của bạn đã được ghi nhận. Ban tổ chức sẽ xem xét và liên hệ bạn qua số điện thoại đã cung cấp.
              </p>
            </div>
          ) : showClaimForm ? (
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                {/* Name */}
                <div>
                  <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
                    <User className="w-3.5 h-3.5" /> Họ tên <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={claimName}
                    onChange={(e) => setClaimName(e.target.value)}
                    placeholder="Nguyễn Văn A"
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
                  />
                </div>
                {/* Phone */}
                <div>
                  <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
                    <Phone className="w-3.5 h-3.5" /> Số điện thoại <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={claimPhone}
                    onChange={(e) => setClaimPhone(e.target.value)}
                    placeholder="0912 345 678"
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
                  />
                </div>
              </div>

              {/* Email (optional) */}
              <div className="mb-4">
                <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
                  <Mail className="w-3.5 h-3.5" /> Email <span className="text-gray-400 text-xs font-normal">(không bắt buộc)</span>
                </label>
                <input
                  type="email"
                  value={claimEmail}
                  onChange={(e) => setClaimEmail(e.target.value)}
                  placeholder="email@example.com"
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
                />
              </div>

              {/* Description */}
              <div className="mb-4">
                <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
                  <FileText className="w-3.5 h-3.5" /> Nội dung khiếu nại <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={claimDescription}
                  onChange={(e) => setClaimDescription(e.target.value)}
                  placeholder="Mô tả chi tiết lý do khiếu nại: thời gian chip không chính xác, thiếu checkpoint, sai cự ly..."
                  rows={4}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all resize-none"
                />
              </div>

              {/* File upload */}
              <div className="mb-6">
                <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
                  <Upload className="w-3.5 h-3.5" /> Tải lên bằng chứng <span className="text-gray-400 text-xs font-normal">(GPX, KML, FIT, ảnh — tối đa 20MB)</span>
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
                    <><Loader2 className="w-4 h-4 animate-spin" /> Đang tải lên...</>
                  ) : (
                    <><Upload className="w-4 h-4" /> Chọn file (tracklog, ảnh chụp màn hình...)</>
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
                    <><Loader2 className="w-4 h-4 animate-spin" /> Đang gửi...</>
                  ) : (
                    'Gửi khiếu nại'
                  )}
                </button>
                <button
                  onClick={() => { setShowClaimForm(false); setClaimName(''); setClaimEmail(''); setClaimPhone(''); setClaimDescription(''); setClaimAttachments([]); }}
                  className="px-6 py-3 text-sm font-medium text-gray-500 hover:text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  Hủy
                </button>
              </div>
            </div>
          ) : (
            <div className="px-6 py-5 text-sm text-gray-500">
              Nếu bạn cho rằng kết quả có sai sót, bạn có thể gửi yêu cầu khiếu nại kèm theo bằng chứng (tracklog GPS, ảnh chụp đồng hồ...) để ban tổ chức xem xét.
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
            Quay lại bảng xếp hạng
          </Link>
        </div>
      </div>

      {/* Hidden share card for image capture */}
      <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
        <div
          ref={shareCardRef}
          style={{
            width: 600,
            padding: '40px 32px',
            background: 'linear-gradient(135deg, #2563eb 0%, #1e40af 50%, #3730a3 100%)',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            color: 'white',
          }}
        >
          {/* Race name */}
          <div style={{ fontSize: 14, opacity: 0.7, marginBottom: 4, fontWeight: 600 }}>
            {athlete.race_name || ''}
          </div>
          <div style={{ fontSize: 13, opacity: 0.5, marginBottom: 24 }}>
            {athlete.distance}
          </div>

          {/* Athlete name */}
          <div style={{ fontSize: 32, fontWeight: 900, marginBottom: 8, letterSpacing: '-0.02em' }}>
            {formatName(athlete.Name)}
          </div>

          {/* Tags */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 32, flexWrap: 'wrap' as const }}>
            <span style={{ padding: '4px 12px', background: 'rgba(255,255,255,0.2)', borderRadius: 20, fontSize: 13, fontWeight: 700 }}>
              BIB: {athlete.Bib}
            </span>
            <span style={{ padding: '4px 12px', background: 'rgba(255,255,255,0.2)', borderRadius: 20, fontSize: 13, fontWeight: 600 }}>
              {genderLabel}
            </span>
            <span style={{ padding: '4px 12px', background: 'rgba(255,255,255,0.2)', borderRadius: 20, fontSize: 13, fontWeight: 600 }}>
              {athlete.Category}
            </span>
          </div>

          {/* Chip Time */}
          <div style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 16, padding: '24px 20px', marginBottom: 20 }}>
            <div style={{ fontSize: 11, opacity: 0.6, textTransform: 'uppercase' as const, letterSpacing: '0.1em', fontWeight: 700, marginBottom: 8 }}>
              Chip Time
            </div>
            <div style={{ fontSize: 48, fontWeight: 900, fontFamily: 'ui-monospace, monospace', letterSpacing: '-0.02em' }}>
              {athlete.ChipTime}
            </div>
            <div style={{ display: 'flex', gap: 20, marginTop: 12, fontSize: 13, opacity: 0.7 }}>
              <span>Pace: <strong style={{ fontFamily: 'ui-monospace, monospace' }}>{athlete.Pace}</strong> /km</span>
              {athlete.Gap && athlete.Gap !== '-' && <span>Gap: <strong style={{ fontFamily: 'ui-monospace, monospace' }}>{athlete.Gap}</strong></span>}
            </div>
          </div>

          {/* Ranks */}
          <div style={{ display: 'flex', gap: 12 }}>
            {[
              { label: 'Overall Rank', value: `#${athlete.OverallRank}` },
              { label: 'Gender Rank', value: `#${athlete.GenderRank}` },
              ...(athlete.CatRank ? [{ label: 'Cat Rank', value: `#${athlete.CatRank}` }] : []),
            ].map((item) => (
              <div key={item.label} style={{ flex: 1, background: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: '14px 12px', textAlign: 'center' as const }}>
                <div style={{ fontSize: 22, fontWeight: 900 }}>{item.value}</div>
                <div style={{ fontSize: 10, opacity: 0.6, textTransform: 'uppercase' as const, letterSpacing: '0.05em', fontWeight: 700, marginTop: 4 }}>{item.label}</div>
              </div>
            ))}
          </div>

          {/* Branding */}
          <div style={{ marginTop: 24, textAlign: 'center' as const, fontSize: 12, opacity: 0.4, fontWeight: 600 }}>
            5bib.com
          </div>
        </div>
      </div>
    </div>
  );
}
