/**
 * Main World Script – Runs in the page's actual JavaScript context.
 *
 * Content scripts run in an "isolated world", so
 * HTMLInputElement.prototype overrides are not visible to page JS.
 * This script runs in the page's world to actually intercept
 * .click() and .showPicker() calls and prevent the file picker from opening.
 *
 * Communication: content script ↔ page world = window.postMessage
 *
 * INTERCEPT LAYERS (triple approach):
 *  L1. Prototype override  – catches direct input.click() / input.showPicker()
 *  L2. Capturing click listener + preventDefault – catches label-triggered
 *      native pickers that bypass prototype overrides
 *  L3. MutationObserver – patches file inputs created dynamically after setup
 *
 * DEBUG: All console.log calls appear in the CHATBOT PAGE's DevTools console.
 * Filter by "SideMagic" to trace which layer fires.
 */

export default defineUnlistedScript(() => {
  window.addEventListener("message", (event) => {
    if (event.data?.type !== "SIDEMAGIC_SETUP_INTERCEPT") return;

    const { content, filename, mimeType } = event.data as {
      content: string;
      filename: string;
      mimeType: string;
    };

    console.group("SideMagic [MainWorld] intercept setup");
    console.log(`file: "${filename}" | mime: ${mimeType}`);

    let intercepted = false;
    const originalClick = HTMLInputElement.prototype.click;
    const originalShowPicker = HTMLInputElement.prototype.showPicker;
    let domObserver: MutationObserver | null = null;

    function restore(): void {
      HTMLInputElement.prototype.click = originalClick;
      if (originalShowPicker) {
        HTMLInputElement.prototype.showPicker = originalShowPicker;
      }
      domObserver?.disconnect();
      domObserver = null;
      console.log("SideMagic [MainWorld]: prototypes restored");
    }

    function handleIntercept(input: HTMLInputElement, source: string): void {
      if (intercepted) {
        console.log("SideMagic [MainWorld]: already done, skip (" + source + ")");
        return;
      }
      intercepted = true;
      console.log("SideMagic [MainWorld]: ✅ INTERCEPTED via", source, input);

      // Create the file and set it on the file input
      const blob = new Blob([content], { type: mimeType });
      const file = new File([blob], filename, {
        type: mimeType,
        lastModified: Date.now(),
      });
      const dt = new DataTransfer();
      dt.items.add(file);

      // Use native property setter so React/Angular/Vue controlled inputs
      // see the new FileList without synthetic event guards interfering.
      const nativeSetter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "files",
      )?.set;
      if (nativeSetter) {
        nativeSetter.call(input, dt.files);
      } else {
        input.files = dt.files;
      }
      console.log("SideMagic [MainWorld]: files set:", input.files?.length);

      // Restore overrides
      restore();

      // Dispatch change event (Gemini's listener expects this)
      setTimeout(() => {
        input.dispatchEvent(new Event("change", { bubbles: true }));
        input.dispatchEvent(new Event("input", { bubbles: true }));
        console.log("SideMagic [MainWorld]: events dispatched → success");
        window.postMessage(
          { type: "SIDEMAGIC_INTERCEPT_RESULT", success: true },
          "*",
        );
      }, 200);
    }

    // ── Layer 1: Prototype override (.click / .showPicker) ──────────────
    HTMLInputElement.prototype.click = function (this: HTMLInputElement) {
      console.log("SideMagic [L1-click]: type=" + this.type);
      if (this.type === "file" && !intercepted) {
        handleIntercept(this, "L1-prototype.click");
        return;
      }
      return originalClick.call(this);
    };

    if (originalShowPicker) {
      HTMLInputElement.prototype.showPicker = function (this: HTMLInputElement) {
        console.log("SideMagic [L1-showPicker]: type=" + this.type);
        if (this.type === "file" && !intercepted) {
          handleIntercept(this, "L1-prototype.showPicker");
          return;
        }
        return originalShowPicker.call(this);
      };
    }

    // ── Layer 2: Capturing click listener + preventDefault ──────────────
    const PATCHED = "__smPatch";
    function patchFileInput(fi: HTMLInputElement): void {
      if ((fi as unknown as Record<string, unknown>)[PATCHED]) return;
      (fi as unknown as Record<string, unknown>)[PATCHED] = 1;
      console.log("SideMagic [L2-patch]: applied to", fi);
      fi.addEventListener(
        "click",
        (e: Event) => {
          console.log("SideMagic [L2-click]: caught, intercepted=" + intercepted);
          if (!intercepted) {
            e.preventDefault();
            e.stopImmediatePropagation();
            handleIntercept(fi, "L2-click-listener");
          }
        },
        { capture: true, once: true },
      );
    }

    const existing = document.querySelectorAll<HTMLInputElement>("input[type='file']");
    console.log("SideMagic [L2]: patching", existing.length, "existing file inputs");
    existing.forEach(patchFileInput);

    // ── Layer 3: MutationObserver for dynamic file inputs ───────────────
    domObserver = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node instanceof HTMLInputElement && node.type === "file") {
            console.log("SideMagic [L3-MO]: new file input", node);
            patchFileInput(node);
          } else if (node instanceof Element) {
            node
              .querySelectorAll<HTMLInputElement>("input[type='file']")
              .forEach((fi) => {
                console.log("SideMagic [L3-MO]: file input in node", fi);
                patchFileInput(fi);
              });
          }
        }
      }
    });
    domObserver.observe(document.documentElement, { childList: true, subtree: true });
    console.log("SideMagic [L3]: MutationObserver active");

    // ── Timeout ────────────────────────────────────────────────────────
    setTimeout(() => {
      if (!intercepted) {
        console.warn(
          "SideMagic [MainWorld]: ❌ TIMEOUT – no layer fired within 6000ms",
        );
        restore();
        window.postMessage(
          { type: "SIDEMAGIC_INTERCEPT_RESULT", success: false },
          "*",
        );
      }
    }, 6000);

    console.groupEnd();
  });
});
