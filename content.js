const ext = typeof browser !== "undefined" ? browser : chrome;

function asPromise(result, fallback) {
  return result && typeof result.then === "function" ? result : fallback();
}

function storageGet(keys) {
  try {
    return asPromise(ext.storage.local.get(keys), () =>
      new Promise((resolve, reject) => {
        ext.storage.local.get(keys, (res) => {
          const err = ext.runtime?.lastError;
          err ? reject(err) : resolve(res);
        });
      })
    );
  } catch (err) {
    return Promise.reject(err);
  }
}

function storageSet(payload) {
  try {
    return asPromise(ext.storage.local.set(payload), () =>
      new Promise((resolve, reject) => {
        ext.storage.local.set(payload, () => {
          const err = ext.runtime?.lastError;
          err ? reject(err) : resolve();
        });
      })
    );
  } catch (err) {
    return Promise.reject(err);
  }
}

function sendMessage(msg) {
  try {
    return asPromise(ext.runtime.sendMessage(msg), () =>
      new Promise((resolve, reject) => {
        ext.runtime.sendMessage(msg, (res) => {
          const err = ext.runtime?.lastError;
          err ? reject(err) : resolve(res);
        });
      })
    );
  } catch (err) {
    return Promise.reject(err);
  }
}

let box;
let translateBtn;
let lastSelectionText = "";
let selectionUpdateTimer;

const BTN_MARGIN = 8;
const BOX_MARGIN = 8;
const CHAT_PANEL_MIN_WIDTH = 320;
const CHAT_PANEL_MIN_HEIGHT = 240;
const CHAT_SHORTCUT_CODE = "Slash";
const CHAT_SHORTCUT_LABEL = "Command + /";
const SETTINGS_KEY = "ptLanguage";
const SETTINGS_FAST_KEY = "ptFastTranslate";
const API_SETTINGS_KEY = "ptApiSettings";
const DEFAULT_LANGUAGE = "zh";
const DEFAULT_FAST_MODE = false;
const DEFAULT_API_PROVIDER = "lmstudio";
const LANGUAGE_OPTIONS = [
  { value: "zh", label: "中文" },
  { value: "ja", label: "日本語" },
  { value: "en", label: "English" }
];
const LANGUAGE_VALUES = new Set(LANGUAGE_OPTIONS.map((opt) => opt.value));
const API_PROVIDER_DEFAULTS = {
  lmstudio: {
    baseUrl: "http://127.0.0.1:1234",
    model: "qwen/qwen3-8b",
    apiKey: ""
  },
  openai: {
    baseUrl: "https://api.openai.com",
    model: "gpt-4.1-mini",
    apiKey: ""
  },
  gemini: {
    baseUrl: "https://generativelanguage.googleapis.com",
    model: "gemini-2.0-flash",
    apiKey: ""
  },
  custom: {
    baseUrl: "http://127.0.0.1:1234",
    model: "qwen/qwen3-8b",
    apiKey: ""
  }
};
const API_PROVIDER_VALUES = new Set(Object.keys(API_PROVIDER_DEFAULTS));
const UI_LABELS = {
  zh: {
    toggle: "語言",
    title: "翻譯語言",
    fast: "快速翻譯",
    providerTitle: "模型 API",
    provider: "供應商",
    baseUrl: "API Base URL",
    model: "模型",
    apiKey: "API Key",
    apiHint:
      "OpenAI / Gemini 需要 API Key。自架 OpenAI 相容 API 可留空。",
    chatTitle: "英文問答",
    chatLauncherPlaceholder: "快速問英文問題...",
    chatLauncherHint: "按 Command + / 開啟或關閉",
    chatInputPlaceholder: "繼續問英文問題...",
    chatEmpty: "問我單字、文法、語氣、用法都可以。",
    chatThinking: "思考中...",
    chatFailed: "問答失敗",
    minimize: "最小化",
    chatReset: "清除紀錄並關閉",
    translateBtn: "翻譯",
    translationTitle: "翻譯",
    play: "播放",
    close: "關閉",
    loading: "翻譯中...",
    ttsGenerating: "產生中",
    ttsFailed: "失敗"
  },
  ja: {
    toggle: "言語",
    title: "翻訳言語",
    fast: "高速翻訳",
    providerTitle: "モデル API",
    provider: "プロバイダー",
    baseUrl: "API Base URL",
    model: "モデル",
    apiKey: "API Key",
    apiHint:
      "OpenAI / Gemini は API Key が必要です。OpenAI 互換 API は空欄可。",
    chatTitle: "英語 Q&A",
    chatLauncherPlaceholder: "英語についてすばやく質問...",
    chatLauncherHint: "Command + / で開閉",
    chatInputPlaceholder: "英語について続けて質問...",
    chatEmpty: "単語、文法、トーン、使い方を気軽に聞いてください。",
    chatThinking: "考え中...",
    chatFailed: "チャット失敗",
    minimize: "最小化",
    chatReset: "履歴を消して閉じる",
    translateBtn: "翻訳",
    translationTitle: "翻訳",
    play: "再生",
    close: "閉じる",
    loading: "翻訳中...",
    ttsGenerating: "生成中",
    ttsFailed: "失敗"
  },
  en: {
    toggle: "Lang",
    title: "Translation Language",
    fast: "Fast Translate",
    providerTitle: "Model API",
    provider: "Provider",
    baseUrl: "API Base URL",
    model: "Model",
    apiKey: "API Key",
    apiHint: "OpenAI and Gemini need a key. Self-hosted OpenAI-compatible APIs can leave it blank.",
    chatTitle: "English Helper",
    chatLauncherPlaceholder: "Ask a quick English question...",
    chatLauncherHint: "Press Command + / to open or close",
    chatInputPlaceholder: "Ask another English question...",
    chatEmpty: "Ask about vocabulary, grammar, tone, or usage.",
    chatThinking: "Thinking...",
    chatFailed: "Chat failed",
    minimize: "Hide",
    chatReset: "Clear and close",
    translateBtn: "Translate",
    translationTitle: "Translation",
    play: "Play",
    close: "Close",
    loading: "Translating...",
    ttsGenerating: "Generating",
    ttsFailed: "Failed"
  }
};
const LANGUAGE_OPTION_LABELS = {
  zh: { zh: "中文", ja: "日文", en: "英文" },
  ja: { zh: "中国語", ja: "日本語", en: "英語" },
  en: { zh: "Chinese", ja: "Japanese", en: "English" }
};
const API_PROVIDER_OPTION_LABELS = {
  zh: {
    lmstudio: "LM Studio",
    openai: "OpenAI / GPT",
    gemini: "Google Gemini",
    custom: "自訂 API"
  },
  ja: {
    lmstudio: "LM Studio",
    openai: "OpenAI / GPT",
    gemini: "Google Gemini",
    custom: "カスタム API"
  },
  en: {
    lmstudio: "LM Studio",
    openai: "OpenAI / GPT",
    gemini: "Google Gemini",
    custom: "Custom API"
  }
};

let currentLanguage = DEFAULT_LANGUAGE;
let currentFastMode = DEFAULT_FAST_MODE;
let currentApiSettings = null;
let settingsWidget;
let settingsPanel;
let settingsToggle;
let settingsTitle;
let settingsSelect;
let apiTitle;
let apiSectionToggle;
let apiSectionBody;
let apiSectionChevron;
let providerLabel;
let providerSelect;
let baseUrlLabel;
let baseUrlInput;
let modelLabel;
let modelInput;
let apiKeyLabel;
let apiKeyInput;
let apiHint;
let fastModeToggle;
let fastModeLabel;
let chatLauncher;
let chatLauncherInput;
let chatLauncherHint;
let chatPanel;
let chatPanelTitle;
let chatPanelShortcut;
let chatPanelMessages;
let chatPanelInput;
let chatPanelMinimize;
let chatPanelClose;
let settingsDragMoved = false;
let ttsAudio;
let ttsCacheKey = "";
let ttsCacheUrl = "";
let ttsInFlight = false;
let lastSelectionRect = null;
let lastRequestRect = null;
let lastSelectionLineRect = null;
let apiSectionExpanded = false;
let chatHistory = [];
let chatPending = false;
let pendingChatSelection = null;
let chatRequestVersion = 0;


function makeDraggable(handle, target) {
  handle.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    e.preventDefault();

    const rect = target.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;

    target.style.left = `${rect.left}px`;
    target.style.top = `${rect.top}px`;
    target.style.right = "auto";
    target.style.bottom = "auto";

    const onMove = (ev) => {
      const nextLeft = clamp(ev.clientX - offsetX, BOX_MARGIN, window.innerWidth - rect.width - BOX_MARGIN);
      const nextTop = clamp(ev.clientY - offsetY, BOX_MARGIN, window.innerHeight - rect.height - BOX_MARGIN);
      target.style.left = `${nextLeft}px`;
      target.style.top = `${nextTop}px`;
    };

    const onUp = () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
    };

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
  });
}

function makeResizable(handle, target) {
  if (!handle || !target) return;

  handle.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    const rect = target.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = rect.width;
    const startHeight = rect.height;
    const maxWidth = window.innerWidth - rect.left - BOX_MARGIN;
    const maxHeight = window.innerHeight - rect.top - BOX_MARGIN;

    target.style.width = `${Math.round(startWidth)}px`;
    target.style.height = `${Math.round(startHeight)}px`;

    const onMove = (ev) => {
      const nextWidth = clamp(
        startWidth + (ev.clientX - startX),
        CHAT_PANEL_MIN_WIDTH,
        maxWidth
      );
      const nextHeight = clamp(
        startHeight + (ev.clientY - startY),
        CHAT_PANEL_MIN_HEIGHT,
        maxHeight
      );

      target.style.width = `${Math.round(nextWidth)}px`;
      target.style.height = `${Math.round(nextHeight)}px`;
    };

    const onUp = () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
    };

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
  });
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatRichText(input) {
  const escaped = escapeHtml(input);
  const withBold = escaped.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  return withBold.replace(/\r?\n/g, "<br>");
}

function formatInlineMarkdown(input) {
  let text = escapeHtml(input);
  const tokens = [];
  const protect = (html) => {
    const token = `\u0000md${tokens.length}\u0000`;
    tokens.push(html);
    return token;
  };

  text = text.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    (_, label, url) => {
      const safeUrl = url.replace(/&amp;/g, "&").replace(/"/g, "%22");
      return protect(
        `<a href="${safeUrl}" target="_blank" rel="noreferrer noopener" style="color:#ffb498;text-decoration:underline;">${label}</a>`
      );
    }
  );

  text = text.replace(/`([^`\n]+)`/g, (_, code) =>
    protect(
      `<code style="padding:1px 4px;border-radius:6px;background:rgba(0,0,0,.28);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.92em;">${code}</code>`
    )
  );

  text = text
    .replace(/\*\*([\s\S]+?)\*\*/g, "<strong>$1</strong>")
    .replace(/__([\s\S]+?)__/g, "<strong>$1</strong>")
    .replace(/\*([^*\n]+)\*/g, "<em>$1</em>")
    .replace(/_([^_\n]+)_/g, "<em>$1</em>");

  return text.replace(/\u0000md(\d+)\u0000/g, (_, index) => {
    const value = tokens[Number(index)];
    return value || "";
  });
}

function isMarkdownBlockBoundary(line) {
  return (
    /^(#{1,6})\s+/.test(line) ||
    /^>\s?/.test(line) ||
    /^([-*_])(?:\s*\1){2,}\s*$/.test(line) ||
    /^[-*+]\s+/.test(line) ||
    /^\d+[.)]\s+/.test(line)
  );
}

function parseMarkdownTableRow(line) {
  const trimmed = String(line || "").trim();
  if (!trimmed || !trimmed.includes("|")) return null;

  const normalized = trimmed
    .replace(/^\|/, "")
    .replace(/\|$/, "");
  const cells = normalized.split("|").map((cell) => cell.trim());

  if (cells.length < 2) return null;
  return cells;
}

function isMarkdownTableSeparator(line) {
  const cells = parseMarkdownTableRow(line);
  if (!cells) return false;

  return cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function parseMarkdownTableAlignments(line, width) {
  const cells = parseMarkdownTableRow(line);
  if (!cells) return Array.from({ length: width }, () => "left");

  return Array.from({ length: width }, (_, index) => {
    const cell = cells[index] || "";
    const left = cell.startsWith(":");
    const right = cell.endsWith(":");
    if (left && right) return "center";
    if (right) return "right";
    return "left";
  });
}

function isMarkdownTableStart(lines, index) {
  if (index + 1 >= lines.length) return false;
  return Boolean(
    parseMarkdownTableRow(lines[index]) &&
    isMarkdownTableSeparator(lines[index + 1])
  );
}

function fitMarkdownTableCells(cells, width) {
  const out = Array.from({ length: width }, (_, index) => cells[index] || "");
  return out;
}

function renderMarkdownTable(lines, startIndex) {
  const header = parseMarkdownTableRow(lines[startIndex]);
  if (!header) {
    return { html: "", nextIndex: startIndex + 1 };
  }

  const width = header.length;
  const alignments = parseMarkdownTableAlignments(lines[startIndex + 1], width);
  const bodyRows = [];
  let nextIndex = startIndex + 2;

  while (nextIndex < lines.length) {
    const trimmed = lines[nextIndex].trim();
    if (!trimmed) break;

    const row = parseMarkdownTableRow(lines[nextIndex]);
    if (!row || isMarkdownTableSeparator(lines[nextIndex])) break;

    bodyRows.push(fitMarkdownTableCells(row, width));
    nextIndex += 1;
  }

  const headerRow = fitMarkdownTableCells(header, width);
  const headerHtml = headerRow
    .map((cell, index) => {
      const align = alignments[index] || "left";
      return `<th style="padding:8px 10px;border:1px solid rgba(255,255,255,.08);background:rgba(255,107,61,.12);text-align:${align};font-weight:700;">${formatInlineMarkdown(
        cell
      )}</th>`;
    })
    .join("");

  const bodyHtml = bodyRows
    .map(
      (row) =>
        `<tr>${row
          .map((cell, index) => {
            const align = alignments[index] || "left";
            return `<td style="padding:8px 10px;border:1px solid rgba(255,255,255,.06);text-align:${align};vertical-align:top;">${formatInlineMarkdown(
              cell
            )}</td>`;
          })
          .join("")}</tr>`
    )
    .join("");

  return {
    html:
      `<div style="margin:0 0 8px;overflow-x:auto;">` +
      `<table style="width:100%;border-collapse:collapse;background:rgba(26,26,26,.38);border-radius:10px;overflow:hidden;">` +
      `<thead><tr>${headerHtml}</tr></thead>` +
      `<tbody>${bodyHtml}</tbody>` +
      `</table>` +
      `</div>`,
    nextIndex
  };
}

function renderMarkdownBlocks(input) {
  const lines = String(input || "").split("\n");
  const html = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    if (/^([-*_])(?:\s*\1){2,}\s*$/.test(trimmed)) {
      html.push(
        '<hr style="margin:10px 0;border:none;border-top:1px solid rgba(255,255,255,.12);">'
      );
      index += 1;
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = Math.min(headingMatch[1].length, 6);
      html.push(
        `<h${level} style="margin:0 0 8px;color:#ffcfbf;font-size:${Math.max(
          18 - level,
          13
        )}px;line-height:1.35;">${formatInlineMarkdown(
          headingMatch[2]
        )}</h${level}>`
      );
      index += 1;
      continue;
    }

    if (/^>\s?/.test(trimmed)) {
      const quoteLines = [];
      while (index < lines.length && /^>\s?/.test(lines[index].trim())) {
        quoteLines.push(lines[index].trim().replace(/^>\s?/, ""));
        index += 1;
      }
      html.push(
        `<blockquote style="margin:0 0 8px;padding:0 0 0 10px;border-left:3px solid rgba(255,107,61,.32);opacity:.92;">${quoteLines
          .map((item) => formatInlineMarkdown(item))
          .join("<br>")}</blockquote>`
      );
      continue;
    }

    if (/^[-*+]\s+/.test(trimmed)) {
      const items = [];
      while (index < lines.length && /^[-*+]\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^[-*+]\s+/, ""));
        index += 1;
      }
      html.push(
        `<ul style="margin:0 0 8px 18px;padding:0;">${items
          .map((item) => `<li style="margin:0 0 4px;">${formatInlineMarkdown(item)}</li>`)
          .join("")}</ul>`
      );
      continue;
    }

    if (/^\d+[.)]\s+/.test(trimmed)) {
      const items = [];
      while (index < lines.length && /^\d+[.)]\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^\d+[.)]\s+/, ""));
        index += 1;
      }
      html.push(
        `<ol style="margin:0 0 8px 18px;padding:0;">${items
          .map((item) => `<li style="margin:0 0 4px;">${formatInlineMarkdown(item)}</li>`)
          .join("")}</ol>`
      );
      continue;
    }

    if (isMarkdownTableStart(lines, index)) {
      const table = renderMarkdownTable(lines, index);
      if (table.html) html.push(table.html);
      index = table.nextIndex;
      continue;
    }

    const paragraphLines = [];
    while (index < lines.length) {
      const current = lines[index].trim();
      if (!current) break;
      if (
        paragraphLines.length &&
        (isMarkdownBlockBoundary(current) || isMarkdownTableStart(lines, index))
      ) {
        break;
      }
      paragraphLines.push(current);
      index += 1;
    }

    html.push(
      `<p style="margin:0 0 8px;">${paragraphLines
        .map((item) => formatInlineMarkdown(item))
        .join("<br>")}</p>`
    );
  }

  return html.join("");
}

function formatMarkdown(input) {
  const source = String(input || "").replace(/\r\n?/g, "\n");
  if (!source) return "";

  const segments = source.split("```");
  const html = [];

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];

    if (index % 2 === 0) {
      const rendered = renderMarkdownBlocks(segment);
      if (rendered) html.push(rendered);
      continue;
    }

    let code = segment;
    const newlineIndex = segment.indexOf("\n");
    if (newlineIndex !== -1) {
      const firstLine = segment.slice(0, newlineIndex).trim();
      if (/^[a-z0-9_+-]{1,24}$/i.test(firstLine)) {
        code = segment.slice(newlineIndex + 1);
      }
    }

    code = code.replace(/^\n+|\n+$/g, "");
    html.push(
      `<pre style="margin:0 0 8px;padding:10px;border-radius:10px;background:rgba(0,0,0,.32);overflow:auto;"><code style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">${escapeHtml(
        code
      )}</code></pre>`
    );
  }

  return html.join("") || formatPlainText(source);
}

function normalizeInlineText(input) {
  return String(input || "")
    .replace(/\s+/g, " ")
    .trim();
}
