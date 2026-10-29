#!/usr/bin/env python3
"""
Playwright tests for the home page 3D "Digital Ecosystem" hero.

    python tests/qa_eco.py [--axe path/to/axe.min.js] [--out qa-results-eco]

Headless Chromium renders WebGL in software (SwiftShader), so the flags below
enable it. Because test machines often report few CPU cores, the scene is
loaded with ?eco=force (skips the device heuristics, nothing else). One test
also checks the unforced behaviour. Frame-time numbers from software rendering
are NOT representative of real GPUs and are labelled as such.
"""
import argparse
import asyncio
import json
import os
import sys
from pathlib import Path

from playwright.async_api import async_playwright

BASE = os.environ.get("BASE_URL", "http://127.0.0.1:5500")
HOME = BASE + "/?eco=force"
WIDTHS = [(375, 812), (390, 844), (768, 1024), (1024, 768), (1440, 900), (1920, 1080)]
GL_ARGS = ["--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--ignore-gpu-blocklist"]
ROOT = "document.querySelector('[data-eco]')"
READY = f"({ROOT}.dataset.ecoState||'').match(/^(ready|fallback)/)"
EXPECT = {"digital": "/services/#digital", "it": "/services/remote-it-support/", "hardware": "/services/computer-repair/"}


async def ready(page, timeout=30000):
    await page.wait_for_function(READY, timeout=timeout)
    return await page.evaluate(f"{ROOT}.dataset.ecoState")


async def run(args):
    out = Path(args.out); (out / "screenshots").mkdir(parents=True, exist_ok=True)
    R = {}

    async def check(name, coro):
        try:
            R[name] = await coro
        except Exception as e:
            R[name] = {"pass": False, "error": str(e)[:300]}

    async with async_playwright() as pw:
        b = await pw.chromium.launch(args=GL_ARGS)

        # 1, 2, 7, 8, 9, 14: every width initialises, canvas matches its stage, no overflow/errors/broken requests
        async def widths():
            rows = []
            for w, h in WIDTHS:
                touch = w < 1024
                ctx = await b.new_context(viewport={"width": w, "height": h}, has_touch=touch, is_mobile=w < 700)
                p = await ctx.new_page()
                errs, failed = [], []
                p.on("console", lambda m: errs.append(m.text) if m.type in ("error", "warning") else None)
                p.on("pageerror", lambda e: errs.append(str(e)))
                p.on("requestfailed", lambda r: failed.append(r.url))
                resp = await p.goto(HOME)
                st = await ready(p)
                await p.wait_for_timeout(1800)
                geo = await p.evaluate(f"""(() => {{
                    const s = {ROOT}.querySelector('[data-eco-stage]'), c = {ROOT}.querySelector('canvas');
                    const d = document.documentElement;
                    return {{ stageW: s.clientWidth, stageH: s.clientHeight, cssW: c && c.clientWidth, cssH: c && c.clientHeight,
                             bufW: c && c.width, bufH: c && c.height, overflow: d.scrollWidth > d.clientWidth,
                             h1: document.querySelector('h1').textContent.trim(), links: document.querySelectorAll('[data-eco-target]').length,
                             sectionsAfterHero: document.querySelectorAll('main > section').length }} }})()""")
                stats = await p.evaluate(f"{ROOT}.ecoDebug && {ROOT}.ecoDebug.stats()")
                await p.screenshot(path=str(out / "screenshots" / f"home-3d_{w}.png"))
                ok = (resp.status == 200 and st == "ready" and geo["cssW"] == geo["stageW"] and geo["cssH"] == geo["stageH"]
                      and abs(geo["bufW"] - round(geo["stageW"] * stats["dpr"])) <= 1 and not geo["overflow"] and not errs and not failed
                      and geo["links"] == 3 and geo["sectionsAfterHero"] >= 10)
                rows.append({"width": w, "pass": ok, "state": st, **geo, "stats": stats, "consoleIssues": errs[:3], "failedRequests": failed[:3]})
                await ctx.close()
            return {"pass": all(r["pass"] for r in rows), "rows": rows}
        await check("initAndLayoutAllWidths", widths())

        # 2: live resize keeps canvas in sync
        async def resize():
            ctx = await b.new_context(viewport={"width": 1440, "height": 900}); p = await ctx.new_page()
            await p.goto(HOME); await ready(p)
            await p.set_viewport_size({"width": 900, "height": 900}); await p.wait_for_timeout(600)
            g = await p.evaluate(f"(() => {{ const s={ROOT}.querySelector('[data-eco-stage]'), c={ROOT}.querySelector('canvas'); return [s.clientWidth, c.clientWidth, c.width] }})()")
            await ctx.close()
            return {"pass": g[0] == g[1] and g[2] > 0, "stageCanvasBuffer": g}
        await check("resize", resize())

        # 3 + 4: pointer hover highlights the right object and its HTML link; click navigates to the correct page
        async def pointer():
            res = {}
            for sid, path in EXPECT.items():
                ctx = await b.new_context(viewport={"width": 1440, "height": 900}); p = await ctx.new_page()
                await p.goto(HOME); await ready(p); await p.wait_for_timeout(1800)
                pos = await p.evaluate(f"{ROOT}.ecoDebug.screenPosition('{sid}')")
                await p.mouse.move(pos["x"], pos["y"]); await p.wait_for_timeout(500)
                hover = await p.evaluate(f"{ROOT}.dataset.ecoHover")
                link_active = await p.evaluate(f"{ROOT}.querySelector('[data-eco-target={sid}]').classList.contains('is-active')")
                label = await p.evaluate(f"(() => {{ const l={ROOT}.querySelector('[data-eco-label]'); return !l.hidden && l.classList.contains('is-visible') && l.textContent.trim() }})()")
                pos = await p.evaluate(f"{ROOT}.ecoDebug.screenPosition('{sid}')")
                await p.mouse.click(pos["x"], pos["y"])
                await p.wait_for_url(f"**{path.split('#')[0]}*", timeout=5000)
                res[sid] = {"hover": hover, "linkHighlighted": link_active, "labelShown": bool(label), "navigatedTo": p.url.replace(BASE, "")}
                await ctx.close()
            ok = all(v["hover"] == k and v["linkHighlighted"] and v["labelShown"] and v["navigatedTo"].startswith(EXPECT[k]) for k, v in res.items())
            return {"pass": ok, **res}
        await check("pointerHoverAndClick", pointer())

        # touch: first tap previews, second tap opens
        async def touch():
            ctx = await b.new_context(viewport={"width": 390, "height": 844}, has_touch=True, is_mobile=True); p = await ctx.new_page()
            await p.goto(HOME); await ready(p); await p.wait_for_timeout(1500)
            await p.evaluate(f"{ROOT}.scrollIntoView({{block:'center'}})"); await p.wait_for_timeout(500)
            pos = await p.evaluate(f"{ROOT}.ecoDebug.screenPosition('digital')")
            await p.touchscreen.tap(pos["x"], pos["y"]); await p.wait_for_timeout(600)
            preview = await p.evaluate(f"{ROOT}.dataset.ecoHover")
            hint = await p.evaluate(f"{ROOT}.querySelector('.eco__label-hint').textContent")
            stayed = "/services" not in p.url
            pos = await p.evaluate(f"{ROOT}.ecoDebug.screenPosition('digital')")
            await p.touchscreen.tap(pos["x"], pos["y"])
            await p.wait_for_url("**/services/**", timeout=5000)
            url = p.url
            await ctx.close()
            return {"pass": preview == "digital" and stayed and "/services/" in url, "firstTapPreview": preview, "hint": hint, "secondTapOpened": url.replace(BASE, "")}
        await check("touchPreviewThenOpen", touch())

        # 5: keyboard reaches the service links, focus drives the scene, Enter navigates
        async def keyboard():
            ctx = await b.new_context(viewport={"width": 1440, "height": 900}); p = await ctx.new_page()
            await p.goto(HOME); await ready(p)
            seen = []
            for _ in range(40):
                await p.keyboard.press("Tab")
                t = await p.evaluate("document.activeElement.dataset.ecoTarget || ''")
                if t:
                    seen.append({"target": t, "hover": await p.evaluate(f"{ROOT}.dataset.ecoHover"),
                                 "focusVisible": await p.evaluate("getComputedStyle(document.activeElement).outlineStyle !== 'none'")})
                    if len(seen) == 3: break
            await p.keyboard.press("Enter")
            await p.wait_for_url("**/services/computer-repair/**", timeout=5000)
            url = p.url
            await ctx.close()
            ok = [s["target"] for s in seen] == ["digital", "it", "hardware"] and all(s["hover"] == s["target"] and s["focusVisible"] for s in seen) and "/computer-repair/" in url
            return {"pass": ok, "tabOrder": seen, "enterOpened": url.replace(BASE, "")}
        await check("keyboard", keyboard())

        # 6 + 13: CTAs and shared navigation are not covered by the canvas and still work
        async def ctas():
            ctx = await b.new_context(viewport={"width": 1440, "height": 900}); p = await ctx.new_page()
            await p.goto(HOME); await ready(p)
            top = await p.evaluate("""[...document.querySelectorAll('.hero__actions a')].map(a => { const r=a.getBoundingClientRect(); const e=document.elementFromPoint(r.x+r.width/2, r.y+r.height/2); return a.contains(e) })""")
            await p.click("text=Explore services"); await p.wait_for_url("**/services/"); a = p.url
            await p.goto(HOME); await ready(p)
            await p.click(".hero__actions >> text=Get a quote"); await p.wait_for_url("**/quote/"); q = p.url
            await p.goto(HOME); await ready(p)
            trig = p.locator("[aria-controls=panel-services]"); await trig.focus(); await p.keyboard.press("Enter")
            mega = await p.locator("#panel-services").is_visible()
            await ctx.close()
            m = await b.new_context(viewport={"width": 390, "height": 844}, has_touch=True, is_mobile=True); mp = await m.new_page()
            await mp.goto(HOME); await ready(mp)
            await mp.click("[data-nav-toggle]"); await mp.wait_for_timeout(300)
            mobile = await mp.locator("[data-mobile-nav]").is_visible()
            await m.close()
            return {"pass": all(top) and a.endswith("/services/") and q.endswith("/quote/") and mega and mobile, "ctasOnTop": top, "megaMenuOpens": mega, "mobileMenuOpens": mobile}
        await check("ctasAndNavigation", ctas())

        # 10: reduced motion renders, but runs no continuous loop
        async def reduced():
            ctx = await b.new_context(viewport={"width": 1440, "height": 900}, reduced_motion="reduce"); p = await ctx.new_page()
            await p.goto(HOME); st = await ready(p); await p.wait_for_timeout(1200)
            s1 = await p.evaluate(f"{ROOT}.ecoDebug.stats()")
            a = await p.locator("canvas.eco__canvas").screenshot(); await p.wait_for_timeout(1200); b2 = await p.locator("canvas.eco__canvas").screenshot()
            pos = await p.evaluate(f"{ROOT}.ecoDebug.screenPosition('it')")
            await p.mouse.move(pos["x"], pos["y"]); await p.wait_for_timeout(300)
            hover = await p.evaluate(f"{ROOT}.dataset.ecoHover")
            await p.mouse.click(pos["x"], pos["y"]); await p.wait_for_url("**/remote-it-support/**", timeout=3000)
            await ctx.close()
            return {"pass": st == "ready" and not s1["running"] and a == b2 and hover == "it", "loopRunning": s1["running"], "framesIdentical": a == b2, "hoverStillWorks": hover == "it", "clickNavigatesImmediately": True}
        await check("reducedMotion", reduced())

        # 11: without JavaScript the hero is complete: headline, CTAs, SVG diagram, service links
        async def nojs():
            ctx = await b.new_context(java_script_enabled=False, viewport={"width": 1440, "height": 900}); p = await ctx.new_page()
            await p.goto(BASE + "/")
            res = {"h1": await p.locator("h1").inner_text(), "svgVisible": await p.locator(".eco__fallback svg").is_visible(),
                   "links": await p.locator("[data-eco-target]").count(), "linksVisible": await p.locator("[data-eco-target]").first.is_visible(),
                   "canvas": await p.locator("canvas").count()}
            await ctx.close()
            return {"pass": res["svgVisible"] and res["links"] == 3 and res["linksVisible"] and res["canvas"] == 0, **res}
        await check("noJavaScript", nojs())

        # 12: no WebGL -> fallback diagram, links still work, nothing downloaded
        async def nowebgl():
            ctx = await b.new_context(viewport={"width": 1440, "height": 900}); p = await ctx.new_page()
            await p.add_init_script("HTMLCanvasElement.prototype.getContext = function(){ return null }")
            reqs = []; p.on("request", lambda r: reqs.append(r.url))
            await p.goto(HOME); st = await ready(p)
            svg = await p.locator(".eco__fallback svg").is_visible()
            await p.click("[data-eco-target=it]"); await p.wait_for_url("**/remote-it-support/**")
            await ctx.close()
            return {"pass": st == "fallback:no-webgl" and svg and not any("hero3d" in u for u in reqs), "state": st, "fallbackVisible": svg, "bundleDownloaded": any("hero3d" in u for u in reqs)}
        await check("noWebGL", nowebgl())

        # unforced behaviour on this machine (documents the device heuristic)
        async def unforced():
            ctx = await b.new_context(viewport={"width": 1440, "height": 900}); p = await ctx.new_page()
            await p.goto(BASE + "/"); st = await ready(p)
            cores = await p.evaluate("navigator.hardwareConcurrency"); mem = await p.evaluate("navigator.deviceMemory ?? null")
            await ctx.close()
            return {"pass": st.startswith("ready") or st == "fallback:constrained-device", "state": st, "reportedCores": cores, "reportedMemoryGB": mem}
        await check("unforcedHeuristics", unforced())

        # pause offscreen, resume on return; explicit cleanup disposes everything
        async def lifecycle():
            ctx = await b.new_context(viewport={"width": 1440, "height": 900}); p = await ctx.new_page()
            await p.goto(HOME); await ready(p); await p.wait_for_timeout(800)
            running_top = (await p.evaluate(f"{ROOT}.ecoDebug.stats()"))["running"]
            await p.evaluate("window.scrollTo(0, document.body.scrollHeight)"); await p.wait_for_timeout(600)
            running_away = (await p.evaluate(f"{ROOT}.ecoDebug.stats()"))["running"]
            await p.evaluate("window.scrollTo(0, 0)"); await p.wait_for_timeout(600)
            running_back = (await p.evaluate(f"{ROOT}.ecoDebug.stats()"))["running"]
            await p.evaluate(f"{ROOT}.ecoUnmount()"); await p.wait_for_timeout(200)
            after = await p.evaluate(f"({{ state: {ROOT}.dataset.ecoState, canvas: !!{ROOT}.querySelector('canvas'), debug: !!{ROOT}.ecoDebug, fallbackVisible: getComputedStyle({ROOT}.querySelector('.eco__fallback')).visibility }})")
            await ctx.close()
            ok = running_top and not running_away and running_back and after["state"] == "unmounted" and not after["canvas"] and not after["debug"] and after["fallbackVisible"] == "visible"
            return {"pass": ok, "runningAtTop": running_top, "runningWhenScrolledAway": running_away, "runningAfterReturn": running_back, "afterCleanup": after}
        await check("pauseAndCleanup", lifecycle())

        # performance (software rendering: indicative only)
        async def perf():
            rows = []
            for w, h in [(1440, 900), (390, 844)]:
                ctx = await b.new_context(viewport={"width": w, "height": h}, is_mobile=w < 700, has_touch=w < 700); p = await ctx.new_page()
                await p.add_init_script("window.__lt=[]; new PerformanceObserver(l=>l.getEntries().forEach(e=>window.__lt.push(e.duration))).observe({type:'longtask', buffered:true})")
                await p.goto(HOME)
                t_load = await p.evaluate("performance.timing.loadEventEnd - performance.timing.navigationStart")
                await ready(p)
                t_ready = await p.evaluate("performance.now()")
                await p.evaluate(f"{ROOT}.scrollIntoView({{block:'center'}})")
                frames = await p.evaluate("""() => new Promise(res => { const t=[]; let last=performance.now(); const f=(n)=>{ t.push(n-last); last=n; if(t.length<120) requestAnimationFrame(f); else res(t) }; requestAnimationFrame(f) })""")
                frames = sorted(frames[5:])
                lcp = await p.evaluate("new Promise(r => new PerformanceObserver(l => { const e=l.getEntries(); r(e[e.length-1].startTime) }).observe({type:'largest-contentful-paint', buffered:true}))")
                stats = await p.evaluate(f"{ROOT}.ecoDebug.stats()")
                lt = await p.evaluate("window.__lt")
                rows.append({"width": w, "loadEventMs": t_load, "sceneReadyMs": round(t_ready), "lcpMs": round(lcp),
                             "medianFrameMs": round(frames[len(frames)//2], 1), "p95FrameMs": round(frames[int(len(frames)*0.95)], 1),
                             "longTasksOver50ms": len([x for x in lt if x > 50]), "longestTaskMs": round(max(lt) if lt else 0),
                             "drawCalls": stats["drawCalls"], "triangles": stats["triangles"], "textures": stats["textures"], "geometries": stats["geometries"], "dpr": stats["dpr"], "qualityStep": stats["qualityStep"]})
                await ctx.close()
            size = Path("dist/js/hero3d.js").stat().st_size if Path("dist/js/hero3d.js").exists() else None
            return {"pass": True, "note": "Headless Chromium with SwiftShader software WebGL; real-GPU frame times will differ.", "bundleBytes": size, "rows": rows}
        await check("performance", perf())

        # accessibility audit with the canvas active
        async def axe():
            if not args.axe:
                return {"pass": True, "skipped": True}
            src = Path(args.axe).read_text()
            out_ = {}
            for w, h in [(1440, 900), (390, 844)]:
                ctx = await b.new_context(viewport={"width": w, "height": h}); p = await ctx.new_page()
                await p.goto(HOME); await ready(p); await p.wait_for_timeout(1500)
                await p.add_script_tag(content=src)
                v = await p.evaluate("async () => (await axe.run(document, {runOnly:{type:'tag', values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}})).violations.map(v => v.id + ': ' + v.nodes.length)")
                out_[w] = v
                await ctx.close()
            return {"pass": all(not v for v in out_.values()), "violations": out_}
        await check("axeWith3D", axe())

        await b.close()

    (out / "results.json").write_text(json.dumps(R, indent=2))
    failed = [k for k, v in R.items() if not v.get("pass")]
    for k, v in R.items():
        print(("PASS " if v.get("pass") else "FAIL ") + k)
    print(f"{len(R) - len(failed)}/{len(R)} passed")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--axe")
    ap.add_argument("--out", default="qa-results-eco")
    asyncio.run(run(ap.parse_args()))
