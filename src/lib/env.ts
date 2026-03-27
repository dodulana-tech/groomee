/**
 * Validate required environment variables at import time.
 * Import this module early (e.g., in lib/db.ts or layout.tsx) to fail fast.
 */

const required = [
  "DATABASE_URL",
  "JWT_SECRET",
  "PAYSTACK_SECRET_KEY",
] as const;

const optional = [
  "NEXT_PUBLIC_APP_URL",
  "PAYSTACK_WEBHOOK_SECRET",
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_PHONE_NUMBER",
  "TWILIO_WHATSAPP_NUMBER",
  "ADMIN_PHONES",
  "SMTP_HOST",
  "SMTP_USER",
  "SMTP_PASS",
  "CRON_SECRET",
  "SESSION_DURATION",
] as const;

const missing = required.filter((key) => !process.env[key]);

if (missing.length > 0) {
  throw new Error(
    `Missing required environment variables: ${missing.join(", ")}. ` +
    `Check your .env file or deployment config.`,
  );
}

// Warn about optional but important vars in production
if (process.env.NODE_ENV === "production") {
  const missingOptional = optional.filter((key) => !process.env[key]);
  if (missingOptional.length > 0) {
    console.warn(
      `[env] Missing optional env vars: ${missingOptional.join(", ")}`,
    );
  }
}

export {};
