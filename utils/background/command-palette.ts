/**
 * Command palette helpers – Opens the side panel and sets
 * a storage flag so the palette is shown when the panel opens.
 */

import { TIMEOUTS } from "../constants";

/** Chrome sidePanel API (not available in Firefox) */
function getSidePanel(): { open: (opts: { windowId: number }) => Promise<void> } | undefined {
  return browser.sidePanel;
}

/** Sets a storage flag so the palette is shown when the panel opens. */
function setCommandPaletteFlag(): void {
  setTimeout(() => {
    void browser.storage.local.set({ sidemagicShowCommandPalette: true });
  }, TIMEOUTS.PALETTE_FLAG_DELAY);
}

/** Cmd+. / OPEN_COMMAND_PALETTE: Opens panel on Chrome, only sets flag on Firefox. */
export async function openCommandPaletteOrSetFlag(): Promise<void> {
  const sidePanel = getSidePanel();
  if (sidePanel?.open) {
    try {
      const w = await browser.windows.getCurrent();
      if (w?.id) await sidePanel.open({ windowId: w.id });
    } catch {
      // Window/panel closed, etc.
    }
  }
  setCommandPaletteFlag();
}
