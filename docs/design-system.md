# Jemawe design system

Source of truth: `src/styles/00-tokens.css`. Components live in `src/styles/1x-*.css`.

## Direction
A serious technology consultancy, not a template. One bold idea, kept quiet everywhere else:

- **Signature:** the *schematic*, a faint 48px blueprint grid on midnight surfaces. On the home page the "Digital Ecosystem" 3D scene (`docs/hero-3d.md`) shows Jemawe's three divisions around a floating core. The SVG "system map" is its no-WebGL, no-JS, and low-power fallback.
- **Everything else is restrained:** left-aligned content on a 12-column grid, ruled lists instead of walls of identical cards, borders over shadows, and sentence-case labels (no all-caps eyebrows). Numbers appear only for real sequences, such as process steps and the timeline.

## Color
| Token | Value | Use |
|---|---|---|
| `--navy-950` | #071226 | Hero, banners, footer, dark panels |
| `--navy-900` | #0B1730 | Headings, dark text |
| `--blue-600` | #2563EB | Primary actions, links on light backgrounds |
| `--blue-500` | #3B82F6 | Accents |
| `--blue-300` | #93B4FD | Links and labels on dark (9.07:1) |
| `--gray-50` | #F6F8FC | Alternating sections |
| `--gray-200` | #E2E8F0 | Borders |
| `--ink` | #14213D | Body text |
| `--slate-500` | #64748B | Non-text accents (brief's secondary color) |
| `--text-muted` | #5F6F86 | Secondary **text**: the brief's #64748B nudged darker to pass WCAG AA on #F6F8FC |
| amber | #FFF8E6 / #D9A21B / #7A5500 | Placeholder badges and "not connected yet" notices only |

## Type
One family: **Manrope** (variable 200–800, self-hosted, OFL licence in `assets/fonts/`). Personality comes from weight and size contrast, not a second face.

| Role | Token | Size |
|---|---|---|
| Display (home hero) | `--fs-display` | clamp 36→60px, weight 790, tracking −0.04em |
| H1 | `--fs-h1` | clamp 34→54px |
| H2 | `--fs-h2` | clamp 28→40px |
| H3 | `--fs-h3` | clamp 20→23px |
| Body | `--fs-base` | 17px / 1.65 |
| Small | `--fs-sm`, `--fs-xs` | 15px, 13px |

Line length is capped at 68ch (`--measure`).

## Space and layout
- 8px scale: `--s-1` 8 · `--s-2` 16 · `--s-3` 24 · `--s-4` 32 · `--s-5` 48 · `--s-6` 64 · `--s-7` 96 · `--s-8` 128 (with `--s-0` 4).
- Container 1240px (1320px at ≥1440), fluid gutter.
- `.grid-12` with `.span-*` and `.start-*` from 1024px up; simple `.grid--2/3/4` auto grids.
- Breakpoints: 640, 768, 1024, 1200 (desktop navigation), 1440.
- Radius encodes hierarchy: controls 8px, cards 12px, media 18px.

## Components
Utility bar · sticky header · mega menu (disclosure pattern) · mobile accordion menu · breadcrumbs · home hero and system map · page banner (with optional illustration) · division bands with ruled service lists · cards (plain or linked, with a whole-card hit area) · industry tiles · browser and phone screenshot frames · process steps · timeline · plan cards · comparison tables (keyboard-scrollable) · notices · placeholder badge · FAQ (native `details`, searchable) · filter pills · multi-step forms with progress, review, and validation · choice cards · CTA band · footer · back-to-top · 404.

## Motion
- One orchestrated hero entrance plus the drawn system map. Scroll reveal only on selected groups, using IntersectionObserver.
- Hover: buttons lift 1px, linked cards lift 3px, service rows indent.
- Everything respects `prefers-reduced-motion`. Content is never hidden without JavaScript, because reveal styles apply only under `.js`.

## Accessibility rules baked in
Visible focus rings (light blue on dark surfaces), skip link, landmarks, one H1 per page, labelled forms with inline errors tied to the field by `aria-describedby`, an `inert` background behind the mobile menu, 44px+ touch targets, and 16px form inputs (no iOS zoom).
