// src/app/api/webhooks/resend/route.ts
// Webhook handler for Resend delivery event callbacks.
//
// Resend sends a POST request to this endpoint whenever an email changes
// delivery state (delivered, bounced, complained, etc.).
//
// Resend signs webhook payloads using the Svix library, and this handler
// verifies that signature before processing any event. The signing secret
// comes from the Resend dashboard (Webhooks > endpoint > Signing Secret) and
// must be set as RESEND_WEBHOOK_SECRET. When that secret is unset, or the
// Svix signature headers are missing/invalid, the request is rejected with
// 401 (see the verification block in POST below). The `svix` package is
// already a dependency.
//
// This project runs a single Resend environment with one webhook endpoint
// pointed at the production URL, so RESEND_WEBHOOK_SECRET is set in the
// Vercel Production scope only. See docs/operations/environment-variables.md.
//
// Once the signature is verified, the handler logs the event and returns 200.
// Delivery webhooks carry no PII beyond the email address (hashed before
// logging) and the message ID, and are idempotent.
//
// Local/preview setup:
//   1. Add RESEND_WEBHOOK_SECRET=whsec_... to .env.local
//   2. Point a Resend webhook endpoint at your local/preview URL.

import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { hashEmail, logInfo } from "@/lib/log";

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
  const firstTo =
    Array.isArray(data.to) && data.to.length > 0 ? data.to[0] : undefined;

  logInfo("resend.webhook", {
    type,
    messageId: data.email_id,
    recipientHash: firstTo ? hashEmail(firstTo) : undefined,
  });
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

  // ── Svix signature verification ───────────────────────────────────────────
  // Resend signs webhook payloads using Svix. RESEND_WEBHOOK_SECRET must be
  // set in production; unsigned/invalid events are rejected with 401.
  // See docs/security-audit.md §2.15.
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error(
      "[resend/webhook] RESEND_WEBHOOK_SECRET is not configured — rejecting event"
    );
    return NextResponse.json(
      { error: "Webhook verification not configured" },
      { status: 401 }
    );
  }

  const svixId = request.headers.get("svix-id");
  const svixTimestamp = request.headers.get("svix-timestamp");
  const svixSignature = request.headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json(
      { error: "Missing Svix signature headers" },
      { status: 401 }
    );
  }

  try {
    const wh = new Webhook(webhookSecret);
    wh.verify(rawBody, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    });
  } catch {
    return NextResponse.json(
      { error: "Invalid webhook signature" },
      { status: 401 }
    );
  }
  // ── End signature verification block ─────────────────────────────────────

  // Validate payload structure.
  const payload = parsePayload(rawBody);

  if (!payload) {
    logInfo("resend.webhook.invalid", { bodyLength: rawBody.length });
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
