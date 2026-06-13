import type { ReactNode } from 'react';
import './landing.css';

/**
 * FEATURE-083 — Landing route-group layout. Intentionally MINIMAL: does NOT
 * render the 5BIB Header/Footer (those live in (main)/layout.tsx). A race
 * landing is a self-contained microsite. Inherits root layout fonts
 * (--font-heading / --font-sans / --font-jetbrains-mono).
 */
export default function LandingLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
