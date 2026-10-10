const { isValidEmail } = require('./auth');

const EMAIL_ERROR_MESSAGE = "This email does not exist or cannot receive emails. Please use another one.";

/**
 * Send 6-digit verification code to the recipient email
 * @param {string} email
 * @param {string} code
 * @returns {Promise<{ ok: boolean, error?: string, devCode?: string }>}
 */
async function sendVerificationEmail(email, code) {
  if (!isValidEmail(email)) {
    return { ok: false, error: EMAIL_ERROR_MESSAGE };
  }

  const cleanEmail = String(email).trim().toLowerCase();

  // If Resend API key is configured, send real email via Resend
  const resendApiKey = process.env.RESEND_API_KEY;
  const emailFrom = process.env.EMAIL_FROM || 'InsuMinder <onboarding@resend.dev>';

  if (resendApiKey) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: emailFrom,
          to: cleanEmail,
          subject: `InsuMinder Verification Code: ${code}`,
          text: `Welcome to InsuMinder!\n\nYour 6-digit registration verification code is:\n${code}\n\nThis code will expire in 10 minutes. If you did not request this, please disregard this email.`,
          html: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
            <h2 style="color: #0284c7; margin-top: 0;">InsuMinder</h2>
            <p style="color: #334155; font-size: 16px;">Welcome! Use the verification code below to complete your registration:</p>
            <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 16px; text-align: center; margin: 24px 0;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #0369a1; font-family: monospace;">${code}</span>
            </div>
            <p style="color: #64748b; font-size: 14px;">⏱️ This verification code is valid for <strong>10 minutes</strong>.</p>
            <p style="color: #94a3b8; font-size: 12px; margin-bottom: 0;">If you did not request this code, you can safely ignore this email.</p>
          </div>`
        }),
        signal: AbortSignal.timeout(10000)
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || (data && data.error)) {
        return { ok: false, error: EMAIL_ERROR_MESSAGE };
      }

      return { ok: true };
    } catch {
      return { ok: false, error: EMAIL_ERROR_MESSAGE };
    }
  }

  // Development mode / local testing fallback:
  // Detect test emails designed to simulate invalid/unreachable mailboxes
  const domain = cleanEmail.split('@')[1] || '';
  if (
    cleanEmail.includes('invalid') ||
    cleanEmail.includes('bounce') ||
    cleanEmail.includes('nonexistent') ||
    domain.includes('fake') ||
    domain.includes('example.invalid')
  ) {
    return { ok: false, error: EMAIL_ERROR_MESSAGE };
  }

  // Log code to server console for easy developer testing
  console.log(`[InsuMinder Auth] Verification code for ${cleanEmail}: ${code} (Expires in 10m)`);

  return {
    ok: true,
    devCode: code // Exposed in dev/local mode so users can verify without waiting for an email provider
  };
}

/**
 * Send share invitation email to recipient
 * @param {string} recipientEmail
 * @param {string} ownerName
 * @param {string} ownerEmail
 * @param {string} shareCode
 * @param {string} inviteUrl
 * @returns {Promise<{ ok: boolean, error?: string, inviteUrl?: string }>}
 */
async function sendShareInviteEmail(recipientEmail, ownerName, ownerEmail, shareCode, inviteUrl) {
  if (!isValidEmail(recipientEmail)) {
    return { ok: false, error: EMAIL_ERROR_MESSAGE };
  }

  const cleanEmail = String(recipientEmail).trim().toLowerCase();
  const resendApiKey = process.env.RESEND_API_KEY;
  const emailFrom = process.env.EMAIL_FROM || 'InsuMinder <onboarding@resend.dev>';
  const fromName = ownerName || ownerEmail || 'An InsuMinder user';

  if (resendApiKey) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: emailFrom,
          to: cleanEmail,
          subject: `${fromName} invited you to InsuMinder Shared Access`,
          text: `Hi there!\n\n${fromName} has invited you to view and manage their insulin injection reminders and logs on InsuMinder.\n\nYour Share Code: ${shareCode}\n\nJoin directly with this link:\n${inviteUrl}\n\nIf you did not expect this, you can disregard this email.`,
          html: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
            <h2 style="color: #0284c7; margin-top: 0;">InsuMinder Shared Access</h2>
            <p style="color: #334155; font-size: 16px;"><strong>${fromName}</strong> has invited you to view and manage their injection reminders and logs on InsuMinder.</p>
            <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 16px; text-align: center; margin: 24px 0;">
              <div style="font-size: 13px; color: #0284c7; font-weight: 600; text-transform: uppercase; margin-bottom: 6px;">Your Share Code</div>
              <span style="font-size: 24px; font-weight: bold; letter-spacing: 2px; color: #0369a1; font-family: monospace;">${shareCode}</span>
            </div>
            <div style="text-align: center; margin: 24px 0;">
              <a href="${inviteUrl}" style="display: inline-block; background: #0284c7; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; font-size: 15px;">Accept & Join Account</a>
            </div>
            <p style="color: #64748b; font-size: 13px;">Or sign up on InsuMinder and enter the Share Code in Settings.</p>
          </div>`
        }),
        signal: AbortSignal.timeout(10000)
      });

      const data = await response.json().catch(() => null);
      if (!response.ok || (data && data.error)) {
        return { ok: false, error: EMAIL_ERROR_MESSAGE };
      }
      return { ok: true, inviteUrl };
    } catch {
      return { ok: false, error: EMAIL_ERROR_MESSAGE };
    }
  }

  // Development mode / local testing fallback
  const domain = cleanEmail.split('@')[1] || '';
  if (
    cleanEmail.includes('invalid') ||
    cleanEmail.includes('bounce') ||
    cleanEmail.includes('nonexistent') ||
    domain.includes('fake') ||
    domain.includes('example.invalid')
  ) {
    return { ok: false, error: EMAIL_ERROR_MESSAGE };
  }

  console.log(`[InsuMinder Share] Invite sent to ${cleanEmail} for owner ${fromName} with code ${shareCode}: ${inviteUrl}`);

  return {
    ok: true,
    inviteUrl
  };
}

module.exports = {
  EMAIL_ERROR_MESSAGE,
  sendVerificationEmail,
  sendShareInviteEmail
};


