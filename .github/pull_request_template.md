## Summary
<!-- One sentence: which story is tested and what this PR adds. -->

Closes #

## Changes
- `tests/usNN-<slug>.test.js` — <N> automated tests
- `docs/testing.md` — USNN test case table (Section 2) and Section 3 row

## Test cases
| ID | Kind | What it checks |
|---|---|---|
| TC-USNN-01 | normal | |
| TC-USNN-02 | error | |
| TC-USNN-03 | boundary, ... | |

## How to run
```bash
npm test                                       # full suite
npm test -- --test-name-pattern="TC-USNN"      # this story only
```

## Proof the tests can fail
| Rule broken on purpose | Test that turned red |
|---|---|
| `<file>`: `<original>` → `<broken>` | TC-USNN-0X |

All changes were reverted before committing.

## Checklist
- [ ] ≥3 cases: ≥1 normal, ≥1 error, boundary on both sides if the rule has a number
- [ ] Every table row has a test with the same ID, and vice versa
- [ ] No database, server, network, real clock or randomness
- [ ] No production code changed
- [ ] `npm test` passes from the repository root
