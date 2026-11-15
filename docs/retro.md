# Final Project Retrospective — What We Would Keep for Our Next Team

Across five sprints (M1 Requirements $\rightarrow$ M5 Production Release `v1.0`), Group 6 built, tested, and deployed **PriceLens** (`https://pricelens-lll0.onrender.com`). Below are the five practices we would carry forward unchanged into our next software engineering team:

1. **Executable Business Rules with Boundary Tests (`npm test` in < 1 second):**
   - Defining numeric limits in `docs/requirements.md` (such as BR1's 20-alert cap, BR2's target-below-current-price check, BR3's 24-hour staleness threshold, and BR8's out-of-stock exclusion) and pairing every rule with `just below`, `on the limit`, and `just above` test cases caught regressions before any code reached `main`.
2. **Idempotent One-Command Database Initialization (`npm run db:init`):**
   - Replacing platform-specific SQL/shell steps with a single version-controlled Node.js initializer (`backend/src/database/init-database.js`) that applies schema migrations and deterministic demo fixtures (`001-demo-data.js`) made local onboarding, CI verification, and Render production startup identical.
3. **Disjoint File Scoping per Sub-Issue Pull Request:**
   - Assigning each sub-issue a clear, non-overlapping set of files eliminated cross-PR merge conflicts and ensured every teammate owned and could explain a distinct slice of the architecture.
4. **Protected `main` Branch with Fast CI Gates (`Install, Build & Test`):**
   - Keeping the GitHub Actions CI run under 20 seconds meant reviewers never waited on slow pipelines, while branch protection guaranteed that broken builds could not be merged or deployed.
5. **Safe-by-Default Operational Logging and `/health` Probes:**
   - Centralizing credential/PII redaction in `backend/src/middleware/request-logger.js` and exposing a lightweight PostgreSQL-backed `GET /health` probe gave the team immediate production visibility without risking secret exposure.
