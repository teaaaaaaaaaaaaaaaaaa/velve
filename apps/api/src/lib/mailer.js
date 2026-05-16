/**
 * Mailer - centralized email sending for the Velve API.
 *
 * Wraps Nodemailer with a single transporter (lazy-initialized, cached) plus
 * a small library of templated senders (waitlist, verification, etc.).
 *
 * SMTP setup is read from environment vars:
 *   SMTP_HOST       e.g. mail.velveapp.com
 *   SMTP_PORT       465 (SSL/TLS) or 587 (STARTTLS)
 *   SMTP_USER       noreply@velveapp.com
 *   SMTP_PASS       account password
 *   SMTP_FROM       "Velve <noreply@velveapp.com>"      (optional, has default)
 *   SMTP_REPLY_TO   info@velveapp.com                   (optional, has default)
 *   WEB_URL         https://velveapp.com                (used in verification links)
 *
 * If SMTP is not configured the transporter falls back to a logger that
 * prints what would have been sent - useful for local development.
 */

const nodemailer = require('nodemailer')

const DEFAULT_FROM_EMAIL = 'noreply@velveapp.com'
const DEFAULT_REPLY_TO = 'info@velveapp.com'

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
      console.warn('[mailer] SMTP env vars missing - emails will be logged, not sent')
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
    `"Velve" <${process.env.SMTP_USER || DEFAULT_FROM_EMAIL}>`
  const reply = replyTo || process.env.SMTP_REPLY_TO || DEFAULT_REPLY_TO

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

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderShell({ title, preheader, body }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#0f0d10;color:#f5f1e8;font-family:Arial,Helvetica,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0f0d10;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0" style="width:640px;max-width:640px;">
          <tr>
            <td style="padding:28px 40px 18px;border:1px solid #2f2430;border-bottom:none;background:linear-gradient(180deg,#18131a 0%,#120f12 100%);">
              <div style="font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:42px;line-height:1;color:#ffffff;letter-spacing:-0.02em;">Velve</div>
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px 40px;border:1px solid #2f2430;border-top:none;background:linear-gradient(180deg,#18131a 0%,#120f12 100%);">
              ${body}
            </td>
          </tr>
          <tr>
            <td style="padding:18px 40px 0;font-size:12px;line-height:20px;color:#8d8591;">
              Sent from ${DEFAULT_FROM_EMAIL}. Questions: <a href="mailto:${DEFAULT_REPLY_TO}" style="color:#9DD3E4;text-decoration:none;">${DEFAULT_REPLY_TO}</a>.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function waitlistHtml({ position }) {
  const numStr = String(position).padStart(4, '0')

  return renderShell({
    title: "You're on the Velve waitlist",
    preheader: "Your waitlist spot is confirmed. We'll email you when access opens.",
    body: `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding:14px 0 0;font-size:12px;line-height:18px;letter-spacing:2px;text-transform:uppercase;color:#CBDA63;">
            Waitlist Confirmed
          </td>
        </tr>
        <tr>
          <td style="padding:14px 0 0;font-size:40px;line-height:46px;font-weight:700;color:#F8F4EC;">
            You're in.
          </td>
        </tr>
        <tr>
          <td style="padding:16px 0 0;font-size:16px;line-height:26px;color:#D7D0D9;">
            Your spot on the Velve waitlist is confirmed.
            <br><br>
            Velve is a mobile app for building your closet, discovering pieces that fit your taste,
            and making trade or buy offers inside a community built on trust.
          </td>
        </tr>
        <tr>
          <td style="padding:28px 0 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #3F3143;background:#1A141B;">
              <tr>
                <td style="padding:24px 24px 10px;font-size:11px;line-height:16px;letter-spacing:2px;text-transform:uppercase;color:#9DD3E4;">
                  Your Position
                </td>
              </tr>
              <tr>
                <td style="padding:0 24px 4px;font-size:58px;line-height:62px;font-weight:700;color:#F8F4EC;">
                  #${numStr}
                </td>
              </tr>
              <tr>
                <td style="padding:0 24px 24px;font-size:14px;line-height:22px;color:#B7AEB8;">
                  We will email you when access opens, or sooner only if there is a real product update worth sending.
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 0 0;font-size:16px;line-height:26px;color:#D7D0D9;">
            What to expect:
          </td>
        </tr>
        <tr>
          <td style="padding:10px 0 0;font-size:15px;line-height:24px;color:#D7D0D9;">
            1. The waitlist will matter if access opens in waves.
            <br>
            2. Updates will stay low-volume and useful.
            <br>
            3. If you need a human, write to <a href="mailto:${DEFAULT_REPLY_TO}" style="color:#9DD3E4;text-decoration:underline;">${DEFAULT_REPLY_TO}</a>.
          </td>
        </tr>
        <tr>
          <td style="padding:32px 0 0;font-size:14px;line-height:24px;color:#D7D0D9;">
            Velve
            <br>
            Closets, discovery, and trusted fashion exchange
          </td>
        </tr>
      </table>
    `,
  })
}

function waitlistText({ position }) {
  const numStr = String(position).padStart(4, '0')

  return [
    'You are on the Velve waitlist.',
    '',
    `Position: #${numStr}`,
    '',
    'Velve is a mobile app for building your closet, discovering pieces that fit your taste,',
    'and making trade or buy offers inside a community built on trust.',
    '',
    "We'll email you when access opens, or sooner only if there is a real product update worth sending.",
    '',
    `Questions: ${DEFAULT_REPLY_TO}`,
    '',
    'Velve',
    'Closets, discovery, and trusted fashion exchange',
  ].join('\n')
}

async function sendWaitlistConfirmation({ to, position }) {
  return sendMail({
    to,
    subject: "You're on the Velve waitlist",
    html: waitlistHtml({ position }),
    text: waitlistText({ position }),
  })
}

function verificationHtml({ displayName, verificationUrl }) {
  const safeName = escapeHtml(displayName || 'there')
  const safeUrl = escapeHtml(verificationUrl)

  return renderShell({
    title: 'Verify your Velve email',
    preheader: 'Confirm your email to finish entering Velve.',
    body: `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding:14px 0 0;font-size:12px;line-height:18px;letter-spacing:2px;text-transform:uppercase;color:#9DD3E4;">
            Account Verification
          </td>
        </tr>
        <tr>
          <td style="padding:14px 0 0;font-size:40px;line-height:46px;font-weight:700;color:#F8F4EC;">
            Confirm your email.
          </td>
        </tr>
        <tr>
          <td style="padding:16px 0 0;font-size:16px;line-height:26px;color:#D7D0D9;">
            Hi ${safeName},
            <br><br>
            Confirm your email to finish entering Velve.
            Once you're in, you'll be able to set up your profile, build your closet,
            save pieces, and start sending trade or buy offers.
          </td>
        </tr>
        <tr>
          <td style="padding:30px 0 0;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td bgcolor="#CBDA63" style="border-radius:999px;">
                  <a href="${safeUrl}" style="display:inline-block;padding:14px 24px;font-size:13px;line-height:13px;letter-spacing:1.6px;text-transform:uppercase;font-weight:700;color:#171217;text-decoration:none;">
                    Verify Email
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 0 0;font-size:14px;line-height:22px;color:#B7AEB8;word-break:break-word;">
            If the button does not work, open this link:
            <br>
            <a href="${safeUrl}" style="color:#9DD3E4;text-decoration:none;">${safeUrl}</a>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 0 0;font-size:14px;line-height:22px;color:#B7AEB8;">
            This link expires in 24 hours.
          </td>
        </tr>
      </table>
    `,
  })
}

async function sendVerificationEmail({ to, displayName, verificationUrl }) {
  return sendMail({
    to,
    subject: 'Verify your Velve email',
    html: verificationHtml({ displayName, verificationUrl }),
    text: [
      `Hi ${displayName || 'there'},`,
      '',
      'Confirm your email to finish entering Velve.',
      'Once you are in, you will be able to set up your profile, build your closet,',
      'save pieces, and start sending trade or buy offers.',
      '',
      `Verify here: ${verificationUrl}`,
      '',
      'This link expires in 24 hours.',
      '',
      `Questions: ${DEFAULT_REPLY_TO}`,
      '',
      '- Velve',
    ].join('\n'),
  })
}

module.exports = {
  sendMail,
  sendWaitlistConfirmation,
  sendVerificationEmail,
  __resetTransporterCache: () => {
    cachedTransporter = null
    cachedConfigured = null
  },
}
