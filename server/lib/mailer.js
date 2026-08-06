// Transactional email via Resend's HTTP API — one fetch call, no SDK.
//
// Enabled only when RESEND_API_KEY is set. Without it, sendMail is a no-op and
// callers fall back to the existing behaviour (log the link server-side, and in
// dev surface it on-screen). So the app runs fine with or without email wired.
//
// Get a free key at https://resend.com → API Keys. On the free tier the shared
// sender `onboarding@resend.dev` only delivers to YOUR OWN account email; to
// email anyone, verify a domain and set MAIL_FROM to a sender on it.

const API = "https://api.resend.com/emails";
const FROM = process.env.MAIL_FROM || "Good Steward <onboarding@resend.dev>";

export function mailerEnabled() {
  return !!process.env.RESEND_API_KEY;
}

// The public origin, for absolute links in emails. Render sets
// RENDER_EXTERNAL_URL automatically; APP_URL overrides it if set.
export function siteUrl() {
  const raw =
    process.env.APP_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    `http://localhost:${process.env.PORT || 8787}`;
  return raw.replace(/\/$/, "");
}

export async function sendMail({ to, subject, html, text }) {
  if (!mailerEnabled()) return { sent: false, reason: "disabled" };
  try {
    const r = await fetch(API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: FROM, to: [to], subject, html, text }),
    });
    if (!r.ok) {
      const detail = await r.text().catch(() => "");
      console.error(`mail: Resend ${r.status} — ${detail.slice(0, 300)}`);
      return { sent: false, reason: `resend_${r.status}` };
    }
    const data = await r.json().catch(() => ({}));
    return { sent: true, id: data.id ?? null };
  } catch (err) {
    console.error("mail: send failed —", err.message);
    return { sent: false, reason: "network" };
  }
}

// ── Templates ───────────────────────────────────────────────────────────────
// Inline styles only — email clients strip <style> and external CSS.
const PINE = "#14271F", BRASS = "#B48A4A", CREAM = "#F3EEE2", INK = "#2C332E", MUTED = "#6B7168";

function layout({ heading, lead, buttonLabel, url, footer }) {
  return `<!doctype html><html><body style="margin:0;background:${CREAM};padding:32px 0;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#FBF8F0;border:1px solid #E4DDCB;border-radius:20px;overflow:hidden">
      <tr><td style="padding:32px 34px 8px">
        <div style="font-family:Georgia,'Times New Roman',serif;font-size:19px;font-weight:600;color:${PINE};letter-spacing:-0.01em">Good Steward</div>
      </td></tr>
      <tr><td style="padding:8px 34px 4px">
        <h1 style="font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:500;color:${PINE};margin:0 0 10px;letter-spacing:-0.01em">${heading}</h1>
        <p style="font-size:15px;line-height:1.55;color:${INK};margin:0 0 22px">${lead}</p>
        <a href="${url}" style="display:inline-block;background:${PINE};color:#F7F3E9;text-decoration:none;font-size:15px;font-weight:600;padding:13px 26px;border-radius:12px">${buttonLabel}</a>
        <p style="font-size:12.5px;line-height:1.5;color:${MUTED};margin:22px 0 0">${footer}</p>
        <p style="font-size:11.5px;line-height:1.5;color:${MUTED};margin:14px 0 0;word-break:break-all">Or paste this link into your browser:<br><a href="${url}" style="color:${BRASS}">${url}</a></p>
      </td></tr>
      <tr><td style="padding:22px 34px 30px">
        <div style="border-top:1px solid #E4DDCB;padding-top:16px;font-size:11px;color:${MUTED}">Good Steward — a stewardship layer for your money. Sandbox demo; no real funds move.</div>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

export function resetEmail(url) {
  return {
    subject: "Reset your Good Steward password",
    html: layout({
      heading: "Reset your password",
      lead: "We got a request to reset the password on your Good Steward account. Click below to choose a new one.",
      buttonLabel: "Choose a new password",
      url,
      footer: "This link expires in 30 minutes and can be used once. If you didn't ask for this, you can safely ignore this email — your password won't change.",
    }),
    text: `Reset your Good Steward password.\n\nOpen this link to choose a new password (expires in 30 minutes, single use):\n${url}\n\nIf you didn't request this, ignore this email.`,
  };
}

export function verifyEmail(url) {
  return {
    subject: "Verify your email for Good Steward",
    html: layout({
      heading: "Verify your email",
      lead: "Confirm this address to secure your Good Steward account.",
      buttonLabel: "Verify my email",
      url,
      footer: "This link expires in 24 hours. If you didn't create a Good Steward account, you can ignore this email.",
    }),
    text: `Verify your email for Good Steward.\n\nOpen this link to confirm your address (expires in 24 hours):\n${url}\n\nIf you didn't create an account, ignore this email.`,
  };
}
