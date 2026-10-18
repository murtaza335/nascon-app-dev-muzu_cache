# Day 2 Frontend Agent Instructions

## Authority

Read the root `AGENTS.md`, root `REQUIREMENTS.md`, root `ARCHITECTURE.md`, and this directory before changing frontend code. For Day 2 behavior, the Part II PDF wins over all Day 1 documents.

For implementation contracts, read root `day2/API-CONTRACT.md` and `day2/FRONTEND-CONTRACT.md`. Those files are owned by the backend/integration track and override any conflicting wording in this directory.

## Requirements addressed

Primary requirements: FR-3.1, FR-3.2, FR-3.3, FR-4.1, FR-4.2, FR-4.3, FR-4.4, FR-5.2, FR-5.3, NFR-1, NFR-2, NFR-6, NFR-8, NFR-9.

Frontend verification requirements: Section 6.2 Selenium Grid, Section 6.3 Appium, Section 6.4 k6 integration expectations, Section 7.1 frontend weightage, and Appendix C frontend checklist.

## Hard rules

- The frontend must not invent or locally bypass backend authorization.
- Anonymous guests must not be shown a login wall on initial page load.
- A guest write attempt must be sent to the server and must result in `403 GUEST_WRITE_FORBIDDEN`; hiding a button is insufficient.
- Use the exact `data-testid` selectors in `REQUIREMENTS.md`.
- Preserve the guest cart during authentication and return the user to the same stream context.
- Native `nascon://` deep links must work before authentication and must not strand the user on Login.
- Every screen and major component must define loading, empty, error, offline/reconnecting, and success states where applicable.
- Never claim stream, chat, score, cart merge, follow, or notification success from local state alone when the server has not confirmed it.
- Keep touch targets at least 48 dp native and 48 CSS px on web.
- Do not add a dependency without checking the root architecture and documenting the decision.
- Do not use Impeccable or Screen Studio for Day 2 implementation.

## Working loop

1. Name the Part II requirement IDs being implemented.
2. Confirm the backend contract and its unavailable/error states.
3. Implement one coherent slice.
4. Add unit/component coverage and the relevant Selenium/Appium case.
5. Test the real integration when the backend is available.
6. Update `TRACEABILITY.md` and the relevant Day 2 checklist.
7. Report changed files, checks, failures, and remaining dependencies.

## Completion evidence

Do not mark a feature integrated based only on a static mock. A temporary fixture is acceptable during layout work but must be labelled `prototype` and replaced before completion.
