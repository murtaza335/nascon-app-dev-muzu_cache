---
name: NaSCon Sports
description: A charcoal, olive and lime Android matchday workspace.
colors:
  background: "#151816"
  surface: "#202421"
  raised: "#2B302C"
  olive: "#303A2C"
  divider: "#3C443E"
  outline: "#7C887F"
  text: "#F1F3EF"
  secondary: "#C1C9C1"
  muted: "#ABB6AC"
  accent: "#B9D98C"
  on-accent: "#18200B"
  success: "#A8DAB5"
  success-bg: "#1D3022"
  warning: "#E7C874"
  warning-bg: "#352F1F"
  error: "#FFB4AB"
  error-bg: "#38221F"
  info: "#B7D5F2"
  info-bg: "#20303E"
typography:
  display:
    fontFamily: "sans-serif"
    fontSize: "36px"
    fontWeight: 600
    lineHeight: "44px"
    letterSpacing: "-0.7px"
  heading:
    fontFamily: "sans-serif"
    fontSize: "28px"
    fontWeight: 600
    lineHeight: "36px"
    letterSpacing: "-0.4px"
  title:
    fontFamily: "sans-serif"
    fontSize: "22px"
    fontWeight: 500
    lineHeight: "28px"
  section:
    fontFamily: "sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: "28px"
  body:
    fontFamily: "sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: "24px"
  strong:
    fontFamily: "sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: "24px"
  label:
    fontFamily: "sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: "20px"
  caption:
    fontFamily: "sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "20px"
  score:
    fontFamily: "sans-serif"
    fontSize: "44px"
    fontWeight: 700
    lineHeight: "52px"
rounded:
  field: "12px"
  card: "16px"
  pill: "24px"
  chip: "20px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  xxl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    typography: "{typography.strong}"
    rounded: "{rounded.field}"
    padding: "13px 16px"
  button-secondary:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.text}"
    typography: "{typography.strong}"
    rounded: "{rounded.field}"
    padding: "13px 16px"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    typography: "{typography.strong}"
    rounded: "{rounded.field}"
    padding: "13px 16px"
  button-danger:
    backgroundColor: "{colors.error-bg}"
    textColor: "{colors.error}"
    typography: "{typography.strong}"
    rounded: "{rounded.field}"
    padding: "13px 16px"
  field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.body}"
    rounded: "{rounded.field}"
    padding: "14px 16px"
  chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.secondary}"
    typography: "{typography.label}"
    rounded: "{rounded.chip}"
    padding: "13px 16px"
  chip-selected:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    typography: "{typography.label}"
    rounded: "{rounded.chip}"
    padding: "13px 16px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.card}"
    padding: "20px"
  navigation:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.muted}"
    typography: "{typography.label}"
  score-summary:
    backgroundColor: "{colors.olive}"
    textColor: "{colors.text}"
    rounded: "{rounded.card}"
    padding: "24px 20px"
---

# Design System: NaSCon Sports

## Overview

**Creative North Star: "The Matchday Workspace"**

A quiet charcoal shell supports readable fixtures, scores, people and merchandise. Olive surfaces establish context; electric lime identifies priority actions, selection and focus. This system describes the implemented Android React Native UI previews, derived from `mobile/src/theme/tokens.ts`, `mobile/src/components/ui.tsx`, navigation and screen source.

The 21 screen previews are a visual and navigation implementation. They do not implement backend access, authentication, durable storage, offline persistence, synchronization, checkout or receipt delivery. Preview controls and unavailable messages must remain explicit about that boundary.

**Key Characteristics:**

- Solid dark surfaces with restrained lime emphasis.
- Android system typography and readable numeric hierarchy.
- Labeled controls and written status alongside color.
- Rounded, scrollable surfaces with native interaction feedback.
- Honest empty, loading, error, success and connection previews.

Native visual verification remains pending. The finish disposition is **recapture** because the emulator host lacked sufficient RAM. Source checks and bundle export do not establish device rendering or accessibility compliance.

## Colors

The palette combines charcoal and olive neutrals with a sharp lime action accent and separate semantic feedback pairs. The frontmatter owns exact values; the source uses camelCase names where the portable tokens use hyphenated names.

### Primary

- **Electric lime — accent:** primary buttons, selected chips, active navigation, input focus and small timeline marks.
- **Dark lime ink — on-accent:** text and icons on lime fills.

### Secondary

- **Soft green — success / success-bg:** labeled accepted or positive-state presentations.
- **Warm amber — warning / warning-bg:** offline and attention messages.
- **Soft coral — error / error-bg:** validation, failure and destructive-action presentations.
- **Pale blue — info / info-bg:** explanatory and correction messages.

### Neutral

- **Charcoal canvas — background:** full screen and navigation-stack background.
- **Olive charcoal — surface:** cards, fields and bottom navigation.
- **Raised olive — raised:** sheets, secondary buttons, inset containers and transient feedback.
- **Context olive — olive:** connectivity strip, score summary and selected navigation-icon container.
- **Soft white — text:** main content and headings.
- **Pale sage — secondary:** supporting descriptions.
- **Muted sage — muted:** metadata and placeholders.
- **Olive divider — divider:** decorative separators.
- **Sage outline — outline:** visible field and unselected-chip boundaries.

**The Named State Rule.** State must be understandable from its label or explanation; color alone is insufficient.

**The Restrained Lime Rule.** Reserve lime fills for priority actions and selection. Normal fixture cards retain neutral surfaces.

Tenant branding currently appears through supplied logos and a validated primary-color context mark. This does not establish a general tenant theme implementation.

## Typography

**Display Font:** Android `sans-serif`, resolved by the platform.
**Body Font:** the same native family; other platforms retain their native default.

The machine-readable sizes use portable CSS units. Their source values are React Native font-size and line-height numbers, which participate in native text scaling. Layout measurements below are dp. No remote font or custom font asset is required.

### Hierarchy

- **Display:** Login introduction.
- **Heading:** available shared large-heading role.
- **Title:** app-bar titles and compact numeric values.
- **Section:** section headings and empty-state titles.
- **Body:** descriptions, fields and longer explanations.
- **Strong:** item names, buttons and important inline content.
- **Label:** filters, badges and navigation labels.
- **Caption:** supporting metadata and helper text.
- **Score:** main match score; the source requests tabular numerals.

**The Native Type Rule.** Preserve system font scaling and the shared type roles. Do not disable scaling to fit a composition.

The system family is an explicit Android/product requirement. It is not a general recommendation to use platform fonts for unrelated brand display work.

## Layout

Shared screens use safe-area handling, an app bar, optional connection strip, and vertically scrolling content. Content uses the lg spacing step as its screen inset, xl as its section gap, and an observed 40 dp bottom inset. Related content commonly uses sm, md and lg gaps. Cards use an observed 20 dp internal padding.

Buttons have a 52 dp minimum height; fields and selectors have a 56 dp minimum. Icon actions are at least 48 by 48 dp and chips have a 48 dp minimum height. These are source measurements, not a completed device target-size audit.

Bottom navigation starts at 80 dp plus the bottom safe-area inset. Its height increases with the reported font scale. Labels remain visible. Fixtures is the initial preview destination; role-dependent destinations are a presentation aid, not authorization.

Match Detail preserves one scroll ordered score, event timeline, then pinned product. Team columns flex; names wrap. Fixture filters scroll horizontally without shrinking their targets.

**The Growing Content Rule.** Let text and controls grow and keep task content scrollable. Verify 360x640 dp, rotation, keyboard insets and enlarged system text on Android before claiming those cases pass.

## Elevation & Depth

Most depth comes from solid tonal layers, not card shadows. Cards sit on the darker canvas; inset content and secondary actions use the raised tone. The shared sheet uses the raised tone with a translucent black backdrop.

Transient feedback in `App.tsx` uses Android elevation 6. This is a narrow overlay treatment, not a general card-shadow vocabulary. Stack transitions and sheet animation are explicitly disabled; native pressed/ripple feedback remains.

**The Solid Surface Rule.** Use opaque tonal surfaces for readable content. Keep the translucent backdrop confined to modal dismissal space.

## Shapes

Fields and standard buttons share the field radius. Cards use the card radius; chips use the chip radius. The pill radius remains for icon actions and the sheet's top corners. Small status badges have an observed 8 dp radius. Avatar corners are proportional to their size.

One-pixel dividers separate content; interactive boundaries use the stronger outline color. The source uses native geometry for small line icons, with accessible labels on actionable controls.

## Components

### Buttons

Primary, secondary, quiet and danger variants share strong text, centered content, minimum height and optional icon or progress indicator. Native press feedback reduces opacity; Android also receives ripple feedback. Disabled buttons reduce opacity and cannot activate. Busy buttons expose accessibility state and replace the icon with progress.

### Chips

Selected chips use muted olive, readable text and an accent outline. Unselected chips use the surface tone, a visible outline and secondary text. Labels and accessibility selection state accompany color.

### Cards / Containers

Cards are flat, rounded solid surfaces with consistent internal padding and gaps. Insets use the raised tone. Fixture cards expose one whole-card action rather than competing nested controls.

### Inputs / Fields

Visible labels sit above fields. Focus changes the outline to lime; an error takes precedence and uses coral with written helper feedback. Selection and cursor use lime. Multiline fields align text to the top. The shared field has no separately styled disabled variant.

### Navigation

The bottom bar uses a solid surface, divider and labeled native-geometry icons. Active text/icons turn lime, with an olive icon capsule. Back, Settings and connection actions have accessible labels. Settings is reachable before entering the preview. The connection strip names Online, Offline or Syncing and pending-action counts.

### Score and timeline

The olive score card keeps team identity, numeric score and written match state together. Missing values use an explicit fallback. Timeline entries keep sequence and description readable; compensated entries retain their original text with strike-through and a written Corrected badge.

### Feedback and sheets

Badge and Message share neutral, success, warning, error and info tones. Messages expose polite live-region semantics. Empty states pair an icon with a title, explanation and optional recovery action. Shared loading, error and success presentations are preview states, not evidence of completed operations.

Sheets provide an accessible close action, modal semantics, scrollable content and a separate dismissal backdrop. Their native focus and Back behavior still require device verification.

The sidecar's HTML/CSS examples are documentation translations of native components. Browser hover and focus affordances make those examples usable; they are not claims about shipped Android keyboard focus. Synthesized color ramps are documentation swatches, not additional application tokens.

## Do's and Don'ts

### Do:

- **Do** use the shared source tokens and components before adding local styling.
- **Do** retain at least 48 dp action targets, written labels and system font scaling.
- **Do** keep score, timeline and featured product in the confirmed reading order.
- **Do** show missing data and unavailable integrations honestly.
- **Do** verify native layout, TalkBack, keyboard behavior, rotation and enlarged text before recording a visual pass.

### Don't:

- **Don't** use lime as the sole indication of success, connection or selection.
- **Don't** invent live data, authentication, persistence or server success in a UI preview.
- **Don't** add photography, betting, video or social features from the visual reference.
- **Don't** treat source tests, typechecking or Hermes export as native visual evidence.
- **Don't** promote an unverified accessibility assumption into a new system rule.

## Production refinement (2026-10-17)
Neutral surfaces dominate; muted olive marks selection, lime marks primary actions.
Semantic colors resolve at render time; device appearance is the initial preference.
Account/Settings expose sign-out with pending-work retention/discard. Preview states,
demo credential pickers and unsupported controls are gone. Native screenshots remain pending.
