---
version: 1
slug: "mobile-src-app-app-tsx"
primary_target: "mobile/src/app/App.tsx"
related_targets: []
---

# Mobile screen implementation

Scope: the approved 21-screen inventory, with shell/Login/Fixtures/Match Detail leading; native Android, Operate mode. Backend and mock data are separate follow-ups. Use an empty typed preview adapter and honest unavailable states until data is supplied.

## Direction contract

THESIS: A readable, role-aware matchday workspace; priority is explicit score, league and connection context rather than a decorative sports feed.

OWN-WORLD: User-pinned charcoal #11150F, olive surfaces #1C2118/#262D21 and lime #C5F545; Roboto type roles, 16dp padding, 48dp targets, solid rounded native surfaces.

STORY: Sign in or deliberately enter design preview, land on Fixtures, select league/match, read score then timeline then product; authorized roles reach management screens.

FIRST VIEWPORT: Login leads with identity, clear heading and labeled fields; Fixtures shows app bar, connectivity, league/filter controls then chronological rows. Match Detail leads with team/score/state before timeline. One lime primary action per group; text wraps at 360x640 and enlarged font sizes.

FORM: The user's reference and confirmed DESIGN-BRIEF.md override the unselected concept hands; seed:f462a76b41c62152. Native controls and navigation stay familiar. No image-led build.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
