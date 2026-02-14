/**
 * Side Panel – Chatbot selection and iframe opening
 *
 * When a card is clicked, the chatbot site opens as an iframe in the side panel.
 * Top toolbar: back button, chatbot name, refresh button.
 * Cmd+. opens the command palette (global shortcut or in panel).
 */

import { COMMANDS } from "~/utils/slash-menu";
import { msg } from "~/utils/i18n";

/** Apply i18n translations to the HTML page */
function applyI18n(): void {
  // data-i18n attribute: set textContent
  document.querySelectorAll<HTMLElement>("[data-i18n]").forEach((el) => {
    const key = el.dataset.i18n!;
    el.textContent = msg(key);
  });

  // data-i18n-html attribute: set innerHTML (for strings with HTML tags)
  document.querySelectorAll<HTMLElement>("[data-i18n-html]").forEach((el) => {
    const key = el.dataset.i18nHtml!;
    el.innerHTML = msg(key);
  });

  // data-i18n-title attribute: set title
  document.querySelectorAll<HTMLElement>("[data-i18n-title]").forEach((el) => {
    const key = el.dataset.i18nTitle!;
    el.title = msg(key);
  });

  // data-i18n-aria-label attribute: set aria-label
  document.querySelectorAll<HTMLElement>("[data-i18n-aria-label]").forEach((el) => {
    const key = el.dataset.i18nAriaLabel!;
    el.setAttribute("aria-label", msg(key));
  });

  // data-i18n-placeholder attribute: set placeholder (e.g. input)
  document.querySelectorAll<HTMLElement>("[data-i18n-placeholder]").forEach((el) => {
    const key = el.dataset.i18nPlaceholder!;
    (el as HTMLInputElement).placeholder = msg(key);
  });
}

// Apply translations on load
applyI18n();

const homeScreen = document.getElementById("home-screen")!;
const chatbotScreen = document.getElementById("chatbot-screen")!;
const chatbotIframe = document.getElementById("chatbot-iframe") as HTMLIFrameElement;
const chatbotLabel = document.getElementById("chatbot-label")!;
const btnBack = document.getElementById("btn-back")!;
const btnRefresh = document.getElementById("btn-refresh")!;
const commandPalette = document.getElementById("command-palette")!;
const commandPaletteSearch = document.getElementById("command-palette-search") as HTMLInputElement;
const commandPaletteList = document.getElementById("command-palette-list")!;
const authOverlay = document.getElementById("auth-overlay")!;

// Screen transitions
function showHome(): void {
  chatbotIframe.src = "about:blank";
  lastChatbotUrl = "";
  hideAuthOverlay();
  chatbotScreen.classList.remove("active");
  homeScreen.classList.add("active");
}

function showChatbot(name: string, url: string): void {
  lastChatbotUrl = url;
  chatbotLabel.textContent = name;
  chatbotIframe.src = url;
  homeScreen.classList.remove("active");
  chatbotScreen.classList.add("active");
  hideAuthOverlay();
}

// ── Auth overlay: shown when iframe redirects to login page ──────────
/** URL the iframe was loading before auth redirect (for reload after login) */
let lastChatbotUrl = "";

function showAuthOverlay(): void {
  authOverlay.hidden = false;
}

function hideAuthOverlay(): void {
  authOverlay.hidden = true;
}

/**
 * Reload the chatbot iframe after successful auth.
 *
 * Navigate iframe to the chatbot URL (e.g. grok.com). Cookie injection
 * (including Firefox partitioned store) sends the session from the auth tab;
 * cooldown allows auth redirects so grok.com can complete the handshake.
 * We use lastChatbotUrl instead of the auth URL so the user lands on the app.
 */
function reloadChatbotAfterAuth(_blockedAuthUrl?: string): void {
  hideAuthOverlay();

  if (lastChatbotUrl) chatbotIframe.src = lastChatbotUrl;
}

// Listen for auth redirect messages from the background script
browser.runtime.onMessage.addListener(
  (message: { type?: string; url?: string }) => {
    if (message.type === "AUTH_REDIRECT_DETECTED") {
      showAuthOverlay();
    }
    if (message.type === "AUTH_TAB_CLOSED") {
      reloadChatbotAfterAuth(message.url);
    }
  },
);

// Card click – open in iframe
document.querySelectorAll<HTMLButtonElement>(".card[data-url]").forEach((card) => {
  card.addEventListener("click", () => {
    const url = card.dataset.url;
    const name = card.querySelector(".card__name")?.textContent ?? "Chatbot";
    if (url) {
      showChatbot(name, url);
    }
  });
});

// Toolbar buttons
btnBack.addEventListener("click", showHome);
btnRefresh.addEventListener("click", () => {
  if (chatbotIframe.src && chatbotIframe.src !== "about:blank") {
    chatbotIframe.src = chatbotIframe.src;
  }
});

// ── Command palette (Cmd+. / Ctrl+.) ─────────────────────────────────
let paletteSelectedIndex = 0;
/** Filtered list for current search; indices refer to this array */
let paletteFilteredCommands: typeof COMMANDS = [];

function filterCommands(query: string): typeof COMMANDS {
  const q = query.trim().toLowerCase();
  if (!q) return [...COMMANDS];
  const desc = (cmd: (typeof COMMANDS)[0]) => msg(cmd.descriptionKey).toLowerCase();
  return COMMANDS.filter(
    (cmd) =>
      cmd.label.toLowerCase().includes(q) ||
      cmd.id.toLowerCase().includes(q) ||
      desc(cmd).includes(q),
  );
}

function renderPaletteItems(commands: typeof COMMANDS): void {
  if (commands.length === 0) {
    commandPaletteList.innerHTML = `<li class="command-palette__empty">${msg("commandPaletteNoResults")}</li>`;
    return;
  }
  commandPaletteList.innerHTML = commands
    .map(
      (cmd, i) => `
    <li class="command-palette__item" data-id="${cmd.id}" data-index="${i}" role="option" tabindex="-1">
      <span class="command-palette__item-content">
        <span class="command-palette__item-label">${cmd.label}</span>
        <div class="command-palette__item-desc">${msg(cmd.descriptionKey)}</div>
      </span>
      <kbd class="command-palette__kbd">⌘.</kbd>
    </li>`,
    )
    .join("");
  commandPaletteList.querySelectorAll(".command-palette__item").forEach((el) => {
    const item = el as HTMLElement;
    item.addEventListener("click", () => runPaletteCommand(item.dataset.id!));
    item.addEventListener("keydown", (e: Event) => {
      const ev = e as KeyboardEvent;
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        runPaletteCommand(item.dataset.id!);
      }
    });
  });
}

function renderPaletteSelection(): void {
  const items = commandPaletteList.querySelectorAll<HTMLElement>(".command-palette__item");
  items.forEach((el, i) => {
    el.classList.toggle("command-palette__item--selected", i === paletteSelectedIndex);
  });
  const selected = items[paletteSelectedIndex];
  if (selected) selected.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

function updatePaletteFilter(): void {
  const query = commandPaletteSearch?.value ?? "";
  paletteFilteredCommands = filterCommands(query);
  paletteSelectedIndex = 0;
  renderPaletteItems(paletteFilteredCommands);
  renderPaletteSelection();
}

/** Panel ve arama input'una focus verir; Cmd+. ile açıldığında panel hazır olana kadar tekrarlanır. */
function focusPanelAndPaletteInput(): void {
  window.focus();
  if (commandPaletteSearch) {
    commandPaletteSearch.focus();
  } else {
    commandPalette.focus();
  }
}

function showCommandPalette(): void {
  paletteFilteredCommands = [...COMMANDS];
  paletteSelectedIndex = 0;
  if (commandPaletteSearch) {
    commandPaletteSearch.value = "";
    commandPaletteSearch.placeholder = msg("commandPaletteSearchPlaceholder");
  }
  renderPaletteItems(paletteFilteredCommands);
  renderPaletteSelection();
  commandPalette.hidden = false;
  commandPalette.setAttribute("tabindex", "-1");
  focusPanelAndPaletteInput();
  requestAnimationFrame(focusPanelAndPaletteInput);
  // Panel Cmd+. ile yeni açıldıysa Chrome bazen focus'u geciktirir; birkaç deneme yap
  setTimeout(focusPanelAndPaletteInput, 100);
  setTimeout(focusPanelAndPaletteInput, 300);
}

function hideCommandPalette(): void {
  commandPalette.hidden = true;
}

function onPaletteKeydown(e: KeyboardEvent): void {
  if (commandPalette.hidden) return;
  const count = paletteFilteredCommands.length;
  if (e.key === "ArrowDown") {
    e.preventDefault();
    paletteSelectedIndex = count ? (paletteSelectedIndex + 1) % count : 0;
    renderPaletteSelection();
    return;
  }
  if (e.key === "ArrowUp") {
    e.preventDefault();
    paletteSelectedIndex = count ? (paletteSelectedIndex - 1 + count) % count : 0;
    renderPaletteSelection();
    return;
  }
  if (e.key === "Enter") {
    e.preventDefault();
    const cmd = paletteFilteredCommands[paletteSelectedIndex];
    if (cmd) runPaletteCommand(cmd.id);
    return;
  }
}

function runPaletteCommand(commandId: string): void {
  hideCommandPalette();
  const iframe = chatbotIframe;
  if (iframe.src && iframe.src !== "about:blank" && iframe.contentWindow) {
    iframe.contentWindow.postMessage({ type: "SIDEMAGIC_RUN_COMMAND", commandId }, "*");
  }
}

// Arrow keys and Enter: Capture in the palette box when open (capture) – safe even if focus is on the panel
commandPalette.addEventListener(
  "keydown",
  (e: Event) => {
    const ev = e as KeyboardEvent;
    if (commandPalette.hidden) return;
    if (ev.key === "Escape") {
      ev.preventDefault();
      hideCommandPalette();
      return;
    }
    onPaletteKeydown(ev);
  },
  true,
);

document.addEventListener("keydown", (e: KeyboardEvent) => {
  if (commandPalette.hidden === false) return; // When palette is open, the above listener handles it
  if (e.key !== "." || (!e.metaKey && !e.ctrlKey)) return;
  e.preventDefault();
  showCommandPalette();
});

// On open or after Cmd+. from main tab: show palette (skip if storage API unavailable – Firefox sidebar, etc.)
function maybeShowPaletteFromStorage(): void {
  if (!browser.storage?.local) return;
  browser.storage.local.get("sidemagicShowCommandPalette").then((v) => {
    if (v.sidemagicShowCommandPalette && browser.storage?.local) {
      browser.storage.local.remove("sidemagicShowCommandPalette");
      showCommandPalette();
    }
  });
}
maybeShowPaletteFromStorage();

// If panel is already open and Cmd+. is pressed in main tab, storage flag is set; listen for change
if (browser.storage?.local && browser.storage?.onChanged) {
  browser.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") return;
    if (changes.sidemagicShowCommandPalette?.newValue === true) {
      showCommandPalette();
      browser.storage?.local?.remove("sidemagicShowCommandPalette");
    }
  });
}

// Search: filter list on input
if (commandPaletteSearch) {
  commandPaletteSearch.addEventListener("input", () => updatePaletteFilter());
}

// Close palette when clicking outside
commandPalette.addEventListener("click", (e) => {
  if (e.target === commandPalette) hideCommandPalette();
});

// Cmd+. ile panel açıldığında panel görünür olur olmaz focus al (Chrome bazen focus vermiyor)
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && !commandPalette.hidden) {
    focusPanelAndPaletteInput();
  }
});
