'use client';

/**
 * F-018 BR-MI 3-tap workflow form (Surface 2).
 * Sev → Category → GPS → Submit. Optional sub-section for BIB / desc / photo / witnesses.
 *
 * 3-tap target validated for Sev 1-3 happy path:
 *   tap 1: severity tile
 *   tap 2: category tile
 *   tap 3: submit (after auto-GPS confirmation)
 */
import { useEffect, useState } from 'react';
import { useKioskSound } from '@/lib/kiosk/useKioskSound';
import {
  Category,
  PHOTO_REQUIRED_SEVERITIES,
  Severity,
  SEVERITIES,
  TraumaSubtype,
} from '../medical.constant';
import { COPY, SEVERITY_VN } from '../medical.microcopy';
import { useCreateIncident } from '../hooks/useIncidentMutation';
import type { GpsLocation } from '../medical.types';
import { SeverityBadge } from './SeverityBadge';
import { SeverityConfirmationModal } from './SeverityConfirmationModal';
import { CategoryPicker } from './CategoryPicker';
import { GpsLocationPicker } from './GpsLocationPicker';
import { BibLookupAutocomplete } from './BibLookupAutocomplete';
import { PhotoCameraUpload } from './PhotoCameraUpload';
import { MedicTeamPickerArray } from './MedicTeamPickerArray';
import { WitnessStatementForm, WitnessDraft } from './WitnessStatementForm';
import { SeverityCategoryAutoSuggest } from './SeverityCategoryAutoSuggest';

interface IncidentFormProps {
  raceId: string;
  coursePolyline?: [number, number][];
  aidStations?: { id: string; name: string; lat: number; lng: number }[];
  onClose: () => void;
  onCreated: (incidentId: string) => void;
}

export function IncidentForm({
  raceId,
  coursePolyline,
  aidStations,
  onClose,
  onCreated,
}: IncidentFormProps) {
  const create = useCreateIncident(raceId);
  const { ensureAudioContext, beepSuccess, beepError } = useKioskSound();

  const [severity, setSeverity] = useState<Severity | null>(null);
  const [confirmingSev, setConfirmingSev] = useState<Severity | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [traumaSubtype, setTraumaSubtype] = useState<TraumaSubtype | null>(
    null,
  );
  const [gps, setGps] = useState<GpsLocation | null>(null);
  const [bib, setBib] = useState('');
  const [athleteName, setAthleteName] = useState('');
  const [description, setDescription] = useState('');
  const [attachmentKeys, setAttachmentKeys] = useState<string[]>([]);
  const [medicalTeamAssigned, setMedicalTeamAssigned] = useState<string[]>([]);
  const [witnesses, setWitnesses] = useState<WitnessDraft[]>([]);
  const [showOptional, setShowOptional] = useState(false);

  // Lazy-construct AudioContext on first interaction (browser autoplay policy).
  useEffect(() => {
    ensureAudioContext();
  }, [ensureAudioContext]);

  const onSeverityClick = (s: Severity) => {
    if (s >= 4) {
      setConfirmingSev(s);
      return;
    }
    setSeverity(s);
  };

  const confirmSev = () => {
    if (confirmingSev !== null) {
      setSeverity(confirmingSev);
      setConfirmingSev(null);
    }
  };

  const photoRequired =
    severity !== null && PHOTO_REQUIRED_SEVERITIES.has(severity);
  const photoMissing = photoRequired && attachmentKeys.length === 0;
  const validIdentity = !!(bib.trim() || athleteName.trim() || description.trim());
  const canSubmit =
    severity !== null &&
    category !== null &&
    (category !== 'trauma' || !!traumaSubtype) &&
    !!gps &&
    !photoMissing &&
    validIdentity &&
    !create.isPending;

  const submit = async () => {
    if (!severity || !category || !gps) return;
    try {
      const result = await create.mutateAsync({
        severity,
        category,
        traumaSubtype: traumaSubtype ?? undefined,
        bib: bib.trim() || undefined,
        athleteName: athleteName.trim() || undefined,
        description: description.trim() || undefined,
        gpsLocation: gps,
        medicalTeamAssigned,
        witnessStatements: witnesses.length ? witnesses : undefined,
        attachmentKeys: attachmentKeys.length ? attachmentKeys : undefined,
      });
      beepSuccess();
      if (result.kind === 'created') {
        onCreated(result.incident.id);
      } else {
        onClose();
      }
    } catch {
      beepError();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={COPY.form.title}
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between">
          <h2 className="text-2xl font-bold text-stone-900">{COPY.form.title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-stone-400 hover:text-stone-700"
            aria-label="Đóng"
          >
            ×
          </button>
        </div>

        {/* Step 1 — Severity */}
        <section className="mt-4">
          <h3 className="text-sm font-semibold text-stone-700">
            1. {COPY.form.severityHeading}
          </h3>
          <div className="mt-2 grid grid-cols-5 gap-2">
            {SEVERITIES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onSeverityClick(s)}
                aria-pressed={severity === s}
                className={`min-h-[64px] rounded-lg border-2 p-2 text-center transition-all ${
                  severity === s
                    ? 'border-stone-900 ring-2 ring-stone-300'
                    : 'border-stone-200 hover:border-stone-400'
                }`}
              >
                <SeverityBadge severity={s} size="md" showLabel={false} />
                <p className="mt-1 text-[11px] leading-tight">
                  {SEVERITY_VN[s]}
                </p>
              </button>
            ))}
          </div>
        </section>

        {/* Step 2 — Category */}
        {severity !== null ? (
          <section className="mt-5">
            <h3 className="text-sm font-semibold text-stone-700">
              2. {COPY.form.categoryHeading}
            </h3>
            <div className="mt-2">
              <CategoryPicker
                value={category}
                traumaSubtype={traumaSubtype}
                onChange={(c, sub) => {
                  setCategory(c);
                  setTraumaSubtype(sub ?? null);
                }}
              />
            </div>
            <div className="mt-2">
              <SeverityCategoryAutoSuggest
                category={category}
                traumaSubtype={traumaSubtype}
                currentSeverity={severity}
              />
            </div>
          </section>
        ) : null}

        {/* Step 3 — GPS */}
        {severity !== null && category !== null ? (
          <section className="mt-5">
            <h3 className="text-sm font-semibold text-stone-700">
              3. {COPY.form.gpsHeading}
            </h3>
            <div className="mt-2">
              <GpsLocationPicker
                value={gps}
                coursePolyline={coursePolyline}
                aidStations={aidStations}
                onChange={setGps}
              />
            </div>
          </section>
        ) : null}

        {/* Optional details */}
        {severity !== null && category !== null ? (
          <section className="mt-5 border-t border-stone-200 pt-4">
            <button
              type="button"
              onClick={() => setShowOptional((v) => !v)}
              className="text-sm font-medium text-blue-700"
            >
              {showOptional ? '▼' : '▶'} {COPY.form.optionalSection}
            </button>
            {showOptional ? (
              <div className="mt-3 space-y-4">
                <div>
                  <label className="text-xs text-stone-700">
                    {COPY.form.bibLabel}
                  </label>
                  <BibLookupAutocomplete
                    raceId={raceId}
                    value={bib}
                    onChange={(b, n) => {
                      setBib(b);
                      if (n) setAthleteName(n);
                    }}
                  />
                </div>
                <div>
                  <label className="text-xs text-stone-700">
                    {COPY.form.nameLabel}
                  </label>
                  <input
                    type="text"
                    value={athleteName}
                    onChange={(e) => setAthleteName(e.target.value)}
                    className="w-full rounded border border-stone-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-stone-700">
                    {COPY.form.descLabel}
                  </label>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full rounded border border-stone-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-stone-700">
                    {COPY.form.photoLabel}
                    {photoRequired ? (
                      <span className="ml-1 text-red-600">*</span>
                    ) : null}
                  </label>
                  {photoRequired ? (
                    <p className="text-xs text-red-700">{COPY.form.photoRequiredHint}</p>
                  ) : null}
                  {/* Phase 1: photo upload deferred until incident exists.
                      Pre-create photo collection requires presigned-PUT-by-temp-id
                      (Phase 2 enhancement). For Sev 4-5 the BTC operator can submit
                      without photo (server returns 400, caller surfaces error +
                      attaches photo via detail drawer post-create). */}
                </div>
                <div>
                  <label className="text-xs text-stone-700">Đội y tế</label>
                  <MedicTeamPickerArray
                    value={medicalTeamAssigned}
                    onChange={setMedicalTeamAssigned}
                  />
                </div>
                <div>
                  <label className="text-xs text-stone-700">
                    {COPY.form.witnessLabel}
                  </label>
                  <WitnessStatementForm
                    severity={severity}
                    value={witnesses}
                    onChange={setWitnesses}
                  />
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {/* Validation hint */}
        {severity !== null && category !== null && !validIdentity ? (
          <p className="mt-3 rounded bg-amber-50 px-2 py-1 text-xs text-amber-900">
            {COPY.validation.needOneOf}
          </p>
        ) : null}

        {/* Submit */}
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] rounded-md border border-stone-300 bg-white px-4 py-2 text-sm"
          >
            {COPY.form.cancel}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className="min-h-[44px] rounded-md bg-red-600 px-6 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            {create.isPending ? COPY.form.submitting : COPY.form.submit}
          </button>
        </div>
      </div>

      <SeverityConfirmationModal
        open={confirmingSev !== null}
        severity={confirmingSev}
        onConfirm={confirmSev}
        onCancel={() => setConfirmingSev(null)}
      />
    </div>
  );
}
