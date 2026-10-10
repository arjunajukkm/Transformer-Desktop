# Golden dataset catalogue

Version 1. All new identities are SYN-prefixed synthetic records; no production workbook was read. 58 executable characterization cases plus 8 future-only design examples = 66 catalogued scenarios. Two additional metadata tests are not counted as domain scenarios.

| Fixture | Grain/important inputs | Hand-reviewable expected arithmetic | Metrics/purpose | Gate/conflict |
|---|---|---|---|---|
| attendance.json | 8 observations / 7 days; A1+A2 are distinct 0.5 events; A6 quantity 2; A8 unknown | 5 evaluable eligible days, one DQ exclusion; MS/absence/regularization each 1/5=20%; split quantity 1 | 3 attendance rates, zero/null variants | G02/MC06 |
| approvals.json | B1/B2 share request identity; B3 another request; B4–B7 pending | Turnaround [2,2,8]: sum12/count3 mean4 median2; request alternative5. Ages [5,1] at 2026-10-10 mean3; future/missing application excluded | 4 approval metrics | G02/MC04/MC10 |
| timing.json | 5 requests: advance2, same0, late4, missing, critical DQ | Mean [-2,0,4]=2/3 rounds0.7; DQ1 unknown1; separate legacy point numerator2 and rate66.7 | Leave timing and opposite-sign legacy lead time | G02/MC03/MC05/MC13 |
| working_time.json | 3 valid physical observations, WFH excluded, one null punch | Duration [480,540,660] mean560 median540; arrival [540,600,720] mean620 median600; exit [1020,1140,1380] mean1180 median1140, all minutes | 6 working-time measures | G02 |
| wfh.json | 6 events, one half day, two months and BU movement | October3.5 exceeds3 by0.5; November2 excess0. Total5.5; legacy6 rows excess3; one-day display1 retains monthly excess0.5; reverse input changes BU | Monthly WFH, legacy WFH, fallback, scope/transfer | G02/MC02/MC07/MC08 |
| policy.json | 13 requests around policy boundary, PL tiers, lag3/4, missing Applied On and DQ | 12 post-policy, DQ1, evaluable11, compliant6, rate54.55; compliant IDs explicit. Pre-policy separate benchmark | Post-policy compliance and rule classifications | G02/MC12 |
| future_expectations.json | 8 design-only scenarios: revisions/corrections/retractions/overlap/partial API/security/scope/formula text | Desired membership/quantity/completeness states explicit; unsupported revision/security contracts are not runtime passes | Future behavior; NOT approval | G03–G09 design only |
| metric_contracts.json | 20 versioned metadata contracts, not runtime engine | Required fields, source lineage, test references, limitations and business approval status | 18 mapped/catalogue metrics plus 2 legacy comparisons | G02 metadata |

## Inline synthetic cases
The test files also define exact zero/null denominators, WFH lag boundaries, null/zero/negative quantity fallback, late-punch exact60/>60/>240 comparisons, scalar/vector alias differences, same-day history loss, cap-hit pagination, export argument capture, formula cell type, cache as-of replay, request source-row lineage and manager/employee/date membership. These use the same SYN identity convention. `golden_scenarios.json` lists each executable case and its result.

## Independent expectation policy
Expected JSON values were authored from arithmetic and inspected rules, not serialized from a production run. A draft compliant-count arithmetic error was corrected from 7 to 6 after enumerating POL01/03/04/06/08/11; the formula was not changed. Counts, IDs, quantities and rounded values compare exactly. Fractional unrounded mean 2/3 is documented explicitly; only that mean permits absolute 1e-9 in a future engine comparison. No global approximate assertion is used. Means/medians have differing working-time inputs to detect accidental substitution.

## Limits
Observation IDs in fixtures are test lineage, not a claim of stable runtime native event identities. Current code lacks versioned retractions and authorization; their design expectations are explicitly separate. Missing quantity is observable as a warning/evaluable day in the current fact path, while WFH defaults it to one. Input coverage is partial/unknown unless the fixture supplies a synthetic complete envelope. The legacy runtime does not expose uniform coverage or policy-version fields; the manifest supplies source-policy checksum.
