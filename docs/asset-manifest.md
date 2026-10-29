# Asset manifest

No image-generation tool was connected while this site was built, so **no photographs were generated**. The visual identity uses original SVG illustrations and real screenshots instead. Photographic assets are listed with prompts for when generation or a photographer is available. None of those files exist yet.

Status key: **Done** = file exists and is used · **Prompt only** = not created.

## Created

| # | Asset | File | Size | Notes |
|---|---|---|---|---|
| 23 | Logo, dark text (for light backgrounds) | `assets/logos/jemawe-logo-dark.svg` | 176×40 | Editable vector. The mark is a "J" drawn as a circuit trace with two nodes |
| 23 | Logo, light text (for dark backgrounds) | `assets/logos/jemawe-logo-light.svg` | 176×40 | |
| 23 | Mark only | `assets/logos/jemawe-mark.svg` | 40×40 | |
| 24 | SVG favicon | `assets/logos/favicon.svg` | 40×40 | |
| 25 | Open Graph image | `assets/og/jemawe-og.png` | 1200×630 | Rendered from HTML with the brand font; used once `siteUrl` is set |
| 18, 22 | Network and background pattern | CSS (`.hero::before`, `.banner::before`) | — | 48px schematic grid, no image file needed |
| — | Home "system map" | inline SVG in `src/pages/index.html` | 600×470 | Accessible `title` and `desc`. Now the fallback for the 3D hero |
| — | 3D "Digital Ecosystem" models and textures | `src/ts/hero3d/` | ~9–10k triangles | Fully procedural: geometry built in code, textures drawn on canvas at runtime. No model or image files to download |
| 3–17, 20–21 | Banner illustrations (16) | `assets/illustrations/*.svg` | 560×420 | services, web, software, restaurant, maintenance, support, business, os, repair, upgrade, education, community, startup, professional, about, contact. Regenerate with `python3 scripts/make-illustrations.py` |
| — | Portfolio screenshots | `assets/img/portfolio/{ecaa,roadmap-to-role,tewahedo-daily}-{desktop-1440,desktop-720,mobile-390}.webp` | 1440×900, 720×450, 390×844 | **Real screenshots** captured with Playwright from each project's own `dist/` build on 2026-10-29. Tewahedo Daily was captured offline, so its "today" card shows a loading state |

## Prompt only (photography)

Use real photos of Jemawe's own work where possible. Never present generated people as Jemawe staff. No text in images.

| # | Asset | Filename | Dimensions | Prompt | Alt text |
|---|---|---|---|---|---|
| 1 | Desktop hero workspace | `hero-workspace-2400.webp` | 2400×1350 (16:9) | Modern technology workspace at dusk, laptop and monitor on a clean desk, cool navy ambient light with electric-blue screen glow, shallow depth of field, empty left third for headline, no visible text or logos | (decorative if behind text) |
| 2 | Mobile hero crop | `hero-workspace-900.webp` | 900×1200 (3:4) | Same scene, vertical crop centered on the laptop | (decorative) |
| 3 | Website development | `web-development-desk.webp` | 1600×1200 | Business website open on a laptop and a phone side by side on a light wooden desk, abstract layout blocks only, daylight | A business website shown on a laptop and phone |
| 4 | Software dashboard | `software-dashboard.webp` | 1600×1200 | Monitor showing an abstract dashboard (bars, charts, no readable text), navy UI, office background softly blurred | An analytics dashboard on a monitor |
| 5 | Restaurant digital menu | `restaurant-menu-phone.webp` | 1600×1200 | Hand holding a phone with a menu-style layout over a set restaurant table, warm light, food softly blurred | A guest viewing a digital menu on a phone at a restaurant table |
| 6 | Remote IT support | `remote-support.webp` | 1600×1200 | Over-the-shoulder view of a laptop in a remote session window, headset on the desk, calm home-office setting | A laptop during a remote support session |
| 7 | Windows troubleshooting | `windows-settings.webp` | 1600×1200 | Laptop with a generic settings-style screen (no Microsoft logos), hands on the keyboard | Adjusting settings on a Windows laptop |
| 8 | macOS troubleshooting | `mac-settings.webp` | 1600×1200 | Silver laptop on a clean desk with a generic preferences window (no Apple logos visible) | Adjusting settings on a Mac |
| 9 | Repair workbench | `repair-bench.webp` | 1600×1200 | Anti-static mat with an opened laptop, precision screwdrivers, organized trays, bright even light | An opened laptop on a repair bench |
| 10 | Laptop repair | `laptop-repair.webp` | 1600×1200 | Close-up of hands replacing a laptop battery, gloved, careful | Replacing a laptop battery |
| 11 | RAM upgrade | `ram-upgrade.webp` | 1600×1200 | Close-up of a memory module being seated in a laptop slot | Installing a memory module |
| 12 | SSD upgrade | `ssd-upgrade.webp` | 1600×1200 | M.2 SSD beside an older 2.5-inch hard drive on a mat | A new SSD next to an older hard drive |
| 13 | Small business office | `small-office.webp` | 1600×1200 | Small office with two workstations and a printer, natural light, no faces in focus | A small business office |
| 14 | Education technology | `education.webp` | 1600×1200 | Classroom or library table with laptops and notebooks, no identifiable children | Laptops on a library table |
| 15 | Nonprofit technology | `community.webp` | 1600×1200 | Community hall with a laptop showing an events page on a welcome table | A laptop at a community event table |
| 16 | Startup workspace | `startup.webp` | 1600×1200 | Whiteboard sketches beside a laptop, sticky notes, early-morning light | A startup planning session |
| 17 | Collaborative work | `collaboration.webp` | 1600×1200 | Two people reviewing a screen together, shot from behind, faces not shown | Two people reviewing a website together |
| 19 | Corporate background | `office-background.webp` | 2400×1350 | Blurred modern office interior in navy and blue tones | (decorative) |
| 20 | Contact illustration | done as SVG (`contact.svg`) | | | |
| 21 | Support illustration | done as SVG (`support.svg`) | | | |

**When adding photos:** export WebP at quality 75–80, supply a 2× and a 1× size and use `srcset`, add `loading="lazy"` below the fold, and write alt text that describes what is shown.

## Still needed from Jemawe
- Founder and team photos (real, approved), for `/leadership/` and `/team/`
- Study EOTC screenshots and details
- Restaurant dish photos, if a real restaurant client approves using them
