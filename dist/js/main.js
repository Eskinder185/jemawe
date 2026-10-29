/** Entry point. Each module checks for its own markup, so this runs safely on every page. */
import { initNav } from "./nav.js";
import { initReveal, initBackToTop, initYear, initTabs, initPrintAndShare } from "./ui.js";
import { initFilters, initFaqSearch } from "./filters.js";
import { initForms } from "./forms.js";
import { initEcosystem } from "./eco-loader.js";
function start() {
    initNav();
    initReveal();
    initBackToTop();
    initYear();
    initTabs();
    initPrintAndShare();
    initFilters();
    initFaqSearch();
    initForms();
    initEcosystem();
}
if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", start);
else
    start();
//# sourceMappingURL=main.js.map