// src/lib/email/resend.ts
// Resend client singleton for the JWF Bursary Assessment System.

import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;

if (!apiKey) {
  throw new Error(
    "RESEND_API_KEY environment variable is not set. " +
      "Add it to your .env.local file before starting the server."
  );
}

/**
 * Singleton Resend client.
 * Import this wherever you need to call the Resend API rather than
 * constructing a new Resend() each time.
 */
export const resend = new Resend(apiKey);
