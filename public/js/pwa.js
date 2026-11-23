/**
 * Register the static-asset service worker only in a secure context.
 * Plain HTTP LAN deployments silently skip (documented PWA limitation).
 */
export function registerServiceWorker() {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return;
  }
  if (!("serviceWorker" in navigator)) {
    return;
  }
  if (window.isSecureContext !== true) {
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // PWA is a progressive enhancement; never surface registration errors.
    });
  });
}