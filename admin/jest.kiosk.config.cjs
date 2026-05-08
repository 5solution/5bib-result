/**
 * F-013 minimal Jest config — runs kiosk.types.spec.ts (logic-only, no React)
 * via backend's already-installed ts-jest. NO npm install needed.
 *
 * Component / hook specs (KioskResultCard / BibNumberPad / KioskIdleOverlay /
 * useKioskIdle / useKioskSound) require @testing-library/react + jsdom which
 * are NOT in admin's node_modules. They are written in correct Jest+RTL form
 * for when admin gets the test stack installed (out of F-013 scope per
 * Manager STOP trigger "NO npm install").
 */
const path = require('path');

const BACKEND_NM = path.resolve(
  __dirname,
  '..',
  'backend',
  'node_modules',
);

module.exports = {
  rootDir: __dirname,
  testEnvironment: 'node',
  // F-013: only kiosk.types.spec.ts is runnable without @testing-library/react.
  // F-017 EXTEND: also matches result-display-config.spec.ts (pure TS runtime guard).
  // F-015 checkin.types regex REMOVED 2026-05-08 — Check-In Kiosk feature scrapped.
  // The component/hook specs (BibNumberPad / KioskResultCard / KioskIdleOverlay /
  // useKioskIdle / useKioskSound) require RTL + jsdom which are NOT installed
  // in admin. Switch this regex to '.*\\.spec\\.(ts|tsx)$' once admin gains the
  // test stack (TD-F013-TESTSTACK).
  testRegex: '.*(kiosk\\.types\\.spec\\.ts|result-display-config\\.spec\\.ts)$',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
  transform: {
    '^.+\\.tsx?$': [
      path.join(BACKEND_NM, 'ts-jest'),
      {
        isolatedModules: true,
        diagnostics: false,
        tsconfig: {
          module: 'commonjs',
          target: 'es2020',
          jsx: 'react-jsx',
          esModuleInterop: true,
          allowJs: true,
          resolveJsonModule: true,
        },
      },
    ],
  },
};
