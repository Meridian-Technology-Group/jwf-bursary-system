/**
 * Submission PDF template — Epic 05 (plan §3.3, §5.2).
 *
 * Parent-facing PDF of a SUBMITTED application: the section-by-section answers,
 * uploaded-document list, and recorded T&Cs acceptance — the same read-only
 * snapshot the on-screen summary renders (both consume `buildSubmittedSummary`).
 *
 * Mirrors the recommendation PDF's shape and brand primitives. Generated on
 * demand (no storage), applicant-RLS scoped at the route.
 *
 * Runtime: nodejs (not edge — @react-pdf/renderer is not edge-compatible).
 */

import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { SubmittedSummary } from "@/lib/portal/application-summary";

// ─── Brand colours ──────────────────────────────────────────────────────────

const NAVY = "#0D1B2A";
const GOLD = "#B8862A";
const SLATE_600 = "#475569";
const SLATE_400 = "#94a3b8";
const SLATE_100 = "#f1f5f9";
const WHITE = "#ffffff";

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
  orgSubtitle: { fontSize: 8, color: SLATE_600, marginTop: 2 },
  docLabel: { fontSize: 8, color: SLATE_600, textAlign: "right" },
  docTitle: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
    textAlign: "right",
    marginTop: 2,
  },
  goldRule: { height: 2, backgroundColor: GOLD, marginBottom: 12 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 16, marginBottom: 16 },
  metaItem: { marginRight: 16 },
  metaLabel: {
    fontSize: 7,
    color: SLATE_400,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  metaValue: { fontSize: 9, color: NAVY, marginTop: 1 },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
    marginTop: 14,
    marginBottom: 6,
    paddingBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: SLATE_100,
  },
  row: {
    flexDirection: "row",
    paddingVertical: 2,
  },
  rowLabel: { width: "40%", color: SLATE_600 },
  rowValue: { width: "60%", color: NAVY },
  tableCaption: {
    fontSize: 8,
    color: SLATE_600,
    marginTop: 6,
    marginBottom: 2,
    fontFamily: "Helvetica-Bold",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: SLATE_100,
    paddingVertical: 2,
    paddingHorizontal: 3,
  },
  tableHeaderCell: {
    fontSize: 8,
    color: SLATE_600,
    fontFamily: "Helvetica-Bold",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 2,
    paddingHorizontal: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: SLATE_100,
  },
  tableCell: { fontSize: 8, color: NAVY },
  docItem: { fontSize: 8, color: SLATE_600, paddingVertical: 1 },
  declaration: { fontSize: 8, color: SLATE_600, marginTop: 4 },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    textAlign: "center",
    fontSize: 7,
    color: SLATE_400,
  },
});

export interface SubmissionPDFProps {
  reference: string;
  school: string;
  academicYear: string;
  childName: string | null;
  submittedDate: string;
  submittedLabel: string;
  summary: SubmittedSummary;
  termsAccepted: { date: string; version: string | null } | null;
  generatedAt: string;
}

export function SubmissionPDF({
  reference,
  school,
  academicYear,
  childName,
  submittedDate,
  submittedLabel,
  summary,
  termsAccepted,
  generatedAt,
}: SubmissionPDFProps) {
  const schoolLabel =
    school === "TRINITY"
      ? "Trinity School"
      : school === "WHITGIFT"
        ? "Whitgift School"
        : school;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.orgName}>John Whitgift Foundation</Text>
            <Text style={styles.orgSubtitle}>Bursary application</Text>
          </View>
          <View>
            <Text style={styles.docLabel}>{submittedLabel}</Text>
            <Text style={styles.docTitle}>Submission summary</Text>
          </View>
        </View>
        <View style={styles.goldRule} />

        {/* Meta */}
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Reference</Text>
            <Text style={styles.metaValue}>{reference}</Text>
          </View>
          {childName ? (
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Child</Text>
              <Text style={styles.metaValue}>{childName}</Text>
            </View>
          ) : null}
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>School</Text>
            <Text style={styles.metaValue}>{schoolLabel}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Round</Text>
            <Text style={styles.metaValue}>{academicYear}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Submitted</Text>
            <Text style={styles.metaValue}>{submittedDate}</Text>
          </View>
        </View>

        {/* Sections */}
        {summary.sections.map((section) => (
          <View key={section.sectionType} wrap={false}>
            <Text style={styles.sectionTitle}>{section.title}</Text>

            {section.rows.map((row) =>
              row.value ? (
                <View key={row.label} style={styles.row}>
                  <Text style={styles.rowLabel}>{row.label}</Text>
                  <Text style={styles.rowValue}>{row.value}</Text>
                </View>
              ) : (
                <Text key={row.label} style={styles.declaration}>
                  {row.label}
                </Text>
              )
            )}

            {section.tables?.map((table) => (
              <View key={table.caption}>
                <Text style={styles.tableCaption}>{table.caption}</Text>
                <View style={styles.tableHeader}>
                  {table.columns.map((col) => (
                    <Text
                      key={col}
                      style={[
                        styles.tableHeaderCell,
                        { width: `${100 / table.columns.length}%` },
                      ]}
                    >
                      {col}
                    </Text>
                  ))}
                </View>
                {table.rows.map((cells, i) => (
                  <View key={i} style={styles.tableRow}>
                    {cells.map((cell, j) => (
                      <Text
                        key={j}
                        style={[
                          styles.tableCell,
                          { width: `${100 / cells.length}%` },
                        ]}
                      >
                        {cell}
                      </Text>
                    ))}
                  </View>
                ))}
              </View>
            ))}

            {section.documents && section.documents.length > 0 ? (
              <View>
                <Text style={styles.tableCaption}>Documents</Text>
                {section.documents.map((doc, i) => (
                  <Text key={`${doc.slot}-${i}`} style={styles.docItem}>
                    • {doc.label}: {doc.filename}
                  </Text>
                ))}
              </View>
            ) : null}
          </View>
        ))}

        {/* Declaration / T&Cs */}
        <View wrap={false}>
          <Text style={styles.sectionTitle}>Declaration</Text>
          <Text style={styles.declaration}>
            {termsAccepted
              ? `Terms & Conditions accepted on submission (${termsAccepted.date}${
                  termsAccepted.version
                    ? `, version ${termsAccepted.version}`
                    : ""
                }).`
              : "Declaration and Terms & Conditions confirmed on submission."}
          </Text>
        </View>

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            `John Whitgift Foundation — generated ${generatedAt} · Page ${pageNumber} of ${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>
  );
}
