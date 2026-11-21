# Hyperframes Composition Brief: Lerna AI

## Objective
Create a 20-second launch video showing Lerna AI turning uploaded study notes into an explanation and a practice question.

## Output
- Composition directory: `brag-output/composition/`
- Rendered video: `brag-output/brag.mp4`
- Format: landscape, 1280x720 at 30 fps
- Duration: 20 seconds

## Source material
- Project root: this repository.
- Primary files: `src/app/page.tsx`, `src/components/upload/UploadWorkspace.tsx`, `src/components/chat/StudyWorkspace.tsx`, `src/app/quiz/page.tsx`, `src/app/globals.css`, `src/app/layout.tsx`, `public/assets/lerna-full-white.png`.
- Product name: Lerna AI.
- Exact site line: "Learn smarter, not harder."
- Actual UI references: "Teach Lerna from your study files", "Drop files here", dark tutor chat, and the quiz question interface.
- Demonstration content: `Cell Division Notes.pdf`, "Explain mitosis simply.", "Mitosis is how one cell makes two matching cells.", "What separates during anaphase?", "Sister chromatids". These are fictional stand-ins, not captured user data.

## Creative direction
- Tone preset: app-store.
- Direction: focused, calm academic confidence.
- Interpretation: exact Lerna palette, clean cards, short legible copy, and direct simulation of user actions.
- Angle: upload a dense handout, receive a clear explanation, then check comprehension.
- Hook: "Your notes have questions." with a stack of lecture pages resolving into a file card.
- Outro: Lerna AI plus "Learn smarter, not harder."
- Avoid generic SaaS language, unrelated visual motifs, fake customer data, or claims about features not shown in the code.

## Visual identity
- Background: `#0a0a0a` and `hsl(220 6% 6%)`.
- Text: `#ffffff` with readable slate secondary text.
- Accent: `#06b6d4`, with restrained lighter cyan/teal highlights.
- Display font: Space Grotesk, with a local sans-serif fallback if the font cannot be bundled.
- Body font: Manrope, with a local sans-serif fallback if the font cannot be bundled.
- Visual references: rounded dark cards, fine white borders, cyan CTA, Lerna wordmark.

## Storyboard
Use `brag-output/brag-plan.md` as the creative contract. Durations sum to 20 seconds.
1. Notes hook — 2.5s — "Your notes have questions."
2. Upload — 4.5s — file drop into Lerna's study-file workspace.
3. Tutor — 5.5s — question sent and concise explanation returned.
4. Quiz — 4s — question, selected answer, correct state.
5. Brand — 3.5s — Lerna AI and the exact landing-page headline.

## Audio
- Role: understated rhythmic bed.
- Audio arc: gentle lift on the tutor reveal, one positive quiz accent, fade under the logo.
- Music: `happy-beats-business-moves-vol-12-by-ende-dot-app.mp3`, copied into `composition/assets/music/`.
- Music treatment: around 0.25 to 0.30 volume with a short final fade.
- Music cue guidance: bundled preset at `.agents/skills/brag/assets/music/cues/happy-beats-business-moves-vol-12-by-ende-dot-app.music-cues.json`; strongest nearby cues at 8.74s and 17.47s. Treat them as optional when readability calls for natural timing.
- Audio-reactive treatment: subtle RMS/bass response in existing cyan card glow, if the Hyperframes extraction workflow is available.
- Audio-coupled moments: file drop, send, answer reveal, quiz tap, final logo.
- SFX selection guidance: choose low/medium high-frequency-risk files according to `.agents/skills/brag/assets/sfx/sfx-analysis.md`; use few cues, timed to visible motion.
- Exact SFX selection and timing: Hyperframes implementation choice.

## Hyperframes instructions
Use the installed `hyperframes-core`, `hyperframes-animation`, `hyperframes-creative`, `hyperframes-keyframes`, and `hyperframes-cli` domain skills. This is the `/brag` workflow, so proceed directly from this brief. Build the composition inside `brag-output/composition/`, copy selected audio and logo locally, keep text readable, and show the actual Lerna workflow. Run `hyperframes check` with zero errors before rendering. Use seek-safe motion, local assets, and a 20-second timeline.
