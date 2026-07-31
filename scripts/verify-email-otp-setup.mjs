#!/usr/bin/env node
/**
 * Operator check: Email OTP prerequisites (public Auth settings + env).
 * Does not read/print secrets beyond presence; does not send mail.
 *
 * Usage: node --env-file=.env scripts/verify-email-otp-setup.mjs
 */
const url = process.env.SUPABASE_URL || "";
const key = process.env.SUPABASE_ANON_KEY || "";

const fail = (msg) => {
  console.error(`FAIL  ${msg}`);
  process.exitCode = 1;
};
const ok = (msg) => console.log(`OK    ${msg}`);
const warn = (msg) => console.log(`WARN  ${msg}`);

if (!url.startsWith("https://") || url.includes("YOUR_PROJECT")) {
  fail("SUPABASE_URL missing or placeholder");
} else {
  ok(`SUPABASE_URL set (${new URL(url).host})`);
}
if (!key || key.startsWith("your_") || key.length < 40) {
  fail("SUPABASE_ANON_KEY missing or placeholder");
} else {
  ok("SUPABASE_ANON_KEY set");
}

const expectedRedirects = [
  "http://localhost:5173/",
  "http://127.0.0.1:5173/",
  "https://zaikopewpew.github.io/obratka/",
];

if (!url || !key || process.exitCode === 1) {
  console.log("\nSkipping Auth settings probe.");
  process.exit(process.exitCode || 1);
}

const res = await fetch(`${url.replace(/\/$/, "")}/auth/v1/settings`, {
  headers: { apikey: key, Authorization: `Bearer ${key}` },
});
if (!res.ok) {
  fail(`Auth settings HTTP ${res.status}`);
  process.exit(1);
}
const settings = await res.json();
const emailOn = settings?.external?.email === true;
const googleOn = settings?.external?.google === true;
const autoconfirm = settings?.mailer_autoconfirm === true;
const signupDisabled = settings?.disable_signup === true;

if (emailOn) ok("Email provider enabled (external.email)");
else fail("Email provider disabled — Dashboard → Auth → Providers → Email");

if (googleOn) ok("Google provider enabled");
else warn("Google provider off (ok if Email-only)");

if (signupDisabled) fail("Signups disabled (disable_signup)");
else ok("Signups allowed");

if (autoconfirm) {
  ok("mailer_autoconfirm=true (Confirm email off) — OTP via Magic Link");
} else {
  warn(
    "mailer_autoconfirm=false — new signup often gets Confirm signup template; ensure {{ .Token }} is in Confirm signup AND Magic Link (see auth-screen/README.md)",
  );
}

console.log("\nManual Dashboard checklist:");
console.log("  [ ] Email Templates → Magic Link contains {{ .Token }}");
console.log("  [ ] Email Templates → Confirm signup contains {{ .Token }}");
console.log("  [ ] Redirect URLs include:");
for (const r of expectedRedirects) console.log(`      - ${r}`);
console.log("  [ ] Before traffic spike: custom SMTP + Email OTP rate limit (SECURITY.md)");
console.log("\nDone.");
