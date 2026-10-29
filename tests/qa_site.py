#!/usr/bin/env python3
"""
Jemawe site QA with Playwright (Chromium).

Usage (from the project root, with the dev server running on :5500):
    pip install playwright && python -m playwright install chromium
    npm run serve            # in another terminal
    python tests/qa_site.py [--axe path/to/axe.min.js] [--out qa-results]

Checks every built page in dist/ at 375, 390, 768, 1024, 1440, and 1920px wide,
then runs interaction tests. Prints a summary and writes qa-results/results.json.
Nothing here is mocked except where stated (the form endpoint tests intercept a
fake endpoint to prove the success and failure paths behave correctly).
"""
import argparse
import asyncio
import json
import os
import re
import sys
from pathlib import Path

from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"
BASE = os.environ.get("BASE_URL", "http://127.0.0.1:5500")
WIDTHS = [375, 390, 768, 1024, 1440, 1920]


def routes():
    out = []
    for f in sorted(DIST.rglob("*.html")):
        rel = f.relative_to(DIST).as_posix()
        if rel == "404.html":
            continue
        out.append("/" + (rel[: -len("index.html")] if rel.endswith("index.html") else rel))
    return out


PAGE_PROBE = """() => {
  const doc = document.documentElement;
  const imgs = [...document.images];
  const ids = [...document.querySelectorAll('[id]')].map(e => e.id);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  // body uses overflow-x: clip as a safety net, which can hide overflow from scrollWidth.
  // So measure every rendered element's edges, skipping content inside real scroll containers.
  const cw = doc.clientWidth;
  const clipped = el => {
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if (cs.position === 'fixed' || ['auto', 'scroll', 'hidden', 'clip'].includes(cs.overflowX)) return true;
    }
    return false;
  };
  const wide = [];
  document.querySelectorAll('body *').forEach(el => {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const cs = getComputedStyle(el);
    if (cs.position === 'fixed' || cs.visibility === 'hidden') return;
    if ((r.right > cw + 1 || r.left < -1) && !clipped(el)) wide.push(el.tagName + '.' + (el.className || '').toString().slice(0, 40));
  });
  return {
    overflow: doc.scrollWidth > cw + 1 || wide.length > 0,
    overflowBy: doc.scrollWidth - doc.clientWidth,
    wideElements: wide.slice(0, 5),
    brokenImages: imgs.filter(i => i.complete && i.naturalWidth === 0).map(i => i.getAttribute('src')),
    missingAlt: imgs.filter(i => !i.hasAttribute('alt')).map(i => i.getAttribute('src')),
    h1: document.querySelectorAll('h1').length,
    duplicateIds: [...new Set(dupes)],
    title: document.title,
    description: (document.querySelector('meta[name=description]') || {}).content || '',
    links: [...document.querySelectorAll('a[href]')].map(a => a.getAttribute('href')),
  };
}"""


async def page_matrix(browser, results):
    all_links = set()
    issues = []
    for w in WIDTHS:
        ctx = await browser.new_context(viewport={"width": w, "height": 900})
        page = await ctx.new_page()
        errors, failed = [], []
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
        page.on("requestfailed", lambda r: failed.append(f"{r.url} ({r.failure})"))
        for route in routes():
            errors.clear(); failed.clear()
            resp = await page.goto(BASE + route, wait_until="load")
            await page.wait_for_timeout(120)
            info = await page.evaluate(PAGE_PROBE)
            all_links.update(info.pop("links"))
            problem = {}
            if not resp or resp.status != 200: problem["status"] = resp.status if resp else None
            if errors: problem["console"] = list(errors)
            if failed: problem["failedRequests"] = list(failed)
            if info["overflow"]: problem["overflow"] = {"by": info["overflowBy"], "elements": info["wideElements"]}
            if info["brokenImages"]: problem["brokenImages"] = info["brokenImages"]
            if info["missingAlt"]: problem["missingAlt"] = info["missingAlt"]
            if info["h1"] != 1: problem["h1Count"] = info["h1"]
            if info["duplicateIds"]: problem["duplicateIds"] = info["duplicateIds"]
            if w == 1440 and (not info["title"] or len(info["description"]) < 50): problem["seo"] = [info["title"], info["description"]]
            if problem:
                issues.append({"route": route, "width": w, **problem})
        await ctx.close()
    results["pagesChecked"] = len(routes())
    results["widths"] = WIDTHS
    results["pageLoads"] = len(routes()) * len(WIDTHS)
    results["pageIssues"] = issues
    return all_links


async def link_check(browser, links, results):
    ctx = await browser.new_context()
    internal = sorted({re.sub(r"[#?].*$", "", l) or "/" for l in links if l.startswith("/")})
    external = sorted({l for l in links if l.startswith("http")})
    bad = []
    for l in internal:
        r = await ctx.request.get(BASE + l, max_redirects=0)
        if r.status != 200:
            bad.append(f"{l} -> {r.status}")
    await ctx.close()
    results["internalLinksChecked"] = len(internal)
    results["brokenInternalLinks"] = bad
    results["externalLinks"] = external  # listed for manual verification


async def axe_audit(browser, axe_path, results):
    if not axe_path or not Path(axe_path).exists():
        results["axe"] = "skipped (no axe.min.js supplied)"
        return
    src = Path(axe_path).read_text()
    by_rule = {}
    for w in (1440, 375):
        ctx = await browser.new_context(viewport={"width": w, "height": 900}, reduced_motion="reduce")
        page = await ctx.new_page()
        for route in routes():
            await page.goto(BASE + route, wait_until="load")
            await page.add_script_tag(content=src)
            res = await page.evaluate(
                """async () => (await axe.run(document, {runOnly: {type: 'tag', values: ['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}})).violations
                   .map(v => ({id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0,3).map(n => n.target.join(' '))}))"""
            )
            for v in res:
                entry = by_rule.setdefault(v["id"], {"impact": v["impact"], "help": v["help"], "pages": set(), "examples": v["nodes"]})
                entry["pages"].add(f"{route}@{w}")
        await ctx.close()
    results["axe"] = {k: {**v, "pages": sorted(v["pages"])[:12], "pageCount": len(v["pages"])} for k, v in by_rule.items()}


async def interactions(browser, results):
    t = {}

    async def check(name, coro):
        try:
            t[name] = await coro
        except Exception as e:  # report, never hide
            t[name] = f"FAIL: {e}"

    # --- desktop mega menu (keyboard + pointer) ---
    async def mega():
        ctx = await browser.new_context(viewport={"width": 1440, "height": 900})
        p = await ctx.new_page()
        await p.goto(BASE + "/")
        trig = p.locator("[aria-controls=panel-services]")
        await trig.focus(); await p.keyboard.press("Enter")
        opened = await trig.get_attribute("aria-expanded") == "true" and await p.locator("#panel-services").is_visible()
        await p.keyboard.press("ArrowDown")
        in_panel = await p.evaluate("document.activeElement.closest('#panel-services') !== null")
        await p.keyboard.press("Escape")
        closed = await trig.get_attribute("aria-expanded") == "false"
        focus_back = await p.evaluate("document.activeElement.getAttribute('aria-controls')") == "panel-services"
        await p.hover("[aria-controls=panel-industries]"); await p.wait_for_timeout(350)
        hover_open = await p.locator("#panel-industries").is_visible()
        await p.mouse.click(700, 800); await p.wait_for_timeout(100)
        outside_close = not await p.locator("#panel-industries").is_visible()
        await ctx.close()
        ok = all([opened, in_panel, closed, focus_back, hover_open, outside_close])
        return {"pass": ok, "enterOpens": opened, "arrowDownIntoPanel": in_panel, "escapeCloses": closed, "focusReturns": focus_back, "hoverOpens": hover_open, "outsideClickCloses": outside_close}
    await check("megaMenu", mega())

    # --- mobile menu ---
    async def mobile():
        ctx = await browser.new_context(viewport={"width": 390, "height": 844})
        p = await ctx.new_page()
        await p.goto(BASE + "/about/")
        hidden_before = await p.evaluate("document.querySelector('[data-mobile-nav]').hidden")
        await p.click("[data-nav-toggle]"); await p.wait_for_timeout(250)
        visible = await p.locator("[data-mobile-nav]").is_visible()
        box = await p.locator("[data-mobile-nav]").bounding_box()
        inert = await p.evaluate("document.querySelector('main').inert")
        focus_in = await p.evaluate("!!document.activeElement.closest('[data-mobile-nav]')")
        for _ in range(60):
            await p.keyboard.press("Tab")
        trapped = await p.evaluate("!!(document.activeElement.closest('[data-mobile-nav]') || document.activeElement.hasAttribute('data-nav-toggle'))")
        await p.keyboard.press("Escape")
        closed = await p.evaluate("document.querySelector('[data-mobile-nav]').hidden")
        focus_back = await p.evaluate("document.activeElement.hasAttribute('data-nav-toggle')")
        not_inert = await p.evaluate("!document.querySelector('main').inert")
        await ctx.close()
        ok = all([hidden_before, visible, box and box["height"] > 300, inert, focus_in, trapped, closed, focus_back, not_inert])
        return {"pass": ok, "hiddenWhenClosed": hidden_before, "panelVisible": visible, "panelHeight": box and round(box["height"]), "backgroundInert": inert, "focusMovesIn": focus_in, "focusTrapped": trapped, "escapeCloses": closed, "focusReturnsToToggle": focus_back, "inertRemoved": not_inert}
    await check("mobileMenu", mobile())

    # --- multi-step quote form ---
    async def quote():
        ctx = await browser.new_context(viewport={"width": 1280, "height": 900})
        p = await ctx.new_page()
        await p.goto(BASE + "/quote/")
        step = lambda: p.evaluate("[...document.querySelectorAll('.form-step')].findIndex(s => s.classList.contains('is-current'))")
        await p.click("text=Continue to project details")
        blocked = await step() == 0 and await p.locator(".field.is-invalid").count() > 0
        await p.check("input[name=service][value=web]", force=True)
        await p.click("text=Continue to project details")
        on_details = await step() == 1
        os_hidden = await p.evaluate("document.getElementById('q-os').disabled && document.getElementById('q-os').closest('[data-show-when]').hidden")
        site_shown = await p.locator("#q-site").is_visible()
        await p.fill("#q-desc", "We need a five page website for our tutoring program with a contact form.")
        await p.select_option("#q-timeline", "Within a month")
        await p.click("text=Continue to contact details")
        await p.fill("#q-name", "Test Person"); await p.fill("#q-email", "not-an-email")
        await p.click("text=Review your request")
        email_error = await p.locator("#q-email").get_attribute("aria-invalid") == "true"
        msg = await p.evaluate("document.getElementById('q-email').closest('.field').querySelector('.field__error').textContent")
        await p.fill("#q-email", "test@example.com")
        await p.click("text=Review your request")
        on_review = await step() == 3
        review_text = await p.locator("[data-review-list]").inner_text()
        await p.click("text=Send quote request")
        consent_required = await p.locator("#q-consent").get_attribute("aria-invalid") == "true"
        await p.check("#q-consent")
        await p.click("text=Send quote request")
        state = await p.locator("[data-form-status]").get_attribute("data-state")
        status_text = await p.locator("[data-form-status]").inner_text()
        url_unchanged = p.url.endswith("/quote/")
        await ctx.close()
        ok = all([blocked, on_details, os_hidden, site_shown, email_error, on_review, "Website" in review_text, consent_required, state == "info", "not" in status_text, url_unchanged])
        return {"pass": ok, "blocksEmptyStep": blocked, "advancesWhenValid": on_details, "irrelevantFieldsHiddenAndDisabled": os_hidden, "relevantFieldsShown": site_shown,
                "invalidEmailFlagged": email_error, "emailMessage": msg, "reviewStepReached": on_review, "reviewShowsAnswers": "Website" in review_text,
                "consentRequired": consent_required, "honestNotConnectedStatus": state == "info", "noFakeRedirect": url_unchanged}
    await check("quoteForm", quote())

    # --- endpoint success / failure paths (fake endpoint intercepted) ---
    async def endpoint(status):
        ctx = await browser.new_context(viewport={"width": 1280, "height": 900})
        p = await ctx.new_page()
        await p.route("**/__qa-endpoint", lambda r: r.fulfill(status=status, body="{}", content_type="application/json"))
        await p.goto(BASE + "/contact/")
        await p.evaluate("document.querySelector('form[data-form]').dataset.endpoint = '/__qa-endpoint'")
        await p.fill("#ct-name", "Test Person"); await p.fill("#ct-email", "test@example.com")
        await p.select_option("#ct-topic", "general"); await p.fill("#ct-message", "Hello, this is a test message.")
        await p.check("#ct-consent")
        await p.click("text=Send message")
        await p.wait_for_timeout(800)
        url = p.url
        state = await p.locator("[data-form-status]").get_attribute("data-state") if "/contact/" in url else None
        await ctx.close()
        return url, state
    async def endpoints():
        ok_url, _ = await endpoint(200)
        fail_url, fail_state = await endpoint(500)
        ok = "/thank-you/" in ok_url and "/contact/" in fail_url and fail_state == "error"
        return {"pass": ok, "successRedirectsToThankYou": "/thank-you/" in ok_url, "failureStaysWithError": fail_state == "error"}
    await check("formEndpointPaths", endpoints())

    # --- prefill from URL ---
    async def prefill():
        ctx = await browser.new_context(); p = await ctx.new_page()
        await p.goto(BASE + "/quote/?service=repair")
        a = await p.is_checked("input[name=service][value=repair]")
        await p.goto(BASE + "/book-repair/?service=upgrade")
        b = await p.input_value("#rb-service") == "upgrade"
        await ctx.close()
        return {"pass": a and b, "quoteRadio": a, "repairSelect": b}
    await check("urlPrefill", prefill())

    # --- FAQ search ---
    async def faq():
        ctx = await browser.new_context(); p = await ctx.new_page()
        await p.goto(BASE + "/faq/")
        total = await p.locator("[data-faq] details").count()
        await p.fill("[data-faq-search]", "password")
        shown = await p.locator("[data-faq] details:not(.is-filtered-out)").count()
        status = await p.locator("[data-faq-status]").inner_text()
        await p.fill("[data-faq-search]", "zzzxqq")
        empty = await p.locator("[data-faq-empty]").is_visible()
        await ctx.close()
        return {"pass": 0 < shown < total and empty, "total": total, "matchesForPassword": shown, "status": status, "emptyMessage": empty}
    await check("faqSearch", faq())

    # --- filters ---
    async def filters():
        ctx = await browser.new_context(); p = await ctx.new_page()
        await p.goto(BASE + "/portfolio/")
        await p.click("[data-filter=website]")
        vis = await p.locator("#project-list [data-filter-item]:not(.is-hidden)").count()
        pressed = await p.get_attribute("[data-filter=website]", "aria-pressed")
        await p.goto(BASE + "/insights/#computer-maintenance")
        pre = await p.get_attribute("[data-filter=computer-maintenance]", "aria-pressed")
        await ctx.close()
        return {"pass": vis == 1 and pressed == "true" and pre == "true", "websitesShown": vis, "ariaPressed": pressed, "hashPreselects": pre == "true"}
    await check("filters", filters())

    # --- menu demo tabs ---
    async def tabs():
        ctx = await browser.new_context(); p = await ctx.new_page()
        await p.goto(BASE + "/services/restaurant-solutions/")
        await p.click("#tab-mains")
        mains = await p.locator("#menu-mains").is_visible() and not await p.locator("#menu-starters").is_visible()
        await p.focus("#tab-mains"); await p.keyboard.press("ArrowRight")
        drinks = await p.get_attribute("#tab-drinks", "aria-selected") == "true"
        await ctx.close()
        return {"pass": mains and drinks, "clickSwitches": mains, "arrowKeysMove": drinks}
    await check("menuDemoTabs", tabs())

    # --- reduced motion ---
    async def reduced():
        ctx = await browser.new_context(reduced_motion="reduce"); p = await ctx.new_page()
        await p.goto(BASE + "/")
        hero = await p.evaluate("getComputedStyle(document.querySelector('[data-hero-step]')).opacity")
        group = await p.evaluate("getComputedStyle(document.querySelector('[data-reveal-group] > *')).opacity")
        await ctx.close()
        return {"pass": hero == "1" and group == "1", "heroOpacity": hero, "revealGroupOpacity": group}
    await check("reducedMotion", reduced())

    # --- without JavaScript ---
    async def nojs():
        ctx = await browser.new_context(java_script_enabled=False, viewport={"width": 1440, "height": 900}); p = await ctx.new_page()
        await p.goto(BASE + "/")
        h1 = await p.locator("h1").is_visible()
        op = await p.evaluate("1") if False else None
        commitments = await p.locator(".commitment").first.is_visible()
        faq_works = await p.locator(".faq details").count() > 0
        await p.goto(BASE + "/quote/")
        steps_visible = await p.locator(".form-step").nth(1).is_visible()
        await ctx.close()
        return {"pass": h1 and commitments and faq_works and steps_visible, "contentVisible": h1 and commitments, "allFormStepsShown": steps_visible}
    await check("noJavaScript", nojs())

    # --- 404 ---
    async def notfound():
        ctx = await browser.new_context(); p = await ctx.new_page()
        r = await p.goto(BASE + "/this-page-does-not-exist/")
        txt = await p.locator("h1").inner_text()
        await ctx.close()
        return {"pass": r.status == 404 and "could not find" in txt, "status": r.status}
    await check("notFoundPage", notfound())

    # --- back to top ---
    async def btt():
        ctx = await browser.new_context(viewport={"width": 1280, "height": 800}); p = await ctx.new_page()
        await p.goto(BASE + "/services/web-development/")
        await p.evaluate("window.scrollTo(0, 3000)"); await p.wait_for_timeout(400)
        vis = await p.evaluate("document.querySelector('[data-back-to-top]').classList.contains('is-visible')")
        await p.click("[data-back-to-top]"); await p.wait_for_timeout(1200)
        y = await p.evaluate("scrollY")
        await ctx.close()
        return {"pass": vis and y < 5, "appearsAfterScroll": vis, "scrollYAfterClick": y}
    await check("backToTop", btt())

    results["interactions"] = t


async def screenshots(browser, out):
    shots = out / "screenshots"; shots.mkdir(parents=True, exist_ok=True)
    pages = ["/", "/services/", "/services/web-development/", "/portfolio/", "/quote/", "/faq/", "/industries/restaurants/", "/help-center/windows-slow-startup/"]
    for w in WIDTHS:
        ctx = await browser.new_context(viewport={"width": w, "height": 900}, reduced_motion="reduce")
        p = await ctx.new_page()
        for route in pages:
            await p.goto(BASE + route, wait_until="networkidle")
            name = (route.strip("/").replace("/", "_") or "home") + f"_{w}.png"
            await p.screenshot(path=str(shots / name), full_page=True)
        await ctx.close()


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--axe")
    ap.add_argument("--out", default="qa-results")
    ap.add_argument("--no-shots", action="store_true")
    args = ap.parse_args()
    out = Path(args.out); out.mkdir(parents=True, exist_ok=True)
    results = {}
    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        results["browser"] = f"Chromium {browser.version}"
        links = await page_matrix(browser, results)
        await link_check(browser, links, results)
        await axe_audit(browser, args.axe, results)
        await interactions(browser, results)
        if not args.no_shots:
            await screenshots(browser, out)
        await browser.close()
    (out / "results.json").write_text(json.dumps(results, indent=2, default=list))
    inter = results["interactions"]
    failed = [k for k, v in inter.items() if not (isinstance(v, dict) and v.get("pass"))]
    print(f"Pages: {results['pagesChecked']} x {len(WIDTHS)} widths = {results['pageLoads']} loads")
    print(f"Page issues: {len(results['pageIssues'])}")
    print(f"Internal links: {results['internalLinksChecked']} checked, {len(results['brokenInternalLinks'])} broken")
    print(f"External links (manual check): {len(results['externalLinks'])}")
    axe = results["axe"]
    print("axe:", axe if isinstance(axe, str) else f"{len(axe)} rule(s) violated")
    print(f"Interactions: {len(inter) - len(failed)}/{len(inter)} passed", ("FAILED: " + ", ".join(failed)) if failed else "")
    sys.exit(1 if failed or results["pageIssues"] or results["brokenInternalLinks"] or (not isinstance(axe, str) and axe) else 0)


asyncio.run(main())
