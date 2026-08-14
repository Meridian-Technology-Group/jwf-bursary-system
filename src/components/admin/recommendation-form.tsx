"use client";

/**
 * Recommendation form (Epic 08 — real award terminology & outcome).
 *
 * The assessor reviews the assessment fee summary, records:
 *  - the recommendation context (accommodation, income category, property cat),
 *  - the single editable synopsis (Epic 06),
 *  - reason codes,
 *  - a distinct SCHOLARSHIP AWARD (£) alongside the calculated bursary (D9),
 * and confirms a THREE-WAY award decision in the Foundation's own language:
 *  - Award (the panel's "Approved Bursary"),
 *  - Qualifies — not awarded (eligible but not granted this round),
 *  - Decline (the panel's "Declined Bursary").
 *
 * Sibling context and an options comparison are surfaced read-only so the
 * assessor sees and confirms the chosen scenario rather than inheriting one
 * opaque number.
 *
 * The form is read-only once a terminal outcome has been recorded on the
 * assessment (Epic 01's AssessmentOutcome) — EXCEPT the synopsis, which Epic 06
 * keeps editable after completion.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Save,
  Award,
  PauseCircle,
  XCircle,
  ShieldAlert,
  DollarSign,
  Users,
  Scale,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ReasonCodeSelector } from "@/components/admin/reason-code-selector";
import type { ReasonCodeOption } from "@/components/admin/reason-code-selector";
import { AssessmentSynopsis } from "@/components/admin/assessment-synopsis";
import { OutcomeBadge } from "@/components/shared/lifecycle-badges";
import {
  saveRecommendationAction,
  setApplicationAwardAction,
} from "@/app/(admin)/applications/[id]/recommendation/actions";
import type { OptionScenario } from "@/lib/assessment/recommendation-options";
import { cn } from "@/lib/utils";
import type { AssessmentOutcome } from "@prisma/client";

// ─── Types ────────────────────────────────────────────────────────────────────

/** The 3-value award decision (Epic 08 / Epic 01 outcome). */
export type AwardDecision =
  | "AWARDED"
  | "QUALIFIES_NOT_AWARDED"
  | "DOES_NOT_QUALIFY";

export interface SerialisedRecommendation {
  id: string;
  assessmentId: string;
  familySynopsis: string | null;
  accommodationStatus: string | null;
  incomeCategory: string | null;
  propertyCategory: number | null;
  bursaryAward: number | null;
  scholarshipAward: number | null;
  yearlyPayableFees: number | null;
  monthlyPayableFees: number | null;
  dishonestyFlag: boolean;
  creditRiskFlag: boolean;
  summary: string | null;
  selectedReasonCodeIds: string[];
}

/** Read-only sibling context surfaced at decision time. */
export interface SiblingContextRow {
  /**
   * Bursary-account id — the React key only. Epic 13 (D13-1a) removed the
   * account reference this row used to key on and display; the UUID is the
   * account's only remaining identity, and it is never rendered.
   */
  bursaryAccountId: string;
  childName: string;
  school: string;
  priorityOrder: number;
  /** The payable fee this sibling absorbed (latest completed assessment). */
  absorbedPayableFees: number | null;
}

export interface RecommendationFormProps {
  applicationId: string;
  /** The recorded outcome on the assessment (Epic 01); null until decided. */
  assessmentOutcome: AssessmentOutcome | null;
  /** Assessment id — backs the single editable synopsis (Epic 06). */
  assessmentId: string;
  /** Current single synopsis (Epic 06), shown + editable on this screen too. */
  synopsis: string | null;
  /** Values pre-populated from the completed assessment */
  assessmentValues: {
    bursaryAward: number | null;
    yearlyPayableFees: number | null;
    monthlyPayableFees: number | null;
    dishonestyFlag: boolean;
    creditRiskFlag: boolean;
  };
  /** Existing recommendation (null if first time) */
  recommendation: SerialisedRecommendation | null;
  reasonCodes: ReasonCodeOption[];
  /** Linked siblings + the fees they absorbed (read-only context). */
  siblingContext: SiblingContextRow[];
  /** Side-by-side option scenarios projected from the pure engine. */
  optionScenarios: OptionScenario[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function formatCurrency(value: number | null | undefined): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
  }).format(value);
}

/** Property category considered high-value; show advisory above this level. */
const PROPERTY_THRESHOLD = 8;

/** An outcome already recorded makes the decision terminal (synopsis excepted). */
export function isTerminalOutcome(outcome: AssessmentOutcome | null): boolean {
  return (
    outcome === "AWARDED" ||
    outcome === "QUALIFIES_NOT_AWARDED" ||
    outcome === "DOES_NOT_QUALIFY" ||
    // Legacy pre-Epic-08 value, still terminal for read-only purposes.
    outcome === "QUALIFIES"
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

export function RedFlagBanner({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-red-300 bg-red-50 px-4 py-3">
      <Icon
        className="mt-0.5 h-5 w-5 shrink-0 text-red-600"
        aria-hidden="true"
      />
      <div>
        <p className="text-sm font-semibold text-red-800">{title}</p>
        <p className="mt-0.5 text-xs text-red-600">{description}</p>
      </div>
    </div>
  );
}

function PropertyAdvisoryBanner() {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
      <AlertTriangle
        className="mt-0.5 h-5 w-5 shrink-0 text-amber-600"
        aria-hidden="true"
      />
      <div>
        <p className="text-sm font-semibold text-amber-800">
          High Property Category
        </p>
        <p className="mt-0.5 text-xs text-amber-600">
          The selected property category exceeds the standard threshold. Please
          ensure this is accurately reflected in the recommendation summary and
          reason codes.
        </p>
      </div>
    </div>
  );
}

export function ReadOnlyBanner({ outcome }: { outcome: AssessmentOutcome }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
      <OutcomeBadge outcome={outcome} />
      <p className="text-sm text-slate-500">
        A final outcome has been recorded for this application. The
        recommendation is read-only (the synopsis remains editable).
      </p>
    </div>
  );
}

// ─── Award decision metadata ───────────────────────────────────────────────────

export const AWARD_DECISIONS: Record<
  AwardDecision,
  {
    label: string;
    icon: React.ElementType;
    buttonClass: string;
    title: string;
    consequence: string;
  }
> = {
  AWARDED: {
    label: "Award",
    icon: Award,
    buttonClass: "bg-green-600 hover:bg-green-700 text-white",
    title: "Confirm: Award bursary",
    consequence:
      "An award confirmation email is sent to the lead applicant, the rolling bursary account is opened (or continued), and the bursary and scholarship awards are recorded. This cannot be undone.",
  },
  QUALIFIES_NOT_AWARDED: {
    label: "Qualifies — not awarded",
    icon: PauseCircle,
    buttonClass: "bg-amber-500 hover:bg-amber-600 text-white",
    title: "Confirm: Qualifies — not awarded",
    consequence:
      "The applicant is assessed as eligible but is not granted an award this round. An email is sent and the application is retained per the retention policy. This cannot be undone.",
  },
  DOES_NOT_QUALIFY: {
    label: "Decline",
    icon: XCircle,
    buttonClass: "bg-rose-600 hover:bg-rose-700 text-white",
    title: "Confirm: Decline bursary",
    consequence:
      "A decline email is sent to the lead applicant and a new application is archived. This cannot be undone.",
  },
};

export interface AwardDialogProps {
  open: boolean;
  decision: AwardDecision | null;
  scholarshipAward: number | null;
  bursaryAward: number | null;
  isPending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function AwardDialog({
  open,
  decision,
  scholarshipAward,
  bursaryAward,
  isPending,
  onConfirm,
  onCancel,
}: AwardDialogProps) {
  const meta = decision ? AWARD_DECISIONS[decision] : null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{meta?.title ?? "Confirm outcome"}</DialogTitle>
          <DialogDescription>{meta?.consequence}</DialogDescription>
        </DialogHeader>
        {decision === "AWARDED" && (
          <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Bursary award</span>
              <span className="font-semibold text-primary-900">
                {formatCurrency(bursaryAward)}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-slate-500">Scholarship award</span>
              <span className="font-semibold text-primary-900">
                {formatCurrency(scholarshipAward)}
              </span>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className={cn(meta?.buttonClass)}
          >
            {isPending ? "Processing…" : `Confirm ${meta?.label ?? ""}`.trim()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Sibling context panel ──────────────────────────────────────────────────────

export function SiblingContextPanel({ rows }: { rows: SiblingContextRow[] }) {
  if (rows.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4 text-slate-400" aria-hidden="true" />
          Sibling context
        </CardTitle>
        <p className="text-sm text-slate-500">
          Linked siblings in this family group and the payable fees absorbed
          before this child&apos;s bursary was computed (read-only).
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="py-2 pr-4 font-semibold">Priority</th>
                <th className="py-2 pr-4 font-semibold">Child</th>
                <th className="py-2 pr-4 font-semibold">School</th>
                <th className="py-2 text-right font-semibold">Absorbed fees</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.bursaryAccountId} className="border-b border-slate-100">
                  <td className="py-2 pr-4 text-slate-600">{r.priorityOrder}</td>
                  <td className="py-2 pr-4 font-medium text-slate-800">
                    {r.childName}
                  </td>
                  <td className="py-2 pr-4 text-slate-600">
                    {r.school === "TRINITY" ? "Trinity" : "Whitgift"}
                  </td>
                  <td className="py-2 text-right font-semibold text-primary-900">
                    {formatCurrency(r.absorbedPayableFees)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Options comparison panel ───────────────────────────────────────────────────

function OptionsComparisonPanel({
  scenarios,
}: {
  scenarios: OptionScenario[];
}) {
  if (scenarios.length <= 1) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Scale className="h-4 w-4 text-slate-400" aria-hidden="true" />
          Options comparison
        </CardTitle>
        <p className="text-sm text-slate-500">
          Net-payable fees under each scenario, projected from the same
          calculation. The chosen scenario is what the award figures reflect.
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="py-2 pr-4 font-semibold">Scenario</th>
                <th className="py-2 pr-4 text-right font-semibold">Bursary</th>
                <th className="py-2 pr-4 text-right font-semibold">
                  Scholarship %
                </th>
                <th className="py-2 pr-4 text-right font-semibold">
                  Yearly payable
                </th>
                <th className="py-2 text-right font-semibold">
                  Monthly payable
                </th>
              </tr>
            </thead>
            <tbody>
              {scenarios.map((s) => (
                <tr key={s.key} className="border-b border-slate-100">
                  <td className="py-2 pr-4 font-medium text-slate-800">
                    {s.label}
                  </td>
                  <td className="py-2 pr-4 text-right text-slate-600">
                    {formatCurrency(s.bursaryAward)}
                  </td>
                  <td className="py-2 pr-4 text-right text-slate-600">
                    {s.scholarshipPct}%
                  </td>
                  <td className="py-2 pr-4 text-right font-semibold text-primary-900">
                    {formatCurrency(s.yearlyPayableFees)}
                  </td>
                  <td className="py-2 text-right font-semibold text-primary-900">
                    {formatCurrency(s.monthlyPayableFees)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Form ────────────────────────────────────────────────────────────────

export function RecommendationForm({
  applicationId,
  assessmentOutcome,
  assessmentId,
  synopsis,
  assessmentValues,
  recommendation,
  reasonCodes,
  siblingContext,
  optionScenarios,
}: RecommendationFormProps) {
  const router = useRouter();

  const isReadOnly = isTerminalOutcome(assessmentOutcome);

  // Form state — initialise from existing recommendation or assessment values.
  // Epic 06: the free-text familySynopsis/summary boxes are removed; the single
  // Assessment.synopsis (rendered below) is the qualitative narrative now.
  const [accommodationStatus, setAccommodationStatus] = React.useState(
    recommendation?.accommodationStatus ?? ""
  );
  const [incomeCategory, setIncomeCategory] = React.useState(
    recommendation?.incomeCategory ?? ""
  );
  const [propertyCategory, setPropertyCategory] = React.useState<string>(
    recommendation?.propertyCategory?.toString() ?? ""
  );
  // Distinct £ scholarship award (D9) — empty string = none recorded.
  const [scholarshipAwardInput, setScholarshipAwardInput] =
    React.useState<string>(
      recommendation?.scholarshipAward != null
        ? String(recommendation.scholarshipAward)
        : ""
    );
  const [selectedReasonCodeIds, setSelectedReasonCodeIds] = React.useState<
    string[]
  >(recommendation?.selectedReasonCodeIds ?? []);

  // Derived from assessment (read-only display)
  const bursaryAward = assessmentValues.bursaryAward;
  const yearlyPayableFees = assessmentValues.yearlyPayableFees;
  const monthlyPayableFees = assessmentValues.monthlyPayableFees;
  const dishonestyFlag = assessmentValues.dishonestyFlag;
  const creditRiskFlag = assessmentValues.creditRiskFlag;

  const scholarshipAwardNum =
    scholarshipAwardInput.trim() === ""
      ? null
      : Number.parseFloat(scholarshipAwardInput);
  const scholarshipAwardValid =
    scholarshipAwardNum == null ||
    (!Number.isNaN(scholarshipAwardNum) && scholarshipAwardNum >= 0);

  // Save state
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveMessage, setSaveMessage] = React.useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Award decision dialog state
  const [pendingDecision, setPendingDecision] =
    React.useState<AwardDecision | null>(null);
  const [isSettingOutcome, setIsSettingOutcome] = React.useState(false);

  const propertyCategoryNum = propertyCategory
    ? parseInt(propertyCategory, 10)
    : null;
  const showPropertyAdvisory =
    propertyCategoryNum != null && propertyCategoryNum > PROPERTY_THRESHOLD;

  // ── Handlers ────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!scholarshipAwardValid) {
      setSaveMessage({
        type: "error",
        text: "Scholarship award must be a non-negative amount.",
      });
      return;
    }
    setIsSaving(true);
    setSaveMessage(null);

    const result = await saveRecommendationAction(applicationId, {
      // Epic 06: the qualitative narrative moved to Assessment.synopsis. The
      // legacy recommendation free-text columns are retained but no longer
      // written from the UI — always persist null here.
      familySynopsis: null,
      accommodationStatus: accommodationStatus || null,
      incomeCategory: incomeCategory || null,
      propertyCategory: propertyCategoryNum,
      bursaryAward,
      scholarshipAward: scholarshipAwardNum,
      yearlyPayableFees,
      monthlyPayableFees,
      dishonestyFlag,
      creditRiskFlag,
      summary: null,
      reasonCodeIds: selectedReasonCodeIds,
    });

    setIsSaving(false);

    if (result.success) {
      setSaveMessage({ type: "success", text: "Recommendation saved." });
      router.refresh();
    } else {
      setSaveMessage({ type: "error", text: result.error });
    }
  }

  async function handleConfirmDecision() {
    if (!pendingDecision) return;

    setIsSettingOutcome(true);
    const result = await setApplicationAwardAction(
      applicationId,
      pendingDecision,
      {
        bursaryAward,
        scholarshipAward: scholarshipAwardNum,
      }
    );
    setIsSettingOutcome(false);

    if (result.success) {
      setPendingDecision(null);
      router.refresh();
    } else {
      setPendingDecision(null);
      setSaveMessage({ type: "error", text: result.error });
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Read-only notice */}
      {isReadOnly && assessmentOutcome && (
        <ReadOnlyBanner outcome={assessmentOutcome} />
      )}

      {/* Red flag banners */}
      {dishonestyFlag && (
        <RedFlagBanner
          icon={ShieldAlert}
          title="Dishonesty Flag Active"
          description="A dishonesty concern was flagged during the assessment. Review carefully before setting an outcome."
        />
      )}
      {creditRiskFlag && (
        <RedFlagBanner
          icon={AlertTriangle}
          title="Credit Risk Flag Active"
          description="A credit risk concern was flagged during the assessment. Ensure this is addressed in the recommendation summary."
        />
      )}

      {/* Property advisory */}
      {showPropertyAdvisory && <PropertyAdvisoryBanner />}

      {/* ── Section A: Assessment Summary (read-only) ────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <DollarSign className="h-4 w-4 text-slate-400" aria-hidden="true" />
            Assessment Fee Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-md bg-slate-50 border border-slate-200 px-4 py-3">
              <p className="text-xs text-slate-500 mb-1">Bursary Award</p>
              <p className="text-lg font-semibold text-primary-900">
                {formatCurrency(bursaryAward)}
              </p>
            </div>
            <div className="rounded-md bg-slate-50 border border-slate-200 px-4 py-3">
              <p className="text-xs text-slate-500 mb-1">Yearly Payable Fees</p>
              <p className="text-lg font-semibold text-primary-900">
                {formatCurrency(yearlyPayableFees)}
              </p>
            </div>
            <div className="rounded-md bg-slate-50 border border-slate-200 px-4 py-3">
              <p className="text-xs text-slate-500 mb-1">Monthly Payable Fees</p>
              <p className="text-lg font-semibold text-primary-900">
                {formatCurrency(monthlyPayableFees)}
              </p>
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            These values are carried over from the completed assessment and
            cannot be edited here.
          </p>
        </CardContent>
      </Card>

      {/* ── Sibling context (read-only) ─────────────────────────────────── */}
      <SiblingContextPanel rows={siblingContext} />

      {/* ── Options comparison (read-only) ──────────────────────────────── */}
      <OptionsComparisonPanel scenarios={optionScenarios} />

      {/* ── Section B: Recommendation Details ───────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recommendation Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Two-column: accommodation + income category */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="accommodation-status">Accommodation Status</Label>
              <Input
                id="accommodation-status"
                value={accommodationStatus}
                onChange={(e) => setAccommodationStatus(e.target.value)}
                disabled={isReadOnly}
                placeholder="e.g. Rented, Mortgaged, Owned outright"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="income-category">Income Category</Label>
              <Input
                id="income-category"
                value={incomeCategory}
                onChange={(e) => setIncomeCategory(e.target.value)}
                disabled={isReadOnly}
                placeholder="e.g. Low, Medium, High"
              />
            </div>
          </div>

          {/* Property category + scholarship award */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="property-category">
                Property Category{" "}
                <span className="font-normal text-slate-400">(1 – 12)</span>
              </Label>
              <Select
                value={propertyCategory}
                onValueChange={setPropertyCategory}
                disabled={isReadOnly}
              >
                <SelectTrigger id="property-category" className="w-40">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Distinct £ scholarship award (D9) */}
            <div className="space-y-1.5">
              <Label htmlFor="scholarship-award">
                Scholarship Award{" "}
                <span className="font-normal text-slate-400">(£, optional)</span>
              </Label>
              <Input
                id="scholarship-award"
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={scholarshipAwardInput}
                onChange={(e) => setScholarshipAwardInput(e.target.value)}
                disabled={isReadOnly}
                placeholder="0.00"
                aria-invalid={!scholarshipAwardValid}
              />
              <p className="text-xs text-slate-400">
                A merit/academic award, distinct from the means-tested bursary.
                Recorded alongside the bursary on the rolling account.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Single assessment synopsis (Epic 06) ─────────────────────────── */}
      {/* The qualitative narrative now lives on Assessment.synopsis and is
          shown + EDITABLE here, independent of the recommendation lock above. */}
      <AssessmentSynopsis
        assessmentId={assessmentId}
        applicationId={applicationId}
        synopsis={synopsis}
        assessmentCompleted
      />

      {/* ── Section C: Reason Codes ──────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Reason Codes</CardTitle>
        </CardHeader>
        <CardContent>
          <ReasonCodeSelector
            reasonCodes={reasonCodes}
            selectedIds={selectedReasonCodeIds}
            onChange={setSelectedReasonCodeIds}
            disabled={isReadOnly}
          />
        </CardContent>
      </Card>

      {/* ── Save button ─────────────────────────────────────────────────── */}
      {!isReadOnly && (
        <div className="flex items-center gap-4">
          <Button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="bg-primary-700 hover:bg-primary-800 text-white"
          >
            <Save className="mr-2 h-4 w-4" aria-hidden="true" />
            {isSaving ? "Saving..." : "Save Recommendation"}
          </Button>

          {saveMessage && (
            <p
              className={cn(
                "text-sm",
                saveMessage.type === "success"
                  ? "text-green-700"
                  : "text-red-600"
              )}
              role="status"
              aria-live="polite"
            >
              {saveMessage.text}
            </p>
          )}
        </div>
      )}

      {/* ── Section D: Award decision ────────────────────────────────────── */}
      {!isReadOnly && (
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="text-base">Award decision</CardTitle>
            <p className="text-sm text-slate-500">
              Record the panel&apos;s decision. Once set, the matching outcome
              email is sent to the lead applicant and this recommendation becomes
              read-only. Save the recommendation first so the scholarship award is
              recorded with the decision.
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {(
                ["AWARDED", "QUALIFIES_NOT_AWARDED", "DOES_NOT_QUALIFY"] as const
              ).map((decision) => {
                const meta = AWARD_DECISIONS[decision];
                const Icon = meta.icon;
                return (
                  <Button
                    key={decision}
                    type="button"
                    onClick={() => setPendingDecision(decision)}
                    className={meta.buttonClass}
                  >
                    <Icon className="mr-2 h-4 w-4" aria-hidden="true" />
                    {meta.label}
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Award decision confirmation dialog ───────────────────────────── */}
      <AwardDialog
        open={pendingDecision !== null}
        decision={pendingDecision}
        scholarshipAward={scholarshipAwardNum}
        bursaryAward={bursaryAward}
        isPending={isSettingOutcome}
        onConfirm={handleConfirmDecision}
        onCancel={() => setPendingDecision(null)}
      />
    </div>
  );
}
