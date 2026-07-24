# Marketing motion

The reusable motion and visual foundation for the living marketing experience
(Track 6, chunk one). Everything here is token-driven, self-contained (no CDNs,
no remote assets), and degrades to a static, still-beautiful state under a
`prefers-reduced-motion` preference. It is built on
[Framer Motion](https://www.npmjs.com/package/framer-motion), bundled by Vite.

## Why it lives under `marketing/`

These primitives, and Framer Motion with them, are imported only by marketing
components. Because the marketing surface is code-split, they land in the
marketing chunks and never weigh on the operator app or the admin control plane.
Do not import this module from `app/` or `admin/`.

## Primitives

| Export | What it does | Reduced-motion behaviour |
|--------|--------------|--------------------------|
| `useReducedMotion()` | The single reduce-motion signal, a plain boolean. Every primitive asks this. | Returns `true` only for a genuine reduce preference. |
| `Reveal` | Fades / slides / scales a block in once as it enters the viewport (`whileInView`, `once`). | Renders the finished resting state immediately, no transition. |
| `WordReveal` | Reveals a heading one word at a time, with an optional per-word class hook for warming key words. Exposes the full line as a single accessible label. | Renders the whole heading at once, complete and readable. |
| `Glow` | A soft, positionable radial ember from the warm palette; optionally pulses on a slow, compositor-friendly loop. | Pulse is dropped; the glow renders static. |
| `Grain` | A subtle, static tiled noise overlay (inline SVG feTurbulence as an alpha mask) for tactile paper depth. | Identical; it never animates. |
| `SectionFold` | The paper-curl transition between two sections: a warm-dark sheet peeling to reveal a warm-light underside (or the reverse), driven by `useScroll` progress and applied only through `transform`. Takes a `direction` (`dark-to-light` \| `light-to-dark`) and a `density` (`subtle` \| `standard` \| `bold`) so any section boundary can reuse it. | Renders a still, composed seam: the sheet frozen at a gentle mid-peel with its warm lip showing, no animation. |

Plus the variant helpers (`revealVariants`, `wordRevealVariants`, `entranceEase`,
`revealDuration`, `revealOffset`) for composing custom entrances on the same
easing and rhythm.

## Tokens

Colour and timing come from design tokens, never literal hex. The ambient warmth
uses marketing-specific tokens declared alongside the palette in the design
system: `--so-glow-warm`, `--so-glow-ember`, `--so-glow-rose`,
`--so-grain-color`, `--so-grain-opacity`, and the fixed hero-world surfaces
`--so-marketing-ink`, `--so-marketing-ink-raised`, `--so-marketing-paper`. The
glow and grain tokens carry distinct light and dark values.

The `SectionFold` surfaces are the fixed marketing ink and paper, so a fold reads
continuous with the warm-dark and warm-light sections it joins; its warm lip is
drawn from `--so-cognac` and `--so-peach`. The light how-it-works sections it
opens into use the `so-paper-world` surface class (declared in the app's
`index.css`), the warm-light counterpart to `so-hero-world`.

## Not in this chunk

The node network and the dotted globe are later chunks and are intentionally
absent here.
