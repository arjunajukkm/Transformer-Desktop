# Stage 2B.0 gate update

## G01 — FAIL

The full test baseline improves from 517 pass /14 fail /3 skip (534 collected) to **533 pass /2 fail /3 skip (538 collected)**, with zero collection/setup/teardown errors and no regressions among previously passing tests. All 11 TEST_DEFECT failures and the current sidebar Escape crash are resolved. Four focus regressions were added. Targeted, module, full-suite and seeded order variations are recorded in the stabilization report and machine evidence.

G01 remains open for **MC14's two desired-behavior test failures** and **current packaged startup failure: missing reportlab.graphics.barcode.code128**. Build success alone is not desktop smoke acceptance. Existing broader manual/workflow/clean-machine smoke gaps are not waived.

## G02 — BLOCKED (unchanged)

All 60 Stage 2A characterization/contract checks remain passing and byte-preserved. No analytical formulas, policy rules, WFH/leave calculations, request reconstruction, history/pagination/export/cache behavior or approval statuses changed. MC14 remains unresolved and all existing HR/data/security/technical decisions retain their Stage 2A status. Passing UI tests do not approve metric semantics.

The Stage 2A evidence and original FAIL/BLOCKED gate record remain intact. This slice does not certify G03–G15 or authorize a future platform migration.
