// Centralized, env-gated logger for mobile.
//
// - debug: verbose tracing (API requests, socket lifecycle, auth flow) —
//   dev-only, silenced in release builds.
// - warn/error: operational signal — always printed, since these are what
//   Sentry/crash-reporting and local debugging both rely on.

function debug(...args: unknown[]) {
  if (__DEV__) {
    console.log(...args);
  }
}

function warn(...args: unknown[]) {
  console.warn(...args);
}

function error(...args: unknown[]) {
  console.error(...args);
}

export const logger = { debug, warn, error };
