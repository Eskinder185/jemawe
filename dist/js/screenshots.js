/** Full-size screenshots remain ordinary image links when JavaScript is unavailable. */
export function initScreenshotViewer() {
    const links = document.querySelectorAll("a[data-screenshot]");
    if (!links.length || typeof HTMLDialogElement === "undefined" || !HTMLDialogElement.prototype.showModal)
        return;
    const dialog = document.createElement("dialog");
    dialog.className = "screenshot-dialog";
    dialog.setAttribute("aria-label", "Full-size project screenshot");
    dialog.innerHTML = '<div class="screenshot-dialog__toolbar"><p data-shot-title></p><button type="button" class="screenshot-dialog__close">Close image</button></div><div class="screenshot-dialog__scroll"><img data-shot-image alt=""></div>';
    document.body.append(dialog);
    const close = dialog.querySelector("button");
    const image = dialog.querySelector("img");
    const scroll = dialog.querySelector(".screenshot-dialog__scroll");
    image.remove();
    const title = dialog.querySelector("[data-shot-title]");
    let opener = null;
    links.forEach((link) => link.addEventListener("click", (event) => {
        if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0)
            return;
        event.preventDefault();
        opener = link;
        const preview = link.querySelector("img");
        title.textContent = link.getAttribute("aria-label") || "Project screenshot";
        image.src = link.href;
        image.alt = preview?.alt || title.textContent;
        scroll.append(image);
        dialog.showModal();
        close.focus();
    }));
    close.addEventListener("click", () => dialog.close());
    dialog.addEventListener("close", () => { image.remove(); image.removeAttribute("src"); opener?.focus(); opener = null; });
    dialog.addEventListener("click", (event) => { if (event.target === dialog)
        dialog.close(); });
}
//# sourceMappingURL=screenshots.js.map