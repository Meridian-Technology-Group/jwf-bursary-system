"use client";

/**
 * WP-12: Recommendation Form
 *
 * Client component for the Recommendation tab. Allows assessors to:
 *  - Review auto-populated fee/flag data from the assessment
 *  - Edit family synopsis, accommodation status, income category, property
 *    category, and summary narrative
 *  - Select reason codes (via ReasonCodeSelector)
 *  - Save the recommendation
 *  - Set the application outcome (QUALIFIES / DOES_NOT_QUALIFY) with a
 *    confirmation dialog
 *
 * Read-only when the application status is QUALIFIES or DOES_NOT_QUALIFY.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Save,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  DollarSign,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  saveRecommendationAction,
  setApplicationOutcomeAction,
} from "@/app/(admin)/applications/[id]/recommendation/actions";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SerialisedRecommendation {
  id: string;
  assessmentId: string;
  familySynopsis: string | null;
  accommodationStatus: string | null;
  incomeCategory: string | null;
  propertyCategory: number | null;
  bursaryAward: number | null;
  yearlyPayableFees: number | null;
  monthlyPayableFees: number | null;
  dishonestyFlag: boolean;
  creditRiskFlag: boolean;
  summary: string | null;
  selectedReasonCodeIds: string[];
}

export interface RecommendationFormProps {
  applicationId: string;
  applicationStatus: string;
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
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
  }).format(value);
}

/** Property category considered high-value; show advisory above this level. */
const PROPERTY_THRESHOLD = 8;

// ─── Sub-components ───────────────────────────────────────────────────────────

function RedFlagBanner({
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

function ReadOnlyBanner({ status }: { status: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
      <CheckCircle2
        className="h-4 w-4 shrink-0 text-slate-400"
        aria-hidden="true"
      />
      <p className="text-sm text-slate-500">
        This application has a terminal status of{" "}
        <span className="font-semibold">{status.replace(/_/g, " ")}</span>.
        Recommendation is read-only.
      </p>
    </div>
  );
}

// ─── Outcome confirmation dialog ───────────────────────────────────────────────

interface OutcomeDialogProps {
  open: boolean;
  outcome: "QUALIFIES" | "DOES_NOT_QUALIFY" | null;
  isPending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function OutcomeDialog({
  open,
  outcome,
  isPending,
  onConfirm,
  onCancel,
}: OutcomeDialogProps) {
  const isQualifies = outcome === "QUALIFIES";

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isQualifies ? "Confirm: Qualifies" : "Confirm: Does Not Qualify"}
          </DialogTitle>
          <DialogDescription>
            {isQualifies
              ? "This will mark the application as QUALIFIES and send an outcome email to the lead applicant. This action cannot be undone."
              : "This will mark the application as DOES NOT QUALIFY and send an outcome email to the lead applicant. This action cannot be undone."}
          </DialogDescription>
        </DialogHeader>
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
            className={cn(
              isQualifies
                ? "bg-green-600 hover:bg-green-700 text-white"
                : "bg-rose-600 hover:bg-rose-700 text-white"
            )}
          >
            {isPending
              ? "Processing..."
              : isQualifies
              ? "Confirm Qualifies"
              : "Confirm Does Not Qualify"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Form ────────────────────────────────────────────────────────────────

export function RecommendationForm({
  applicationId,
  applicationStatus,
  assessmentValues,
  recommendation,
  reasonCodes,
}: RecommendationFormProps) {
  const router = useRouter();

  const isReadOnly =
    applicationStatus === "QUALIFIES" ||
    applicationStatus === "DOES_NOT_QUALIFY";

  // Form state — initialise from existing recommendation or assessment values
  const [familySynopsis, setFamilySynopsis] = React.useState(
    recommendation?.familySynopsis ?? ""
  );
  const [accommodationStatus, setAccommodationStatus] = React.useState(
    recommendation?.accommodationStatus ?? ""
  );
  const [incomeCategory, setIncomeCategory] = React.useState(
    recommendation?.incomeCategory ?? ""
  );
  const [propertyCategory, setPropertyCategory] = React.useState<string>(
    recommendation?.propertyCategory?.toString() ?? ""
  );
  const [summary, setSummary] = React.useState(
    recommendation?.summary ?? ""
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

  // Save state
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveMessage, setSaveMessage] = React.useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Outcome dialog state
  const [pendingOutcome, setPendingOutcome] = React.useState<
    "QUALIFIES" | "DOES_NOT_QUALIFY" | null
  >(null);
  const [isSettingOutcome, setIsSettingOutcome] = React.useState(false);

  const propertyCategoryNum = propertyCategory
    ? parseInt(propertyCategory, 10)
    : null;
  const showPropertyAdvisory =
    propertyCategoryNum != null && propertyCategoryNum > PROPERTY_THRESHOLD;

  // ── Handlers ────────────────────────────────────────────────────────────────

  async function handleSave() {
    setIsSaving(true);
    setSaveMessage(null);

    const result = await saveRecommendationAction(applicationId, {
      familySynopsis: familySynopsis || null,
      accommodationStatus: accommodationStatus || null,
      incomeCategory: incomeCategory || null,
      propertyCategory: propertyCategoryNum,
      bursaryAward,
      yearlyPayableFees,
      monthlyPayableFees,
      dishonestyFlag,
      creditRiskFlag,
      summary: summary || null,
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

  async function handleConfirmOutcome() {
    if (!pendingOutcome) return;

    setIsSettingOutcome(true);
    const result = await setApplicationOutcomeAction(applicationId, pendingOutcome);
    setIsSettingOutcome(false);

    if (result.success) {
      setPendingOutcome(null);
      router.refresh();
    } else {
      setPendingOutcome(null);
      setSaveMessage({ type: "error", text: result.error });
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Read-only notice */}
      {isReadOnly && <ReadOnlyBanner status={applicationStatus} />}

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

      {/* ── Section B: Recommendation Details ───────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recommendation Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Family synopsis */}
          <div className="space-y-1.5">
            <Label htmlFor="family-synopsis">Family Synopsis</Label>
            <Textarea
              id="family-synopsis"
              value={familySynopsis}
              onChange={(e) => setFamilySynopsis(e.target.value)}
              disabled={isReadOnly}
              placeholder="Brief summary of the family's circumstances..."
              rows={4}
              className="resize-y"
            />
          </div>

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

          {/* Property category */}
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

          {/* Summary narrative */}
          <div className="space-y-1.5">
            <Label htmlFor="summary">Recommendation Summary</Label>
            <Textarea
              id="summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              disabled={isReadOnly}
              placeholder="Detailed recommendation narrative for the panel..."
              rows={6}
              className="resize-y"
            />
          </div>
        </CardContent>
      </Card>

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

      {/* ── Section D: Set Outcome ───────────────────────────────────────── */}
      {!isReadOnly && (
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="text-base">Set Application Outcome</CardTitle>
            <p className="text-sm text-slate-500">
              Once the outcome is set, an email is sent to the lead applicant
              and this recommendation becomes read-only.
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                onClick={() => setPendingOutcome("QUALIFIES")}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <CheckCircle2 className="mr-2 h-4 w-4" aria-hidden="true" />
                Qualifies
              </Button>
              <Button
                type="button"
                onClick={() => setPendingOutcome("DOES_NOT_QUALIFY")}
                className="bg-rose-600 hover:bg-rose-700 text-white"
              >
                <XCircle className="mr-2 h-4 w-4" aria-hidden="true" />
                Does Not Qualify
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Outcome confirmation dialog ──────────────────────────────────── */}
      <OutcomeDialog
        open={pendingOutcome !== null}
        outcome={pendingOutcome}
        isPending={isSettingOutcome}
        onConfirm={handleConfirmOutcome}
        onCancel={() => setPendingOutcome(null)}
      />
    </div>
  );
}
