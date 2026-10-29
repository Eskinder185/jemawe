/**
 * Header behaviour:
 *  - sticky header shadow (IntersectionObserver sentinel, no scroll handler)
 *  - desktop mega menu: disclosure buttons, hover intent on fine pointers,
 *    Escape / outside click / focus leaving closes, ArrowDown opens into the panel
 *  - mobile menu: hidden + inert background while open, focus kept inside,
 *    Escape closes and returns focus to the toggle
 */

const DESKTOP = window.matchMedia("(min-width: 1200px)");
const FINE_POINTER = window.matchMedia("(hover: hover) and (pointer: fine)");

export function initNav(): void {
  const header = document.querySelector<HTMLElement>("[data-site-header]");
  if (!header) return;
  initStickyState(header);
  initMegaMenu(header);
  initMobileMenu(header);
}

function initStickyState(header: HTMLElement): void {
  const sentinel = document.createElement("div");
  sentinel.setAttribute("aria-hidden", "true");
  sentinel.style.cssText = "position:absolute;top:0;left:0;width:1px;height:48px;pointer-events:none;";
  document.body.prepend(sentinel);
  new IntersectionObserver(([entry]) => {
    header.classList.toggle("is-scrolled", !entry.isIntersecting);
  }).observe(sentinel);
}

function initMegaMenu(header: HTMLElement): void {
  const items = Array.from(header.querySelectorAll<HTMLElement>("[data-nav-item]"));
  let openItem: HTMLElement | null = null;
  let hoverTimer = 0;

  const parts = (item: HTMLElement) => ({
    trigger: item.querySelector<HTMLButtonElement>("[data-nav-trigger]")!,
    panel: item.querySelector<HTMLElement>("[data-nav-panel]")!,
  });

  function open(item: HTMLElement): void {
    if (openItem === item) return;
    if (openItem) close(openItem, false);
    const { trigger, panel } = parts(item);
    trigger.setAttribute("aria-expanded", "true");
    panel.hidden = false;
    panel.classList.add("is-open");
    header.classList.add("has-open-panel");
    openItem = item;
  }

  function close(item: HTMLElement, returnFocus: boolean): void {
    const { trigger, panel } = parts(item);
    trigger.setAttribute("aria-expanded", "false");
    panel.hidden = true;
    panel.classList.remove("is-open");
    if (openItem === item) openItem = null;
    if (!openItem) header.classList.remove("has-open-panel");
    if (returnFocus) trigger.focus();
  }

  for (const item of items) {
    const { trigger, panel } = parts(item);
    const links = () => Array.from(panel.querySelectorAll<HTMLAnchorElement>("a"));

    trigger.addEventListener("click", () => {
      window.clearTimeout(hoverTimer);
      if (openItem === item) close(item, false);
      else open(item);
    });

    trigger.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        open(item);
        links()[0]?.focus();
      }
    });

    panel.addEventListener("keydown", (e) => {
      const list = links();
      const index = list.indexOf(document.activeElement as HTMLAnchorElement);
      if (e.key === "ArrowDown" && index > -1) {
        e.preventDefault();
        list[(index + 1) % list.length].focus();
      } else if (e.key === "ArrowUp" && index > -1) {
        e.preventDefault();
        if (index === 0) trigger.focus();
        else list[index - 1].focus();
      }
    });

    item.addEventListener("focusout", (e) => {
      const next = e.relatedTarget as Node | null;
      if (openItem === item && next && !item.contains(next)) close(item, false);
    });

    // Hover intent only where hover is a real input method.
    item.addEventListener("pointerenter", (e) => {
      if (e.pointerType !== "mouse" || !FINE_POINTER.matches || !DESKTOP.matches) return;
      window.clearTimeout(hoverTimer);
      hoverTimer = window.setTimeout(() => open(item), openItem ? 0 : 110);
    });
    item.addEventListener("pointerleave", (e) => {
      if (e.pointerType !== "mouse" || !FINE_POINTER.matches) return;
      window.clearTimeout(hoverTimer);
      hoverTimer = window.setTimeout(() => {
        if (openItem === item) close(item, false);
      }, 180);
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && openItem) close(openItem, true);
  });
  document.addEventListener("click", (e) => {
    if (openItem && !openItem.contains(e.target as Node)) close(openItem, false);
  });
  DESKTOP.addEventListener("change", () => {
    if (openItem) close(openItem, false);
  });
}

function initMobileMenu(header: HTMLElement): void {
  const toggle = header.querySelector<HTMLButtonElement>("[data-nav-toggle]");
  const panel = document.querySelector<HTMLElement>("[data-mobile-nav]"); // sibling of the header, so fixed positioning is relative to the viewport
  if (!toggle || !panel) return;
  const label = toggle.querySelector<HTMLElement>(".nav-toggle__label");
  const outside = () => Array.from(document.querySelectorAll<HTMLElement>("main, .site-footer, .utility-bar, .announcement"));

  const focusables = () =>
    [toggle, ...Array.from(panel.querySelectorAll<HTMLElement>("a[href], summary, button:not([disabled])"))].filter(
      (el) => el.offsetParent !== null || el === toggle
    );

  function onKeydown(e: KeyboardEvent): void {
    if (e.key === "Escape") {
      close(true);
      return;
    }
    if (e.key !== "Tab") return;
    const list = focusables();
    const first = list[0];
    const last = list[list.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function open(): void {
    const top = Math.max(0, header.getBoundingClientRect().bottom);
    panel!.style.setProperty("--mobile-nav-top", `${top}px`);
    panel!.hidden = false;
    panel!.classList.add("is-open");
    toggle!.setAttribute("aria-expanded", "true");
    if (label) label.textContent = "Close";
    document.body.classList.add("nav-open");
    outside().forEach((el) => (el.inert = true));
    document.addEventListener("keydown", onKeydown);
    panel!.querySelector<HTMLElement>("a[href], summary")?.focus();
  }

  function close(returnFocus = false): void {
    if (panel!.hidden) return;
    panel!.hidden = true;
    panel!.classList.remove("is-open");
    toggle!.setAttribute("aria-expanded", "false");
    if (label) label.textContent = "Menu";
    document.body.classList.remove("nav-open");
    outside().forEach((el) => (el.inert = false));
    document.removeEventListener("keydown", onKeydown);
    if (returnFocus) toggle!.focus();
  }

  toggle.addEventListener("click", () => (panel.hidden ? open() : close()));
  panel.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).closest("a[href]")) close();
  });
  DESKTOP.addEventListener("change", (e) => {
    if (e.matches) close();
  });
}
