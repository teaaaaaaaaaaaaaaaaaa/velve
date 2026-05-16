/**
 * Mailer — centralized email sending for the Velve API.
 *
 * Wraps Nodemailer with a single transporter (lazy-initialized, cached) plus
 * a small library of templated senders (waitlist, verification, …).
 *
 * SMTP setup is read from environment vars:
 *   SMTP_HOST       e.g. mail.velveapp.com
 *   SMTP_PORT       465 (SSL/TLS) or 587 (STARTTLS)
 *   SMTP_USER       noreply@velveapp.com
 *   SMTP_PASS       account password
 *   SMTP_FROM       "Velve <noreply@velveapp.com>"      (optional, has default)
 *   SMTP_REPLY_TO   info@velveapp.com                   (optional, has default)
 *   WEB_URL         https://velveapp.com                (used in template links)
 *
 * If SMTP is not configured the transporter falls back to a logger that
 * prints what *would* have been sent — useful for local dev.
 */

const nodemailer = require('nodemailer')

let cachedTransporter = null
let cachedConfigured = null

function getTransporter() {
  if (cachedTransporter !== null) return cachedTransporter

  const host = process.env.SMTP_HOST
  const port = parseInt(process.env.SMTP_PORT || '465', 10)
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  if (!host || !user || !pass) {
    if (cachedConfigured === null) {
      console.warn('[mailer] SMTP env vars missing — emails will be logged, not sent')
      cachedConfigured = false
    }
    cachedTransporter = false
    return false
  }

  cachedConfigured = true
  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    // cPanel servers occasionally have slow handshakes
    connectionTimeout: 10_000,
    greetingTimeout: 8_000,
    socketTimeout: 12_000,
  })

  return cachedTransporter
}

async function sendMail({ to, subject, html, text, replyTo }) {
  const transporter = getTransporter()
  const from =
    process.env.SMTP_FROM ||
    `"Velve" <${process.env.SMTP_USER || 'noreply@velveapp.com'}>`
  const reply = replyTo || process.env.SMTP_REPLY_TO || 'info@velveapp.com'

  if (!transporter) {
    console.log(`[mailer:dry-run] To: ${to} | Subject: ${subject}`)
    return { dryRun: true }
  }

  return transporter.sendMail({
    from,
    to,
    subject,
    html,
    text,
    replyTo: reply,
  })
}

// ─── Templates ─────────────────────────────────────────────────────────

function waitlistHtml({ position }) {
  const numStr = String(position).padStart(4, '0')
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>You're on the Velve waiting list</title>
</head>
<body style="margin:0;padding:0;background:#0d0d0d;font-family:Helvetica,Arial,sans-serif;color:#e8e8e8;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0d0d0d;">
    <tr>
      <td align="center" style="padding:48px 20px;">
        <table role="presentation" width="540" cellpadding="0" cellspacing="0" border="0" style="max-width:540px;background:#141414;border:1px solid rgba(255,255,255,0.08);border-radius:6px;">
          <tr>
            <td style="padding:40px 40px 16px;text-align:center;">
              <div style="font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:42px;color:#ffffff;letter-spacing:-0.02em;line-height:1;">Velve</div>
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:0.22em;color:rgba(255,255,255,0.42);text-transform:uppercase;margin-top:10px;">Drop 001 &middot; 2026</div>
            </td>
          </tr>
          <tr><td style="padding:16px 40px;"><div style="height:1px;background:rgba(255,255,255,0.1);"></div></td></tr>
          <tr>
            <td style="padding:18px 40px 8px;text-align:center;">
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:0.34em;color:rgba(255,255,255,0.45);text-transform:uppercase;">you are</div>
              <div style="font-family:Helvetica,Arial,sans-serif;font-weight:700;font-size:72px;color:#CBDA63;letter-spacing:-0.04em;line-height:1;margin:18px 0;">#${numStr}</div>
              <div style="display:inline-block;width:48px;height:1px;background:#CBDA63;margin:6px 0 14px;"></div>
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:0.34em;color:rgba(255,255,255,0.45);text-transform:uppercase;">on the list</div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 40px 12px;">
              <p style="margin:0 0 14px;font-family:Georgia,'Times New Roman',serif;font-size:15px;line-height:1.65;color:rgba(255,255,255,0.82);">
                You're in. Velve is a peer-to-peer exchange for alternative fashion &mdash; clothing that has a history, that gets traded, that doesn't end up forgotten.
              </p>
              <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:15px;line-height:1.65;color:rgba(255,255,255,0.82);">
                We'll reach out when the doors open. One email when it's your turn &mdash; nothing in between.
              </p>
            </td>
          </tr>
          <tr><td style="padding:24px 40px 0;"><div style="height:1px;background:rgba(255,255,255,0.08);"></div></td></tr>
          <tr>
            <td style="padding:22px 40px 36px;">
              <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:12px;letter-spacing:0.06em;color:rgba(255,255,255,0.42);line-height:1.6;">
                Need a human? Reply to <a href="mailto:info@velveapp.com" style="color:#9DD3E4;text-decoration:none;">info@velveapp.com</a>.
              </p>
              <p style="margin:10px 0 0;font-family:Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:0.18em;color:rgba(255,255,255,0.24);text-transform:uppercase;">
                Velve &middot; alternative fashion exchange
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function waitlistText({ position }) {
  const numStr = String(position).padStart(4, '0')
  return [
    `VELVE — Drop 001`,
    ``,
    `You are #${numStr} on the list.`,
    ``,
    `Velve is a peer-to-peer exchange for alternative fashion.`,
    `We'll reach out when the doors open.`,
    ``,
    `Need a human? Reply to info@velveapp.com.`,
    ``,
    `— Velve`,
  ].join('\n')
}

async function sendWaitlistConfirmation({ to, position }) {
  return sendMail({
    to,
    subject: "You're on the Velve waiting list",
    html: waitlistHtml({ position }),
    text: waitlistText({ position }),
  })
}

// ─── Verification (matches existing pattern in routes/verification.js) ──

function verificationHtml({ displayName, verificationUrl }) {
  const name = (displayName || 'there').toString().replace(/[<>]/g, '')
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0d0d0d;font-family:Helvetica,Arial,sans-serif;color:#e8e8e8;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr><td align="center" style="padding:48px 20px;">
      <table role="presentation" width="540" cellpadding="0" cellspacing="0" border="0" style="max-width:540px;background:#141414;border:1px solid rgba(255,255,255,0.08);border-radius:6px;">
        <tr><td style="padding:40px 40px 16px;text-align:center;">
          <div style="font-family:Georgia,serif;font-style:italic;font-size:38px;color:#fff;letter-spacing:-0.02em;">Velve</div>
        </td></tr>
        <tr><td style="padding:8px 40px 28px;">
          <p style="margin:0 0 14px;font-family:Georgia,serif;font-size:15px;line-height:1.6;color:rgba(255,255,255,0.82);">Hi ${name},</p>
          <p style="margin:0 0 24px;font-family:Georgia,serif;font-size:15px;line-height:1.6;color:rgba(255,255,255,0.82);">Confirm your email so you can access your Velve account.</p>
          <div style="text-align:center;">
            <a href="${verificationUrl}" style="display:inline-block;padding:14px 28px;background:#CBDA63;color:#2B2A2B;text-decoration:none;font-family:Helvetica,Arial,sans-serif;font-weight:700;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;border-radius:2px;">Verify email</a>
          </div>
          <p style="margin:24px 0 0;font-family:Helvetica,Arial,sans-serif;font-size:11px;color:rgba(255,255,255,0.4);word-break:break-all;">Or open: <a href="${verificationUrl}" style="color:#9DD3E4;text-decoration:none;">${verificationUrl}</a></p>
          <p style="margin:8px 0 0;font-family:Helvetica,Arial,sans-serif;font-size:11px;color:rgba(255,255,255,0.3);">This link expires in 24 hours.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

async function sendVerificationEmail({ to, displayName, verificationUrl }) {
  return sendMail({
    to,
    subject: 'Verify your Velve email',
    html: verificationHtml({ displayName, verificationUrl }),
    text: `Hi ${displayName || 'there'},\n\nVerify your Velve email: ${verificationUrl}\n\nThis link expires in 24 hours.\n\n— Velve`,
  })
}

module.exports = {
  sendMail,
  sendWaitlistConfirmation,
  sendVerificationEmail,
  // exposed for tests / manual reset
  __resetTransporterCache: () => {
    cachedTransporter = null
    cachedConfigured = null
  },
}
