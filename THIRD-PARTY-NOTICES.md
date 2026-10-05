# Third-party notices

Panda uses the following component and animation sources:

- **Arc UI** — Button, Input, Checkbox, Segmented Control, foundation tokens and motion presets, copied from the official free registry on 4 October 2026. MIT, copyright 2026 Elia Kuratli. Local import paths and visual tokens adapted. [License](https://uiarc.dev/license). Full notice: `licenses/Arc-UI-MIT.txt`.
- **Transitions.dev** — Number pop-in, Panel reveal, Icon swap. Copyright 2026 Jakub Antalik / Transitions.dev. Used within this personal app under the Transitions.dev license; durations and distances adapted. Original snippet sources: `https://github.com/Jakubantalik/transitions.dev/tree/main/skills/transitions-dev`. Full notice: `licenses/Transitions.dev.txt`.
- **Bencho** — design and interaction reference only. No source or asset copied. The live Checklist interaction and published component explanation were reviewed on 4 October 2026: the last list row turns into an editor in place, and completion draws the tick and strike-through. Panda adapts this interaction with Arc controls and Motion; no Bencho source or assets are bundled.
- **Panda mascot** — original SVG drawing and CSS animation created for this app from the user's supplied character direction; no Duolingo or Opal artwork copied.
- **Portfolio notch** — silhouette adapted from the user's local portfolio as explicitly requested; the source portfolio was not modified.

Runtime/build dependencies and their supplied notices:

- @radix-ui/primitive 1.1.7: `licenses/radix-ui_primitive-1.1.7-LICENSE`
- @radix-ui/react-checkbox 1.3.11: `licenses/radix-ui_react-checkbox-1.3.11-LICENSE`
- @radix-ui/react-compose-refs 1.1.5: `licenses/radix-ui_react-compose-refs-1.1.5-LICENSE`
- @radix-ui/react-context 1.2.2: `licenses/radix-ui_react-context-1.2.2-LICENSE`
- @radix-ui/react-presence 1.1.10: `licenses/radix-ui_react-presence-1.1.10-LICENSE`
- @radix-ui/react-primitive 2.1.10: `licenses/radix-ui_react-primitive-2.1.10-LICENSE`
- @radix-ui/react-slot 1.3.3: `licenses/radix-ui_react-slot-1.3.3-LICENSE`
- @radix-ui/react-use-controllable-state 1.2.6: `licenses/radix-ui_react-use-controllable-state-1.2.6-LICENSE`
- @radix-ui/react-use-effect-event 0.0.5: `licenses/radix-ui_react-use-effect-event-0.0.5-LICENSE`
- @radix-ui/react-use-layout-effect 1.1.4: `licenses/radix-ui_react-use-layout-effect-1.1.4-LICENSE`
- @radix-ui/react-use-size 1.1.4: `licenses/radix-ui_react-use-size-1.1.4-LICENSE`
- @types/react-dom 19.3.0: `licenses/types_react-dom-19.3.0-LICENSE`
- @types/react 19.3.0: `licenses/types_react-19.3.0-LICENSE`
- csstype 3.2.3: `licenses/csstype-3.2.3-LICENSE`
- esbuild 0.25.12: `licenses/esbuild-0.25.12-LICENSE.md`
- framer-motion 12.43.0: `licenses/framer-motion-12.43.0-LICENSE.md`
- lucide-react 0.468.0: `licenses/lucide-react-0.468.0-LICENSE`
- motion-dom 12.43.0: `licenses/motion-dom-12.43.0-LICENSE.md`
- motion-utils 12.39.0: `licenses/motion-utils-12.39.0-LICENSE.md`
- motion 12.43.0: `licenses/motion-12.43.0-LICENSE.md`
- react-dom 19.3.0: `licenses/react-dom-19.3.0-LICENSE`
- react 19.3.0: `licenses/react-19.3.0-LICENSE`
- scheduler 0.28.0: `licenses/scheduler-0.28.0-LICENSE`
- tslib 2.8.1: `licenses/tslib-2.8.1-LICENSE.txt`
- typescript 5.9.3: `licenses/typescript-5.9.3-LICENSE.txt`

### Notch motion adaptation
The notch reveal uses the panel-reveal easing from https://transitions.dev/library.html, adapted to a clipped, top-anchored surface so the Mac window resizes only at endpoints. Arc segmented controls retain their styling with a shorter sliding-selection transition. Implementation guidance: Emil Kowalski’s official animate skill and recipes, https://github.com/emilkowalski/skills/tree/main/skills/animate (interruptible transitions, short durations, keyboard/reduced-motion support). No additional runtime dependency.
