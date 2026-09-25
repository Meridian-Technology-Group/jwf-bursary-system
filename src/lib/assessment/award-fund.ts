/**
 * Epic 18b — which funds can pay an award at each school (Charlotte,
 * 6 Sep 2026): "Whitgift School will have three possible award types: a JWF
 * bursary award or a WSP-JWF bursary award or a WFA bursary award. Trinity
 * School will have two possible award types: a JWF bursary award or a TBF
 * bursary award."
 *
 * The fund is chosen at the lock (New Award / Rolled-over) and recorded per
 * assessment year — it can change year to year on the same account. Pure
 * module: no DB, no React.
 */

import type { AwardFundType, School } from "@prisma/client";

export const AWARD_FUND_LABELS: Record<AwardFundType, string> = {
  JWF: "JWF bursary",
  WSP_JWF: "WSP-JWF bursary",
  WFA: "WFA bursary",
  TBF: "TBF bursary",
};

/** The funds offerable at a school, in display order (JWF first everywhere). */
export function awardFundOptionsForSchool(school: School): AwardFundType[] {
  switch (school) {
    case "WHITGIFT":
      return ["JWF", "WSP_JWF", "WFA"];
    case "TRINITY":
      return ["JWF", "TBF"];
    case "OP_PARTNER":
      // GT migration: Old Palace awards are paid from the Foundation's fund.
      return ["JWF"];
  }
}

/** Whether a fund is a legal choice for the school. */
export function isAwardFundValidForSchool(
  fund: AwardFundType,
  school: School
): boolean {
  return awardFundOptionsForSchool(school).includes(fund);
}
