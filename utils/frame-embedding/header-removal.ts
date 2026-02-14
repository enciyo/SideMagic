/**
 * Frame Embedding – Header Removal (Firefox)
 *
 * X-Frame-Options / Permissions-Policy kaldırır; CSP frame-ancestors'ı
 * yeniden yazar. Chatbot sayfaları side panel iframe'inde açılabilir.
 *
 * Tarayıcı: Firefox (MV2) – webRequest.onHeadersReceived.
 * Chrome (MV3): declarativeNetRequest kullanır (bu dosya no-op).
 * Kapsam: sub_frame + <all_urls>.
 */

import { FRAME_EMBEDDING_HEADERS_TO_REMOVE } from "./constants";

// --- Sabitler ---

const LISTENER_FILTER = {
  urls: ["<all_urls>"],
  types: ["sub_frame"],
} as const;

const EXTRA_INFO_SPEC: string[] = ["blocking", "responseHeaders"];

const CSP_HEADER_NAMES = new Set([
  "content-security-policy",
  "content-security-policy-report-only",
]);

/** frame-ancestors direktifini tek eşleşmede * ile değiştirir */
const FRAME_ANCESTORS_REPLACE = /\bframe-ancestors\s+[^;]*/gi;
const FRAME_ANCESTORS_WILDCARD = "frame-ancestors *";

const HEADERS_TO_REMOVE_SET = new Set(
  FRAME_EMBEDDING_HEADERS_TO_REMOVE.map((h) => h.toLowerCase()),
);

// --- Tipler ---

type ResponseHeader = { name: string; value?: string };

interface WebRequestHeadersAPI {
  onHeadersReceived: {
    addListener: (
      callback: (details: { responseHeaders?: ResponseHeader[] }) => { responseHeaders: ResponseHeader[] },
      filter: { urls: readonly string[]; types: readonly string[] },
      extraInfoSpec: string[],
    ) => void;
  };
}

// --- Header işleme ---

function processResponseHeaders(headers: ResponseHeader[]): ResponseHeader[] {
  return headers
    .map((h): ResponseHeader | null => {
      const nameLower = h.name.toLowerCase();
      if (HEADERS_TO_REMOVE_SET.has(nameLower)) return null;
      if (CSP_HEADER_NAMES.has(nameLower) && h.value) {
        return { name: h.name, value: rewriteCspFrameAncestors(h.value) };
      }
      return h;
    })
    .filter((h): h is ResponseHeader => h !== null);
}

/** CSP içinde frame-ancestors direktifini * ile değiştirir; iframe'de yüklenebilir. */
function rewriteCspFrameAncestors(value: string): string {
  return value.replace(FRAME_ANCESTORS_REPLACE, FRAME_ANCESTORS_WILDCARD);
}

// --- Public API ---

type HeadersReceivedDetails = { responseHeaders?: ResponseHeader[] };

function onHeadersReceived(details: HeadersReceivedDetails): { responseHeaders: ResponseHeader[] } {
  return {
    responseHeaders: processResponseHeaders(details.responseHeaders ?? []),
  };
}

/**
 * Firefox'ta webRequest ile X-Frame-Options / CSP frame-ancestors düzenlemesi.
 * Chrome'da declarativeNetRequest kullanıldığı için burada no-op.
 */
export function setupHeaderRemoval(): void {
  if (!import.meta.env.FIREFOX) return;

  // Firefox MV2 webRequest has different types than Chrome; cast for addListener
  const webRequest = browser.webRequest as unknown as WebRequestHeadersAPI | undefined;
  if (!webRequest?.onHeadersReceived) return;

  webRequest.onHeadersReceived.addListener(
    onHeadersReceived,
    LISTENER_FILTER,
    EXTRA_INFO_SPEC,
  );
}
