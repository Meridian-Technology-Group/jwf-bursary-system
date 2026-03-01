/**
 * WP-21: Recommendation PDF Template
 *
 * React PDF template using @react-pdf/renderer.
 * Produces a professional JWF-branded recommendation document.
 *
 * IMPORTANT: All Decimal fields must be converted to plain numbers by the
 * caller before being passed to this component.
 *
 * Runtime: nodejs (not edge — @react-pdf/renderer is not edge-compatible)
 */

import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";

// ─── Brand colours ────────────────────────────────────────────────────────────

const NAVY = "#0D1B2A";
const GOLD = "#B8862A";
const SLATE_600 = "#475569";
const SLATE_400 = "#94a3b8";
const SLATE_100 = "#f1f5f9";
const RED_700 = "#b91c1c";
const WHITE = "#ffffff";

// ─── StyleSheet ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    color: NAVY,
    backgroundColor: WHITE,
    paddingTop: 40,
    paddingBottom: 48,
    paddingHorizontal: 40,
    lineHeight: 1.4,
  },

  // ── Header ────────────────────────────────────────────────────────────────

  headerBlock: {
    marginBottom: 20,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  orgName: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
    letterSpacing: 0.5,
  },
  orgSubtitle: {
    fontSize: 8,
    color: SLATE_600,
    marginTop: 2,
  },
  docLabel: {
    fontSize: 8,
    color: SLATE_600,
    textAlign: "right",
  },
  docTitle: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
    textAlign: "right",
    marginTop: 2,
  },
  goldRule: {
    height: 2,
    backgroundColor: GOLD,
    marginBottom: 12,
  },
  headerMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },
  metaItem: {
    flexDirection: "column",
    minWidth: 100,
  },
  metaLabel: {
    fontSize: 7,
    color: SLATE_400,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  metaValue: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
  },

  // ── Section layout ────────────────────────────────────────────────────────

  section: {
    marginBottom: 14,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  sectionAccent: {
    width: 3,
    height: 12,
    backgroundColor: GOLD,
    marginRight: 6,
    borderRadius: 1,
  },
  sectionTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: SLATE_100,
    marginBottom: 8,
  },

  // ── Two-column grid ───────────────────────────────────────────────────────

  row2: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 6,
  },
  col2: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 7,
    color: SLATE_400,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  fieldValue: {
    fontSize: 9,
    color: NAVY,
  },
  fieldValueBold: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
  },

  // ── Financial summary boxes ───────────────────────────────────────────────

  feeBoxRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  feeBox: {
    flex: 1,
    backgroundColor: SLATE_100,
    borderRadius: 3,
    padding: 8,
    alignItems: "center",
  },
  feeBoxLabel: {
    fontSize: 7,
    color: SLATE_600,
    marginBottom: 3,
    textAlign: "center",
  },
  feeBoxAmount: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
    textAlign: "center",
  },

  // ── Flags ─────────────────────────────────────────────────────────────────

  flagRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  flagBullet: {
    width: 6,
    fontSize: 9,
    color: RED_700,
    marginRight: 4,
  },
  flagText: {
    flex: 1,
    fontSize: 9,
    color: RED_700,
    fontFamily: "Helvetica-Bold",
  },
  noFlagsText: {
    fontSize: 9,
    color: SLATE_400,
    fontStyle: "italic",
  },

  // ── Reason codes ──────────────────────────────────────────────────────────

  reasonCodeRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 3,
  },
  reasonCodeBadge: {
    backgroundColor: NAVY,
    color: WHITE,
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 2,
    marginRight: 6,
    minWidth: 28,
    textAlign: "center",
  },
  reasonCodeLabel: {
    flex: 1,
    fontSize: 9,
    color: NAVY,
  },
  noReasonCodesText: {
    fontSize: 9,
    color: SLATE_400,
    fontStyle: "italic",
  },

  // ── Narrative ─────────────────────────────────────────────────────────────

  narrativeText: {
    fontSize: 9,
    color: NAVY,
    lineHeight: 1.6,
  },

  // ── Outcome ───────────────────────────────────────────────────────────────

  outcomeBox: {
    backgroundColor: NAVY,
    borderRadius: 4,
    padding: 14,
    marginTop: 4,
  },
  outcomeLabel: {
    fontSize: 7,
    color: GOLD,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  outcomeValue: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: WHITE,
    marginBottom: 10,
  },
  outcomeFeeGrid: {
    flexDirection: "row",
    gap: 24,
  },
  outcomeFeeItem: {
    flexDirection: "column",
  },
  outcomeFeeLabel: {
    fontSize: 7,
    color: GOLD,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  outcomeFeeValue: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: WHITE,
  },

  // ── Footer ────────────────────────────────────────────────────────────────

  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: SLATE_100,
    paddingTop: 6,
  },
  footerText: {
    fontSize: 7,
    color: SLATE_400,
  },
});

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReasonCodeEntry {
  code: number;
  label: string;
}

export interface RecommendationPDFProps {
  // Header
  reference: string;
  school: string;
  academicYear: string;
  childName: string;

  // Family Assessment
  familyTypeCategory: number | null;
  accommodationStatus: string | null;
  familySynopsis: string | null;

  // Financial Summary
  totalHouseholdNetIncome: number | null;
  netAssetsYearlyValuation: number | null;
  grossFees: number | null;
  scholarshipPct: number | null;
  bursaryAward: number | null;
  yearlyPayableFees: number | null;
  monthlyPayableFees: number | null;

  // Flags
  dishonestyFlag: boolean;
  creditRiskFlag: boolean;

  // Reason codes
  reasonCodes: ReasonCodeEntry[];

  // Narrative
  summary: string | null;

  // Outcome
  incomeCategory: string | null;
  propertyCategory: number | null;

  // Meta
  generatedAt: string;
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

function nullableString(value: string | null | undefined, fallback = "—"): string {
  if (!value || value.trim() === "") return fallback;
  return value;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionAccent} />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function Field({
  label,
  value,
  bold = false,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <View>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={bold ? styles.fieldValueBold : styles.fieldValue}>{value}</Text>
    </View>
  );
}

// ─── RecommendationPDF Component ──────────────────────────────────────────────

export function RecommendationPDF(props: RecommendationPDFProps) {
  const {
    reference,
    school,
    academicYear,
    childName,
    familyTypeCategory,
    accommodationStatus,
    familySynopsis,
    totalHouseholdNetIncome,
    netAssetsYearlyValuation,
    grossFees,
    scholarshipPct,
    bursaryAward,
    yearlyPayableFees,
    monthlyPayableFees,
    dishonestyFlag,
    creditRiskFlag,
    reasonCodes,
    summary,
    incomeCategory,
    propertyCategory,
    generatedAt,
  } = props;

  const hasFlags = dishonestyFlag || creditRiskFlag;
  const bursaryPct =
    bursaryAward != null && grossFees != null && grossFees > 0
      ? ((bursaryAward / grossFees) * 100).toFixed(1)
      : null;

  return (
    <Document
      title={`Recommendation — ${reference}`}
      author="John Whitgift Foundation"
      subject="Bursary Assessment Recommendation"
    >
      <Page size="A4" style={styles.page}>

        {/* ── Header ────────────────────────────────────────────────────── */}
        <View style={styles.headerBlock}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.orgName}>John Whitgift Foundation</Text>
              <Text style={styles.orgSubtitle}>Bursary Assessment System</Text>
            </View>
            <View>
              <Text style={styles.docLabel}>CONFIDENTIAL DOCUMENT</Text>
              <Text style={styles.docTitle}>Recommendation</Text>
            </View>
          </View>

          <View style={styles.goldRule} />

          <View style={styles.headerMeta}>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Reference</Text>
              <Text style={styles.metaValue}>{reference}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>School</Text>
              <Text style={styles.metaValue}>{school}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Academic Year</Text>
              <Text style={styles.metaValue}>{academicYear}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Child</Text>
              <Text style={styles.metaValue}>{childName}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Generated</Text>
              <Text style={styles.metaValue}>{generatedAt}</Text>
            </View>
          </View>
        </View>

        {/* ── 1. Family Assessment ──────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionHeader title="Family Assessment" />
          <View style={styles.sectionDivider} />

          <View style={styles.row2}>
            <View style={styles.col2}>
              <Field
                label="Family Type Category"
                value={familyTypeCategory != null ? String(familyTypeCategory) : "—"}
              />
            </View>
            <View style={styles.col2}>
              <Field
                label="Accommodation Status"
                value={nullableString(accommodationStatus)}
              />
            </View>
          </View>

          {familySynopsis && familySynopsis.trim() !== "" && (
            <View style={{ marginTop: 4 }}>
              <Text style={styles.fieldLabel}>Family Synopsis</Text>
              <Text style={styles.fieldValue}>{familySynopsis}</Text>
            </View>
          )}
        </View>

        {/* ── 2. Financial Summary ──────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionHeader title="Financial Summary" />
          <View style={styles.sectionDivider} />

          <View style={styles.row2}>
            <View style={styles.col2}>
              <Field
                label="Total Household Net Income"
                value={formatCurrency(totalHouseholdNetIncome)}
                bold
              />
            </View>
            <View style={styles.col2}>
              <Field
                label="Net Assets Yearly Valuation"
                value={formatCurrency(netAssetsYearlyValuation)}
                bold
              />
            </View>
          </View>

          <View style={[styles.row2, { marginTop: 6 }]}>
            <View style={styles.col2}>
              <Field
                label="Gross Fees"
                value={formatCurrency(grossFees)}
              />
            </View>
            <View style={styles.col2}>
              <Field
                label="Scholarship"
                value={scholarshipPct != null ? `${scholarshipPct}%` : "—"}
              />
            </View>
          </View>

          <View style={styles.feeBoxRow}>
            <View style={styles.feeBox}>
              <Text style={styles.feeBoxLabel}>Bursary Award</Text>
              <Text style={styles.feeBoxAmount}>{formatCurrency(bursaryAward)}</Text>
              {bursaryPct && (
                <Text style={[styles.feeBoxLabel, { marginTop: 2 }]}>
                  ({bursaryPct}% of gross fees)
                </Text>
              )}
            </View>
            <View style={styles.feeBox}>
              <Text style={styles.feeBoxLabel}>Yearly Payable Fees</Text>
              <Text style={styles.feeBoxAmount}>{formatCurrency(yearlyPayableFees)}</Text>
            </View>
            <View style={styles.feeBox}>
              <Text style={styles.feeBoxLabel}>Monthly Payable Fees</Text>
              <Text style={styles.feeBoxAmount}>{formatCurrency(monthlyPayableFees)}</Text>
            </View>
          </View>
        </View>

        {/* ── 3. Flags ──────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionHeader title="Flags" />
          <View style={styles.sectionDivider} />

          {!hasFlags && (
            <Text style={styles.noFlagsText}>No flags raised during assessment.</Text>
          )}
          {dishonestyFlag && (
            <View style={styles.flagRow}>
              <Text style={styles.flagBullet}>•</Text>
              <Text style={styles.flagText}>
                DISHONESTY FLAG — A dishonesty concern was identified during assessment.
              </Text>
            </View>
          )}
          {creditRiskFlag && (
            <View style={styles.flagRow}>
              <Text style={styles.flagBullet}>•</Text>
              <Text style={styles.flagText}>
                CREDIT RISK FLAG — A credit risk concern was identified during assessment.
              </Text>
            </View>
          )}
        </View>

        {/* ── 4. Reason Codes ───────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionHeader title="Reason Codes" />
          <View style={styles.sectionDivider} />

          {reasonCodes.length === 0 ? (
            <Text style={styles.noReasonCodesText}>No reason codes applied.</Text>
          ) : (
            reasonCodes.map((rc) => (
              <View key={rc.code} style={styles.reasonCodeRow}>
                <Text style={styles.reasonCodeBadge}>{rc.code}</Text>
                <Text style={styles.reasonCodeLabel}>{rc.label}</Text>
              </View>
            ))
          )}
        </View>

        {/* ── 5. Narrative / Summary ────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionHeader title="Assessor Narrative" />
          <View style={styles.sectionDivider} />

          <Text style={styles.narrativeText}>
            {nullableString(summary, "No narrative provided.")}
          </Text>
        </View>

        {/* ── 6. Outcome ────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionHeader title="Outcome" />
          <View style={styles.sectionDivider} />

          <View style={{ marginBottom: 6 }}>
            <View style={styles.row2}>
              <View style={styles.col2}>
                <Field
                  label="Income Category"
                  value={nullableString(incomeCategory)}
                />
              </View>
              <View style={styles.col2}>
                <Field
                  label="Property Category"
                  value={propertyCategory != null ? String(propertyCategory) : "—"}
                />
              </View>
            </View>
          </View>

          <View style={styles.outcomeBox}>
            <Text style={styles.outcomeLabel}>Recommended Bursary Award</Text>
            <Text style={styles.outcomeValue}>
              {formatCurrency(bursaryAward)}
              {bursaryPct ? `  (${bursaryPct}%)` : ""}
            </Text>
            <View style={styles.outcomeFeeGrid}>
              <View style={styles.outcomeFeeItem}>
                <Text style={styles.outcomeFeeLabel}>Yearly Payable Fees</Text>
                <Text style={styles.outcomeFeeValue}>{formatCurrency(yearlyPayableFees)}</Text>
              </View>
              <View style={styles.outcomeFeeItem}>
                <Text style={styles.outcomeFeeLabel}>Monthly Payable Fees</Text>
                <Text style={styles.outcomeFeeValue}>{formatCurrency(monthlyPayableFees)}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── Footer ────────────────────────────────────────────────────── */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            John Whitgift Foundation — Bursary Assessment System
          </Text>
          <Text style={styles.footerText}>
            CONFIDENTIAL · {reference}
          </Text>
        </View>

      </Page>
    </Document>
  );
}
