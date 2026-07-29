# Every email this system sends

Written 2026-07-29, in answer to a direct question: what mail does this project actually
send through Gmail? The short answer is **authentication mail only**. There is no
application email — no maintenance reminders, no repair alerts, no digests.

## Who sends it, and why the hosting choice is irrelevant

Mail is sent by **Supabase's Auth server**, not by this app and not by whatever host serves
the frontend.

```
browser  ──HTTPS──▶  Supabase Auth  ──SMTP:587──▶  smtp.gmail.com  ──▶  recipient
```

The browser calls `supabase.auth.resetPasswordForEmail(...)`, which is an ordinary HTTPS
request. Supabase's server is what opens the SMTP connection. Nothing in this repository
ever speaks SMTP — there is no backend server of ours in the path at all.

This matters because it settles a deployment question: **Vercel, Render, a static bucket,
or a container all behave identically for email.** A frontend host that "can't send SMTP"
cannot break this, because it is never asked to. `frontend/Dockerfile` exists as a
deployment option, not as a fix for an email problem.

## Configuration

`config.toml`'s `[auth.email.smtp]` — Gmail on port 587 with an app password, both supplied
as `env(...)` references resolved from the root `.env` at `config push` time.

Two settings that took a live incident each to get right:

- **`[auth.rate_limit] email_sent`** was left at the CLI default of `2` per hour until
  2026-07-29. That default is reasonable while no SMTP server is configured; with real
  recovery mail flowing it is an outage waiting to happen — the third person to forget their
  password within an hour simply gets nothing back. Now `30`, which is well under Gmail's
  ~500/day app-password ceiling.
- **`[auth.email] max_frequency`** was `1s`. Anyone holding down a resend button could
  exhaust the hourly allowance in seconds, and then the daily Gmail quota — a denial of
  service against this project's own password recovery, available from the public login
  page. Now `60s`.

Also fixed 2026-07-29: `GOOGLE_APP_PASSWORD` in the root `.env` was stored in the format
Google *displays* it, in four space-separated groups. SMTP AUTH takes the 16 characters with
no spaces. The spaces were stripped and `config push` confirmed the change reached the live
project (the stored password hash changed). This is the most likely explanation for why
inbox delivery had never been confirmed before that date despite the API accepting the call.

## The complete list

| Email | Trigger | Status |
| --- | --- | --- |
| **Invite** | `bootstrap-user.mjs` calling `inviteUserByEmail` when provisioning a roster entry | **Active.** The default account-creation path. |
| **Password recovery** | The user submitting the forgot-password form (`resetPasswordForEmail`) | **Active.** The only email an ordinary user can trigger themselves. |
| **Email change confirmation** | A user changing their address. `double_confirm_changes = true`, so both the old and new address are mailed | **Reachable but unused** — no screen offers an address change today. |
| **Signup confirmation** | New self-registration | **Never sent.** `[auth] enable_signup = false`; only the bootstrap script creates accounts. `enable_confirmations` is also false. |
| **Magic link** | `signInWithOtp` | **Never sent.** The app only ever calls `signInWithPassword`. |
| **Reauthentication OTP** | A password change requiring reauthentication | **Never sent.** `secure_password_change = false`. |

Templates are Supabase's defaults; `config.toml`'s `[auth.email.template.*]` blocks are all
commented out. The `sender_name` is "SAIL Plant Maintenance"; the from-address is whatever
`SENDER_GMAIL` holds, which is a personal Gmail account rather than a plant-owned domain —
worth changing before this is anything but internal, since recipients see that address.

## What is *not* emailed

The bell menu's notifications — maintenance overdue, maintenance due soon, open repairs —
are derived in the browser from records already on screen (`frontend/src/lib/notifications.ts`)
and are never sent anywhere. Nothing is stored and nothing is delivered; a notification exists
exactly as long as the condition that produced it.

Emailing those was considered and deliberately deferred on 2026-07-29. It is real work, not a
setting: it needs a scheduled server-side job (nothing in a browser can run while people are
asleep), a decision on frequency and recipients, and headroom in the Gmail quota that a
personal app password does not comfortably provide for a plant-sized roster.

## Before production

- **Add the deployed origin to `site_url` / `additional_redirect_urls`.** Supabase validates
  `redirectTo` against them and silently falls back to `site_url` on a mismatch, so a
  recovery link sent to a production user would otherwise point at `localhost`. The mail
  arrives, the link is useless, and nothing reports an error.
- **Confirm inbox delivery once, for real.** A successful API call is not delivery; Gmail can
  still classify the message as spam. As of this writing a recovery email has been accepted
  by Supabase (a 4-second round trip, consistent with a completed SMTP handshake) but
  **arrival in the inbox has not been confirmed by a recipient**.
- **Move off a personal Gmail account** if this outlives its current scope. App passwords are
  tied to one person's account, carry that person's quota, and stop working the moment their
  password changes or 2FA is reset.
