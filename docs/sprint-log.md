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

---

## Sprint 3 - 28 September 2026 to 11 October 2026

### Sprint goal

Extend the Milestone 2 walking skeleton into a usable PriceLens application where all five P0 User Stories work end to end with PostgreSQL-backed data, clear Business Rule feedback, integrated navigation, reproducible setup and release documentation.

### Sprint roles

| Role | Member |
| --- | --- |
| Product Owner | @davvph |
| Scrum Master | @Tienachilles |

The Sprint 3 Scrum Master differs from the Sprint 1 Scrum Master, @adcc17, and the Sprint 2 Scrum Master, @helian16.

### Required chore

| Issue | Owner | Close |
| --- | --- | --- |
| [#155 — Refine backlog for Sprint 3](https://github.com/SE-FDA-NEU-AI66B/Group6-TopicA3-Price_Monitoring_Comparison_Platform/issues/155) | @davvph (PO) | Yes |
| [#156 — Sprint 3 wrap-up](https://github.com/SE-FDA-NEU-AI66B/Group6-TopicA3-Price_Monitoring_Comparison_Platform/issues/156) | @Tienachilles (SM) | Yes |

### Workstream summary

| Parent | Workstream | Result |
| --- | --- | --- |
| [#124](https://github.com/SE-FDA-NEU-AI66B/Group6-TopicA3-Price_Monitoring_Comparison_Platform/issues/124) | Frontend Foundation and Shared UI/UX | All 5 committed Sub-Issues completed; Parent remains open on the board |
| [#130](https://github.com/SE-FDA-NEU-AI66B/Group6-TopicA3-Price_Monitoring_Comparison_Platform/issues/130) | Backend and Persistence Foundation | All 5 committed Sub-Issues completed; Parent remains open on the board |
| [#136](https://github.com/SE-FDA-NEU-AI66B/Group6-TopicA3-Price_Monitoring_Comparison_Platform/issues/136) | Product Tracking and Price Insights | All 6 committed Sub-Issues completed; Parent remains open on the board |
| [#143](https://github.com/SE-FDA-NEU-AI66B/Group6-TopicA3-Price_Monitoring_Comparison_Platform/issues/143) | Price Alerts and Notifications | All 5 committed Sub-Issues completed; Parent remains open on the board |
| [#149](https://github.com/SE-FDA-NEU-AI66B/Group6-TopicA3-Price_Monitoring_Comparison_Platform/issues/149) | Integration, QA and Milestone 3 Release | 4 of 5 committed Sub-Issues completed; #154 remains in progress |

Parent Issues and unestimated administrative Chores organise the work but are not included in committed points or velocity. The Sprint 3 Project Board defines the iteration as 28 September to 11 October 2026. GitHub records show that the Sprint 3 Issues and PRs were created or completed after that iteration window, so the result below records the verified release state at wrap-up rather than claiming that those closures occurred by 11 October.

### Committed

| Issue | Story | Points | Owner |
| --- | --- | ---: | --- |
| [#125](https://github.com/SE-FDA-NEU-AI66B/Group6-TopicA3-Price_Monitoring_Comparison_Platform/issues/125) | Define the shared visual system and P0 wireframes | 3 | @helian16 |
| [#126](https://github.com/SE-FDA-NEU-AI66B/Group6-TopicA3-Price_Monitoring_Comparison_Platform/issues/126) | Create the shared frontend structure and P0 page templates | 3 | @helian16 |
| [#127](https://github.com/SE-FDA-NEU-AI66B/Group6-TopicA3-Price_Monitoring_Comparison_Platform/issues/127) | Implement shared design tokens and reusable UI components | 3 | @helian16 |
| [#128](https://github.com/SE-FDA-NEU-AI66B/Group6-TopicA3-Price_Monitoring_Comparison_Platform/issues/128) | Implement shared API, session, formatting and error utilities | 3 | @helian16 |
| [#129](https://github.com/SE-FDA-NEU-AI66B/Group6-TopicA3-Price_Monitoring_Comparison_Platform/issues/129) | Refactor landing and watchlist onto the Sprint 3 foundation | 3 | @helian16 |
| [#131](https://github.com/SE-FDA-NEU-AI66B/Group6-TopicA3-Price_Monitoring_Comparison_Platform/issues/131) | Establish the shared backend module structure | 3 | @davvph |
| [#132](https://github.com/SE-FDA-NEU-AI66B/Group6-TopicA3-Price_Monitoring_Comparison_Platform/issues/132) | Implement shared validation and problem responses | 3 | @davvph |
| [#133](https://github.com/SE-FDA-NEU-AI66B/Group6-TopicA3-Price_Monitoring_Comparison_Platform/issues/133) | Finalise authentication, ownership and database access | 3 | @davvph |
| [#134](https://github.com/SE-FDA-NEU-AI66B/Group6-TopicA3-Price_Monitoring_Comparison_Platform/issues/134) | Extend deterministic seed data for P0 scenarios | 3 | @davvph |
| [#135](https://github.com/SE-FDA-NEU-AI66B/Group6-TopicA3-Price_Monitoring_Comparison_Platform/issues/135) | Establish automated-test conventions and P0 fixtures | 3 | @davvph |
| [#137](https://github.com/SE-FDA-NEU-AI66B/Group6-TopicA3-Price_Monitoring_Comparison_Platform/issues/137) | Implement US04 backend resolution and tracking | 4 | @Tienachilles |
| [#138](https://github.com/SE-FDA-NEU-AI66B/Group6-TopicA3-Price_Monitoring_Comparison_Platform/issues/138) | Implement the US04 frontend flow | 4 | @Tienachilles |
| [#139](https://github.com/SE-FDA-NEU-AI66B/Group6-TopicA3-Price_Monitoring_Comparison_Platform/issues/139) | Implement US02 backend history and summary | 4 | @Tienachilles |
| [#140](https://github.com/SE-FDA-NEU-AI66B/Group6-TopicA3-Price_Monitoring_Comparison_Platform/issues/140) | Implement the US02 Product Details experience | 4 | @Tienachilles |
| [#141](https://github.com/SE-FDA-NEU-AI66B/Group6-TopicA3-Price_Monitoring_Comparison_Platform/issues/141) | Implement US09 exact-variant comparison | 4 | @Tienachilles |
| [#142](https://github.com/SE-FDA-NEU-AI66B/Group6-TopicA3-Price_Monitoring_Comparison_Platform/issues/142) | Implement the US09 comparison experience | 4 | @Tienachilles |
| [#144](https://github.com/SE-FDA-NEU-AI66B/Group6-TopicA3-Price_Monitoring_Comparison_Platform/issues/144) | Implement US03 backend alert creation and BR1/BR2 | 4 | @minh7322 |
| [#145](https://github.com/SE-FDA-NEU-AI66B/Group6-TopicA3-Price_Monitoring_Comparison_Platform/issues/145) | Implement US03 frontend alert creation and feedback | 4 | @minh7322 |
| [#146](https://github.com/SE-FDA-NEU-AI66B/Group6-TopicA3-Price_Monitoring_Comparison_Platform/issues/146) | Implement US05 price observation and BR4 evaluation | 4 | @minh7322 |
| [#147](https://github.com/SE-FDA-NEU-AI66B/Group6-TopicA3-Price_Monitoring_Comparison_Platform/issues/147) | Implement US05 notification delivery | 4 | @minh7322 |
| [#148](https://github.com/SE-FDA-NEU-AI66B/Group6-TopicA3-Price_Monitoring_Comparison_Platform/issues/148) | Provide the reproducible US05 demonstration flow | 3 | @minh7322 |
| [#150](https://github.com/SE-FDA-NEU-AI66B/Group6-TopicA3-Price_Monitoring_Comparison_Platform/issues/150) | Connect all P0 screens and browser navigation | 3 | @adcc17 |
| [#151](https://github.com/SE-FDA-NEU-AI66B/Group6-TopicA3-Price_Monitoring_Comparison_Platform/issues/151) | Verify all P0 stories against M1 acceptance criteria | 4 | @adcc17 |
| [#152](https://github.com/SE-FDA-NEU-AI66B/Group6-TopicA3-Price_Monitoring_Comparison_Platform/issues/152) | Create the Milestone 3 UI document | 4 | @adcc17 |
| [#153](https://github.com/SE-FDA-NEU-AI66B/Group6-TopicA3-Price_Monitoring_Comparison_Platform/issues/153) | Verify SETUP and README from a fresh clone | 4 | @adcc17 |
| [#154](https://github.com/SE-FDA-NEU-AI66B/Group6-TopicA3-Price_Monitoring_Comparison_Platform/issues/154) | Complete Sprint 3 records and submission evidence | 3 | @adcc17 |

**Total committed: 91 points**

### Result

| Issue | Points | Status | If not done, why |
| --- | ---: | --- | --- |
| #125 | 3 | Done | — |
| #126 | 3 | Done | — |
| #127 | 3 | Done | — |
| #128 | 3 | Done | — |
| #129 | 3 | Done | — |
| #131 | 3 | Done | — |
| #132 | 3 | Done | — |
| #133 | 3 | Done | — |
| #134 | 3 | Done | — |
| #135 | 3 | Done | — |
| #137 | 4 | Done | — |
| #138 | 4 | Done | — |
| #139 | 4 | Done | — |
| #140 | 4 | Done | — |
| #141 | 4 | Done | — |
| #142 | 4 | Done | — |
| #144 | 4 | Done | — |
| #145 | 4 | Done | — |
| #146 | 4 | Done | — |
| #147 | 4 | Done | — |
| #148 | 3 | Done | — |
| #150 | 3 | Done | — |
| #151 | 4 | Done | — |
| #152 | 4 | Done | — |
| #153 | 4 | Done | — |
| #154 | 3 | Not finished | Sprint records are updated here, but the user-maintained `Team06_M3.pdf` and required screenshot evidence are not present in this repository for verification. |

**Completed: 88 points. Velocity this sprint: 88 points.**

**Not finished:** #154 remains in progress until the final PDF and evidence are available and checked against the repository. The five Parent Issues remain open on the Project Board even though four workstreams show every Child Issue complete.

### Sprint Review

- **What we demonstrated:** All five P0 stories work through their intended browser or background flow with PostgreSQL-backed data: US02, US03, US04, US05 and US09.
- **Verified result:** The final acceptance record reports 18 passing P0 Acceptance Criteria, integrated browser navigation, clear BR2 feedback and a successful fresh-clone setup run.
- **Feedback received:** Release verification found gaps in P0 entry-point guidance, environment documentation and the short US05 run path. Those gaps were corrected in README, `docs/SETUP.md` and `.env.example`.
- **Backlog changes as a result:** No new feature scope was added. Release tasks #150–#153 completed integration, acceptance evidence, UI documentation and setup verification.
- **Remaining release work:** #154 must verify the external PDF and screenshot evidence and reconcile the five open Parent Issues with their completed Child Issues.

#### Repository evidence

All 25 Sprint 3 PRs from #157 through #181 are merged. Each has at least one submitted review from a member other than the author. Representative evidence covering every author is listed below.

| PR | Title | Author | Other-member approval | Merge status |
| --- | --- | --- | --- | --- |
| [#157](https://github.com/SE-FDA-NEU-AI66B/Group6-TopicA3-Price_Monitoring_Comparison_Platform/pull/157) | Add Sprint 3 P0 screen wireframes | @helian16 | @adcc17 | Merged |
| [#162](https://github.com/SE-FDA-NEU-AI66B/Group6-TopicA3-Price_Monitoring_Comparison_Platform/pull/162) | Establish shared backend module structure | @davvph | @helian16 | Merged |
| [#167](https://github.com/SE-FDA-NEU-AI66B/Group6-TopicA3-Price_Monitoring_Comparison_Platform/pull/167) | Implement US04 backend resolution and tracked-product creation | @Tienachilles | @helian16 | Merged |
| [#173](https://github.com/SE-FDA-NEU-AI66B/Group6-TopicA3-Price_Monitoring_Comparison_Platform/pull/173) | Implement US03 backend alert creation and BR1/BR2 | @minh7322 | @helian16 | Merged |
| [#178](https://github.com/SE-FDA-NEU-AI66B/Group6-TopicA3-Price_Monitoring_Comparison_Platform/pull/178) | Connect all P0 screens and browser navigation | @adcc17 | @minh7322 | Merged |

The P0 Story Issues [#37](https://github.com/SE-FDA-NEU-AI66B/Group6-TopicA3-Price_Monitoring_Comparison_Platform/issues/37), [#38](https://github.com/SE-FDA-NEU-AI66B/Group6-TopicA3-Price_Monitoring_Comparison_Platform/issues/38), [#39](https://github.com/SE-FDA-NEU-AI66B/Group6-TopicA3-Price_Monitoring_Comparison_Platform/issues/39), [#40](https://github.com/SE-FDA-NEU-AI66B/Group6-TopicA3-Price_Monitoring_Comparison_Platform/issues/40) and [#56](https://github.com/SE-FDA-NEU-AI66B/Group6-TopicA3-Price_Monitoring_Comparison_Platform/issues/56) are closed. The Sprint 3 board currently contains 27 Done items, including completed implementation, release tasks and the two required Chores.

| Member | Merged PR | Review given | Closed Issue | Requirement met |
| --- | --- | --- | --- | --- |
| @adcc17 | #178 | Approved #157 | #150 | Yes |
| @davvph | #162 | Approved #168 | #131 | Yes |
| @Tienachilles | #167 | Approved #164 | #137 | Yes |
| @helian16 | #157 | Approved #162 | #125 | Yes |
| @minh7322 | #173 | Approved #160 | #144 | Yes |

#### Submission checklist

| Area | Check | Status |
| --- | --- | --- |
| Repository | `docs/ui.md`, updated `docs/design.md`, verified `docs/SETUP.md`, README P0 starts and Sprint 3 log | Complete |
| GitHub | Minimum merged PRs, closed P0 Issues and per-member contributions | Complete |
| Project Board | Current Sprint 3 state inspected; 27 Done, 1 In Progress and 5 Parent Issues in Todo | Complete |
| Board evidence | Planning and submission-day screenshots | Not stored in this repository; omitted from this change at the user's request |
| Application evidence | Real-data P0 and clear-error screenshots with browser address bar | Not stored in this repository; Edge automation did not provide browser chrome |
| PDF | Exact filename, cover, links, evidence pages, `docs/ui.md` content and visual QA | User reports the PDF is already prepared, but it was not supplied for repository comparison |
| Release hash | Final release or merge commit | Record after the last release change is merged; do not use an intermediate hash |

### Retrospective

| Keep doing | Stop doing | Start doing |
| --- | --- | --- |
| Use one reviewed PR per focused Issue and verify P0 behaviour against deterministic PostgreSQL fixtures. | Leave Parent Issue and Project Board status behind after all of its Child Issues are complete. | Capture planning evidence at Sprint Planning and place final submission evidence where the release reviewer can verify it. |

**One concrete action for the next release step (with an owner):** @Tienachilles will verify the supplied `Team06_M3.pdf` and required evidence against the repository, then reconcile Parent Issue status before #154 and #149 are closed.

### Attendance

| Member | Planning | Review | Retro |
| --- | --- | --- | --- |
| @adcc17 | Not recorded | Not recorded | Not recorded |
| @davvph | Not recorded | Not recorded | Not recorded |
| @Tienachilles | Not recorded | Not recorded | Not recorded |
| @helian16 | Not recorded | Not recorded | Not recorded |
| @minh7322 | Not recorded | Not recorded | Not recorded |
