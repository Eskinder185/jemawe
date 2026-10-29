/** Category filters (portfolio, insights, help center) and searchable FAQ. */
export function initFilters() {
    document.querySelectorAll("[data-filter-group]").forEach((group) => {
        const buttons = Array.from(group.querySelectorAll("[data-filter]"));
        const listId = group.getAttribute("data-filter-group");
        const list = listId ? document.getElementById(listId) : null;
        if (!list || !buttons.length)
            return;
        const items = Array.from(list.querySelectorAll("[data-filter-item]"));
        const status = document.querySelector(`[data-filter-status="${listId}"]`);
        const noun = group.getAttribute("data-filter-noun") || "items";
        const apply = (value, updateHash) => {
            let shown = 0;
            for (const item of items) {
                const match = value === "all" || item.dataset.category === value;
                item.classList.toggle("is-hidden", !match);
                if (match)
                    shown++;
            }
            buttons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.filter === value)));
            if (status)
                status.textContent = `Showing ${shown} ${shown === 1 ? noun.replace(/s$/, "") : noun}`;
            if (updateHash)
                history.replaceState(null, "", value === "all" ? location.pathname : `#${value}`);
        };
        buttons.forEach((b) => b.addEventListener("click", () => apply(b.dataset.filter || "all", true)));
        const fromHash = location.hash.slice(1);
        apply(buttons.some((b) => b.dataset.filter === fromHash) ? fromHash : "all", false);
    });
}
export function initFaqSearch() {
    const input = document.querySelector("[data-faq-search]");
    const root = document.querySelector("[data-faq]");
    if (!input || !root)
        return;
    const status = document.querySelector("[data-faq-status]");
    const empty = root.querySelector("[data-faq-empty]");
    const entries = Array.from(root.querySelectorAll("details"));
    const groups = Array.from(root.querySelectorAll("[data-faq-group]"));
    const total = entries.length;
    input.addEventListener("input", () => {
        const q = input.value.trim().toLowerCase();
        let shown = 0;
        for (const d of entries) {
            const match = !q || (d.textContent || "").toLowerCase().includes(q);
            d.classList.toggle("is-filtered-out", !match);
            if (match)
                shown++;
        }
        for (const g of groups) {
            const any = g.querySelector("details:not(.is-filtered-out)");
            g.classList.toggle("is-filtered-out", !any);
        }
        if (empty)
            empty.hidden = shown > 0;
        if (status)
            status.textContent = q ? `${shown} of ${total} questions match “${input.value.trim()}”` : "";
    });
}
//# sourceMappingURL=filters.js.map