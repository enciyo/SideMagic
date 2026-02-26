/**
 * Background / Service Worker
 *
 * Responsibilities:
 * 1. "Previous active tab" tracking
 * 2. Fetches HTML/text/URL from the source tab based on messages from content script
 * 3. Side panel opening
 * 4. Frame embedding: header removal (Firefox = webRequest, Chrome = declarativeNetRequest)
 * 5. Auth redirect detection – opens auth pages in a new tab when iframe is blocked
 */

import type { RuntimeMessage } from "~/utils/types";
import { setupTabTracking } from "~/utils/background/tab-tracking";
import { setupHeaderRemoval } from "~/utils/frame-embedding/header-removal";
import { setupAuthRedirect } from "~/utils/frame-embedding/auth-redirect";
import { handleSetupFileIntercept } from "~/utils/background/file-intercept";
import { openCommandPaletteOrSetFlag } from "~/utils/background/command-palette";
import { handleGetSourceTabData, handleGetSourceTabUrl } from "~/utils/background/source-tab-data";

export default defineBackground(() => {
  // ── Active tab tracking ────────────────────────────────────────────
  const { getLastSourceTabId } = setupTabTracking();

  // ── Side panel: Open on icon click ─────────────────────────────────
  try {
    const sp = browser.sidePanel as
      | { setPanelBehavior: (opts: Record<string, boolean>) => Promise<void> }
      | undefined;
    if (sp?.setPanelBehavior) {
      sp.setPanelBehavior({ openPanelOnActionClick: true });
    }
  } catch {
    // Firefox – sidebar_action default behavior
  }

  // ── Cmd+. / Ctrl+.: Command palette ────────────────────────────────
  browser.commands?.onCommand?.addListener((name: string) => {
    if (name === "open-command-palette") void openCommandPaletteOrSetFlag();
  });

  // ── Frame embedding: Firefox = webRequest, Chrome = DNR (manifest) ─
  setupHeaderRemoval();

  // ── Auth redirect: Open auth pages in new tab when iframe is blocked
  setupAuthRedirect();

  // ── Message Listener ───────────────────────────────────────────────
  browser.runtime.onMessage.addListener(
    (
      message: RuntimeMessage,
      sender: Browser.runtime.MessageSender,
      sendResponse: (response: unknown) => void,
    ) => {
      if (message.type === "GET_SOURCE_TAB_DATA") {
        handleGetSourceTabData(getLastSourceTabId())
          .then((data) => sendResponse({ success: true, data }))
          .catch((err) =>
            sendResponse({ success: false, error: String(err) }),
          );
        return true;
      }

      if (message.type === "GET_SOURCE_TAB_URL") {
        handleGetSourceTabUrl(getLastSourceTabId())
          .then((url) => sendResponse({ success: true, url }))
          .catch((err) =>
            sendResponse({ success: false, error: String(err) }),
          );
        return true;
      }

      if (message.type === "OPEN_COMMAND_PALETTE") {
        void openCommandPaletteOrSetFlag();
        sendResponse({ success: true });
        return true;
      }

      if (message.type === "SETUP_FILE_INTERCEPT") {
        handleSetupFileIntercept(
          sender,
          message.content ?? "",
          message.filename ?? "file.txt",
          message.mimeType ?? "text/plain",
          message.originUrl,
        )
          .then((ok) => sendResponse({ success: ok }))
          .catch((err) =>
            sendResponse({ success: false, error: String(err) }),
          );
        return true;
      }
    },
  );
});
