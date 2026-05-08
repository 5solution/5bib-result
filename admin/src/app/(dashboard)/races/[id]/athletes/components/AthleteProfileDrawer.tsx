'use client';

/**
 * F-014 BR-AS-13 — Athlete profile drawer.
 *
 * Per Manager plan note "may be merged into AthleteEditDrawer with tab
 * toggle per BR-AS-13 — Coder choice", we picked the merge path. This
 * file is a thin alias that opens the merged drawer in `mode="profile"`
 * so the row "View" action stays semantically distinct from "Edit" while
 * the actual rendering shares one component.
 */

import { AthleteEditDrawer } from './AthleteEditDrawer';
import type { AthleteWithStatus } from '../athletes.types';

interface AthleteProfileDrawerProps {
  open: boolean;
  row: AthleteWithStatus | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function AthleteProfileDrawer(props: AthleteProfileDrawerProps) {
  return (
    <AthleteEditDrawer
      open={props.open}
      mode="profile"
      row={props.row}
      onOpenChange={props.onOpenChange}
      onSaved={props.onSaved}
    />
  );
}

export default AthleteProfileDrawer;
