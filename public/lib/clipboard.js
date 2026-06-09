export async function copyText(value, deps = globalThis) {
  const navigatorRef = deps.navigator;
  const documentRef = deps.document;

  try {
    if (navigatorRef?.clipboard?.writeText) {
      await navigatorRef.clipboard.writeText(value);
      return;
    }
  } catch {
    // Fall back to the legacy copy path below for HTTP LAN contexts.
  }

  if (!documentRef?.createElement || !documentRef?.body?.append || !documentRef.execCommand) {
    throw new Error("Clipboard unavailable");
  }

  const textarea = documentRef.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.inset = "0";
  textarea.style.opacity = "0";

  documentRef.body.append(textarea);
  textarea.focus();
  textarea.select();

  const copied = documentRef.execCommand("copy");
  documentRef.body.removeChild(textarea);

  if (!copied) {
    throw new Error("Clipboard unavailable");
  }
}
