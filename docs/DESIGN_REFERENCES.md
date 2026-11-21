# Lerna landing direction and verification

## Brief and baseline

This is the authorized public landing overhaul. Authenticated study tools retain their existing information architecture. The exact hero is **“Understand your materials. Keep what you learn.”** Navigation anchors remain `how-it-works`, `features`, `pricing`, `faq`, and `community`. Existing query-driven login, signup, reset, forgot-password switching, `/chat` redirects, privacy, support, WhatsApp, and Discord entry points are retained.

Baseline inspected: `src/app/page.tsx`, shared providers/font setup, upload formats, existing auth component interfaces, and existing public brand/product assets at the worker base `e9e13fd`. The old page used navy/cyan, Space Grotesk, a public product screenshot, static motion shims, an unrestricted scroll listener, unsupported testimonials/comparisons, and proposed paid-plan claims. The redesign removes those claims and the scroll listener. It keeps the existing Free/₦0 offer with an explicit usage-limit qualification.

The public browser entry failed before navigation with a missing kernel-assets error. The web reader also could not open the production URL. Consequently this worker does **not** claim a live production visual comparison or verification that production matches the checkout.

## Chosen design and motion

- Design read: a document-centered learning product for students, researchers, and professionals. Dials: variance 7, motion 4, density 3. Existing Next.js/Tailwind 3 and Space Grotesk are retained; no new design system, font, package, or WebGL renderer is introduced.
- Navy canvas, cyan emphasis, readable neutral text, consistent 8–12px interactive/artifact radii, and restrained shaded surfaces. Scoped light tokens respect the existing `html.light` theme without affecting app screens.
- The hero shows semantic content artifacts: a material excerpt, its explanation, and a saved note/session. It is explicitly labeled illustrative and uses fixed synthetic biology content. It has no fake interactive app controls and performs no model, upload, or document request. The user-directed CSS/DOM-first concept and existing assets take precedence over the skill's generic image-generation suggestion.
- Desktop depth comes from CSS perspective, short overlaps, border highlights, and navy-tinted shadows. Mobile switches to a readable flat stack. The existing public product screenshot is reused in the feature section; no invented interface image, logo wall, endorsement, customer count, or testimonial is added.
- Entry/section enhancements use one 520ms native Web Animations transition for transform/opacity. They establish the content sequence, run once, finish when scrolled offscreen or the tab becomes hidden, and clean up on unmount. Reduced motion skips them. The base HTML is visible without JavaScript; CTAs never wait for an entrance animation.
- Native disclosures implement FAQ and mobile navigation. Auth query handling has its own Suspense boundary, so it does not replace the entire landing with a client-only loading screen.

Layer scale is local: content 0, study artifacts 1–3, navigation 20, skip link 30. All new CSS lives in `landing.module.css`; no chat component, state, prompt, or shared animation bundle is imported.

## References and provenance

| Reference | Applied decision |
| --- | --- |
| Installed [design-taste-frontend SKILL.md](C:/Users/USER/.agents/skills/design-taste-frontend/SKILL.md), read 2026-10-18 | Audit first, preserve brand/IA, avoid repeated feature cards, use concrete copy, keep motion purposeful and progressively enhanced. No skill was installed or upgraded. |
| Installed [ui-ux-pro-max SKILL.md](C:/Users/USER/.agents/skills/ui-ux-pro-max/SKILL.md), including its web quick reference | Explicit focus, native controls, clear labels, sufficient target size, readable contrast, responsive layouts. Two local design-system searches did not return a verified Lerna-specific product/palette match; their coworking/photo-generator colors and testimonial recommendations were rejected. General guidance was used without persisting unverified search output. |
| [Motion accessibility](https://motion.dev/docs/react-accessibility) | Reduced motion removes spatial movement; a complete static experience remains. These principles are implemented with native browser animation rather than adding another library. |
| [Motion bundle guidance](https://motion.dev/docs/react-reduce-bundle-size) | Keep animation code small and avoid introducing a full animation feature bundle for simple reveals. No numerical bundle savings are claimed from that article. |
| [MDN reduced motion](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion) | CSS and JavaScript both honor the preference, including changes made while the page is open. |
| [W3C focus not obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html) | Sticky navigation has bounded height, anchor clearance, and visible keyboard focus; a skip link bypasses navigation. |
| [Apple HIG motion](https://developer.apple.com/design/human-interface-guidelines/motion) | Evaluated as an official reference. No installed Apple-specific skill was listed. Its content required unavailable browser rendering; no Apple-specific implementation claim or unofficial “Liquid Glass” package is made. |

## Evidence and remaining checks

On 20 October the integrated Next 16.4.1 development app was checked in local
mock-provider mode with headless Chrome, using `scripts/check-landing-browser.mjs`.
At 360, 390, 768, 1280 and 1440px, hydrated React content retained the exact
hero, no document-level horizontal overflow, functional native FAQ/mobile
navigation, and a working signup dialog entry. The check also covered the
actual `html.light` theme at 390px, first-Tab skip-link focus, reduced motion,
standard motion settling after its finite reveal, and a throttled network with
the primary CTA available at initial DOM content. It captured no page or
hydration errors after waiting for hydration before toggling native disclosures.
The script blocks nonlocal requests and checks that the development server
reports mocked AI providers before navigation. Evidence and screenshots live
in ignored `.stabilization-local/evidence/landing-integrated*.{json,png}`.
Opening the dialog is not a real Auth login; the local Auth service is absent.
This local development check is not a production bundle/performance comparison.

The first browser draft clicked a native `<details>` while React was still
hydrating and produced an attribute mismatch warning for its `open` state.
The reproducible check now verifies initial CTA visibility first and waits for
hydration before native interactive controls. The static fixture separately
verifies complete content before JavaScript; this does not prove every
pre-hydration interaction is warning-free.

Local Chrome fixture checks on 2026-10-19 used the real landing React server markup and scoped stylesheet with the existing licensed Space Grotesk asset. All five requested widths had `document.scrollWidth === viewport width`, no visible overflowing elements, the exact hero text, and working section anchors. The primary CTA's bottom edge was 454px at 360/390px, 436px at 768px, 593px at 1280px, and 598px at 1440px, within each tested viewport. Native mobile navigation and FAQ disclosures opened successfully; a light-theme mobile screenshot and a standard-motion desktop screenshot were also captured. The finite JavaScript animation itself was not hydrated by this fixture.

Evidence directory: `C:/Users/USER/AppData/Local/Temp/lerna-landing-visual-checks/`, containing `results.json`, five `landing-WIDTH.png` full-page captures, `landing-390-light.png`, and `landing-1440-standard.png`. Temporary fixture source: `C:/Users/USER/AppData/Local/Temp/lerna-landing-render.cjs`. These artifacts are local layout evidence; they contain synthetic/public content only.

Sampled CSS text/background pairs measured between 6.11:1 and 16.97:1 contrast, including muted text and primary CTAs in both themes. This is a sampled palette check, not a full accessibility certification. Strict Next/TypeScript ESLint on the new landing source and all persistence-owned source files passed with zero errors and warnings.

The remaining design gates are authenticated entry/recovery, hidden-tab/offscreen
motion on real devices, baseline-to-branch bundle and loading comparisons,
and field Core Web Vitals. The integrated local browser already covered the
five specified widths, light theme at 390px, keyboard skip link, reduced motion,
slow-network CTA availability and route asset loading. Fixture rendering and
development mode cannot establish hosted performance or real authentication.

Worker layout screenshots and structured checks, when produced, use the actual landing React server markup and CSS with closed auth components mocked. They are kept outside git in a temporary evidence directory. Their report explicitly distinguishes static/no-hydration layout proof from full-app behavior. The worker does not label those screenshots as production or as an authentication test.

The shared stylesheet previously forced smooth document scrolling with `!important`. The lead owns its reduced-motion correction; the landing module cannot safely override a global document rule across other routes. Metadata canonical origin and social asset corrections also belong to the lead.
