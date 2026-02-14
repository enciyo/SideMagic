import { defineConfig } from "wxt";
import {
  FRAME_EMBEDDING_DNR_RULE_ID,
  FRAME_EMBEDDING_DNR_RULE_PATH,
} from "./utils/frame-embedding/constants";

export default defineConfig({
  manifest: ({ browser }) => {
    // <all_urls>: Required for Firefox webRequest (header-removal, auth-redirect)
    // and Chrome declarativeNetRequest rule scope
    const hostPermissions = [
      "https://gemini.google.com/*",
      "https://claude.ai/*",
      "https://x.com/*",
      "https://grok.com/*",
      "https://kimi.com/*",
      "https://www.kimi.com/*",
      "https://accounts.x.ai/*",
      "<all_urls>",
    ];

    const base = {
      name: "__MSG_extName__",
      description: "__MSG_extDescription__",
      default_locale: "en",
      version: "0.1.0",
      host_permissions: hostPermissions,
    };

    // Add main world script to web_accessible_resources
    const webAccessibleResources = [
      {
        resources: ["intercept-main-world.js"],
        matches: [
          "https://gemini.google.com/*",
          "https://claude.ai/*",
          "https://x.com/*",
          "https://grok.com/*",
          "https://kimi.com/*",
          "https://www.kimi.com/*",
        ],
      },
    ];

    if (browser === "firefox") {
      // Firefox MV2: host URLs in permissions; no host_permissions key
      const { host_permissions: _hp, ...baseWithoutHost } = base;
      return {
        ...baseWithoutHost,
        permissions: [
          "activeTab",
          "tabs",
          "storage",
          "identity",
          "webNavigation",
          "webRequest",
          "webRequestBlocking",
          ...hostPermissions,
        ],
        commands: {
          "open-command-palette": {
            suggested_key: { default: "Ctrl+Period", mac: "Command+Period" },
            description: "__MSG_openCommandPalette__",
          },
        },
        web_accessible_resources: webAccessibleResources,
      };
    }

    // Chrome MV3: declarativeNetRequest + Cmd+. command palette
    return {
      ...base,
      permissions: [
        "activeTab",
        "scripting",
        "tabs",
        "storage",
        "identity",
        "webNavigation",
        "declarativeNetRequest",
      ],
      action: {
        default_title: "SideMagic",
      },
      commands: {
        "open-command-palette": {
          suggested_key: { default: "Ctrl+Period", mac: "Command+Period" },
          description: "__MSG_openCommandPalette__",
        },
      },
      declarative_net_request: {
        rule_resources: [
          {
            id: FRAME_EMBEDDING_DNR_RULE_ID,
            enabled: true,
            path: FRAME_EMBEDDING_DNR_RULE_PATH,
          },
        ],
      },
      web_accessible_resources: webAccessibleResources,
    };
  },
});
