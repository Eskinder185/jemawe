# Jemawe public-site polish prompt

Review and improve the complete Jemawe public website in `C:\Users\eskew\github\jemawe`. Inspect the source before editing. Keep the result restrained, credible, and easy to scan.

## Direction

- Treat the home page as an introduction to Jemawe's services. Show one representative project screenshot with a brief statement of its purpose. Keep the full project collection on `/portfolio/`. Do not put live-product links in the home showcase.
- On every page, check headings, paragraphs, lists, cards, tables, and calls to action for awkward wrapping, narrow columns, excess empty space, visual imbalance, repeated content, and unclear language. Fix the shared layout rule when several pages have the same problem.
- Write plain, specific copy. Shorten or remove claims that sound promotional, repetitive, or unsupported. Keep the distinction between completed work, public applications, previews, and planned features clear.
- Preserve honest form and status messaging. Do not imply that a form, customer portal, monitoring feed, or service is connected when it is not.
- Do not invent people, testimonials, ratings, statistics, certifications, prices, addresses, phone numbers, or company history. Mark missing facts with `{{todo "…"}}` where appropriate.
- Keep navigation and calls to action purposeful. A visitor should understand what Jemawe offers, see credible evidence, and find an appropriate next step without scrolling through a full portfolio on the home page.

## Implementation and review

- Edit `src/` and build to `dist/`; never hand-edit generated `dist/` files. Preserve the current architecture, CSS tokens, accessibility, reduced-motion behavior, and `/jemawe/` sub-path support.
- Inspect every public route at narrow, tablet, and desktop widths. Pay particular attention to 12-column layouts that combine span and start utilities.
- Run the build, TypeScript check, `tests/qa_site.py`, and `tests/qa_eco.py` for the 3D hero. Report only observed results and remaining limitations.
