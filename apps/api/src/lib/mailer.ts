import nodemailer from 'nodemailer'

function createTransport() {
  const host = process.env['SMTP_HOST']
  if (!host) return null

  return nodemailer.createTransport({
    host,
    port: Number(process.env['SMTP_PORT'] ?? 587),
    secure: process.env['SMTP_SECURE'] === 'true',
    auth: process.env['SMTP_USER']
      ? { user: process.env['SMTP_USER'], pass: process.env['SMTP_PASS'] }
      : undefined,
  })
}

export async function sendVerificationEmail(to: string, token: string): Promise<void> {
  const appUrl = process.env['APP_URL'] ?? 'http://localhost:3000'
  const url = `${appUrl}/verify-email?token=${token}`
  const transport = createTransport()

  if (!transport) {
    // Dev fallback: log to console when SMTP is not configured
    console.log(`[mailer] Verification email for ${to}:\n  ${url}`)
    return
  }

  await transport.sendMail({
    from: process.env['SMTP_FROM'] ?? 'noreply@kanban.local',
    to,
    subject: 'Verify your email address',
    text: `Please verify your email by visiting: ${url}\n\nThis link expires in 24 hours.`,
    html: `
      <p>Welcome! Please verify your email address to activate your account.</p>
      <p><a href="${url}" style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">Verify email</a></p>
      <p style="color:#6b7280;font-size:12px;">Or copy this link: ${url}<br>This link expires in 24 hours.</p>
    `,
  })
}

export async function sendPasswordResetEmail(to: string, token: string): Promise<void> {
  const appUrl = process.env['APP_URL'] ?? 'http://localhost:3000'
  const url = `${appUrl}/reset-password?token=${token}`
  const transport = createTransport()

  if (!transport) {
    console.log(`[mailer] Password reset email for ${to}:\n  ${url}`)
    return
  }

  await transport.sendMail({
    from: process.env['SMTP_FROM'] ?? 'noreply@kanban.local',
    to,
    subject: 'Reset your password',
    text: `Reset your password by visiting: ${url}\n\nThis link expires in 1 hour. If you did not request a reset, ignore this email.`,
    html: `
      <p>Someone requested a password reset for your account.</p>
      <p><a href="${url}" style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">Reset password</a></p>
      <p style="color:#6b7280;font-size:12px;">Or copy this link: ${url}<br>This link expires in 1 hour. If you did not request a reset, ignore this email.</p>
    `,
  })
}
