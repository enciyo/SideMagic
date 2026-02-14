/**
 * Notifies background when Cmd+. / Ctrl+. is pressed in the main tab.
 * No UI is shown – the palette only opens inside the side panel.
 */

export default defineContentScript({
  matches: ["<all_urls>"],
  allFrames: false,
  runAt: "document_start",

  main() {
    if (window.self !== window.top) return;

    document.addEventListener(
      "keydown",
      (e) => {
        if (e.key !== "." || (!e.metaKey && !e.ctrlKey)) return;
        e.preventDefault();
        e.stopPropagation();
        browser.runtime.sendMessage({ type: "OPEN_COMMAND_PALETTE" }).catch(() => {});
      },
      true,
    );
  },
});
