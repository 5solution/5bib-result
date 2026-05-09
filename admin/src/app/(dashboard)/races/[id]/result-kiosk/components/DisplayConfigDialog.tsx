'use client';

/**
 * F-017 — Modal split-pane: form left, live preview right.
 *
 * Form sections:
 *   - Preset selector (DEFAULT / MINIMAL / PREMIUM / CUSTOM)
 *   - Hero choice (rank / finish-time / photo)
 *   - Visible sections (7 toggles)
 *   - Theme color (hex input)
 *   - Custom message (textarea, plain text Phase 1)
 *   - Sponsor logos (upload + remove, max 5, ≤2MB each)
 *   - Sound toggle
 *   - Idle timeout slider
 */

import { useEffect, useState } from 'react';
import { X, Save, RotateCcw, Upload, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import { authHeaders } from '@/lib/api';
import {
  type DisplayConfig,
  type DisplayPreset,
  type HeroChoice,
  type VisibleSections,
  resolveDisplayConfig,
} from '@/lib/kiosk/result-display-config';
import {
  useApplyPreset,
  useDisplayConfig,
  useUpdateDisplayConfig,
} from '../hooks/useDisplayConfig';
import { DisplayConfigPreview } from './DisplayConfigPreview';
import { KIOSK_COPY } from '../kiosk.microcopy';
import { KIOSK_CONFIG } from '../kiosk.constant';

interface Props {
  raceId: string;
  open: boolean;
  onClose: () => void;
}

const SECTION_KEYS: Array<keyof VisibleSections> = [
  'rank',
  'finishTime',
  'splits',
  'sponsorBanner',
  'customMessage',
  'qrShare',
  'photo',
];

export function DisplayConfigDialog({ raceId, open, onClose }: Props) {
  const { token } = useAuth();
  const { data: serverConfig } = useDisplayConfig(raceId);
  const updateMut = useUpdateDisplayConfig(raceId);
  const presetMut = useApplyPreset(raceId);

  const [draft, setDraft] = useState<DisplayConfig>(() =>
    resolveDisplayConfig(raceId, null),
  );
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    if (serverConfig) setDraft(serverConfig);
  }, [serverConfig]);

  if (!open) return null;

  const setPartial = (patch: Partial<DisplayConfig>) =>
    setDraft((prev) => ({ ...prev, ...patch, preset: 'CUSTOM' as DisplayPreset }));

  const toggleSection = (key: keyof VisibleSections) =>
    setDraft((prev) => ({
      ...prev,
      preset: 'CUSTOM',
      visibleSections: {
        ...prev.visibleSections,
        [key]: !prev.visibleSections[key],
      },
    }));

  const handlePreset = async (preset: Exclude<DisplayPreset, 'CUSTOM'>) => {
    const next = await presetMut.mutateAsync(preset);
    setDraft(next);
  };

  const handleSave = async () => {
    const saved = await updateMut.mutateAsync(draft);
    setDraft(saved);
    onClose();
  };

  const handleUpload = async (file: File) => {
    if (file.size > KIOSK_CONFIG.SPONSOR_LOGO_MAX_BYTES) {
      setUploadError('File quá 2MB');
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      // CLAUDE.md exception: backend uses @FileInterceptor + multipart/form-data
      // for binary upload. SDK auto-gen doesn't handle multipart File bodies (sends
      // JSON `{ file: {} }` which serializes File to empty object → backend "No file"
      // 400). Raw fetch + FormData is the only sane path for binary uploads —
      // same pattern as F-018 photo upload S3 PUT exception.
      const formData = new FormData();
      formData.append('file', file);

      const headers = authHeaders(token ?? '').headers ?? {};
      const response = await fetch(
        `/api/result-kiosk-display/${raceId}/sponsor-logo`,
        {
          method: 'POST',
          headers, // do NOT set Content-Type — browser sets multipart boundary
          body: formData,
        },
      );

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        setUploadError(`Upload thất bại (${response.status}) ${text}`);
        return;
      }
      const json = (await response.json().catch(() => ({}))) as { url?: string };
      if (json?.url) {
        setDraft((prev) => ({
          ...prev,
          sponsorLogos: [...prev.sponsorLogos, json.url!],
        }));
      }
    } catch (err) {
      setUploadError(`Lỗi upload: ${(err as Error).message}`);
    } finally {
      setUploading(false);
    }
  };

  const removeLogo = (url: string) => {
    setDraft((prev) => ({
      ...prev,
      sponsorLogos: prev.sponsorLogos.filter((u) => u !== url),
    }));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      data-testid="display-config-dialog"
      role="dialog"
      aria-modal="true"
    >
      <div className="grid h-[90vh] w-full max-w-6xl grid-cols-1 overflow-hidden rounded-2xl bg-white shadow-xl md:grid-cols-2">
        {/* Form pane */}
        <div className="flex flex-col overflow-y-auto p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-stone-900">{KIOSK_COPY.config.title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label={KIOSK_COPY.config.cancel}
              className="rounded-lg p-2 text-stone-500 hover:bg-stone-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-6 space-y-6">
            {/* Preset */}
            <section>
              <div className="text-sm font-semibold text-stone-700">{KIOSK_COPY.config.presetLabel}</div>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(['DEFAULT', 'MINIMAL', 'PREMIUM'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => void handlePreset(p)}
                    className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                      draft.preset === p
                        ? 'border-[#FF0E65] bg-[#FF0E65]/10 text-[#FF0E65]'
                        : 'border-stone-200 bg-white text-stone-700'
                    }`}
                  >
                    {KIOSK_COPY.config.presets[p]}
                  </button>
                ))}
                <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-center text-sm text-stone-500">
                  {KIOSK_COPY.config.presets.CUSTOM}
                  {draft.preset === 'CUSTOM' && (
                    <span className="ml-1 text-[#FF0E65]">●</span>
                  )}
                </div>
              </div>
            </section>

            {/* Hero choice */}
            <section>
              <div className="text-sm font-semibold text-stone-700">{KIOSK_COPY.config.heroLabel}</div>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {(['rank', 'finish-time', 'photo'] as HeroChoice[]).map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setPartial({ heroChoice: h })}
                    className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                      draft.heroChoice === h
                        ? 'border-[#FF0E65] bg-[#FF0E65]/10 text-[#FF0E65]'
                        : 'border-stone-200 bg-white text-stone-700'
                    }`}
                  >
                    {KIOSK_COPY.config.heroChoices[h]}
                  </button>
                ))}
              </div>
            </section>

            {/* Visible sections */}
            <section>
              <div className="text-sm font-semibold text-stone-700">{KIOSK_COPY.config.sectionsLabel}</div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {SECTION_KEYS.map((key) => (
                  <label
                    key={key}
                    className="flex cursor-pointer items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={draft.visibleSections[key]}
                      onChange={() => toggleSection(key)}
                      className="h-4 w-4"
                    />
                    <span className="text-stone-700">{KIOSK_COPY.config.sections[key]}</span>
                  </label>
                ))}
              </div>
            </section>

            {/* Theme color */}
            <section>
              <label className="text-sm font-semibold text-stone-700">
                {KIOSK_COPY.config.themeLabel}
              </label>
              <div className="mt-2 flex items-center gap-3">
                <input
                  type="color"
                  value={draft.themeColor}
                  onChange={(e) => setPartial({ themeColor: e.target.value })}
                  className="h-10 w-16 rounded border border-stone-200"
                  data-testid="config-theme-color"
                />
                <input
                  type="text"
                  value={draft.themeColor}
                  onChange={(e) => setPartial({ themeColor: e.target.value })}
                  className="flex-1 rounded border border-stone-200 px-3 py-2 font-mono text-sm"
                  pattern="^#[0-9a-fA-F]{6}$"
                />
              </div>
            </section>

            {/* Custom message */}
            <section>
              <label className="text-sm font-semibold text-stone-700">
                {KIOSK_COPY.config.customMessageLabel}
              </label>
              <textarea
                value={draft.customMessage}
                onChange={(e) => setPartial({ customMessage: e.target.value })}
                maxLength={500}
                rows={3}
                className="mt-2 w-full rounded border border-stone-200 px-3 py-2 text-sm"
                placeholder="Plain text only (Phase 1)"
              />
              <div className="text-xs text-stone-400">{draft.customMessage.length} / 500</div>
            </section>

            {/* Sponsor logos */}
            <section>
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-stone-700">
                  {KIOSK_COPY.config.sponsorLogosLabel}
                </div>
                <div className="text-xs text-stone-400">
                  {draft.sponsorLogos.length} / {KIOSK_CONFIG.SPONSOR_LOGO_MAX_COUNT}
                </div>
              </div>
              <div className="mt-2 space-y-2">
                {draft.sponsorLogos.map((url) => (
                  <div
                    key={url}
                    className="flex items-center justify-between rounded border border-stone-200 bg-white px-3 py-2 text-sm"
                  >
                    <span className="truncate text-stone-700">{url}</span>
                    <button
                      type="button"
                      onClick={() => removeLogo(url)}
                      className="ml-2 rounded p-1 text-rose-600 hover:bg-rose-50"
                      aria-label="Xoá logo"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
              {draft.sponsorLogos.length < KIOSK_CONFIG.SPONSOR_LOGO_MAX_COUNT && (
                <label className="mt-2 flex cursor-pointer items-center gap-2 rounded border border-dashed border-stone-300 px-3 py-3 text-sm text-stone-500 hover:bg-stone-50">
                  <Upload className="h-4 w-4" />
                  <span>{uploading ? 'Đang upload...' : 'Upload logo (≤2MB)'}</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    className="hidden"
                    disabled={uploading}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void handleUpload(f);
                    }}
                  />
                </label>
              )}
              {uploadError && (
                <div className="mt-2 text-xs text-rose-600">{uploadError}</div>
              )}
            </section>

            {/* Sound + idle */}
            <section className="grid grid-cols-2 gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.soundEnabled}
                  onChange={(e) => setPartial({ soundEnabled: e.target.checked })}
                  className="h-4 w-4"
                />
                <span className="font-semibold text-stone-700">{KIOSK_COPY.config.soundLabel}</span>
              </label>
              <label className="text-sm">
                <span className="font-semibold text-stone-700">{KIOSK_COPY.config.idleLabel}</span>
                <input
                  type="number"
                  min={10}
                  max={300}
                  value={draft.idleTimeoutSeconds}
                  onChange={(e) =>
                    setPartial({ idleTimeoutSeconds: parseInt(e.target.value, 10) || 60 })
                  }
                  className="mt-1 w-full rounded border border-stone-200 px-3 py-2 font-mono"
                />
              </label>
            </section>
          </div>

          <div className="mt-auto flex items-center justify-end gap-3 pt-6">
            <Button type="button" variant="outline" onClick={onClose}>
              {KIOSK_COPY.config.cancel}
            </Button>
            <Button
              type="button"
              onClick={() => void handleSave()}
              disabled={updateMut.isPending}
              className="bg-[#FF0E65] text-white hover:bg-[#FF0E65]/90"
            >
              <Save className="mr-2 h-4 w-4" />
              {KIOSK_COPY.config.save}
            </Button>
          </div>
        </div>

        {/* Preview pane */}
        <div className="border-l border-stone-100 bg-stone-50 p-6 overflow-y-auto">
          <DisplayConfigPreview config={draft} />
        </div>
      </div>
    </div>
  );
}
