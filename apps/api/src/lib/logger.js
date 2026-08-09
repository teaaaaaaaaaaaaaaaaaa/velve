// Centralized, env-gated logger.
//
// - debug: verbose request/response tracing — noisy, dev-only by default.
// - info/warn/error: operational signal — always printed, including in
//   production, since that's what on-call/monitoring depends on.
//
// Verbosity is controlled by LOG_LEVEL (silent|error|warn|info|debug),
// defaulting to 'debug' outside production and 'info' in production.

const LEVELS = { silent: 0, error: 1, warn: 2, info: 3, debug: 4 }

function resolveLevel() {
  const configured = String(process.env.LOG_LEVEL || '').toLowerCase()
  if (configured in LEVELS) return LEVELS[configured]
  return process.env.NODE_ENV === 'production' ? LEVELS.info : LEVELS.debug
}

const activeLevel = resolveLevel()

function debug(...args) {
  if (activeLevel >= LEVELS.debug) console.log(...args)
}

function info(...args) {
  if (activeLevel >= LEVELS.info) console.log(...args)
}

function warn(...args) {
  if (activeLevel >= LEVELS.warn) console.warn(...args)
}

function error(...args) {
  if (activeLevel >= LEVELS.error) console.error(...args)
}

module.exports = { debug, info, warn, error }
