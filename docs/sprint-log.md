# Sprint log

## Sprint 1 - 31 August 2026 to 13 September 2026

### Sprint goal

Complete and align the PriceLens requirements so that the product vision, personas, scenarios, User Stories, Business Rules, screens and system flow are clear, consistent and testable.

### Required chore

| Issue | Owner | Close |
| --- | --- | --- |
| [#26 — Refine backlog for Sprint 1](https://github.com/SE-FDA-NEU-AI66B/Group6-TopicA3-Price_Monitoring_Comparison_Platform/issues/26) | @davvph (PO) | Yes |
| [#27 — Sprint 1 wrap-up](https://github.com/SE-FDA-NEU-AI66B/Group6-TopicA3-Price_Monitoring_Comparison_Platform/issues/27) | @adcc17 (SM) | Yes |

### Committed

| Issue | Story | Points | Owner |
| --- | --- | ---: | --- |
| [#15](https://github.com/SE-FDA-NEU-AI66B/Group6-TopicA3-Price_Monitoring_Comparison_Platform/issues/15) | Create requirements structure and product vision | 3 | @adcc17 |
| [#16](https://github.com/SE-FDA-NEU-AI66B/Group6-TopicA3-Price_Monitoring_Comparison_Platform/issues/16) | Conduct interviews and draft personas | 5 | @davvph |
| [#17](https://github.com/SE-FDA-NEU-AI66B/Group6-TopicA3-Price_Monitoring_Comparison_Platform/issues/17) | Write complete user scenarios | 3 | @davvph |
| [#18](https://github.com/SE-FDA-NEU-AI66B/Group6-TopicA3-Price_Monitoring_Comparison_Platform/issues/18) | Define US01–US06 and create Story Issues | 8 | @helian16 |
| [#19](https://github.com/SE-FDA-NEU-AI66B/Group6-TopicA3-Price_Monitoring_Comparison_Platform/issues/19) | Define US07–US12 and create Story Issues | 8 | @Tienachilles |
| [#20](https://github.com/SE-FDA-NEU-AI66B/Group6-TopicA3-Price_Monitoring_Comparison_Platform/issues/20) | Define six Business Rules | 5 | @helian16 |
| [#21](https://github.com/SE-FDA-NEU-AI66B/Group6-TopicA3-Price_Monitoring_Comparison_Platform/issues/21) | Define required screens | 3 | @minh7322 |
| [#22](https://github.com/SE-FDA-NEU-AI66B/Group6-TopicA3-Price_Monitoring_Comparison_Platform/issues/22) | Create the system flow diagram | 2 | @Tienachilles |
| [#23](https://github.com/SE-FDA-NEU-AI66B/Group6-TopicA3-Price_Monitoring_Comparison_Platform/issues/23) | Configure Project Board and README | 3 | @minh7322 |
| [#24](https://github.com/SE-FDA-NEU-AI66B/Group6-TopicA3-Price_Monitoring_Comparison_Platform/issues/24) | Prepare Sprint log | 2 | @adcc17 |
| [#45](https://github.com/SE-FDA-NEU-AI66B/Group6-TopicA3-Price_Monitoring_Comparison_Platform/issues/45) | Align US01–US06 with updated Personas and Scenarios | — | @helian16 |
| [#49](https://github.com/SE-FDA-NEU-AI66B/Group6-TopicA3-Price_Monitoring_Comparison_Platform/issues/49) | Fix duplicate Section 2 | — | @adcc17 |
| [#52](https://github.com/SE-FDA-NEU-AI66B/Group6-TopicA3-Price_Monitoring_Comparison_Platform/issues/52) | Update and align Business Rules with US01–US12 | 3 | @adcc17 |
| [#61](https://github.com/SE-FDA-NEU-AI66B/Group6-TopicA3-Price_Monitoring_Comparison_Platform/issues/61) | Resolve remaining Milestone 1 documentation gaps | — | @davvph, @adcc17 |

**Total committed: 45 points**

### Result

| Issue | Points | Status | If not done, why |
| --- | ---: | --- | --- |
| #15 | 3 | Done | — |
| #16 | 5 | Done | — |
| #17 | 3 | Done | — |
| #18 | 8 | Done | — |
| #19 | 8 | Done | — |
| #20 | 5 | Done | — |
| #21 | 3 | Done | — |
| #22 | 2 | Done | — |
| #23 | 3 | Carried over | The README and remaining Project Board configuration were not completed before the Sprint 1 log was finalized. |
| #24 | 2 | Done | — |
| #45 | — | Done | — |
| #49 | — | Done | — |
| #52 | 3 | Done | — |
| #61 | — | Done | — |

**Completed: 42 points. Velocity this sprint: 42 points.**

### Sprint Review

- **What we demonstrated:** A complete PriceLens requirements document containing a one-sentence Product Vision, three personas, three end-to-end scenarios, twelve checkable User Stories, enforceable Business Rules, a screen inventory and a connected screen-flow diagram.
- **Feedback received:** Review feedback identified inconsistencies among personas, scenarios, User Stories and Business Rule references, as well as missing documentation details that needed to be aligned before submission.
- **Backlog changes as a result:** US01–US12 and their Business Rule references were aligned, duplicate content and duplicate Story Issues were removed or closed, and the remaining documentation gaps were resolved through follow-up tasks.

### Retrospective

| Keep doing | Stop doing | Start doing |
| --- | --- | --- |
| Split each requirements section into a focused Pull Request and require another member to review it. | Create duplicate Issues or allow Story Issue content to differ from `docs/requirements.md`. | Update the Project Board and `docs/sprint-log.md` during the sprint whenever scope or status changes. |

**One concrete action for next sprint (with an owner):** @adcc17 will update `docs/sprint-log.md` immediately after Sprint Planning, Sprint Review and the Retrospective in Sprint 2.

**Scrum Master for Sprint 2:** @adcc17

### Sprint 2 implementation decision — 4 October 2026

PostgreSQL remains the PriceLens database engine and the approved nine-table data model is unchanged. Database initialization now runs through version-controlled JavaScript in the backend with `npm run db:init`; this replaces the tracked `.sql`, PowerShell and Bash initializer files so the implementation complies with the shared CI policy without changing application behaviour.

### Attendance

| Member | Planning | Review | Retro |
| --- | --- | --- | --- |
| @adcc17 | Present | Present | Present |
| @davvph | Present | Present | Present |
| @Tienachilles | Present | Present | Present |
| @helian16 | Present | Present | Present |
| @minh7322 | Present | Present | Present |

---

## Sprint 2 - 14 September 2026 to 27 September 2026

### Sprint goal

Design the PriceLens architecture and deliver a working end-to-end walking skeleton that retrieves seeded data from a real PostgreSQL database, displays it through a running application route and can be installed on a new machine by following `docs/SETUP.md`.

### Sprint roles

| Role | Member |
| --- | --- |
| Product Owner | @davvph |
| Scrum Master | @helian16 |

The Sprint 2 Scrum Master differs from the Sprint 1 Scrum Master, @adcc17.

### Required chore

| Issue | Owner | Close |
| --- | --- | --- |
| [#65 — Refine backlog for Sprint 2](https://github.com/SE-FDA-NEU-AI66B/Group6-TopicA3-Price_Monitoring_Comparison_Platform/issues/65) | @davvph (PO) | Yes |
| [#66 — Sprint 2 wrap-up](https://github.com/SE-FDA-NEU-AI66B/Group6-TopicA3-Price_Monitoring_Comparison_Platform/issues/66) | @helian16 (SM) | No — closes after final submission verification |

### Workstream summary

| Parent | Workstream | Result |
| --- | --- | --- |
| [#67](https://github.com/SE-FDA-NEU-AI66B/Group6-TopicA3-Price_Monitoring_Comparison_Platform/issues/67) | System Architecture | All 5 committed Sub-Issues completed |
| [#73](https://github.com/SE-FDA-NEU-AI66B/Group6-TopicA3-Price_Monitoring_Comparison_Platform/issues/73) | Data and Persistence | All 4 committed Sub-Issues completed |
| [#78](https://github.com/SE-FDA-NEU-AI66B/Group6-TopicA3-Price_Monitoring_Comparison_Platform/issues/78) | API and Backend | All 4 committed Sub-Issues completed |
| [#83](https://github.com/SE-FDA-NEU-AI66B/Group6-TopicA3-Price_Monitoring_Comparison_Platform/issues/83) | User Interface and System Integration | All 4 committed Sub-Issues completed |
| [#88](https://github.com/SE-FDA-NEU-AI66B/Group6-TopicA3-Price_Monitoring_Comparison_Platform/issues/88) | Release, Documentation and Quality Assurance | 4 of 5 committed Sub-Issues completed; final PDF remains |

Parent Issues and unestimated administrative Chores organise the work but are not included in committed points or velocity.

### Committed

| Issue | Story | Points | Owner |
| --- | --- | ---: | --- |
| [#23](https://github.com/SE-FDA-NEU-AI66B/Group6-TopicA3-Price_Monitoring_Comparison_Platform/issues/23) | Complete the Project Board and README work carried over from Sprint 1 | 3 | @minh7322 |
| [#68](https://github.com/SE-FDA-NEU-AI66B/Group6-TopicA3-Price_Monitoring_Comparison_Platform/issues/68) | Identify architectural drivers and system boundaries | 3 | @helian16 |
| [#69](https://github.com/SE-FDA-NEU-AI66B/Group6-TopicA3-Price_Monitoring_Comparison_Platform/issues/69) | Define component responsibilities and integration boundaries | 3 | @helian16 |
| [#70](https://github.com/SE-FDA-NEU-AI66B/Group6-TopicA3-Price_Monitoring_Comparison_Platform/issues/70) | Create the PriceLens container architecture diagram | 3 | @helian16 |
| [#71](https://github.com/SE-FDA-NEU-AI66B/Group6-TopicA3-Price_Monitoring_Comparison_Platform/issues/71) | Document two PriceLens Architecture Decision Records | 3 | @helian16 |
| [#72](https://github.com/SE-FDA-NEU-AI66B/Group6-TopicA3-Price_Monitoring_Comparison_Platform/issues/72) | Integrate and validate the architecture documentation | 3 | @helian16 |
| [#74](https://github.com/SE-FDA-NEU-AI66B/Group6-TopicA3-Price_Monitoring_Comparison_Platform/issues/74) | Identify persistent entities and relationships | 3 | @minh7322 |
| [#75](https://github.com/SE-FDA-NEU-AI66B/Group6-TopicA3-Price_Monitoring_Comparison_Platform/issues/75) | Create the PriceLens ERD and data dictionary | 3 | @minh7322 |
| [#76](https://github.com/SE-FDA-NEU-AI66B/Group6-TopicA3-Price_Monitoring_Comparison_Platform/issues/76) | Implement the database schema and rule-related constraints | 5 | @minh7322 |
| [#77](https://github.com/SE-FDA-NEU-AI66B/Group6-TopicA3-Price_Monitoring_Comparison_Platform/issues/77) | Create and validate database initialization and seed data | 3 | @minh7322 |
| [#79](https://github.com/SE-FDA-NEU-AI66B/Group6-TopicA3-Price_Monitoring_Comparison_Platform/issues/79) | Map P0 User Stories to API operations | 3 | @Tienachilles |
| [#80](https://github.com/SE-FDA-NEU-AI66B/Group6-TopicA3-Price_Monitoring_Comparison_Platform/issues/80) | Define API contracts, validation and error responses | 3 | @Tienachilles |
| [#81](https://github.com/SE-FDA-NEU-AI66B/Group6-TopicA3-Price_Monitoring_Comparison_Platform/issues/81) | Implement the database-backed walking-skeleton route | 5 | @Tienachilles |
| [#82](https://github.com/SE-FDA-NEU-AI66B/Group6-TopicA3-Price_Monitoring_Comparison_Platform/issues/82) | Test and document the API and backend handoff | 3 | @Tienachilles |
| [#84](https://github.com/SE-FDA-NEU-AI66B/Group6-TopicA3-Price_Monitoring_Comparison_Platform/issues/84) | Finalize the walking-skeleton page and integration contract | 2 | @davvph |
| [#85](https://github.com/SE-FDA-NEU-AI66B/Group6-TopicA3-Price_Monitoring_Comparison_Platform/issues/85) | Build the PriceLens walking-skeleton user interface | 3 | @davvph |
| [#86](https://github.com/SE-FDA-NEU-AI66B/Group6-TopicA3-Price_Monitoring_Comparison_Platform/issues/86) | Connect and verify the end-to-end database flow | 5 | @davvph |
| [#87](https://github.com/SE-FDA-NEU-AI66B/Group6-TopicA3-Price_Monitoring_Comparison_Platform/issues/87) | Document the walking skeleton and capture evidence | 3 | @davvph |
| [#89](https://github.com/SE-FDA-NEU-AI66B/Group6-TopicA3-Price_Monitoring_Comparison_Platform/issues/89) | Create the setup guide and environment example | 5 | @adcc17 |
| [#90](https://github.com/SE-FDA-NEU-AI66B/Group6-TopicA3-Price_Monitoring_Comparison_Platform/issues/90) | Verify the setup guide on a fresh machine | 3 | @adcc17 |
| [#91](https://github.com/SE-FDA-NEU-AI66B/Group6-TopicA3-Price_Monitoring_Comparison_Platform/issues/91) | Document changes since Milestone 1 | 2 | @adcc17 |
| [#92](https://github.com/SE-FDA-NEU-AI66B/Group6-TopicA3-Price_Monitoring_Comparison_Platform/issues/92) | Update README and the Sprint 2 sprint log | 2 | @adcc17 |
| [#93](https://github.com/SE-FDA-NEU-AI66B/Group6-TopicA3-Price_Monitoring_Comparison_Platform/issues/93) | Prepare and verify the Milestone 2 PDF | 3 | @adcc17 |

**Total committed: 74 points**

### Result

| Issue | Points | Status | If not done, why |
| --- | ---: | --- | --- |
| #23 | 3 | Done | Carried over from Sprint 1 and completed with the Sprint 2 README and board updates. |
| #68 | 3 | Done | — |
| #69 | 3 | Done | — |
| #70 | 3 | Done | — |
| #71 | 3 | Done | — |
| #72 | 3 | Done | — |
| #74 | 3 | Done | — |
| #75 | 3 | Done | — |
| #76 | 5 | Done | — |
| #77 | 3 | Done | — |
| #79 | 3 | Done | — |
| #80 | 3 | Done | — |
| #81 | 5 | Done | — |
| #82 | 3 | Done | — |
| #84 | 2 | Done | — |
| #85 | 3 | Done | — |
| #86 | 5 | Done | — |
| #87 | 3 | Done | — |
| #89 | 5 | Done | — |
| #90 | 3 | Done | — |
| #91 | 2 | Done | — |
| #92 | 2 | Done | — |
| #93 | 3 | Not finished | The final PDF must be prepared and verified after all documentation is merged. |

**Completed: 71 points. Velocity this sprint: 71 points.**

**Not finished:** #93 will produce and verify `Team06_M2.pdf`, record the relevant Pull Request and merge commit hash, and complete the final submission checks. After #93 is complete, the Scrum Master will close the Sprint 2 wrap-up Chore and the release Parent Issue.

### Sprint Review

- **What we demonstrated:** A complete six-section PriceLens design document, a nine-table PostgreSQL data layer, documented API contracts, an authenticated database-backed `/watchlist` walking skeleton and a reproducible setup process tested on another machine.
- **Verified result:** The demonstration user can sign in and open `/watchlist`, where exactly 10 products are loaded from PostgreSQL. The browser-to-frontend-to-backend-to-database path is supported by backend, frontend and screenshot evidence.
- **Feedback received:** The initial setup instructions were too difficult for a new user to follow, and the database initialization approach needed to comply with the shared CI policy and remain consistent across operating systems.
- **Backlog changes as a result:** The setup guide was simplified into one ordered workflow, Windows Command Prompt guidance and database-only cleanup were added, database initialization was consolidated into `npm run db:init`, an independent fresh-machine test was recorded and changes since Milestone 1 were documented.
- **Remaining release work:** Only the final Milestone 2 PDF preparation and verification in #93 remains.

### Retrospective

| Keep doing | Stop doing | Start doing |
| --- | --- | --- |
| Split each design, implementation and verification area into a focused Pull Request and require substantive review by another member. | Allow Project Board fields, Issue state and documentation status to fall out of sync after a Pull Request is merged. | Update the board and sprint log immediately after each merge, then run the setup guide on another machine before release preparation begins. |

**One concrete action for the next release step (with an owner):** @helian16 will verify the final Project Board state, capture the final board screenshot and close #66 after #93 and the release checks are complete.

### Attendance

| Member | Planning | Review | Retro |
| --- | --- | --- | --- |
| @adcc17 | Present | Present | Present |
| @davvph | Present | Present | Present |
| @Tienachilles | Present | Present | Present |
| @helian16 | Present | Present | Present |
| @minh7322 | Present | Present | Present |
