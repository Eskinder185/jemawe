#!/usr/bin/env python3
"""
Targeted Playwright validation for Managed TLS & Certificate Care and quote integration.
"""
import asyncio
import json
from pathlib import Path
from playwright.async_api import async_playwright

BASE = "http://127.0.0.1:5500"
OUT = Path("qa-results/certificate-care")
OUT.mkdir(parents=True, exist_ok=True)

async def test_certificate_page(browser):
    print("Testing /services/certificate-care/ ...")
    results = {}
    
    # Check at mobile (375px) and desktop (1280px)
    for w, h, name in [(375, 812, "mobile"), (1280, 900, "desktop")]:
        ctx = await browser.new_context(viewport={"width": w, "height": h}, reduced_motion="reduce")
        p = await ctx.new_page()
        
        console_errors = []
        p.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
        
        res = await p.goto(f"{BASE}/services/certificate-care/", wait_until="networkidle")
        assert res.status == 200, f"Expected 200 status, got {res.status}"
        
        # Check horizontal overflow
        overflow = await p.evaluate("""() => {
            const doc = document.documentElement;
            const cw = doc.clientWidth;
            const elements = [...document.body.querySelectorAll('*')];
            const offenders = [];
            for (const el of elements) {
                const rect = el.getBoundingClientRect();
                if (rect.right > cw + 1) {
                    offenders.push({ tag: el.tagName, cls: el.className, id: el.id, right: rect.right, cw });
                }
            }
            return offenders;
        }""")
        
        # Verify key sections
        has_hero = await p.locator("h1:has-text('Keep secure connections working as your business grows.')").count() > 0
        has_scope = await p.locator("h2:has-text('What certificate care covers')").count() > 0
        has_situations = await p.locator("h2:has-text('Suitable customer situations')").count() > 0
        has_process = await p.locator("h2:has-text('How we deliver certificate care')").count() > 0
        has_pricing = await p.locator("h2:has-text('Clear pricing and what you pay for')").count() > 0
        has_responsibilities = await p.locator("h2:has-text('Customer responsibilities and ownership')").count() > 0
        has_planned = await p.locator("h2:has-text('Planned digital trust services')").count() > 0
        has_faq = await p.locator("h2:has-text('Frequently asked questions')").count() > 0
        
        # Check FAQ details toggling
        first_details = p.locator(".faq details").first
        summary = first_details.locator("summary")
        await summary.click()
        is_open = await first_details.evaluate("el => el.open")
        
        # Check primary CTA href
        cta_href = await p.locator("a:has-text('Request a certificate assessment')").first.get_attribute("href")
        
        # Scroll back to top before full-page screenshot so sticky header stays at top
        await p.evaluate("window.scrollTo(0, 0)")
        await p.wait_for_timeout(100)

        # Screenshot
        shot_path = OUT / f"page_{name}_{w}.png"
        await p.screenshot(path=str(shot_path), full_page=True)
        
        results[name] = {
            "status": res.status,
            "overflowElements": overflow,
            "has_hero": has_hero,
            "has_scope": has_scope,
            "has_situations": has_situations,
            "has_process": has_process,
            "has_pricing": has_pricing,
            "has_responsibilities": has_responsibilities,
            "has_planned": has_planned,
            "has_faq": has_faq,
            "faq_expands": is_open,
            "cta_href": cta_href,
            "console_errors": console_errors,
            "screenshot": str(shot_path),
        }
        await ctx.close()
        
    return results

async def test_quote_journey(browser):
    print("Testing /quote/?service=certificates ...")
    ctx = await browser.new_context(viewport={"width": 1280, "height": 900})
    p = await ctx.new_page()
    
    console_errors = []
    p.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
    
    await p.goto(f"{BASE}/quote/?service=certificates", wait_until="networkidle")
    
    # 1. Step 1: Preselection check
    is_checked = await p.is_checked("input[name=service][value=certificates]")
    
    # Take screenshot of step 1
    await p.screenshot(path=str(OUT / "quote_step1.png"))
    
    # Click next to step 2
    await p.click("text=Continue to project details")
    
    # 2. Step 2: Details
    step = await p.evaluate("[...document.querySelectorAll('.form-step')].findIndex(s => s.classList.contains('is-current'))")
    on_details = step == 1
    
    # Check visible fields
    site_visible = await p.locator("#q-site").is_visible()
    category_visible = await p.locator("#q-category").is_visible()
    hosting_visible = await p.locator("#q-hosting").is_visible()
    desc_visible = await p.locator("#q-desc").is_visible()
    timeline_visible = await p.locator("#q-timeline").is_visible()
    
    # Check hidden and disabled fields
    os_hidden = await p.evaluate("document.getElementById('q-os').disabled && document.getElementById('q-os').closest('[data-show-when]').hidden")
    devices_hidden = await p.evaluate("document.getElementById('q-devices').disabled && document.getElementById('q-devices').closest('[data-show-when]').hidden")
    budget_hidden = await p.evaluate("document.getElementById('q-budget').disabled && document.getElementById('q-budget').closest('[data-show-when]').hidden")
    features_hidden = await p.evaluate("document.getElementById('q-features-label').closest('[data-show-when]').hidden")
    
    # Fill in details
    await p.fill("#q-site", "https://example.com")
    await p.fill("#q-category", "Small Business Accounting")
    await p.fill("#q-hosting", "Cloudflare and AWS")
    await p.fill("#q-desc", "We manage three domains with public web services and need renewal automation, deployment verification, and monitoring.")
    await p.select_option("#q-timeline", "Within a month")
    
    await p.screenshot(path=str(OUT / "quote_step2.png"))
    await p.click("text=Continue to contact details")
    
    # 3. Step 3: Contact
    step = await p.evaluate("[...document.querySelectorAll('.form-step')].findIndex(s => s.classList.contains('is-current'))")
    on_contact = step == 2
    await p.fill("#q-name", "Jordan Taylor")
    await p.fill("#q-email", "jordan@example.com")
    await p.fill("#q-phone", "555-019-2834")
    
    await p.screenshot(path=str(OUT / "quote_step3.png"))
    await p.click("text=Review your request")
    
    # 4. Step 4: Review
    step = await p.evaluate("[...document.querySelectorAll('.form-step')].findIndex(s => s.classList.contains('is-current'))")
    on_review = step == 3
    review_text = await p.locator("[data-review-list]").inner_text()
    
    service_in_review = "TLS & certificate care" in review_text
    site_in_review = "https://example.com" in review_text
    category_in_review = "Small Business Accounting" in review_text
    hosting_in_review = "Cloudflare and AWS" in review_text
    
    # Check honest submission without endpoint
    await p.check("#q-consent")
    await p.screenshot(path=str(OUT / "quote_step4_review.png"))
    await p.click("text=Send quote request")
    
    status_state = await p.locator("[data-form-status]").get_attribute("data-state")
    status_text = await p.locator("[data-form-status]").inner_text()
    url_stayed = p.url.endswith("/quote/?service=certificates")
    
    await p.screenshot(path=str(OUT / "quote_step4_status.png"))
    await ctx.close()
    
    return {
        "prefilled": is_checked,
        "on_details": on_details,
        "site_visible": site_visible,
        "category_visible": category_visible,
        "hosting_visible": hosting_visible,
        "desc_visible": desc_visible,
        "timeline_visible": timeline_visible,
        "os_hidden_and_disabled": os_hidden,
        "devices_hidden_and_disabled": devices_hidden,
        "budget_hidden_and_disabled": budget_hidden,
        "features_hidden": features_hidden,
        "on_contact": on_contact,
        "on_review": on_review,
        "review_contains_service": service_in_review,
        "review_contains_site": site_in_review,
        "review_contains_category": category_in_review,
        "review_contains_hosting": hosting_in_review,
        "submission_honest_status": status_state == "info",
        "status_message": status_text,
        "url_not_redirected": url_stayed,
        "console_errors": console_errors,
    }

async def test_homepage_and_navigation(browser):
    print("Testing navigation and links ...")
    ctx = await browser.new_context(viewport={"width": 1280, "height": 900})
    p = await ctx.new_page()
    
    # 1. Homepage
    await p.goto(f"{BASE}/", wait_until="networkidle")
    home_link = await p.locator("a[href='/services/certificate-care/']").count()
    
    # 2. Services index
    await p.goto(f"{BASE}/services/", wait_until="networkidle")
    services_link = await p.locator("a[href='/services/certificate-care/']").count()
    
    # 3. Mega-menu panel
    mega_link = await p.locator(".mega a[href='/services/certificate-care/']").count()
    
    # 4. Footer
    footer_link = await p.locator(".site-footer a[href='/services/certificate-care/']").count()
    
    # 5. Website maintenance page
    await p.goto(f"{BASE}/services/website-maintenance/", wait_until="networkidle")
    maint_link = await p.locator("a[href='/services/certificate-care/']").count()
    
    # 6. Pricing page
    await p.goto(f"{BASE}/pricing/", wait_until="networkidle")
    pricing_link = await p.locator("a[href='/services/certificate-care/']").count()
    
    await ctx.close()
    
    return {
        "homepage_contains_link": home_link > 0,
        "services_page_contains_link": services_link > 0,
        "mega_menu_contains_link": mega_link > 0,
        "footer_contains_link": footer_link > 0,
        "website_maintenance_contains_link": maint_link > 0,
        "pricing_contains_link": pricing_link > 0,
    }

async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        
        cert_results = await test_certificate_page(browser)
        quote_results = await test_quote_journey(browser)
        nav_results = await test_homepage_and_navigation(browser)
        
        await browser.close()
        
        summary = {
            "certificate_page": cert_results,
            "quote_journey": quote_results,
            "navigation": nav_results,
        }
        
        report_file = OUT / "verification_report.json"
        report_file.write_text(json.dumps(summary, indent=2))
        print("SUMMARY:")
        print(json.dumps(summary, indent=2))

if __name__ == "__main__":
    asyncio.run(main())
