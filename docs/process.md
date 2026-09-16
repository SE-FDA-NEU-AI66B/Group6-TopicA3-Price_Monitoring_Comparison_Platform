# Software Process Dossier

## 1. Chosen Process and Its Position on the Spectrum

**(a) The model.** Our team will follow Incremental Development, supported by throwaway prototyping when dashboard or data-collection requirements are unclear. Each two-week Scrum sprint begins when the Product Owner orders the backlog and the team selects one small end-to-end increment, such as collecting prices, cleaning invalid records, storing the time series, and displaying a basic chart. We will create and discard low-cost mock-ups for uncertain interactions. Developers implement the work on feature branches, add tests, and open Pull Requests for peer review. We then merge approved work, demonstrate running software to the instructor or consulted users, collect feedback, and hold a retrospective led by the Scrum Master. Each cycle ends with a usable increment in `main`, test evidence, an updated backlog, and a retrospective record.

**(b) The position.** We place this process toward the agile end of the spectrum: approximately 75% agile with plan-driven milestone gates. The product objective, core collect-clean-store-visualize-alert pipeline, four milestones, final demo date, and repository review workflow remain fixed. Backlog priority, supported products or marketplaces, collection frequency, cleaning rules, dashboard design, and alert thresholds may be reconsidered between sprints. Within a sprint, the Sprint Goal is protected; new requests are recorded for a later cycle.

## 2. The Five Diagnostic Questions

**1. Are the requirements stable or volatile?** Our core requirements are stable: collect prices, clean the data, store price history, visualize changes, and notify users of price drops. However, details are moderately volatile. External pages or APIs may change, real data may contain missing values and outliers, and users may request different charts or alert thresholds after seeing a prototype. These uncertainties support early incremental testing.

**2. Is there safety or legal impact?** The platform is not safety-critical and will not make purchases or control equipment. We must nevertheless consider marketplace terms, permitted collection methods, rate limits, contact-data privacy, and the risk of misleading users with incorrect prices. These concerns require documented sources and data validation, but not the formal change control required for medical or core-banking software.

**3. Is the team large and distributed or small and co-located?** We are a small student team able to meet on campus or communicate quickly online. This keeps communication costs low and supports short feedback cycles. GitHub issues, Pull Requests, and written decisions will preserve accountability.

**4. Can the customer engage continuously?** The instructor can provide feedback during weekly classes and checkpoints, while potential users can be consulted when an increment is available. They cannot participate daily, so two-week Sprint Reviews provide a realistic feedback rhythm.

**5. What do culture and contract constraints allow?** The course fixes four milestones, the final demo date, process evidence, submission workflow, and instructor repository access. These create plan-driven boundaries, while the team may reprioritize its backlog and refine requirements inside them. A hybrid process therefore fits better than either extreme.

## 3. Risks of the Opposite Choice

If we used a fully plan-driven process, the largest risk would be discovering too late that the price-collection pipeline is unreliable. Freezing assumptions about sources, schemas, and cleaning rules before repeated end-to-end runs could let invalid or missing prices affect the database, dashboard, and alerts. The first symptom would be scheduled jobs returning empty or abnormal values, producing chart gaps or false price-drop alerts after dependent components were already built.

## 4. Process Rules

- Each sprint lasts two weeks, and the Product Owner reorders the backlog before Sprint Planning.
- Every change reaches `main` through a Pull Request reviewed and approved by at least one other member, with a substantive comment.
- An item moves to Done only when relevant tests pass, failure and missing-data cases are handled, the PR is merged, and necessary documentation is updated.
- Any requirement, source, or schema change after a sprint starts is recorded in `docs/changelog.md` and assessed through the Product Backlog.
- Within 24 hours of each Sprint Review, the Scrum Master records Keep, Drop, and Try actions in `docs/retro.md`.
