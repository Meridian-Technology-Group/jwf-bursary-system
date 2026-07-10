// prisma/seed-data/reason-codes.ts
// Reason codes for year-on-year circumstance changes.
//
// CALC-09 (decision D4) — deprecate-and-replace, never update-in-place
// (implementation-plan.md §2 item 6). The original 35 placeholder codes
// (1–35) are kept as rows — historic recommendations reference them by ID
// and must keep rendering their labels — but are now flagged
// `isDeprecated: true` so pickers stop offering them.
//
// The client's definitive 36-item list (implementation-plan.md Appendix D,
// workbook rows B217–B252) is appended as new rows using codes 101–136 to
// avoid colliding with the deprecated 1–35. The workbook's own 1–36 display
// numbering is preserved verbatim inside the label ("<n> - <text>"); only
// whitespace is normalised (the workbook has inconsistent spacing around
// some dashes, e.g. "7-  Illness") — wording, capitalisation and punctuation
// are transcribed exactly as written.

export const reasonCodes = [
  // --- Deprecated placeholders (1–35) — kept for historic recommendations ---
  { code: 1,  label: "No real change in circumstances",     sortOrder: 1,  isDeprecated: true },
  { code: 2,  label: "Property value increased",             sortOrder: 2,  isDeprecated: true },
  { code: 3,  label: "Salary increase",                      sortOrder: 3,  isDeprecated: true },
  { code: 4,  label: "New employment",                       sortOrder: 4,  isDeprecated: true },
  { code: 5,  label: "Additional income source",             sortOrder: 5,  isDeprecated: true },
  { code: 6,  label: "Savings increased",                    sortOrder: 6,  isDeprecated: true },
  { code: 7,  label: "Investment returns",                   sortOrder: 7,  isDeprecated: true },
  { code: 8,  label: "Rental income increase",               sortOrder: 8,  isDeprecated: true },
  { code: 9,  label: "Pension increase",                     sortOrder: 9,  isDeprecated: true },
  { code: 10, label: "Benefits increase",                    sortOrder: 10, isDeprecated: true },
  { code: 11, label: "Debt reduced",                         sortOrder: 11, isDeprecated: true },
  { code: 12, label: "Mortgage paid off",                    sortOrder: 12, isDeprecated: true },
  { code: 13, label: "Property sold (profit)",               sortOrder: 13, isDeprecated: true },
  { code: 14, label: "Inheritance received",                 sortOrder: 14, isDeprecated: true },
  { code: 15, label: "Business growth",                      sortOrder: 15, isDeprecated: true },
  { code: 16, label: "Bonus/commission received",            sortOrder: 16, isDeprecated: true },
  { code: 17, label: "Partner started working",              sortOrder: 17, isDeprecated: true },
  { code: 18, label: "Child left household",                 sortOrder: 18, isDeprecated: true },
  { code: 19, label: "Salary decrease",                      sortOrder: 19, isDeprecated: true },
  { code: 20, label: "Job loss/redundancy",                  sortOrder: 20, isDeprecated: true },
  { code: 21, label: "Business decline",                     sortOrder: 21, isDeprecated: true },
  { code: 22, label: "Separation/divorce",                   sortOrder: 22, isDeprecated: true },
  { code: 23, label: "Bereavement",                          sortOrder: 23, isDeprecated: true },
  { code: 24, label: "New dependent",                        sortOrder: 24, isDeprecated: true },
  { code: 25, label: "Medical costs increased",              sortOrder: 25, isDeprecated: true },
  { code: 26, label: "Debt increased",                       sortOrder: 26, isDeprecated: true },
  { code: 27, label: "Property value decreased",             sortOrder: 27, isDeprecated: true },
  { code: 28, label: "Savings depleted",                     sortOrder: 28, isDeprecated: true },
  { code: 29, label: "Investment losses",                    sortOrder: 29, isDeprecated: true },
  { code: 30, label: "Rental income decrease",                sortOrder: 30, isDeprecated: true },
  { code: 31, label: "Pension decrease",                     sortOrder: 31, isDeprecated: true },
  { code: 32, label: "Benefits decrease",                    sortOrder: 32, isDeprecated: true },
  { code: 33, label: "Partner stopped working",              sortOrder: 33, isDeprecated: true },
  { code: 34, label: "Additional child joined household",    sortOrder: 34, isDeprecated: true },
  { code: 35, label: "Stopped qualifying for benefits",      sortOrder: 35, isDeprecated: true },

  // --- Client's definitive YoY list (Appendix D, workbook B217–B252) ---
  // DB code = 101 + (display number - 1); sortOrder = display number.
  { code: 101, label: "1 - No year on year comparison, first assessment",           sortOrder: 1,  isDeprecated: false },
  { code: 102, label: "2 - No real change",                                        sortOrder: 2,  isDeprecated: false },
  { code: 103, label: "3 - Additional family member since last year",              sortOrder: 3,  isDeprecated: false },
  { code: 104, label: "4 - One of their children has left school since last year", sortOrder: 4,  isDeprecated: false },
  { code: 105, label: "5 - Divorce or separation",                                 sortOrder: 5,  isDeprecated: false },
  { code: 106, label: "6 - Bereavement",                                           sortOrder: 6,  isDeprecated: false },
  { code: 107, label: "7 - Illness",                                               sortOrder: 7,  isDeprecated: false },
  { code: 108, label: "8 - Sudden unemployment",                                   sortOrder: 8,  isDeprecated: false },
  { code: 109, label: "9 - Self-employed net profit increase/decrease",            sortOrder: 9,  isDeprecated: false },
  { code: 110, label: "10 - Bonus change year on year",                            sortOrder: 10, isDeprecated: false },
  { code: 111, label: "11 - Increase in Benefits",                                 sortOrder: 11, isDeprecated: false },
  { code: 112, label: "12 - Salary increase",                                      sortOrder: 12, isDeprecated: false },
  { code: 113, label: "13 - New job and decreased pay",                           sortOrder: 13, isDeprecated: false },
  { code: 114, label: "14 - New job and increased pay",                           sortOrder: 14, isDeprecated: false },
  { code: 115, label: "15 - Increased savings",                                    sortOrder: 15, isDeprecated: false },
  { code: 116, label: "16 - Inheritance",                                          sortOrder: 16, isDeprecated: false },
  { code: 117, label: "17 - Early Pension drawing",                                sortOrder: 17, isDeprecated: false },
  { code: 118, label: "18 - More Profitable or New Investments",                   sortOrder: 18, isDeprecated: false },
  { code: 119, label: "19 - Additional income not disclosed last year",           sortOrder: 19, isDeprecated: false },
  { code: 120, label: "20 - Stopped work to study",                                sortOrder: 20, isDeprecated: false },
  { code: 121, label: "21 - Became a student",                                     sortOrder: 21, isDeprecated: false },
  { code: 122, label: "22 - Mortgage now fully paid",                              sortOrder: 22, isDeprecated: false },
  { code: 123, label: "23 - New property asset acquired",                         sortOrder: 23, isDeprecated: false },
  { code: 124, label: "24 - Property asset has increased in value",               sortOrder: 24, isDeprecated: false },
  { code: 125, label: "25 - Additional asset not disclosed last year",           sortOrder: 25, isDeprecated: false },
  { code: 126, label: "26 - Re-mortgage agreement",                               sortOrder: 26, isDeprecated: false },
  { code: 127, label: "27 - Change in accommodation arrangements",               sortOrder: 27, isDeprecated: false },
  { code: 128, label: "28 - Failure to meet the deadline",                        sortOrder: 28, isDeprecated: false },
  { code: 129, label: "29 - Out of date documents used last year",               sortOrder: 29, isDeprecated: false },
  { code: 130, label: "30 - Forged or tampered with documents",                  sortOrder: 30, isDeprecated: false },
  { code: 131, label: "31 - Failure to provide required documents",              sortOrder: 31, isDeprecated: false },
  { code: 132, label: "32 - Other",                                               sortOrder: 32, isDeprecated: false },
  { code: 133, label: "33 - Error made by previous assessor",                    sortOrder: 33, isDeprecated: false },
  { code: 134, label: "34 - Reduced Payable fees due to scholarship offer",      sortOrder: 34, isDeprecated: false },
  { code: 135, label: "35 - Internal Bursary request originally",                sortOrder: 35, isDeprecated: false },
  { code: 136, label: "36 - Reduced savings",                                    sortOrder: 36, isDeprecated: false },
] as const;
