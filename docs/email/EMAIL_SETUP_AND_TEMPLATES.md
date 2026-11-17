# Lerna AI — Production Email Setup & Branded Templates

This guide details the custom SMTP configuration, DNS records, and Supabase Auth email templates required for production deliverability of Lerna AI transactional emails.

---

## 1. Provider Setup: Resend SMTP

Lerna AI uses **Resend** as the primary transactional email delivery infrastructure.

### A. Resend Credentials
1. Create an account at [resend.com](https://resend.com).
2. Navigate to **API Keys** and generate a new key with **Sending access** (e.g., `re_abc123...`).
3. Add your sending domain (e.g., `uselerna.app` or `mail.uselerna.app`).

### B. Supabase Dashboard SMTP Configuration
In the **Supabase Dashboard** -> **Project Settings** -> **Authentication** -> **SMTP Settings**:
- **Enable Custom SMTP**: `ON`
- **Sender email**: `auth@uselerna.app` (or your verified domain sender)
- **Sender name**: `Lerna AI`
- **Host**: `smtp.resend.com`
- **Port**: `465` (SSL) or `587` (TLS)
- **Username**: `resend`
- **Password**: `<YOUR_RESEND_API_KEY>`
- **Minimum interval between emails**: `60` seconds

---

## 2. Domain Verification & DNS Records

Configure the following records in your DNS provider (Cloudflare, Namecheap, Route 53, etc.) for `uselerna.app`:

### A. SPF (Sender Policy Framework)
If using root domain:
- **Type**: `TXT`
- **Name**: `@` (or `uselerna.app`)
- **Value**: `v=spf1 include:resend.com ~all`

*(If you already have Google Workspace or other SPF records, merge them: e.g. `v=spf1 include:_spf.google.com include:resend.com ~all`)*

### B. DKIM (DomainKeys Identified Mail)
Resend will provide a dedicated DKIM record in your domain dashboard:
- **Type**: `CNAME` or `TXT` (as specified by Resend)
- **Name**: `resend._domainkey`
- **Value**: Provided by Resend domain verification screen

### C. DMARC (Domain-based Message Authentication, Reporting & Conformance)
- **Type**: `TXT`
- **Name**: `_dmarc`
- **Value**: `v=DMARC1; p=none; pct=100; rua=mailto:dmarc-reports@uselerna.app`

*(Start with `p=none` for monitoring. Upgrade to `p=quarantine` or `p=reject` once deliverability is established).*

---

## 3. Branded HTML Email Templates

These responsive templates use Lerna's dark theme palette (`#0B1120` canvas, `#1E293B` card, `#06B6D4` cyan accent, `#FFFFFF` text) and include security reminders.

Copy and paste these templates into **Supabase Dashboard** -> **Authentication** -> **Email Templates**.

---

### Template 1: Confirm Signup / Email Verification
**Subject:** `Verify your email for Lerna AI`

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirm Your Lerna AI Account</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0B1120; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #E2E8F0;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0B1120; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 520px; background-color: #111827; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 16px; padding: 36px 32px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);">
          <!-- Logo / Header -->
          <tr>
            <td align="left" style="padding-bottom: 24px; border-bottom: 1px solid rgba(255, 255, 255, 0.06);">
              <span style="font-size: 20px; font-weight: 700; color: #FFFFFF; letter-spacing: -0.5px;">Lerna<span style="color: #06B6D4;"> AI</span></span>
            </td>
          </tr>
          <!-- Body Content -->
          <tr>
            <td style="padding-top: 28px;">
              <h1 style="font-size: 22px; font-weight: 700; color: #FFFFFF; margin: 0 0 12px 0;">Welcome to Lerna!</h1>
              <p style="font-size: 14px; line-height: 22px; color: #94A3B8; margin: 0 0 24px 0;">
                Thanks for signing up. Please confirm your email address to activate your account and start your personalized AI tutoring workspace.
              </p>
              <!-- Primary Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 28px 0;">
                <tr>
                  <td align="center" style="border-radius: 10px; background-color: #06B6D4;">
                    <a href="{{ .ConfirmationURL }}" target="_blank" style="display: inline-block; padding: 13px 28px; font-size: 14px; font-weight: 600; color: #020617; text-decoration: none; border-radius: 10px; letter-spacing: -0.2px;">Verify Email Address</a>
                  </td>
                </tr>
              </table>
              <p style="font-size: 12px; line-height: 18px; color: #64748B; margin: 24px 0 0 0;">
                If the button above does not work, copy and paste this link into your browser:<br>
                <a href="{{ .ConfirmationURL }}" style="color: #06B6D4; text-decoration: underline; word-break: break-all;">{{ .ConfirmationURL }}</a>
              </p>
              <p style="font-size: 12px; line-height: 18px; color: #64748B; margin: 16px 0 0 0;">
                This link will expire in 24 hours. If you did not create an account with Lerna AI, you can safely ignore this email.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding-top: 32px; border-top: 1px solid rgba(255, 255, 255, 0.06); font-size: 11px; color: #475569; text-align: center;">
              &copy; 2026 Lerna AI. All rights reserved.<br>
              Secure Educational Intelligence Platform
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

---

### Template 2: Reset Password / Recovery
**Subject:** `Reset your password for Lerna AI`

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Lerna AI Password</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0B1120; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #E2E8F0;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0B1120; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 520px; background-color: #111827; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 16px; padding: 36px 32px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);">
          <!-- Header -->
          <tr>
            <td align="left" style="padding-bottom: 24px; border-bottom: 1px solid rgba(255, 255, 255, 0.06);">
              <span style="font-size: 20px; font-weight: 700; color: #FFFFFF; letter-spacing: -0.5px;">Lerna<span style="color: #06B6D4;"> AI</span></span>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding-top: 28px;">
              <h1 style="font-size: 22px; font-weight: 700; color: #FFFFFF; margin: 0 0 12px 0;">Password Reset Request</h1>
              <p style="font-size: 14px; line-height: 22px; color: #94A3B8; margin: 0 0 24px 0;">
                We received a request to reset the password for your Lerna AI account. Click the button below to choose a new, secure password.
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 28px 0;">
                <tr>
                  <td align="center" style="border-radius: 10px; background-color: #06B6D4;">
                    <a href="{{ .ConfirmationURL }}" target="_blank" style="display: inline-block; padding: 13px 28px; font-size: 14px; font-weight: 600; color: #020617; text-decoration: none; border-radius: 10px; letter-spacing: -0.2px;">Reset Password</a>
                  </td>
                </tr>
              </table>
              <p style="font-size: 12px; line-height: 18px; color: #64748B; margin: 24px 0 0 0;">
                If you did not request a password reset, no action is required. Your password remains safe and unchanged.
              </p>
              <div style="margin-top: 20px; padding: 14px; background-color: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 8px;">
                <p style="font-size: 11px; line-height: 16px; color: #FCA5A5; margin: 0;">
                  <strong>Security Note:</strong> This single-use link expires in 30 minutes. Never forward this email or share the link with anyone.
                </p>
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding-top: 32px; border-top: 1px solid rgba(255, 255, 255, 0.06); font-size: 11px; color: #475569; text-align: center;">
              &copy; 2026 Lerna AI. All rights reserved.<br>
              Account Security Operations
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

---

### Template 3: Email Change Confirmation
**Subject:** `Confirm change of email for Lerna AI`

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirm Your New Email Address</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0B1120; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #E2E8F0;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0B1120; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 520px; background-color: #111827; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 16px; padding: 36px 32px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);">
          <tr>
            <td align="left" style="padding-bottom: 24px; border-bottom: 1px solid rgba(255, 255, 255, 0.06);">
              <span style="font-size: 20px; font-weight: 700; color: #FFFFFF; letter-spacing: -0.5px;">Lerna<span style="color: #06B6D4;"> AI</span></span>
            </td>
          </tr>
          <tr>
            <td style="padding-top: 28px;">
              <h1 style="font-size: 22px; font-weight: 700; color: #FFFFFF; margin: 0 0 12px 0;">Confirm New Email Address</h1>
              <p style="font-size: 14px; line-height: 22px; color: #94A3B8; margin: 0 0 24px 0;">
                You recently requested to update your email address on Lerna AI. Click the button below to verify this new email address and complete the change.
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 28px 0;">
                <tr>
                  <td align="center" style="border-radius: 10px; background-color: #06B6D4;">
                    <a href="{{ .ConfirmationURL }}" target="_blank" style="display: inline-block; padding: 13px 28px; font-size: 14px; font-weight: 600; color: #020617; text-decoration: none; border-radius: 10px; letter-spacing: -0.2px;">Confirm Email Change</a>
                  </td>
                </tr>
              </table>
              <p style="font-size: 12px; line-height: 18px; color: #64748B; margin: 16px 0 0 0;">
                If you did not initiate this change, contact our security team immediately at <a href="mailto:security@uselerna.app" style="color: #06B6D4;">security@uselerna.app</a>.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding-top: 32px; border-top: 1px solid rgba(255, 255, 255, 0.06); font-size: 11px; color: #475569; text-align: center;">
              &copy; 2026 Lerna AI. All rights reserved.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```
