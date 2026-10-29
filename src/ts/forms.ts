/**
 * Forms: accessible inline validation, conditional sections, multi-step flows
 * with a review step, and honest submission handling.
 *
 * Submission rules (from the project brief):
 *  - No endpoint configured (data-endpoint="") -> validate, then say plainly
 *    that the form is not connected. Never fake a success.
 *  - Endpoint configured -> POST JSON; only a 2xx response redirects to the
 *    thank-you page. Errors are reported with what to do next.
 *  - A hidden honeypot field silently drops obvious bot submissions.
 */

type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

const MESSAGES = {
  email: "Enter an email address in the format name@example.com.",
  checkbox: "Check this box to continue.",
  select: "Choose an option from the list.",
  radio: "Choose one of the options.",
  tooShort: (min: number) => `Use at least ${min} characters.`,
  generic: "Fill in this field.",
};

export function initForms(): void {
  document.querySelectorAll<HTMLFormElement>("form[data-form]").forEach(setupForm);
}

function fieldOf(control: Element): HTMLElement | null {
  return control.closest<HTMLElement>(".field");
}

function labelText(control: Control): string {
  const field = fieldOf(control);
  const label =
    (control.id && document.querySelector<HTMLLabelElement>(`label[for="${control.id}"]`)) ||
    field?.querySelector<HTMLElement>(".field__label, legend, label");
  return (label?.textContent || control.name || "").replace(/\(optional\)/i, "").replace(/\s+/g, " ").trim();
}

function messageFor(control: Control): string {
  const custom = control.dataset.error;
  const v = control.validity;
  if (v.valueMissing) {
    if (custom) return custom;
    if (control instanceof HTMLInputElement && control.type === "checkbox") return MESSAGES.checkbox;
    if (control instanceof HTMLInputElement && control.type === "radio") return MESSAGES.radio;
    if (control instanceof HTMLSelectElement) return MESSAGES.select;
    const name = labelText(control).toLowerCase();
    return name ? `Enter your ${name.replace(/^your /, "")}.` : MESSAGES.generic;
  }
  if (v.typeMismatch && control.type === "email") return MESSAGES.email;
  if (v.tooShort && control instanceof HTMLTextAreaElement) return MESSAGES.tooShort(control.minLength);
  if (v.tooShort && control instanceof HTMLInputElement) return MESSAGES.tooShort(control.minLength);
  return custom || control.validationMessage || MESSAGES.generic;
}

function errorElement(field: HTMLElement): HTMLElement {
  let el = field.querySelector<HTMLElement>(".field__error");
  if (!el) {
    el = document.createElement("p");
    el.className = "field__error";
    el.id = `err-${Math.random().toString(36).slice(2, 9)}`;
    field.append(el);
  }
  return el;
}

/** Validate one control (radio groups are validated as a unit). Returns true when valid. */
function validate(control: Control): boolean {
  if (control.disabled) return true;
  const field = fieldOf(control);
  if (!field) return control.checkValidity();
  const group =
    control instanceof HTMLInputElement && control.type === "radio"
      ? Array.from(field.querySelectorAll<HTMLInputElement>(`input[type="radio"][name="${control.name}"]`))
      : [control];
  const valid = group.every((c) => c.checkValidity());
  const err = errorElement(field);
  field.classList.toggle("is-invalid", !valid);
  err.textContent = valid ? "" : messageFor(group.find((c) => !c.checkValidity()) || control);
  for (const c of group) {
    if (valid) c.removeAttribute("aria-invalid");
    else c.setAttribute("aria-invalid", "true");
    const ids = new Set((c.getAttribute("aria-describedby") || "").split(" ").filter(Boolean));
    ids.add(err.id);
    c.setAttribute("aria-describedby", [...ids].join(" "));
  }
  return valid;
}

function controlsIn(scope: ParentNode): Control[] {
  return Array.from(scope.querySelectorAll<Control>("input, select, textarea")).filter(
    (c) => !c.disabled && c.type !== "hidden" && !c.closest("[data-honeypot]")
  );
}

function validateScope(scope: ParentNode): Control | null {
  let firstInvalid: Control | null = null;
  const seenRadio = new Set<string>();
  for (const c of controlsIn(scope)) {
    if (c instanceof HTMLInputElement && c.type === "radio") {
      if (seenRadio.has(c.name)) continue;
      seenRadio.add(c.name);
    }
    if (!validate(c) && !firstInvalid) firstInvalid = c;
  }
  return firstInvalid;
}

function setStatus(form: HTMLFormElement, state: "error" | "success" | "info" | null, html = ""): void {
  const status = form.querySelector<HTMLElement>("[data-form-status]");
  if (!status) return;
  if (!state) {
    status.removeAttribute("data-state");
    status.innerHTML = "";
    return;
  }
  status.dataset.state = state;
  status.innerHTML = html;
  status.tabIndex = -1;
  status.focus();
}

/** Show/hide sections such as [data-show-when="service=web"] and disable hidden controls. */
function syncConditionals(form: HTMLFormElement): void {
  form.querySelectorAll<HTMLElement>("[data-show-when]").forEach((section) => {
    const [name, value] = (section.dataset.showWhen || "").split("=");
    const controls = Array.from(form.querySelectorAll<Control>(`[name="${name}"]`));
    const current = controls
      .filter((c) => !(c instanceof HTMLInputElement) || !["radio", "checkbox"].includes(c.type) || c.checked)
      .map((c) => c.value);
    const show = value.split("|").some((v) => current.includes(v));
    section.hidden = !show;
    section.querySelectorAll<Control>("input, select, textarea").forEach((c) => (c.disabled = !show));
  });
}

function setupForm(form: HTMLFormElement): void {
  form.noValidate = true; // we validate with clearer, accessible messages
  const steps = Array.from(form.querySelectorAll<HTMLElement>(".form-step"));
  let current = 0;

  // Live validation: on blur once touched, then on input while invalid.
  form.addEventListener(
    "blur",
    (e) => {
      const t = e.target as Control;
      if (t.matches?.("input, select, textarea") && !t.closest("[data-honeypot]") && (t.value || t.dataset.touched)) {
        t.dataset.touched = "1";
        validate(t);
      }
    },
    true
  );
  form.addEventListener("input", (e) => {
    const t = e.target as Control;
    if (fieldOf(t)?.classList.contains("is-invalid")) validate(t);
  });
  form.addEventListener("change", (e) => {
    const t = e.target as Control;
    syncConditionals(form);
    if (t.type === "radio" || t.type === "checkbox" || t.tagName === "SELECT") validate(t);
  });
  prefillFromUrl(form);
  syncConditionals(form);

  // Multi-step flow
  if (steps.length > 1) {
    const stepper = document.createElement("ol");
    stepper.className = "stepper";
    stepper.setAttribute("aria-label", "Form progress");
    steps.forEach((s, i) => {
      const li = document.createElement("li");
      li.innerHTML = `<span class="sr-only">Step ${i + 1} of ${steps.length}: </span><span class="stepper__label">${s.dataset.stepTitle || `Step ${i + 1}`}</span>`;
      stepper.append(li);
    });
    form.prepend(stepper);

    const show = (index: number, focus: boolean) => {
      current = index;
      steps.forEach((s, i) => s.classList.toggle("is-current", i === index));
      Array.from(stepper.children).forEach((li, i) => {
        li.classList.toggle("is-done", i < index);
        li.classList.toggle("is-current", i === index);
        if (i === index) li.setAttribute("aria-current", "step");
        else li.removeAttribute("aria-current");
      });
      if (steps[index].hasAttribute("data-review")) fillReview(form, steps[index]);
      if (focus) {
        const heading = steps[index].querySelector<HTMLElement>("legend, h2, h3");
        if (heading) {
          heading.tabIndex = -1;
          heading.focus();
        }
        form.scrollIntoView({ block: "start", behavior: "auto" });
      }
    };

    form.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-step-next], [data-step-back]");
      if (!btn) return;
      e.preventDefault();
      if (btn.hasAttribute("data-step-back")) {
        show(Math.max(0, current - 1), true);
        return;
      }
      const invalid = validateScope(steps[current]);
      if (invalid) {
        invalid.focus();
        return;
      }
      show(Math.min(steps.length - 1, current + 1), true);
    });
    show(0, false);
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    setStatus(form, null);
    const invalid = validateScope(form);
    if (invalid) {
      // Jump back to the step that holds the problem.
      const stepIndex = steps.findIndex((s) => s.contains(invalid));
      if (stepIndex > -1 && steps.length > 1) {
        steps.forEach((s, i) => s.classList.toggle("is-current", i === stepIndex));
      }
      const count = form.querySelectorAll(".field.is-invalid").length;
      setStatus(form, "error", `${count === 1 ? "One field needs" : `${count} fields need`} attention before this can be sent. The first one is highlighted.`);
      invalid.focus();
      return;
    }

    const honeypot = form.querySelector<HTMLInputElement>("[data-honeypot] input");
    if (honeypot && honeypot.value) return; // silently drop bot submissions

    const endpoint = (form.dataset.endpoint || "").trim();
    if (!endpoint) {
      setStatus(
        form,
        "info",
        `Everything you entered looks complete, but this form is not connected to Jemawe's inbox yet, so it has <strong>not</strong> been sent. Please keep a copy of your details. Once a secure form service is connected, this button will send your request.`
      );
      return;
    }

    const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]');
    submit?.classList.add("is-loading");
    submit?.setAttribute("aria-disabled", "true");
    try {
      const data: Record<string, string | string[]> = {};
      new FormData(form).forEach((value, key) => {
        if (form.querySelector(`[data-honeypot] [name="${key}"]`)) return;
        const v = String(value);
        if (key in data) data[key] = ([] as string[]).concat(data[key], v);
        else data[key] = v;
      });
      data.form = form.dataset.form || "inquiry";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(String(res.status));
      window.location.assign(`/thank-you/?form=${encodeURIComponent(form.dataset.form || "inquiry")}`);
    } catch {
      setStatus(form, "error", "Your request could not be sent because the form service did not respond. Your answers are still here, so you can try again in a moment.");
    } finally {
      submit?.classList.remove("is-loading");
      submit?.removeAttribute("aria-disabled");
    }
  });
}

/** Links such as /quote/?service=web preselect a matching option. Only known keys, only existing values. */
const PREFILL_KEYS = ["service", "type", "topic"];
function prefillFromUrl(form: HTMLFormElement): void {
  const params = new URLSearchParams(window.location.search);
  for (const key of PREFILL_KEYS) {
    const value = params.get(key);
    if (!value) continue;
    form.querySelectorAll<Control>(`[name="${key}"]`).forEach((c) => {
      if (c instanceof HTMLInputElement && (c.type === "radio" || c.type === "checkbox")) {
        if (c.value === value) c.checked = true;
      } else if (c instanceof HTMLSelectElement) {
        if (Array.from(c.options).some((o) => o.value === value)) c.value = value;
      }
    });
  }
}

function fillReview(form: HTMLFormElement, step: HTMLElement): void {
  const target = step.querySelector<HTMLElement>("[data-review-list]");
  if (!target) return;
  const rows: string[] = [];
  const seen = new Set<string>();
  for (const c of controlsIn(form)) {
    if (step.contains(c) || seen.has(c.name)) continue;
    let value = "";
    if (c instanceof HTMLInputElement && (c.type === "radio" || c.type === "checkbox")) {
      if (c.type === "checkbox" && !c.name.endsWith("[]") && form.querySelectorAll(`[name="${c.name}"]`).length === 1) {
        continue; // single consent boxes are not useful to repeat
      }
      seen.add(c.name);
      value = Array.from(form.querySelectorAll<HTMLInputElement>(`[name="${c.name}"]:checked`))
        .map((x) => x.closest(".choice")?.querySelector(".choice__title")?.textContent || x.value)
        .join(", ");
    } else if (c instanceof HTMLSelectElement) {
      value = c.value ? c.selectedOptions[0]?.textContent || c.value : "";
    } else {
      value = c.value.trim();
    }
    if (!value) continue;
    const field = fieldOf(c);
    const label = (field?.querySelector(".field__label, legend")?.textContent || labelText(c)).replace(/\(optional\)/i, "").trim();
    rows.push(`<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`);
  }
  target.innerHTML = rows.length ? rows.join("") : "<div><dt>Nothing entered yet</dt><dd>Go back to add your details.</dd></div>";
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch] as string);
}
