"""Refresh public portfolio screenshots in isolated Playwright browser contexts.

Run from the repository root after reviewing each live site. Never reuse a personal
browser profile. Generated PNG originals stay in ignored qa-results/; WebP assets
are written to assets/img/portfolio/. See docs/asset-manifest.md for provenance.
"""
import asyncio
from pathlib import Path

from PIL import Image
from playwright.async_api import async_playwright


SITES = {
    "coderush": "https://eskinder185.github.io/CodeRush/",
    "tewahedo-daily": "https://tewahedodaily.pages.dev/",
    "netshield": "https://eskinder185.github.io/NetShield/",
    "astrafocus": "https://eskinder185.github.io/AstraFocusNexus/",
}
OUT = Path("assets/img/portfolio")
ORIGINALS = Path("qa-results/portfolio-captures")


async def capture(page, key):
    await page.goto(SITES[key], wait_until="domcontentloaded", timeout=30000)
    await page.wait_for_load_state("networkidle", timeout=20000)
    if key == "coderush":
        await page.get_by_role("button", name="Start", exact=True).click()
        await page.evaluate("window.scrollTo(0, 0)")
    if key == "tewahedo-daily":
        await page.wait_for_function("[...document.images].length >= 2 && [...document.images].every(img => img.complete && img.naturalWidth > 0)", timeout=20000)
    if key == "astrafocus":
        await page.get_by_role("button", name="New task").first.click()
        await page.get_by_placeholder("What needs to happen?").fill("Review sample project plan")
        await page.get_by_role("button", name="Add task").click()
        await page.get_by_text("Review sample project plan").first.wait_for()
    await page.wait_for_timeout(2200 if key == "astrafocus" else 700)
    return await page.title()


def webp(original, dest, width=None):
    with Image.open(original) as source:
        image = source.convert("RGB")
        if width and image.width != width:
            height = round(image.height * width / image.width)
            image = image.resize((width, height), Image.Resampling.LANCZOS)
        image.save(dest, format="WEBP", quality=82, method=6)


async def main():
    OUT.mkdir(parents=True, exist_ok=True)
    ORIGINALS.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        for key in SITES:
            mobile_height = 1400 if key in ("coderush", "netshield") else 1000
            for label, width, height in (("desktop", 1440, 900), ("mobile", 390, mobile_height)):
                # A fresh context guarantees that AstraFocus never reads the owner's tasks.
                context = await browser.new_context(viewport={"width": width, "height": height}, reduced_motion="reduce", device_scale_factor=1)
                page = await context.new_page()
                title = await capture(page, key)
                original = ORIGINALS / f"{key}-{label}-{width}.png"
                await page.screenshot(path=str(original), full_page=False, animations="disabled")
                if label == "desktop":
                    webp(original, OUT / f"{key}-desktop-1440.webp")
                    webp(original, OUT / f"{key}-desktop-720.webp", 720)
                else:
                    webp(original, OUT / f"{key}-mobile-390.webp")
                print(f"{key} {label}: {title} ({width}x{height})")
                await context.close()
        context = await browser.new_context(viewport={"width": 1440, "height": 900}, reduced_motion="reduce", device_scale_factor=1)
        page = await context.new_page()
        await page.goto(SITES["netshield"] + "#/demo", wait_until="networkidle", timeout=30000)
        await page.get_by_text("Websites are having trouble loading.", exact=False).first.wait_for(timeout=20000)
        original = ORIGINALS / "netshield-demo-desktop-1440.png"
        await page.screenshot(path=str(original), full_page=False, animations="disabled")
        webp(original, OUT / "netshield-demo-desktop-1440.webp")
        webp(original, OUT / "netshield-demo-desktop-720.webp", 720)
        print("netshield demo desktop: loaded synthetic dashboard (1440x900)")
        await context.close()
        await browser.close()


asyncio.run(main())
