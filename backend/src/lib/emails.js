// src/lib/emailTemplates.js
const BRAND = {
    product: "Astrae",
    supportEmail: "support@astrae.no",
    footerText: "© " + new Date().getFullYear() + " Astrae — All rights reserved.",
    accent: "#7c3aed",     // purple
    text: "#111827",       // gray-900
    soft: "#f3f4f6",       // gray-100
    border: "#e5e7eb",     // gray-200
    link: "#7c3aed",
    bg: "#ffffff",
    logoUrl: process.env.APP_LOGO_URL || null, // optional: set to a hosted image URL
};

function baseHtml({ title, bodyHtml }) {
    // Keep it simple and inline styles so it renders well in most clients
    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="color-scheme" content="light only">
  <meta name="supported-color-schemes" content="light only">
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.soft};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.soft};padding:32px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:${BRAND.bg};border:1px solid ${BRAND.border};border-radius:12px;overflow:hidden;">
          <tr>
            <td style="padding:20px 24px;border-bottom:1px solid ${BRAND.border};">
              <div style="display:flex;align-items:center;gap:12px;">
                ${BRAND.logoUrl ? `<img src="${BRAND.logoUrl}" alt="${escapeHtml(BRAND.product)}" height="28" style="display:block;border:0;" />` : ""}
                <span style="font:600 16px/1.2 system-ui, -apple-system, Segoe UI, Roboto; color:${BRAND.text};">${escapeHtml(BRAND.product)}</span>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 24px; color:${BRAND.text}; font:400 15px/1.6 system-ui, -apple-system, Segoe UI, Roboto;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:18px 24px; border-top:1px solid ${BRAND.border}; color:#6b7280; font:400 12px/1.5 system-ui, -apple-system, Segoe UI, Roboto;">
              <div>${escapeHtml(BRAND.footerText)}</div>
              <div style="margin-top:6px;">Need help? <a href="mailto:${BRAND.supportEmail}" style="color:${BRAND.link};text-decoration:none;">${BRAND.supportEmail}</a></div>
            </td>
          </tr>
        </table>
        <div style="height:24px"></div>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function button({ href, label }) {
    return `<a href="${escapeAttr(href)}"
    style="display:inline-block;background:${BRAND.accent};color:#fff;text-decoration:none;font:600 14px/1 system-ui,-apple-system,Segoe UI,Roboto;padding:12px 18px;border-radius:8px;">
    ${escapeHtml(label)}
  </a>`;
}

function plainTextFallback({ heading, intro, actionLabel, actionUrl, outro }) {
    return [
        heading,
        "",
        intro,
        "",
        `${actionLabel}: ${actionUrl}`,
        "",
        outro,
        "",
        BRAND.footerText
    ].join("\n");
}

function verifyEmailTemplate({ username, verifyUrl }) {
    const heading = "Verify your email";
    const intro = `Hi ${username}, thanks for signing up! Please verify your email to activate your account.`;
    const actionLabel = "Verify my account";
    const actionUrl = verifyUrl;
    const outro = "If you didn’t request this, you can ignore this email.";

    const bodyHtml = `
    <h1 style="margin:0 0 12px 0;font:700 22px system-ui,-apple-system,Segoe UI,Roboto;">${escapeHtml(heading)}</h1>
    <p style="margin:0 0 16px 0;">${escapeHtml(intro)}</p>
    <div style="margin:16px 0 22px 0;">${button({ href: actionUrl, label: actionLabel })}</div>
    <p style="margin:0 0 12px 0;color:#6b7280;">Or paste this link in your browser:</p>
    <p style="margin:0 0 18px 0;"><a style="color:${BRAND.link};word-break:break-all;" href="${escapeAttr(actionUrl)}">${escapeHtml(actionUrl)}</a></p>
    <p style="margin:0;">${escapeHtml(outro)}</p>
  `;

    return {
        subject: "Verify your Astrae account",
        html: baseHtml({ title: "Verify your email", bodyHtml }),
        text: plainTextFallback({ heading, intro, actionLabel, actionUrl, outro }),
    };
}

function resetPasswordTemplate({ username, resetUrl }) {
    const heading = "Reset your password";
    const intro = `Hi ${username}, you requested a password reset. Click the button below to continue.`;
    const actionLabel = "Reset password";
    const actionUrl = resetUrl;
    const outro = "This link expires in 1 hour. If you didn’t request this, just ignore this email.";

    const bodyHtml = `
    <h1 style="margin:0 0 12px 0;font:700 22px system-ui,-apple-system,Segoe UI,Roboto;">${escapeHtml(heading)}</h1>
    <p style="margin:0 0 16px 0;">${escapeHtml(intro)}</p>
    <div style="margin:16px 0 22px 0;">${button({ href: actionUrl, label: actionLabel })}</div>
    <p style="margin:0 0 12px 0;color:#6b7280;">Or paste this link in your browser:</p>
    <p style="margin:0 0 18px 0;"><a style="color:${BRAND.link};word-break:break-all;" href="${escapeAttr(actionUrl)}">${escapeHtml(actionUrl)}</a></p>
    <p style="margin:0;">${escapeHtml(outro)}</p>
  `;

    return {
        subject: "Reset your Astrae password",
        html: baseHtml({ title: "Reset password", bodyHtml }),
        text: plainTextFallback({ heading, intro, actionLabel, actionUrl, outro }),
    };
}

function escapeHtml(s = "") {
    return String(s)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;")
        .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function escapeAttr(s = "") {
    return String(s).replace(/"/g, "&quot;");
}

export {
    verifyEmailTemplate,
    resetPasswordTemplate,
};
