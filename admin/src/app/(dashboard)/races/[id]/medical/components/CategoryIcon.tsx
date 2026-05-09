'use client';

/**
 * F-018 BR-MI-06 — 8-category icon set Phase 1.
 * Lucide icons (already a project dep). Wrapper provides accessible label.
 */
import {
  HeartPulse,
  Bone,
  ThermometerSun,
  Droplet,
  Activity,
  Brain,
  AlertOctagon,
  HelpCircle,
} from 'lucide-react';
import { Category } from '../medical.constant';
import { CATEGORY_VN } from '../medical.microcopy';

const ICONS: Record<Category, React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>> = {
  cardiac: HeartPulse,
  trauma: Bone,
  heat_stroke: ThermometerSun,
  dehydration: Droplet,
  musculoskeletal: Activity,
  neurological: Brain,
  allergic: AlertOctagon,
  other: HelpCircle,
};

interface CategoryIconProps {
  category: Category;
  className?: string;
}

export function CategoryIcon({ category, className }: CategoryIconProps) {
  const Icon = ICONS[category];
  return (
    <span
      role="img"
      aria-label={CATEGORY_VN[category]}
      className={className}
    >
      <Icon className="size-5" aria-hidden />
    </span>
  );
}
