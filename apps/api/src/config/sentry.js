const Sentry = require('@sentry/node');
const { ProfilingIntegration } = require('@sentry/profiling-node');

function initSentry(app) {
  if (!process.env.SENTRY_DSN) {
    console.warn('[Sentry] SENTRY_DSN not configured - error monitoring disabled');
    return;
  }

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    integrations: [
      new Sentry.Integrations.Http({ tracing: true }),
      new Sentry.Integrations.Express({ app }),
      new ProfilingIntegration(),
    ],
    tracesSampleRate: 0.1, // 10% of transactions
    profilesSampleRate: 0.1,
    environment: process.env.NODE_ENV || 'development',
  });

  console.log('[Sentry] Error monitoring initialized');
}

module.exports = { initSentry, Sentry };
