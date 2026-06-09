export async function copyText(value, deps = globalThis) {
  const navigatorRef = deps.navigator;
  const documentRef = deps.document;
  const windowRef = deps.window || deps;

  try {
    if (navigatorRef?.clipboard?.writeText) {
      await navigatorRef.clipboard.writeText(value);
      return "clipboard";
    }
  } catch {
    // Fall back to the legacy copy path below for HTTP LAN contexts.
  }

  if (documentRef?.createElement && documentRef?.body && documentRef.execCommand) {
    const textarea = documentRef.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute?.("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.inset = "0";
    textarea.style.opacity = "0";
    textarea.style.pointerEvents = "none";

    const append = documentRef.body.appendChild || documentRef.body.append;
    const remove = documentRef.body.removeChild;

    if (append && remove) {
      append.call(documentRef.body, textarea);
      textarea.focus?.();
      textarea.select?.();
      textarea.setSelectionRange?.(0, textarea.value.length);

      const copied = documentRef.execCommand("copy");
      remove.call(documentRef.body, textarea);

      if (copied) {
        return "execCommand";
      }
    }
  }

  if (typeof windowRef?.prompt === "function") {
    windowRef.prompt("Copy this text", value);
    return "prompt";
  }

  throw new Error("Clipboard unavailable");
}
