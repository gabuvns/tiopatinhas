# TioPatinhas: design direction and mobile contract

The 2026 direction is deliberate, accessible and responsive: expressive but readable typography, useful interaction feedback, preference-aware themes and lightweight rendering. This follows the relevant recommendations in the [Lovable 2026 guide](https://lovable.dev/guides/website-design-trends-2026). Financial figures keep a stable position and do not animate. The design uses system fonts and existing dependencies.

## Phone navigation

At 680 CSS pixels and below, a compact header keeps currency, account/data actions and new-entry access. Theme selection moves into Dados e conta. Five labeled bottom destinations expose the same views as the desktop sidebar. The selected destination has both an accessible current-page state and a visible surface treatment. Navigation moves focus to the main landmark; a skip link supports keyboard use.

The bottom bar reserves its height plus the device safe area. Toasts sit above it, and scroll padding keeps focused controls reachable. It is hidden when the visual viewport shrinks around a focused text input. Viewport dimensions are UI state, never financial events or backup configuration. The integration lives in useViewportFrame.ts and uses VisualViewport when available, with ordinary resize and CSS dynamic-viewport fallbacks.

## Reading and input

Portfolio and rebalancing tables become labeled cards on phones using a single set of controls. Table roles and column headers are retained. Figures use tabular numerals and exact values. Narrow chart readouts stack rather than splitting currency digits. Charts calculate geometry from the available container width; a right-axis gutter keeps monthly contributions legible. Tap selections remain visible, with month/year sliders as alternatives to precise pointing.

Series selection uses a mobile sheet with search, dismissal and focus containment. Transaction and confirmation dialogs isolate the background and restore focus. Their scrollable content and reachable actions use the visual viewport to accommodate browser chrome and keyboard space. Cofrinho search keeps filtered fields mounted, preserving all allocations when saving.

The product aims for 44px touch areas on primary controls. WCAG 2.2 AA [target-size minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) is 24px with exceptions; the larger product target is intentional. Reflow checks use [320px layouts](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html), and fixed navigation follows [focus-not-obscured guidance](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html). Reduced-motion preferences remain supported. No zoom restriction is added.

## Verification

Run npm run check and npm run build. In development, ?audit=1 provides an explicit audit button: it reports selected axe rules, viewport/content widths and small touch targets. This is a diagnostic, not a conformance certificate. Test 320px and 390px phone layouts, 768px tablet layout, desktop, both themes, keyboard traversal, short viewports, long asset names and large values. Use fictitious demo data only for screenshots. Real device keyboard behavior still warrants device testing beyond desktop viewport simulation.
