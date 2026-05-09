## Appendices

### Appendix A: Reference Documents

| Document | Location | Description |
|----------|----------|-------------|
| README.md | `../README.md` | Master requirements document: system overview, two-layer data model, lifecycle, calculation model, reference tables, domain concepts, scope |
| APPLICATION.md | `../APPLICATION.md` | Complete field-by-field mapping of every input in the applicant portal |
| ADMIN.md | `../ADMIN.md` | Documentation of the current admin console structure and workflows |
| OPEN_QUESTIONS.md | `../OPEN_QUESTIONS.md` | 30 requirements questions with stakeholder answers |
| Assessment Model Spreadsheet | `./Assessment Model Notional Calculations - BW.xlsx` | Source spreadsheet for the four-stage calculation model and reference tables |
| Payable Fees Logic | `../payable_fees_logic.png` | Visual reference for the payable fees formula |
| Progress Report Schedule | `../image002.png` | Year-by-year re-assessment tracking in the current system |
| Reason Codes | `../image003.png` | Year-on-year bursary change reason codes |

### Appendix B: Glossary

Key terms are defined in the [Key Domain Concepts](../README.md#key-domain-concepts) section of README.md. The most critical terms for this PRD:

| Term | Definition |
|------|-----------|
| **Payable Fees** | The amount the family actually pays after scholarship and bursary deductions, plus VAT |
| **HNDI after NS** | Household Net Disposable Income after Necessary Spending — the key calculation output |
| **Two-Layer Data Model** | The separation between applicant-entered data (document collection) and assessor-entered data (calculation input) |
| **Benchmark** | The payable fees from the first year's assessment, acting as a floor for subsequent years |
| **Reason Codes** | Configurable codes explaining year-on-year changes in payable fees |
| **Lead Applicant** | The single parent/guardian with portal access, answering on behalf of the household |

### Appendix C: Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-02-22 | — | Initial draft |
| 1.1 | 2026-02-22 | — | Added data minimisation & name masking requirements (3.1.14 NM-01–NM-05), user stories US-B13/US-B14, non-functional requirement NF-16, updated wireframe descriptions for Application Queue and Assessment Form |
| 1.2 | 2026-02-22 | — | Added split-screen document viewer requirement (AE-17), user story US-B15, updated Assessment Form wireframe description |
