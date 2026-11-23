import { renderQRCode } from "./qr.js";
import { t } from "./i18n.js";
import { announce, copyWithFeedback, ui } from "./ui.js";

let lastFocused = null;
let open = false;

export function qrTargetUrl() {
  return `${window.location.origin}${window.location.pathname}`;
}

function focusableItems() {
  if (!ui.qr.modal) {
    return [];
  }
  return Array.from(
    ui.qr.modal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
  ).filter((element) => !element.disabled && !element.hidden);
}

export function openQRModal() {
  if (!ui.qr.modal) {
    return;
  }
  lastFocused = document.activeElement;
  const url = qrTargetUrl();

  ui.qr.code.textContent = "";
  try {
    ui.qr.code.append(renderQRCode(url, { margin: 4, ecc: "M", label: t("qr.title") }));
  } catch {
    // Extremely long URLs may exceed the supported QR versions; the copyable
    // URL below remains available.
    ui.qr.code.textContent = "";
  }
  ui.qr.url.textContent = url;
  ui.qr.modal.hidden = false;
  document.body.classList.add("modal-open");
  open = true;
  ui.qr.close.focus();
  announce(t("qr.title"));
}

export function closeQRModal() {
  if (!ui.qr.modal || !open) {
    return;
  }
  ui.qr.modal.hidden = true;
  document.body.classList.remove("modal-open");
  open = false;
  if (lastFocused && typeof lastFocused.focus === "function") {
    lastFocused.focus();
  }
}

export function initQRModal() {
  if (!ui.qr.button || !ui.qr.modal) {
    return;
  }

  ui.qr.button.addEventListener("click", () => openQRModal());
  ui.qr.close.addEventListener("click", () => closeQRModal());
  ui.qr.copy.addEventListener("click", () => copyWithFeedback(ui.qr.copy, qrTargetUrl()));

  ui.qr.modal.addEventListener("click", (event) => {
    if (event.target === ui.qr.modal) {
      closeQRModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (!open) {
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      closeQRModal();
      return;
    }
    if (event.key !== "Tab") {
      return;
    }
    const items = focusableItems();
    if (items.length === 0) {
      event.preventDefault();
      ui.qr.close.focus();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
}

export function isQRModalOpen() {
  return open;
}