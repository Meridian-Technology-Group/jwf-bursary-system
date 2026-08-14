/**
 * ContactBursaryTeam — the Foundation's contact line, rendered the one way
 * (CF-31).
 *
 * The portal used to say "contact the Foundation" in several places without
 * naming a channel, and parents phoned. The Foundation asked for a specific
 * sentence and a specific address; both live in `guidance-content.ts` so this
 * is presentation only. Renders as a sentence fragment — callers supply the
 * lead-in ("If you believe this is an error, …") and the full stop.
 *
 * No `"use client"`: it is markup with no state, so it works inside server and
 * client components alike.
 */

import {
  BURSARIES_CONTACT_EMAIL,
  CONTACT_BURSARY_TEAM_COPY,
} from "@/lib/portal/guidance-content";
import { cn } from "@/lib/utils";

/** The copy minus the address, which is rendered as a link. */
const LEAD_IN = CONTACT_BURSARY_TEAM_COPY.replace(
  ` ${BURSARIES_CONTACT_EMAIL}`,
  ""
);

export function ContactBursaryTeam({
  linkClassName,
}: {
  /** Link colour for the surface this sits on (rose on the lockout, etc.). */
  linkClassName?: string;
}) {
  return (
    <>
      {LEAD_IN}{" "}
      <a
        href={`mailto:${BURSARIES_CONTACT_EMAIL}`}
        className={cn(
          "font-medium underline underline-offset-2",
          linkClassName ?? "text-accent-700 hover:text-accent-800"
        )}
      >
        {BURSARIES_CONTACT_EMAIL}
      </a>
    </>
  );
}
