# Vue 3 export — Tri LTB 1v1 Reflex Duel Clash

`TriDuelClash.vue` is a standalone Vue 3 `<script setup>` + Tailwind port of the React screen in
`src/components/duel/DuelClash.tsx`. It is a reference file: it is **not** compiled or run by this
project (this app runs on React + TanStack Start).

## Using it in a Vue project

1. Copy `TriDuelClash.vue` into your Vue 3 + Tailwind v4 app (`src/components/`).
2. Copy the `@theme` tokens and all `@keyframes` / `@utility` blocks from this project's
   `src/styles.css` (everything under the `TRI LTB` heading) into your Vue app's entry stylesheet.
3. Load the fonts in `index.html`:

```html
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  rel="stylesheet"
  href="https://fonts.googleapis.com/css2?family=Orbitron:wght@600;800;900&family=Rajdhani:wght@500;600;700&display=swap"
/>
```

4. Render it full-screen:

```vue
<script setup lang="ts">
import TriDuelClash from "./components/TriDuelClash.vue";
</script>

<template>
  <TriDuelClash />
</template>
```

## Notes

- The layout is locked to a 9:16 frame (`aspect-[9/16]`, `max-w-[min(100vw,calc(100dvh*9/16))]`),
  so it stays mobile-proportioned on desktop.
- The stadium background is hotlinked; swap `STADIUM_BG` for your own asset.
- The Vue port keeps the core states (idle breathing, frenzy, tug bar dominance/flicker,
  final-10s danger timer, GOAL!/BLOCKED! overlays). Electric arcs and the light-spill layer are
  React-only extras and can be ported the same way as the particle loop if needed.
