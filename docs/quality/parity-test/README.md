# Parity Test (MSA Schedule 1 §3)

> **STATUS: STUB** — contractual acceptance test. Awaiting the Foundation's ten
> historical cases (Schedule 1 §3; deadline was 15 May 2026).

## Purpose
The contractual parity test: run the assessment engine against ≥10 historical,
hand-worked cases and confirm every result is within 5% of the Foundation's
spreadsheet.

## To complete
- [ ] Obtain the ten historical cases from the Foundation (inputs + expected
      outputs).
- [ ] Encode them as fixtures here.
- [ ] Run them through the engine (`src/lib/assessment/*`) and produce a
      side-by-side comparison report.
- [ ] Record pass/fail per case (within 5%) and capture assessor sign-off.

The engine is well covered by unit tests (`src/lib/assessment/__tests__/`); this
test validates it against real Foundation-worked cases. See the assessment model
at [`../../product/assessment-model.xlsx`](../../product/assessment-model.xlsx).
