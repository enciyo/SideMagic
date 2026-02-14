/**
 * Main World Script – Runs in the page's actual JavaScript context.
 *
 * Content scripts run in an "isolated world", so
 * HTMLInputElement.prototype overrides are not visible to page JS.
 * This script runs in the page's world to actually intercept
 * .click() and .showPicker() calls and prevent the file picker from opening.
 *
 * Communication: content script ↔ page world = window.postMessage
 */

export default defineUnlistedScript(() => {
  window.addEventListener("message", (event) => {
    if (event.data?.type !== "SIDEMAGIC_SETUP_INTERCEPT") return;

    const { content, filename, mimeType } = event.data as {
      content: string;
      filename: string;
      mimeType: string;
    };

    let intercepted = false;
    const originalClick = HTMLInputElement.prototype.click;
    const originalShowPicker = HTMLInputElement.prototype.showPicker;

    function restore(): void {
      HTMLInputElement.prototype.click = originalClick;
      if (originalShowPicker) {
        HTMLInputElement.prototype.showPicker = originalShowPicker;
      }
    }

    function handleIntercept(input: HTMLInputElement): void {
      if (intercepted) return;
      intercepted = true;

      // Create the file and set it on the file input
      const blob = new Blob([content], { type: mimeType });
      const file = new File([blob], filename, {
        type: mimeType,
        lastModified: Date.now(),
      });
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;

      // Restore overrides
      restore();

      // Dispatch change event (Gemini's listener expects this)
      setTimeout(() => {
        input.dispatchEvent(new Event("change", { bubbles: true }));
        input.dispatchEvent(new Event("input", { bubbles: true }));
        // Notify content script of result
        window.postMessage(
          { type: "SIDEMAGIC_INTERCEPT_RESULT", success: true },
          "*",
        );
      }, 200);
    }

    // .click() override
    HTMLInputElement.prototype.click = function (this: HTMLInputElement) {
      if (this.type === "file" && !intercepted) {
        handleIntercept(this);
        return; // File picker does not open
      }
      return originalClick.call(this);
    };

    // .showPicker() override
    if (originalShowPicker) {
      HTMLInputElement.prototype.showPicker = function (this: HTMLInputElement) {
        if (this.type === "file" && !intercepted) {
          handleIntercept(this);
          return; // showPicker blocked
        }
        return originalShowPicker.call(this);
      };
    }

    // 6 second timeout – restore if interception doesn't happen
    setTimeout(() => {
      if (!intercepted) {
        restore();
        window.postMessage(
          { type: "SIDEMAGIC_INTERCEPT_RESULT", success: false },
          "*",
        );
      }
    }, 6000);
  });
});
