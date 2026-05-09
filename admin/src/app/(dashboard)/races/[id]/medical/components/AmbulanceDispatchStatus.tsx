'use client';

import { IncidentState } from '../medical.constant';
import { STATE_VN } from '../medical.microcopy';

interface AmbulanceDispatchStatusProps {
  state: IncidentState;
  ambulanceETA?: string;
}

export function AmbulanceDispatchStatus({
  state,
  ambulanceETA,
}: AmbulanceDispatchStatusProps) {
  if (state !== 'AMB_REQUESTED' && state !== 'HOSPITAL_TRANSFER') {
    return null;
  }
  return (
    <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm">
      <p className="font-semibold text-red-900">{STATE_VN[state]}</p>
      {ambulanceETA ? (
        <p className="mt-1 text-xs text-red-700">
          ETA: {new Date(ambulanceETA).toLocaleString('vi-VN')}
        </p>
      ) : null}
    </div>
  );
}
