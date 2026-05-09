'use client';

/**
 * F-018 — Surface 3: Incident detail drawer (F-014 Sheet pattern).
 */
import { useEffect, useState } from 'react';
import { IncidentResponse } from '../medical.types';
import { CATEGORY_VN, CLOSURE_REASON_VN, COPY, STATE_VN } from '../medical.microcopy';
import {
  CLOSURE_REASONS,
  ClosureReason,
  IncidentState,
  isActiveState,
} from '../medical.constant';
import { SeverityBadge } from './SeverityBadge';
import { CategoryIcon } from './CategoryIcon';
import { StateMachineTimeline } from './StateMachineTimeline';
import { StateTransitionPicker } from './StateTransitionPicker';
import { MedicTeamPickerArray } from './MedicTeamPickerArray';
import { WitnessStatementForm, WitnessDraft } from './WitnessStatementForm';
import { MedicalDirectorSignatureForm } from './MedicalDirectorSignatureForm';
import { PdfExportButton } from './PdfExportButton';
import { useUpdateIncidentStatus } from '../hooks/useIncidentMutation';

interface IncidentDetailDrawerProps {
  raceId: string;
  incident: IncidentResponse;
  onClose: () => void;
}

export function IncidentDetailDrawer({
  raceId,
  incident,
  onClose,
}: IncidentDetailDrawerProps) {
  const [pendingTo, setPendingTo] = useState<IncidentState | null>(null);
  const [reasonNote, setReasonNote] = useState('');
  const [closureReason, setClosureReason] = useState<ClosureReason | ''>('');
  const [extraMedics, setExtraMedics] = useState<string[]>([]);
  const [extraWitnesses, setExtraWitnesses] = useState<WitnessDraft[]>([]);
  const [signature, setSignature] = useState<{
    name: string;
    signedAt: string;
  } | null>(incident.medicalDirectorSignature ?? null);

  const update = useUpdateIncidentStatus(raceId);
  const closed = !isActiveState(incident.state);

  useEffect(() => {
    setSignature(incident.medicalDirectorSignature ?? null);
  }, [incident.medicalDirectorSignature]);

  const submitTransition = async () => {
    if (!pendingTo) return;
    try {
      await update.mutateAsync({
        incidentId: incident.id,
        payload: {
          to: pendingTo,
          reasonNote: reasonNote.trim() || undefined,
          closureReason: pendingTo === 'CLOSED' ? (closureReason as ClosureReason || 'RESOLVED') : undefined,
          medicsToAssign: extraMedics.length ? extraMedics : undefined,
          witnessStatements: extraWitnesses.length ? extraWitnesses : undefined,
          medicalDirectorSignature:
            pendingTo === 'CLOSED' ? signature ?? undefined : undefined,
        },
      });
      setPendingTo(null);
      setReasonNote('');
      setClosureReason('');
      setExtraMedics([]);
      setExtraWitnesses([]);
    } catch {
      // Surface error via update.error in UI.
    }
  };

  return (
    <aside
      role="dialog"
      aria-label={COPY.detail.title}
      className="fixed inset-y-0 right-0 z-30 flex w-full max-w-xl flex-col overflow-y-auto border-l border-stone-200 bg-white shadow-xl"
    >
      <header className="flex items-start justify-between border-b border-stone-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <SeverityBadge severity={incident.severity} pulsing={incident.severity === 5 && !closed} />
          <CategoryIcon category={incident.category} />
          <span className="text-sm font-semibold">
            {CATEGORY_VN[incident.category]}
          </span>
          <span className="rounded bg-stone-100 px-2 py-0.5 text-xs">
            {STATE_VN[incident.state]}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng"
          className="text-stone-400 hover:text-stone-700"
        >
          ×
        </button>
      </header>

      <div className="space-y-6 px-4 py-4">
        {closed ? (
          <p className="rounded bg-stone-100 px-3 py-2 text-xs text-stone-700">
            {COPY.detail.closedBanner}
            {incident.closureReason ? ` — ${CLOSURE_REASON_VN[incident.closureReason]}` : ''}
          </p>
        ) : null}

        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500">
            VĐV
          </h3>
          <p className="mt-1 text-sm">
            {incident.bib ? (
              <span className="font-mono">BIB {incident.bib}</span>
            ) : (
              <span className="italic text-stone-500">Chưa xác định</span>
            )}
            {incident.athleteName ? <span> — {incident.athleteName}</span> : null}
          </p>
          {incident.description ? (
            <p className="mt-2 whitespace-pre-wrap text-sm text-stone-700">
              {incident.description}
            </p>
          ) : null}
        </section>

        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500">
            Vị trí
          </h3>
          <p className="mt-1 font-mono text-xs text-stone-600">
            {incident.gpsLocation.lat.toFixed(5)},{' '}
            {incident.gpsLocation.lng.toFixed(5)} ({incident.gpsLocation.source})
          </p>
        </section>

        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500">
            Đội y tế phụ trách (A1 — multi-medic)
          </h3>
          <ul className="mt-1 flex flex-wrap gap-1">
            {incident.medicalTeamAssigned.map((m) => (
              <li
                key={m}
                className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-900"
              >
                {m}
              </li>
            ))}
            {incident.medicalTeamAssigned.length === 0 ? (
              <li className="text-xs text-stone-500">Chưa phân công</li>
            ) : null}
          </ul>
        </section>

        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500">
            {COPY.detail.timeline}
          </h3>
          <div className="mt-2">
            <StateMachineTimeline transitions={incident.incidentTransitions} />
          </div>
        </section>

        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500">
            Ảnh đính kèm
          </h3>
          {incident.attachments.length === 0 ? (
            <p className="mt-1 text-xs text-stone-500">Chưa có ảnh</p>
          ) : (
            <ul className="mt-2 grid grid-cols-3 gap-2">
              {incident.attachments.map((a) => (
                <li key={a.s3Key}>
                  {a.signedUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={a.signedUrl}
                      alt="incident photo"
                      className="aspect-square rounded object-cover"
                    />
                  ) : (
                    <div className="aspect-square rounded bg-stone-100 text-center text-[10px] leading-loose text-stone-500">
                      {a.s3Key.split('/').pop()}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {!closed ? (
          <section className="rounded-md border border-stone-200 bg-stone-50 p-3">
            <h3 className="text-sm font-semibold">{COPY.detail.transitionCta}</h3>
            <div className="mt-2">
              <StateTransitionPicker
                current={incident.state}
                onSelect={(to) => setPendingTo(to)}
                disabled={update.isPending}
              />
            </div>

            {pendingTo ? (
              <div className="mt-3 space-y-2 rounded border border-stone-300 bg-white p-3">
                <p className="text-xs">
                  → <strong>{STATE_VN[pendingTo]}</strong>
                </p>
                <textarea
                  rows={2}
                  placeholder="Lý do (bắt buộc nếu hạ mức / FALSE_ALARM)"
                  value={reasonNote}
                  onChange={(e) => setReasonNote(e.target.value)}
                  className="w-full rounded border border-stone-300 px-2 py-1.5 text-xs"
                />
                {pendingTo === 'CLOSED' ? (
                  <>
                    <select
                      value={closureReason}
                      onChange={(e) =>
                        setClosureReason(e.target.value as ClosureReason | '')
                      }
                      className="w-full rounded border border-stone-300 px-2 py-1.5 text-xs"
                    >
                      <option value="">— chọn lý do đóng —</option>
                      {CLOSURE_REASONS.map((r) => (
                        <option key={r} value={r}>
                          {CLOSURE_REASON_VN[r]}
                        </option>
                      ))}
                    </select>
                    <MedicalDirectorSignatureForm
                      value={signature}
                      onChange={setSignature}
                    />
                    {incident.severity >= 4 ? (
                      <WitnessStatementForm
                        severity={incident.severity}
                        value={extraWitnesses}
                        onChange={setExtraWitnesses}
                      />
                    ) : null}
                  </>
                ) : null}
                {(pendingTo === 'MEDIC_DISPATCHED' ||
                  pendingTo === 'MEDIC_ON_SITE') ? (
                  <MedicTeamPickerArray
                    value={extraMedics}
                    onChange={setExtraMedics}
                  />
                ) : null}
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setPendingTo(null)}
                    className="rounded border border-stone-300 bg-white px-3 py-1.5 text-xs"
                  >
                    Huỷ
                  </button>
                  <button
                    type="button"
                    onClick={submitTransition}
                    disabled={update.isPending}
                    className="rounded bg-stone-900 px-3 py-1.5 text-xs text-white disabled:opacity-50"
                  >
                    Xác nhận
                  </button>
                </div>
                {update.isError ? (
                  <p className="text-[11px] text-red-700">
                    {(update.error as Error)?.message}
                  </p>
                ) : null}
              </div>
            ) : null}
          </section>
        ) : null}

        <section>
          <PdfExportButton raceId={raceId} incidentIds={[incident.id]} />
        </section>
      </div>
    </aside>
  );
}
