'use client';
import { tierFromConfidence } from '../awards.constant';

const TIER_CLASS: Record<number, string> = {
  1: 'text-red-700 font-bold',
  2: 'text-amber-700 font-semibold',
  3: 'text-stone-600',
};

export function ConfidenceScore({ value }: { value: number }) {
  const tier = tierFromConfidence(value);
  return (
    <span className={`font-mono ${TIER_CLASS[tier]}`}>
      {value.toFixed(2)}
    </span>
  );
}
