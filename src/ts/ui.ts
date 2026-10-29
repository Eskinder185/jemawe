/** Scroll reveal, back-to-top, footer year, restaurant menu demo tabs. */

const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)");

export function initReveal(): void {
  const targets = document.querySelectorAll<HTMLElement>("[data-reveal], [data-reveal-group]");
  document.querySelectorAll<HTMLElement>("[data-reveal-group]").forEach((group) => {
    Array.from(group.children).forEach((child, i) => (child as HTMLElement).style.setProperty("--i", String(Math.min(i, 8))));
  });
  if (REDUCED.matches || !("IntersectionObserver" in window)) {
    targets.forEach((el) => el.classList.add("is-visible"));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      }
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
  );
  targets.forEach((el) => io.observe(el));
}

export function initBackToTop(): void {
  const btn = document.querySelector<HTMLButtonElement>("[data-back-to-top]");
  if (!btn) return;
  const sentinel = document.createElement("div");
  sentinel.setAttribute("aria-hidden", "true");
  sentinel.style.cssText = "position:absolute;top:0;left:0;width:1px;height:900px;pointer-events:none;";
  document.body.prepend(sentinel);
  btn.hidden = false;
  new IntersectionObserver(([entry]) => {
    const show = !entry.isIntersecting;
    btn.classList.toggle("is-visible", show);
    btn.tabIndex = show ? 0 : -1;
    btn.setAttribute("aria-hidden", show ? "false" : "true");
  }).observe(sentinel);
  btn.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: REDUCED.matches ? "auto" : "smooth" });
    document.querySelector<HTMLElement>("#main")?.focus({ preventScroll: true });
  });
}

export function initYear(): void {
  document.querySelectorAll("[data-year]").forEach((el) => (el.textContent = String(new Date().getFullYear())));
}

/** Accessible tabs (used by the restaurant digital menu demonstration). */
export function initTabs(): void {
  document.querySelectorAll<HTMLElement>("[data-tabs]").forEach((root) => {
    const tabs = Array.from(root.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    const select = (tab: HTMLButtonElement, focus: boolean) => {
      tabs.forEach((t) => {
        const selected = t === tab;
        t.setAttribute("aria-selected", String(selected));
        t.tabIndex = selected ? 0 : -1;
        const panel = document.getElementById(t.getAttribute("aria-controls") || "");
        if (panel) panel.hidden = !selected;
      });
      if (focus) tab.focus();
    };
    tabs.forEach((tab, i) => {
      tab.addEventListener("click", () => select(tab, false));
      tab.addEventListener("keydown", (e) => {
        let next = -1;
        if (e.key === "ArrowRight") next = (i + 1) % tabs.length;
        if (e.key === "ArrowLeft") next = (i - 1 + tabs.length) % tabs.length;
        if (e.key === "Home") next = 0;
        if (e.key === "End") next = tabs.length - 1;
        if (next > -1) {
          e.preventDefault();
          select(tabs[next], true);
        }
      });
    });
    if (tabs[0]) select(tabs.find((t) => t.getAttribute("aria-selected") === "true") || tabs[0], false);
  });
}

/** Print buttons on the checklists page, and copy-link / email sharing on articles. */
export function initPrintAndShare(): void {
  document.querySelectorAll<HTMLButtonElement>("[data-print]").forEach((b) => b.addEventListener("click", () => window.print()));

  const status = document.querySelector<HTMLElement>("[data-share-status]");
  document.querySelectorAll<HTMLButtonElement>("[data-share]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const url = window.location.href.split("#")[0];
      try {
        if (navigator.share && window.matchMedia("(pointer: coarse)").matches) {
          await navigator.share({ title: document.title, url });
          return;
        }
        await navigator.clipboard.writeText(url);
        if (status) status.textContent = "Link copied to your clipboard.";
      } catch {
        if (status) status.textContent = `Copy this link: ${url}`;
      }
    });
  });
  document.querySelectorAll<HTMLAnchorElement>("[data-share-email]").forEach((a) => {
    a.href = `${a.href}&body=${encodeURIComponent(window.location.href.split("#")[0])}`;
  });
}
