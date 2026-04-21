'use client';

import { useEffect } from 'react';

// Toggles a body class so the timing landing can scope its global styles
// and hide the main site's Header/Footer.
export default function TimingBodyClass() {
  useEffect(() => {
    document.body.classList.add('timing-landing-active');
    return () => {
      document.body.classList.remove('timing-landing-active');
    };
  }, []);
  return null;
}
