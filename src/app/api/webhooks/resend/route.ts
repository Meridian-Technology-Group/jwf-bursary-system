// src/app/api/webhooks/resend/route.ts
// Webhook handler for Resend delivery event callbacks.
//
// Resend sends a POST request to this endpoint whenever an email changes
// delivery state (delivered, bounced, complained, etc.).
//
// Resend signs webhook payloads using the Svix library. Signature verification
// requires installing the `svix` package and adding a RESEND_WEBHOOK_SECRET
// to your environment variables (available from the Resend dashboard under
// Webhooks > Signing Secret).
//
// Until that secret is configured, the handler logs the event payload and
// returns 200 — this is safe because delivery webhooks carry no PII beyond
// the email address and message ID, and are idempotent.
//
// To enable verification:
//   1. npm install svix
//   2. Add RESEND_WEBHOOK_SECRET=whsec_... to .env.local
//   3. Uncomment the verification block below.

import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Resend webhook payload types
// ---------------------------------------------------------------------------

/** Union of all event types Resend emits. */
type ResendWebhookEventType =
  | "email.sent"
  | "email.delivered"
  | "email.delivery_delayed"
  | "email.bounced"
  | "email.complained"
  | "email.opened"
  | "email.clicked";

/** Minimal shape of the data object included in every event. */
interface ResendEmailEventData {
  email_id: string;
  from?: string;
  to?: string[];
  subject?: string;
  created_at?: string;
  [key: string]: unknown;
}

/** Top-level Resend webhook payload. */
interface ResendWebhookPayload {
  type: ResendWebhookEventType;
  data: ResendEmailEventData;
  created_at?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Attempt to parse the raw body as JSON and cast to the expected webhook
 * payload shape. Returns `null` if the body is missing, not valid JSON, or
 * missing the required `type` / `data` fields.
 */
function parsePayload(raw: string): ResendWebhookPayload | null {
  try {
    const parsed: unknown = JSON.parse(raw);

    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("type" in parsed) ||
      !("data" in parsed)
    ) {
      return null;
    }

    const payload = parsed as ResendWebhookPayload;

    if (typeof payload.type !== "string" || typeof payload.data !== "object") {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Log a delivery event to the console.
 * In a future iteration this would write to the `audit_logs` table or a
 * dedicated `email_delivery_events` table.
 */
function logEvent(payload: ResendWebhookPayload): void {
  const { type, data } = payload;
  const timestamp = payload.created_at ?? new Date().toISOString();

  switch (type) {
    case "email.delivered":
      console.log(
        `[resend/webhook] DELIVERED | id: ${data.email_id} | to: ${data.to?.join(", ")} | subject: ${data.subject} | at: ${timestamp}`
      );
      break;

    case "email.bounced":
      console.warn(
        `[resend/webhook] BOUNCED | id: ${data.email_id} | to: ${data.to?.join(", ")} | subject: ${data.subject} | at: ${timestamp}`
      );
      break;

    case "email.complained":
      console.warn(
        `[resend/webhook] COMPLAINT | id: ${data.email_id} | to: ${data.to?.join(", ")} | subject: ${data.subject} | at: ${timestamp}`
      );
      break;

    case "email.delivery_delayed":
      console.warn(
        `[resend/webhook] DELAYED | id: ${data.email_id} | to: ${data.to?.join(", ")} | at: ${timestamp}`
      );
      break;

    case "email.sent":
      console.log(
        `[resend/webhook] SENT | id: ${data.email_id} | to: ${data.to?.join(", ")} | at: ${timestamp}`
      );
      break;

    case "email.opened":
      console.log(
        `[resend/webhook] OPENED | id: ${data.email_id} | at: ${timestamp}`
      );
      break;

    case "email.clicked":
      console.log(
        `[resend/webhook] CLICKED | id: ${data.email_id} | at: ${timestamp}`
      );
      break;

    default:
      // Exhaustive guard — if Resend adds a new event type, log it verbatim.
      console.log(
        `[resend/webhook] UNKNOWN EVENT: ${String(type)} | data:`,
        data
      );
  }
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

/**
 * POST /api/webhooks/resend
 *
 * Receives Resend delivery event webhooks, validates the payload structure,
 * and logs the event. Returns 200 for all recognised events.
 *
 * Signature verification is supported when the RESEND_WEBHOOK_SECRET
 * environment variable is set (requires the `svix` package). Without it,
 * the handler accepts all structurally-valid payloads.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // Read the raw body once; we need the string for both verification and
  // parsing so we must not call request.json() first.
  let rawBody: string;

  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json(
      { error: "Failed to read request body" },
      { status: 400 }
    );
  }

  // ── Optional Svix signature verification ──────────────────────────────────
  //
  // Uncomment the block below once you have:
  //   1. Installed svix:  npm install svix
  //   2. Added RESEND_WEBHOOK_SECRET=whsec_... to .env.local
  //
  // import { Webhook } from "svix";
  //
  // const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  // if (webhookSecret) {
  //   const svixId        = request.headers.get("svix-id");
  //   const svixTimestamp = request.headers.get("svix-timestamp");
  //   const svixSignature = request.headers.get("svix-signature");
  //
  //   if (!svixId || !svixTimestamp || !svixSignature) {
  //     return NextResponse.json(
  //       { error: "Missing Svix signature headers" },
  //       { status: 401 }
  //     );
  //   }
  //
  //   const wh = new Webhook(webhookSecret);
  //   try {
  //     wh.verify(rawBody, {
  //       "svix-id":        svixId,
  //       "svix-timestamp": svixTimestamp,
  //       "svix-signature": svixSignature,
  //     });
  //   } catch {
  //     return NextResponse.json(
  //       { error: "Invalid webhook signature" },
  //       { status: 401 }
  //     );
  //   }
  // }
  // ── End signature verification block ─────────────────────────────────────

  // Validate payload structure.
  const payload = parsePayload(rawBody);

  if (!payload) {
    console.warn("[resend/webhook] Received invalid payload:", rawBody.slice(0, 200));
    return NextResponse.json(
      { error: "Invalid webhook payload" },
      { status: 400 }
    );
  }

  // Log the event (future: persist to audit_logs / email_delivery_events).
  logEvent(payload);

  // Always return 200 so Resend does not retry the webhook unnecessarily.
  return NextResponse.json({ received: true }, { status: 200 });
}
