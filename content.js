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
  { value: "ja", label: "日文" },
  { value: "en", label: "英文" }
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
    provider: "服務",
    baseUrl: "API 網址",
    model: "模型",
    apiKey: "API Key",
    apiHint: "OpenAI / Gemini 需要 Key，自架 OpenAI 相容 API 可留空。",
    chatTitle: "英文問答",
    chatLauncherPlaceholder: "快速問英文問題...",
    chatLauncherHint: "按 Command + / 開啟或關閉",
    chatInputPlaceholder: "繼續問英文問題...",
    chatEmpty: "問我單字、文法、語氣、用法都可以。",
    chatThinking: "思考中...",
    chatFailed: "問答失敗",
    minimize: "隱藏",
    chatReset: "清除紀錄並關閉",
    translateBtn: "翻譯",
    translationTitle: "翻譯",
    play: "播放",
    close: "關閉",
    loading: "翻譯中...",
    ttsGenerating: "生成中",
    ttsFailed: "失敗"
  },
  ja: {
    toggle: "言語",
    title: "翻訳言語",
    fast: "クイック翻訳",
    providerTitle: "モデル API",
    provider: "サービス",
    baseUrl: "API URL",
    model: "モデル",
    apiKey: "API Key",
    apiHint: "OpenAI / Gemini は Key が必要です。自前の OpenAI 互換 API は空欄でも使えます。",
    chatTitle: "英語 Q&A",
    chatLauncherPlaceholder: "英語についてすばやく質問...",
    chatLauncherHint: "Command + / で開閉",
    chatInputPlaceholder: "英語について続けて質問...",
    chatEmpty: "単語、文法、トーン、使い方を気軽に聞いてください。",
    chatThinking: "考え中...",
    chatFailed: "チャット失敗",
    minimize: "隠す",
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
let currentApiSettings = createDefaultApiSettings();
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

ext.runtime.onMessage.addListener((msg) => {
  if (msg?.type !== "SHOW_TRANSLATION") return;
  const { original, translated } = msg;
  showTranslation(original, translated);
});

function isEditableTarget(target) {
  const el =
    target?.nodeType === Node.ELEMENT_NODE ? target : target?.parentElement;
  if (!el) return false;
  return Boolean(
    el.closest(
      'input, textarea, select, [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]'
    )
  );
}

function isChatUiTarget(target) {
  const el =
    target?.nodeType === Node.ELEMENT_NODE ? target : target?.parentElement;
  if (!el) return false;
  if (chatLauncher && chatLauncher.contains(el)) return true;
  if (chatPanel && chatPanel.contains(el)) return true;
  return false;
}

function isQuickChatShortcut(event) {
  return (
    event.metaKey &&
    !event.shiftKey &&
    !event.altKey &&
    !event.ctrlKey &&
    event.code === CHAT_SHORTCUT_CODE
  );
}

function handleQuickChatShortcut(event) {
  if (!isQuickChatShortcut(event)) return;
  if (isEditableTarget(event.target) && !isChatUiTarget(event.target)) return;

  event.preventDefault();

  if (chatPanel && chatPanel.style.display !== "none") {
    hideChatPanel();
    return;
  }

  if (chatLauncher && chatLauncher.style.display !== "none") {
    hideChatLauncher();
    return;
  }

  pendingChatSelection = captureChatSelection();

  if (chatHistory.length) {
    hideChatLauncher();
    showChatPanel();
    focusChatInput();
    return;
  }

  showChatLauncher();
}

function limitTextLength(text, maxLength = 320) {
  const normalized = normalizeInlineText(text);
  if (!normalized) return "";
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 3)}...`;
}

function captureChatSelection() {
  const info = getSelectionInfo();
  if (!info?.text) return null;

  const text = limitTextLength(info.text, 160);
  if (!text) return null;

  let context = "";
  try {
    context = limitTextLength(getSelectionContextText(info.text), 320);
  } catch (err) {
    context = "";
  }

  return {
    text,
    context: context && context !== text ? context : ""
  };
}

function ensureTranslateButton() {
  if (translateBtn) return translateBtn;

  translateBtn = document.createElement("button");
  translateBtn.type = "button";
  translateBtn.textContent = getUiLabels().translateBtn;
  translateBtn.style.cssText = `
    position: fixed;
    z-index: 2147483647;
    display: none;
    padding: 6px 10px;
    border: none;
    border-radius: 999px;
    background: #ff6b3d;
    color: #fff;
    font-size: 12px;
    line-height: 1;
    box-shadow: 0 8px 18px rgba(255,107,61,.35);
    cursor: pointer;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  `;

  translateBtn.addEventListener("mousedown", (e) => {
    e.preventDefault();
    e.stopPropagation();
  });

  translateBtn.addEventListener("click", () => {
    const info = getSelectionInfo();
    if (info?.rect) {
      lastRequestRect = snapshotRect(info.rect);
    } else if (lastSelectionRect) {
      lastRequestRect = { ...lastSelectionRect };
    }

    const text = getTranslateInputText();
    const context = getSelectionContextText(text);
    if (!text) return;
    showTranslation(text, getUiLabels().loading, { loading: true });
    sendMessage({
      type: "TRANSLATE_TEXT",
      text,
      context,
      language: currentLanguage,
      fastMode: currentFastMode
    });
  });

  document.documentElement.appendChild(translateBtn);
  return translateBtn;
}

function showTranslateButtonAt(rect) {
  const btn = ensureTranslateButton();
  btn.style.display = "block";

  const btnWidth = btn.offsetWidth || 44;
  const btnHeight = btn.offsetHeight || 24;

  const spaceAbove = rect.top;
  const spaceBelow = window.innerHeight - rect.bottom;
  let top = rect.bottom + BTN_MARGIN;
  let left = rect.right - btnWidth;
  left = clamp(left, BTN_MARGIN, window.innerWidth - btnWidth - BTN_MARGIN);
  top = clamp(top, BTN_MARGIN, window.innerHeight - btnHeight - BTN_MARGIN);

  btn.style.left = `${left}px`;
  btn.style.top = `${top}px`;
}

function hideTranslateButton() {
  if (!translateBtn) return;
  translateBtn.style.display = "none";
}

function getSelectionInfo() {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) return null;
  const text = selection.toString();
  if (!text.trim()) return null;
  if (selection.rangeCount === 0) return null;

  const range = selection.getRangeAt(0);
  const rects = range.getClientRects();
  let overallRect = range.getBoundingClientRect();
  if (!overallRect || (overallRect.width === 0 && overallRect.height === 0)) {
    if (rects && rects.length) overallRect = rects[rects.length - 1];
  }
  if (!overallRect || (overallRect.width === 0 && overallRect.height === 0)) {
    return null;
  }

  let lineRect = null;
  if (rects && rects.length) {
    lineRect = rects[rects.length - 1];
  }
  if (!lineRect || (lineRect.width === 0 && lineRect.height === 0)) {
    lineRect = overallRect;
  }

  const tailRect = getSelectionTailRect(range);

  return { text, rect: overallRect, lineRect, tailRect };
}

function scheduleSelectionUpdate() {
  if (selectionUpdateTimer) clearTimeout(selectionUpdateTimer);
  selectionUpdateTimer = setTimeout(updateSelection, 50);
}

function updateSelection() {
  const info = getSelectionInfo();
  if (!info) {
    lastSelectionText = "";
    lastSelectionRect = null;
    lastSelectionLineRect = null;
    hideTranslateButton();
    return;
  }

  lastSelectionText = info.text;
  lastSelectionRect = snapshotRect(info.rect);
  lastSelectionLineRect = snapshotRect(
    info.tailRect || info.lineRect || info.rect
  );
  showTranslateButtonAt(info.tailRect || info.lineRect || info.rect);
}

document.addEventListener("selectionchange", scheduleSelectionUpdate, true);
document.addEventListener("mouseup", scheduleSelectionUpdate, true);
document.addEventListener("keyup", scheduleSelectionUpdate, true);
document.addEventListener("keydown", handleQuickChatShortcut, true);
window.addEventListener("scroll", scheduleSelectionUpdate, true);
window.addEventListener("resize", scheduleSelectionUpdate, true);
initLanguageSettings();

function ensureBox() {
  if (box) return box;

  box = document.createElement("div");
  box.style.cssText = `
    position: fixed;
    right: 16px;
    bottom: 16px;
    width: 360px;
    min-width: 260px;
    max-width: 80vw;
    max-height: 55vh;
    overflow: auto;
    resize: horizontal;
    z-index: 2147483647;
    background: rgba(46, 46, 46, 0.72);
    color: #f5f5f5;
    border: 1px solid rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(14px) saturate(120%);
    -webkit-backdrop-filter: blur(14px) saturate(120%);
    padding: 12px 12px 10px;
    border-radius: 12px;
    box-shadow: 0 12px 30px rgba(0,0,0,.35);
    font-size: 13px;
    line-height: 1.4;
    white-space: pre-wrap;
    user-select: text;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  `;
  box.setAttribute("role", "dialog");
  document.documentElement.appendChild(box);
  return box;
}

function showTranslation(original, translated, opts = {}) {
  const container = ensureBox();
  const safeOriginal = escapeHtml(normalizeInlineText(original));
  const safeTranslated = formatRichText(translated || "");
  const isLoading = Boolean(opts.loading);
  const showPlay = isSingleWordText(original);
  const showOriginal = isSingleWordText(original);
  const headerTitle = showOriginal ? safeOriginal : "";
  const labels = getUiLabels();
  const playButtonHtml = showPlay
    ? `<button id="pt-play" aria-label="${labels.play}" style="cursor:pointer;border:none;border-radius:999px;padding:4px 10px;background:#ff6b3d;color:#fff;font-size:12px;box-shadow:0 6px 14px rgba(255,107,61,.35);">${labels.play}</button>`
    : "";

  container.innerHTML =
    `<div id="pt-header" style="display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:8px;cursor:move;user-select:none;">` +
    `<div style="font-weight:700;white-space:normal;">${headerTitle}</div>` +
    `<div style="display:flex;gap:6px;align-items:center;">` +
    playButtonHtml +
    `<button id="pt-close" aria-label="${labels.close}" style="cursor:pointer;border:none;border-radius:999px;width:24px;height:24px;line-height:24px;text-align:center;background:rgba(255,107,61,.18);color:#ff6b3d;font-size:16px;">×</button>` +
    `</div>` +
    `</div>` +
    `<div id="pt-translation-title" style="opacity:.9;margin-bottom:6px;font-weight:700;color:#ff6b3d;">${labels.translationTitle}</div>` +
    `<div style="background:rgba(26,26,26,.6);padding:8px;border-radius:10px;border:1px solid rgba(255,255,255,.06);${isLoading ? "opacity:.7;font-style:italic;" : ""}">${safeTranslated || labels.loading}</div>`;

  container.querySelector("#pt-close")?.addEventListener("click", () => {
    container.remove();
    box = null;
  });

  const playBtn = container.querySelector("#pt-play");
  if (playBtn) {
    playBtn.addEventListener("click", () => {
      requestTtsPlayback(original, playBtn);
    });
  }

  const header = container.querySelector("#pt-header");
  if (header) makeDraggable(header, container);

  const anchorRect = lastRequestRect || lastSelectionRect;
  if (anchorRect) {
    positionBoxNearRect(container, anchorRect);
    if (!isLoading) lastRequestRect = null;
  }
}

function ensureChatLauncher() {
  if (chatLauncher) return chatLauncher;

  const labels = getUiLabels();
  const launcher = document.createElement("div");
  chatLauncher = launcher;
  launcher.style.cssText = `
    position: fixed;
    left: 50%;
    bottom: 15vh;
    transform: translateX(-50%);
    display: none;
    width: min(520px, 84vw);
    z-index: 2147483647;
    background: rgba(46, 46, 46, 0.72);
    color: #f5f5f5;
    border: 1px solid rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(14px) saturate(120%);
    -webkit-backdrop-filter: blur(14px) saturate(120%);
    padding: 12px;
    border-radius: 12px;
    box-shadow: 0 12px 30px rgba(0,0,0,.35);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  `;

  const input = document.createElement("input");
  chatLauncherInput = input;
  input.type = "text";
  input.autocomplete = "off";
  input.spellcheck = false;
  input.placeholder = labels.chatLauncherPlaceholder;
  input.style.cssText = `
    width: 100%;
    padding: 10px 12px;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(26, 26, 26, 0.7);
    color: #f5f5f5;
    font-size: 13px;
    box-sizing: border-box;
  `;

  const hint = document.createElement("div");
  chatLauncherHint = hint;
  hint.textContent = labels.chatLauncherHint;
  hint.style.cssText =
    "margin-top:8px;font-size:11px;opacity:.72;line-height:1.4;";

  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      hideChatLauncher();
      return;
    }
    if (event.key !== "Enter") return;
    event.preventDefault();
    submitChatQuestion(input.value, "launcher");
  });

  launcher.appendChild(input);
  launcher.appendChild(hint);
  document.documentElement.appendChild(launcher);

  document.addEventListener(
    "click",
    (event) => {
      if (!chatLauncher || chatLauncher.style.display === "none") return;
      const target = event.target;
      const clickedLauncher = chatLauncher.contains(target);
      const clickedPanel = chatPanel ? chatPanel.contains(target) : false;
      if (!clickedLauncher && !clickedPanel) {
        hideChatLauncher();
      }
    },
    true
  );

  return launcher;
}

function showChatLauncher() {
  if (chatHistory.length) {
    showChatPanel();
    focusChatInput();
    return;
  }

  const launcher = ensureChatLauncher();
  launcher.style.display = "block";
  if (chatLauncherInput) {
    chatLauncherInput.disabled = chatPending;
    requestAnimationFrame(() => {
      chatLauncherInput.focus();
      chatLauncherInput.select();
    });
  }
}

function hideChatLauncher() {
  if (!chatLauncher) return;
  chatLauncher.style.display = "none";
}

function hideChatPanel() {
  if (!chatPanel) return;
  chatPanel.style.display = "none";
}

function resetChatState() {
  chatRequestVersion += 1;
  chatHistory = [];
  pendingChatSelection = null;
  setChatPendingState(false);

  if (chatLauncherInput) chatLauncherInput.value = "";
  if (chatPanelInput) chatPanelInput.value = "";

  hideChatLauncher();
  hideChatPanel();

  if (chatPanel) {
    delete chatPanel.dataset.positioned;
  }

  if (chatPanelMessages) {
    renderChatHistory();
  }
}

function ensureChatPanel() {
  if (chatPanel) return chatPanel;

  const labels = getUiLabels();
  const panel = document.createElement("div");
  chatPanel = panel;
  panel.style.cssText = `
    position: fixed;
    display: none;
    width: 420px;
    min-width: ${CHAT_PANEL_MIN_WIDTH}px;
    max-width: 88vw;
    min-height: ${CHAT_PANEL_MIN_HEIGHT}px;
    max-height: 62vh;
    z-index: 2147483647;
    background: rgba(46, 46, 46, 0.72);
    color: #f5f5f5;
    border: 1px solid rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(14px) saturate(120%);
    -webkit-backdrop-filter: blur(14px) saturate(120%);
    padding: 12px;
    border-radius: 12px;
    box-shadow: 0 12px 30px rgba(0,0,0,.35);
    font-size: 13px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    flex-direction: column;
    gap: 10px;
    overflow: hidden;
    box-sizing: border-box;
  `;
  panel.setAttribute("role", "dialog");

  const header = document.createElement("div");
  header.style.cssText =
    "display:flex;align-items:center;justify-content:space-between;gap:8px;cursor:move;user-select:none;";

  const headerText = document.createElement("div");
  headerText.style.cssText =
    "display:flex;align-items:center;gap:8px;min-width:0;";

  const title = document.createElement("div");
  chatPanelTitle = title;
  title.textContent = labels.chatTitle;
  title.style.cssText =
    "font-weight:700;color:#ff6b3d;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";

  const shortcut = document.createElement("span");
  chatPanelShortcut = shortcut;
  shortcut.textContent = CHAT_SHORTCUT_LABEL;
  shortcut.style.cssText =
    "padding:3px 8px;border-radius:999px;background:rgba(255,107,61,.16);color:#ffb498;font-size:11px;line-height:1;";

  headerText.appendChild(title);
  headerText.appendChild(shortcut);

  const headerActions = document.createElement("div");
  headerActions.style.cssText =
    "display:flex;align-items:center;gap:6px;flex-shrink:0;";

  const minBtn = document.createElement("button");
  chatPanelMinimize = minBtn;
  minBtn.type = "button";
  minBtn.textContent = "−";
  minBtn.setAttribute("aria-label", labels.minimize);
  minBtn.style.cssText =
    "cursor:pointer;border:none;border-radius:999px;width:24px;height:24px;line-height:24px;text-align:center;background:rgba(255,255,255,.08);color:#f5f5f5;font-size:16px;";
  minBtn.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
  });
  minBtn.addEventListener("click", () => {
    hideChatPanel();
  });

  const closeBtn = document.createElement("button");
  chatPanelClose = closeBtn;
  closeBtn.type = "button";
  closeBtn.textContent = "×";
  closeBtn.setAttribute("aria-label", labels.chatReset);
  closeBtn.style.cssText =
    "cursor:pointer;border:none;border-radius:999px;width:24px;height:24px;line-height:24px;text-align:center;background:rgba(255,107,61,.18);color:#ff6b3d;font-size:16px;";
  closeBtn.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
  });
  closeBtn.addEventListener("click", () => {
    resetChatState();
  });

  headerActions.appendChild(minBtn);
  headerActions.appendChild(closeBtn);
  header.appendChild(headerText);
  header.appendChild(headerActions);

  const messages = document.createElement("div");
  chatPanelMessages = messages;
  messages.style.cssText = `
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    gap: 8px;
    min-height: 120px;
    overflow: auto;
    padding-right: 2px;
  `;

  const input = document.createElement("input");
  chatPanelInput = input;
  input.type = "text";
  input.autocomplete = "off";
  input.spellcheck = false;
  input.placeholder = labels.chatInputPlaceholder;
  input.style.cssText = `
    width: 100%;
    padding: 10px 12px;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(26, 26, 26, 0.7);
    color: #f5f5f5;
    font-size: 13px;
    box-sizing: border-box;
  `;
  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      hideChatPanel();
      return;
    }
    if (event.key !== "Enter") return;
    event.preventDefault();
    submitChatQuestion(input.value, "panel");
  });

  const resizeHandle = document.createElement("div");
  resizeHandle.style.cssText = `
    position: absolute;
    right: 2px;
    bottom: 2px;
    width: 16px;
    height: 16px;
    cursor: nwse-resize;
    display: flex;
    align-items: flex-end;
    justify-content: flex-end;
    color: rgba(255,255,255,.42);
    font-size: 11px;
    line-height: 1;
    user-select: none;
  `;
  resizeHandle.textContent = "◢";

  panel.appendChild(header);
  panel.appendChild(messages);
  panel.appendChild(input);
  panel.appendChild(resizeHandle);
  document.documentElement.appendChild(panel);

  makeDraggable(header, panel);
  makeResizable(resizeHandle, panel);
  renderChatHistory();
  return panel;
}

function positionChatPanelDefault(panel) {
  const width = panel.offsetWidth || 420;
  const height = panel.offsetHeight || 340;
  const left = clamp(
    Math.round((window.innerWidth - width) / 2),
    BOX_MARGIN,
    window.innerWidth - width - BOX_MARGIN
  );
  const top = clamp(
    window.innerHeight - height - 32,
    BOX_MARGIN,
    window.innerHeight - height - BOX_MARGIN
  );

  panel.style.left = `${left}px`;
  panel.style.top = `${top}px`;
  panel.style.right = "auto";
  panel.style.bottom = "auto";
}

function showChatPanel() {
  const panel = ensureChatPanel();
  const wasHidden = panel.style.display === "none";
  panel.style.display = "flex";
  if (chatPanelInput) chatPanelInput.disabled = chatPending;
  renderChatHistory();
  if (wasHidden && !panel.dataset.positioned) {
    positionChatPanelDefault(panel);
    panel.dataset.positioned = "true";
  }
  return panel;
}

function focusChatInput() {
  if (!chatPanelInput) return;
  requestAnimationFrame(() => {
    chatPanelInput.focus();
  });
}

function formatPlainText(input) {
  return escapeHtml(input).replace(/\r?\n/g, "<br>");
}

function buildChatMessageNode(role, text, options = {}) {
  const wrapper = document.createElement("div");
  const isUser = role === "user";

  wrapper.style.cssText = `display:flex;justify-content:${
    isUser ? "flex-end" : "flex-start"
  };`;

  const bubble = document.createElement("div");
  bubble.style.cssText = `
    max-width: 88%;
    padding: 8px 10px;
    border-radius: 12px;
    border: 1px solid ${
      isUser ? "rgba(255,107,61,.26)" : "rgba(255,255,255,.06)"
    };
    background: ${
      isUser ? "rgba(255,107,61,.16)" : "rgba(26,26,26,.62)"
    };
    color: #f5f5f5;
    line-height: 1.45;
    white-space: normal;
    word-break: break-word;
    ${options.pending ? "opacity:.78;font-style:italic;" : ""}
  `;
  bubble.innerHTML = isUser ? formatPlainText(text) : formatMarkdown(text);

  wrapper.appendChild(bubble);
  return wrapper;
}

function renderChatHistory() {
  if (!chatPanelMessages) return;

  const labels = getUiLabels();
  chatPanelMessages.innerHTML = "";

  if (!chatHistory.length && !chatPending) {
    const empty = document.createElement("div");
    empty.textContent = labels.chatEmpty;
    empty.style.cssText =
      "padding:10px 12px;border-radius:12px;background:rgba(26,26,26,.5);border:1px solid rgba(255,255,255,.05);opacity:.78;line-height:1.45;";
    chatPanelMessages.appendChild(empty);
  } else {
    chatHistory.forEach((entry) => {
      chatPanelMessages.appendChild(
        buildChatMessageNode(entry.role, entry.text)
      );
    });
  }

  if (chatPending) {
    chatPanelMessages.appendChild(
      buildChatMessageNode("assistant", labels.chatThinking, {
        pending: true
      })
    );
  }

  chatPanelMessages.scrollTop = chatPanelMessages.scrollHeight;
}

function setChatPendingState(value) {
  chatPending = Boolean(value);

  if (chatLauncherInput) chatLauncherInput.disabled = chatPending;
  if (chatPanelInput) chatPanelInput.disabled = chatPending;
}

function formatChatErrorMessage(error) {
  const labels = getUiLabels();
  const message = String(error?.message || error || "").trim() || "Unknown error";
  return `${labels.chatFailed}: ${message}`;
}

async function submitChatQuestion(rawText, source = "panel") {
  const question = String(rawText || "").trim();
  if (!question || chatPending) return;
  const requestVersion = ++chatRequestVersion;

  const historyBefore = chatHistory.map((entry) => ({
    role: entry.role,
    text: entry.text
  }));
  const selectionForRequest = pendingChatSelection
    ? {
        text: pendingChatSelection.text,
        context: pendingChatSelection.context
      }
    : null;

  if (source === "launcher" && chatLauncherInput) {
    chatLauncherInput.value = "";
  }
  if (source === "panel" && chatPanelInput) {
    chatPanelInput.value = "";
  }

  hideChatLauncher();

  chatHistory.push({
    role: "user",
    text: question
  });
  setChatPendingState(true);
  showChatPanel();

  try {
    const result = await sendMessage({
      type: "CHAT_QUERY",
      question,
      history: historyBefore,
      selection: selectionForRequest,
      language: currentLanguage
    });

    if (requestVersion !== chatRequestVersion) return;

    if (!result?.ok) {
      throw new Error(result?.error || "Chat request failed");
    }

    const answer = String(result.answer || "").trim();
    if (!answer) {
      throw new Error("No reply received");
    }

    chatHistory.push({
      role: "assistant",
      text: answer
    });
  } catch (err) {
    if (requestVersion !== chatRequestVersion) return;
    chatHistory.push({
      role: "assistant",
      text: formatChatErrorMessage(err)
    });
  } finally {
    if (requestVersion !== chatRequestVersion) return;
    pendingChatSelection = null;
    setChatPendingState(false);
    if (chatPanelMessages) {
      renderChatHistory();
    }
    if (chatPanel && chatPanel.style.display !== "none") {
      focusChatInput();
    }
  }
}

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

function getTranslateInputText() {
  return lastSelectionText?.trim() || "";
}

function getSelectionContextText(selectedText) {
  const trimmed = String(selectedText || "").trim();
  if (!trimmed) return "";
  if (!isSingleWordText(trimmed)) return trimmed;

  const sentence = getSentenceFromSelection();
  return sentence || trimmed;
}

function getSentenceFromSelection() {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
    return "";
  }

  const range = selection.getRangeAt(0);
  const container = getSentenceContainer(range.commonAncestorContainer);
  if (!container) return selection.toString().trim();

  const containerText = (container.innerText || container.textContent || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!containerText) return selection.toString().trim();

  let offset = 0;
  try {
    const preRange = document.createRange();
    preRange.setStart(container, 0);
    preRange.setEnd(range.startContainer, range.startOffset);
    offset = preRange.toString().length;
  } catch (err) {
    return selection.toString().trim();
  }

  const sentence = extractSentence(containerText, offset);
  return sentence || selection.toString().trim();
}

function getSentenceContainer(node) {
  let el = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
  const tags = new Set([
    "P",
    "DIV",
    "LI",
    "ARTICLE",
    "SECTION",
    "BLOCKQUOTE",
    "TD",
    "TH",
    "MAIN",
    "ASIDE",
    "HEADER",
    "FOOTER"
  ]);

  while (el && el !== document.body) {
    if (el.isContentEditable) return el;
    if (tags.has(el.tagName)) return el;
    el = el.parentElement;
  }

  return document.body;
}

function extractSentence(text, offset) {
  const normalized = String(text || "");
  if (!normalized) return "";

  const punct = /[.!?。？！]/;
  let start = 0;
  for (let i = Math.min(offset - 1, normalized.length - 1); i >= 0; i -= 1) {
    if (punct.test(normalized[i])) {
      start = i + 1;
      break;
    }
  }

  let end = normalized.length;
  for (let i = Math.max(offset, 0); i < normalized.length; i += 1) {
    if (punct.test(normalized[i])) {
      end = i + 1;
      break;
    }
  }

  return normalized.slice(start, end).trim();
}

function sanitizeSingleWord(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return "";

  let core = trimmed;
  try {
    core = trimmed.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
  } catch (err) {
    core = trimmed.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, "");
  }

  return core || trimmed;
}

function isSingleWordText(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return false;
  if (/\s/.test(trimmed)) return false;
  const core = sanitizeSingleWord(trimmed);
  if (!core) return false;
  return !/\s/.test(core);
}

function getSelectionTailRect(range) {
  let lastTextNodes = [];
  try {
    const walker = document.createTreeWalker(
      range.commonAncestorContainer,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          if (!node || !node.nodeValue) return NodeFilter.FILTER_REJECT;
          try {
            if (!range.intersectsNode(node)) return NodeFilter.FILTER_REJECT;
          } catch (err) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    let current = walker.nextNode();
    while (current) {
      lastTextNodes.push(current);
      current = walker.nextNode();
    }
  } catch (err) {
    lastTextNodes = [];
  }

  for (let i = lastTextNodes.length - 1; i >= 0; i -= 1) {
    const node = lastTextNodes[i];
    const value = node.nodeValue || "";
    if (!value) continue;

    const isStart = node === range.startContainer;
    const isEnd = node === range.endContainer;
    const startOffset = isStart ? range.startOffset : 0;
    const endOffset = isEnd ? range.endOffset : value.length;
    if (endOffset <= startOffset) continue;

    let idx = -1;
    for (let j = endOffset - 1; j >= startOffset; j -= 1) {
      if (!/\s/.test(value[j])) {
        idx = j;
        break;
      }
    }
    if (idx === -1) {
      idx = endOffset - 1;
    }
    if (idx < startOffset) continue;

    const charRange = document.createRange();
    charRange.setStart(node, idx);
    charRange.setEnd(node, idx + 1);

    const rect = charRange.getBoundingClientRect();
    if (rect && (rect.width !== 0 || rect.height !== 0)) return rect;

    const rects = charRange.getClientRects();
    if (rects && rects.length) return rects[0];
  }

  return null;
}

function snapshotRect(rect) {
  return {
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    left: rect.left,
    width: rect.width,
    height: rect.height
  };
}

function positionBoxNearRect(target, rect) {
  target.style.right = "auto";
  target.style.bottom = "auto";

  const boxRect = target.getBoundingClientRect();
  const boxWidth = boxRect.width || 360;
  const boxHeight = boxRect.height || 160;
  const margin = BOX_MARGIN;

  const fitsBelow = rect.bottom + margin + boxHeight <= window.innerHeight;
  const fitsRight = rect.right + margin + boxWidth <= window.innerWidth;
  const fitsAbove = rect.top - margin - boxHeight >= margin;
  const fitsLeft = rect.left - margin - boxWidth >= margin;

  let top = rect.bottom + margin;
  let left = rect.left;

  if (fitsBelow) {
    top = rect.bottom + margin;
    left = rect.left;
  } else if (fitsRight) {
    top = rect.top;
    left = rect.right + margin;
  } else if (fitsAbove) {
    top = rect.top - boxHeight - margin;
    left = rect.left;
  } else if (fitsLeft) {
    top = rect.top;
    left = rect.left - boxWidth - margin;
  }

  left = clamp(left, margin, window.innerWidth - boxWidth - margin);
  top = clamp(top, margin, window.innerHeight - boxHeight - margin);

  target.style.left = `${left}px`;
  target.style.top = `${top}px`;
}

async function requestTtsPlayback(text, button) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return;
  if (ttsInFlight) return;

  const labels = getUiLabels();
  const cacheKey = `${currentLanguage}::${trimmed}`;
  if (ttsCacheKey === cacheKey && ttsCacheUrl) {
    playAudioUrl(ttsCacheUrl);
    return;
  }

  const originalLabel =
    button?.dataset?.label || button?.textContent || labels.play;
  ttsInFlight = true;
  if (button) {
    button.dataset.label = labels.play;
    button.textContent = labels.ttsGenerating;
    button.disabled = true;
  }

  try {
    const result = await sendMessage({
      type: "SPEAK_TEXT",
      text: trimmed,
      language: currentLanguage
    });

    if (!result?.ok) {
      throw new Error(result?.error || "TTS failed");
    }

    if (result.audio) {
      const mimeType = result.mime || "audio/wav";
      const audioBlob = new Blob([result.audio], { type: mimeType });
      const audioUrl = URL.createObjectURL(audioBlob);

      if (ttsCacheUrl) URL.revokeObjectURL(ttsCacheUrl);
      ttsCacheKey = cacheKey;
      ttsCacheUrl = audioUrl;

      playAudioUrl(audioUrl);
    }
  } catch (err) {
    console.warn("TTS failed:", err);
    if (button) button.textContent = labels.ttsFailed;
    setTimeout(() => {
      if (button) button.textContent = originalLabel;
    }, 1200);
  } finally {
    ttsInFlight = false;
    if (button) {
      button.disabled = false;
      if (button.textContent !== labels.ttsFailed) {
        button.textContent = originalLabel;
      }
    }
  }
}

function playAudioUrl(url) {
  if (!ttsAudio) {
    ttsAudio = new Audio();
  } else {
    try {
      ttsAudio.pause();
      ttsAudio.currentTime = 0;
    } catch (err) {
      // ignore
    }
  }
  ttsAudio.src = url;
  ttsAudio.play().catch(() => {});
}

function normalizeLanguage(lang) {
  return LANGUAGE_VALUES.has(lang) ? lang : DEFAULT_LANGUAGE;
}

function normalizeProvider(provider) {
  return API_PROVIDER_VALUES.has(provider)
    ? provider
    : DEFAULT_API_PROVIDER;
}

function trimString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function trimBaseUrl(value) {
  return trimString(value).replace(/\/+$/g, "");
}

function createDefaultApiProfiles() {
  return Object.fromEntries(
    Object.entries(API_PROVIDER_DEFAULTS).map(([provider, defaults]) => [
      provider,
      { ...defaults }
    ])
  );
}

function createDefaultApiSettings() {
  return {
    provider: DEFAULT_API_PROVIDER,
    profiles: createDefaultApiProfiles()
  };
}

function normalizeApiProfile(provider, profile) {
  const normalizedProvider = normalizeProvider(provider);
  const defaults =
    API_PROVIDER_DEFAULTS[normalizedProvider] ||
    API_PROVIDER_DEFAULTS[DEFAULT_API_PROVIDER];
  const source = profile && typeof profile === "object" ? profile : {};

  return {
    baseUrl: trimBaseUrl(source.baseUrl) || defaults.baseUrl,
    model: trimString(source.model) || defaults.model,
    apiKey: trimString(source.apiKey)
  };
}

function normalizeApiProfiles(profiles) {
  const source = profiles && typeof profiles === "object" ? profiles : {};
  return Object.fromEntries(
    Array.from(API_PROVIDER_VALUES).map((provider) => [
      provider,
      normalizeApiProfile(provider, source[provider])
    ])
  );
}

function normalizeApiSettings(settings) {
  const source = settings && typeof settings === "object" ? settings : {};
  const provider = normalizeProvider(source.provider);
  const profiles = normalizeApiProfiles(source.profiles);
  return { provider, profiles };
}

function getActiveApiProfile(settings = currentApiSettings) {
  const normalized = normalizeApiSettings(settings);
  return (
    normalized.profiles[normalized.provider] ||
    normalizeApiProfile(normalized.provider)
  );
}

function updateActiveApiProfile(patch) {
  const provider = normalizeProvider(currentApiSettings.provider);
  const profiles = { ...currentApiSettings.profiles };
  profiles[provider] = normalizeApiProfile(provider, {
    ...profiles[provider],
    ...patch
  });
  currentApiSettings = {
    provider,
    profiles
  };
}

function syncApiInputsFromState() {
  const settings = normalizeApiSettings(currentApiSettings);
  currentApiSettings = settings;
  const profile = getActiveApiProfile(settings);

  if (providerSelect) providerSelect.value = settings.provider;
  if (baseUrlInput) baseUrlInput.value = profile.baseUrl;
  if (modelInput) modelInput.value = profile.model;
  if (apiKeyInput) apiKeyInput.value = profile.apiKey;
}

function setApiSectionExpanded(expanded) {
  apiSectionExpanded = Boolean(expanded);

  if (apiSectionBody) {
    apiSectionBody.style.display = apiSectionExpanded ? "block" : "none";
  }

  if (apiSectionToggle) {
    apiSectionToggle.setAttribute(
      "aria-expanded",
      apiSectionExpanded ? "true" : "false"
    );
  }

  if (apiSectionChevron) {
    apiSectionChevron.textContent = apiSectionExpanded ? "▾" : "▸";
  }
}

function ensureSettingsWidget() {
  if (settingsWidget) return settingsWidget;

  settingsWidget = document.createElement("div");
  settingsWidget.style.cssText = `
    position: fixed;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
    z-index: 2147483647;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  `;

  const toggle = document.createElement("button");
  settingsToggle = toggle;
  toggle.type = "button";
  toggle.textContent = "語言";
  toggle.style.cssText = `
    display: block;
    width: 44px;
    padding: 10px 6px;
    border: none;
    border-radius: 999px;
    background: rgba(46, 46, 46, 0.75);
    color: #f5f5f5;
    border: 1px solid rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(12px) saturate(120%);
    -webkit-backdrop-filter: blur(12px) saturate(120%);
    font-size: 12px;
    line-height: 1;
    box-shadow: 0 8px 20px rgba(0,0,0,.3);
    cursor: pointer;
  `;

  settingsPanel = document.createElement("div");
  settingsPanel.style.cssText = `
    display: none;
    margin-top: 8px;
    background: rgba(46, 46, 46, 0.72);
    color: #f5f5f5;
    border: 1px solid rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(14px) saturate(120%);
    -webkit-backdrop-filter: blur(14px) saturate(120%);
    padding: 10px 12px;
    border-radius: 12px;
    box-shadow: 0 10px 30px rgba(0,0,0,.35);
    width: 280px;
  `;

  const title = document.createElement("div");
  settingsTitle = title;
  title.textContent = "翻譯語言";
  title.style.cssText =
    "font-weight: 700; font-size: 12px; margin-bottom: 8px; color: #ff6b3d;";

  settingsSelect = document.createElement("select");
  settingsSelect.style.cssText = `
    width: 100%;
    padding: 6px 8px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(26, 26, 26, 0.7);
    color: #f5f5f5;
    font-size: 12px;
    box-sizing: border-box;
  `;

  LANGUAGE_OPTIONS.forEach((opt) => {
    const option = document.createElement("option");
    option.value = opt.value;
    option.textContent = opt.label;
    settingsSelect.appendChild(option);
  });

  const fastRow = document.createElement("label");
  fastRow.style.cssText =
    "display:flex;align-items:center;gap:8px;margin-top:10px;font-size:12px;cursor:pointer;";

  fastModeToggle = document.createElement("input");
  fastModeToggle.type = "checkbox";
  fastModeToggle.style.cssText = "cursor:pointer; accent-color:#ff6b3d;";

  const fastLabel = document.createElement("span");
  fastModeLabel = fastLabel;
  fastLabel.textContent = "快速翻譯";

  fastRow.appendChild(fastModeToggle);
  fastRow.appendChild(fastLabel);

  const divider = document.createElement("div");
  divider.style.cssText =
    "height:1px;margin:12px 0;background:rgba(255,255,255,.08);";

  const apiHeader = document.createElement("button");
  apiSectionToggle = apiHeader;
  apiHeader.type = "button";
  apiHeader.style.cssText = `
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 0;
    border: none;
    background: transparent;
    cursor: pointer;
    color: #f5f5f5;
  `;

  const apiHeaderText = document.createElement("span");
  apiTitle = apiHeaderText;
  apiHeaderText.textContent = "模型 API";
  apiHeaderText.style.cssText =
    "font-weight:700;font-size:12px;color:#ff6b3d;text-align:left;";

  const apiHeaderChevron = document.createElement("span");
  apiSectionChevron = apiHeaderChevron;
  apiHeaderChevron.textContent = "▸";
  apiHeaderChevron.style.cssText =
    "font-size:12px;line-height:1;color:rgba(255,255,255,.8);";

  apiHeader.appendChild(apiHeaderText);
  apiHeader.appendChild(apiHeaderChevron);

  const apiFields = document.createElement("div");
  apiSectionBody = apiFields;
  apiFields.style.cssText = "display:none;padding-top:8px;";

  const providerText = document.createElement("div");
  providerLabel = providerText;
  providerText.textContent = "服務";
  providerText.style.cssText =
    "font-size:11px;opacity:.82;margin-bottom:4px;";

  providerSelect = document.createElement("select");
  providerSelect.style.cssText = `
    width: 100%;
    padding: 6px 8px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(26, 26, 26, 0.7);
    color: #f5f5f5;
    font-size: 12px;
    box-sizing: border-box;
  `;

  Array.from(API_PROVIDER_VALUES).forEach((provider) => {
    const option = document.createElement("option");
    option.value = provider;
    option.textContent = provider;
    providerSelect.appendChild(option);
  });

  const baseUrlText = document.createElement("div");
  baseUrlLabel = baseUrlText;
  baseUrlText.textContent = "API 網址";
  baseUrlText.style.cssText =
    "font-size:11px;opacity:.82;margin:10px 0 4px;";

  baseUrlInput = document.createElement("input");
  baseUrlInput.type = "url";
  baseUrlInput.spellcheck = false;
  baseUrlInput.autocomplete = "off";
  baseUrlInput.style.cssText = `
    width: 100%;
    padding: 6px 8px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(26, 26, 26, 0.7);
    color: #f5f5f5;
    font-size: 12px;
    box-sizing: border-box;
  `;

  const modelText = document.createElement("div");
  modelLabel = modelText;
  modelText.textContent = "模型";
  modelText.style.cssText =
    "font-size:11px;opacity:.82;margin:10px 0 4px;";

  modelInput = document.createElement("input");
  modelInput.type = "text";
  modelInput.spellcheck = false;
  modelInput.autocomplete = "off";
  modelInput.style.cssText = `
    width: 100%;
    padding: 6px 8px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(26, 26, 26, 0.7);
    color: #f5f5f5;
    font-size: 12px;
    box-sizing: border-box;
  `;

  const apiKeyText = document.createElement("div");
  apiKeyLabel = apiKeyText;
  apiKeyText.textContent = "API Key";
  apiKeyText.style.cssText =
    "font-size:11px;opacity:.82;margin:10px 0 4px;";

  apiKeyInput = document.createElement("input");
  apiKeyInput.type = "password";
  apiKeyInput.spellcheck = false;
  apiKeyInput.autocomplete = "off";
  apiKeyInput.style.cssText = `
    width: 100%;
    padding: 6px 8px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(26, 26, 26, 0.7);
    color: #f5f5f5;
    font-size: 12px;
    box-sizing: border-box;
  `;

  const apiHintText = document.createElement("div");
  apiHint = apiHintText;
  apiHintText.style.cssText =
    "margin-top:8px;font-size:11px;line-height:1.4;opacity:.74;";

  settingsPanel.appendChild(title);
  settingsPanel.appendChild(settingsSelect);
  settingsPanel.appendChild(fastRow);
  settingsPanel.appendChild(divider);
  settingsPanel.appendChild(apiHeader);
  apiFields.appendChild(providerText);
  apiFields.appendChild(providerSelect);
  apiFields.appendChild(baseUrlText);
  apiFields.appendChild(baseUrlInput);
  apiFields.appendChild(modelText);
  apiFields.appendChild(modelInput);
  apiFields.appendChild(apiKeyText);
  apiFields.appendChild(apiKeyInput);
  apiFields.appendChild(apiHintText);
  settingsPanel.appendChild(apiFields);
  settingsWidget.appendChild(toggle);
  settingsWidget.appendChild(settingsPanel);
  document.documentElement.appendChild(settingsWidget);

  toggle.addEventListener("click", (e) => {
    e.preventDefault();
    if (settingsDragMoved) {
      settingsDragMoved = false;
      return;
    }
    const isOpening = settingsPanel.style.display === "none";
    settingsPanel.style.display = isOpening ? "block" : "none";
    if (isOpening) {
      setApiSectionExpanded(false);
    }
  });

  settingsSelect.addEventListener("change", () => {
    const nextLang = normalizeLanguage(settingsSelect.value);
    currentLanguage = nextLang;
    updateSettingsPanelText();
    saveLanguageSetting(nextLang);
  });

  fastModeToggle.addEventListener("change", () => {
    const nextValue = Boolean(fastModeToggle.checked);
    currentFastMode = nextValue;
    saveFastModeSetting(nextValue);
  });

  apiSectionToggle.addEventListener("click", (e) => {
    e.preventDefault();
    setApiSectionExpanded(!apiSectionExpanded);
  });

  providerSelect.addEventListener("change", () => {
    currentApiSettings = normalizeApiSettings({
      ...currentApiSettings,
      provider: providerSelect.value
    });
    syncApiInputsFromState();
    updateSettingsPanelText();
    saveApiSettings();
  });

  baseUrlInput.addEventListener("change", () => {
    updateActiveApiProfile({ baseUrl: baseUrlInput.value });
    syncApiInputsFromState();
    saveApiSettings();
  });

  modelInput.addEventListener("change", () => {
    updateActiveApiProfile({ model: modelInput.value });
    syncApiInputsFromState();
    saveApiSettings();
  });

  apiKeyInput.addEventListener("change", () => {
    updateActiveApiProfile({ apiKey: apiKeyInput.value });
    syncApiInputsFromState();
    saveApiSettings();
  });

  document.addEventListener(
    "click",
    (e) => {
      if (!settingsWidget.contains(e.target)) {
        settingsPanel.style.display = "none";
        setApiSectionExpanded(false);
      }
    },
    true
  );

  enableSettingsDrag(toggle, settingsWidget);
  syncApiInputsFromState();
  setApiSectionExpanded(false);
  updateSettingsPanelText();
  return settingsWidget;
}

function notifyLanguage(lang) {
  try {
    sendMessage({
      type: "SET_LANGUAGE",
      language: lang
    });
  } catch (err) {
    // ignore
  }
}

function notifyFastMode(enabled) {
  try {
    sendMessage({
      type: "SET_FAST_MODE",
      enabled: Boolean(enabled)
    });
  } catch (err) {
    // ignore
  }
}

function notifyApiSettings(settings) {
  try {
    sendMessage({
      type: "SET_API_SETTINGS",
      settings
    });
  } catch (err) {
    // ignore
  }
}

async function saveLanguageSetting(lang) {
  try {
    await storageSet({ [SETTINGS_KEY]: lang });
  } catch (err) {
    // ignore
  }
  notifyLanguage(lang);
}

async function saveFastModeSetting(enabled) {
  try {
    await storageSet({ [SETTINGS_FAST_KEY]: Boolean(enabled) });
  } catch (err) {
    // ignore
  }
  notifyFastMode(Boolean(enabled));
}

async function saveApiSettings() {
  const nextSettings = normalizeApiSettings(currentApiSettings);
  currentApiSettings = nextSettings;
  try {
    await storageSet({ [API_SETTINGS_KEY]: nextSettings });
  } catch (err) {
    // ignore
  }
  notifyApiSettings(nextSettings);
}

async function initLanguageSettings() {
  ensureSettingsWidget();
  try {
    const stored = await storageGet([
      SETTINGS_KEY,
      SETTINGS_FAST_KEY,
      API_SETTINGS_KEY
    ]);
    const nextLang = normalizeLanguage(stored?.[SETTINGS_KEY]);
    currentLanguage = nextLang;
    currentFastMode =
      typeof stored?.[SETTINGS_FAST_KEY] === "boolean"
        ? stored[SETTINGS_FAST_KEY]
        : DEFAULT_FAST_MODE;
    currentApiSettings = normalizeApiSettings(stored?.[API_SETTINGS_KEY]);
  } catch (err) {
    currentLanguage = DEFAULT_LANGUAGE;
    currentFastMode = DEFAULT_FAST_MODE;
    currentApiSettings = createDefaultApiSettings();
  }

  if (settingsSelect) settingsSelect.value = currentLanguage;
  if (fastModeToggle) fastModeToggle.checked = currentFastMode;
  syncApiInputsFromState();
  updateSettingsPanelText();
  notifyLanguage(currentLanguage);
  notifyFastMode(currentFastMode);
  notifyApiSettings(currentApiSettings);
}

function updateSettingsPanelText() {
  const lang = normalizeLanguage(currentLanguage);
  const labels = UI_LABELS[lang] || UI_LABELS[DEFAULT_LANGUAGE];
  const optionLabels =
    LANGUAGE_OPTION_LABELS[lang] || LANGUAGE_OPTION_LABELS[DEFAULT_LANGUAGE];
  const providerLabels =
    API_PROVIDER_OPTION_LABELS[lang] ||
    API_PROVIDER_OPTION_LABELS[DEFAULT_LANGUAGE];

  if (settingsToggle) settingsToggle.textContent = labels.toggle;
  if (settingsTitle) settingsTitle.textContent = labels.title;
  if (fastModeLabel) fastModeLabel.textContent = labels.fast;
  if (apiTitle) apiTitle.textContent = labels.providerTitle;
  if (providerLabel) providerLabel.textContent = labels.provider;
  if (baseUrlLabel) baseUrlLabel.textContent = labels.baseUrl;
  if (modelLabel) modelLabel.textContent = labels.model;
  if (apiKeyLabel) apiKeyLabel.textContent = labels.apiKey;
  if (apiHint) apiHint.textContent = labels.apiHint;
  if (chatLauncherInput) {
    chatLauncherInput.placeholder = labels.chatLauncherPlaceholder;
  }
  if (chatLauncherHint) chatLauncherHint.textContent = labels.chatLauncherHint;
  if (chatPanelTitle) chatPanelTitle.textContent = labels.chatTitle;
  if (chatPanelShortcut) chatPanelShortcut.textContent = CHAT_SHORTCUT_LABEL;
  if (chatPanelInput) chatPanelInput.placeholder = labels.chatInputPlaceholder;
  if (chatPanelMinimize) {
    chatPanelMinimize.setAttribute("aria-label", labels.minimize);
  }
  if (chatPanelClose) {
    chatPanelClose.setAttribute("aria-label", labels.chatReset);
  }
  if (translateBtn) translateBtn.textContent = labels.translateBtn;

  if (settingsSelect && optionLabels) {
    Array.from(settingsSelect.options).forEach((opt) => {
      const nextLabel = optionLabels[opt.value];
      if (nextLabel) opt.textContent = nextLabel;
    });
  }

  if (providerSelect && providerLabels) {
    Array.from(providerSelect.options).forEach((opt) => {
      const nextLabel = providerLabels[opt.value];
      if (nextLabel) opt.textContent = nextLabel;
    });
  }

  if (chatPanelMessages && (chatPending || !chatHistory.length)) {
    renderChatHistory();
  }

  if (box) {
    const titleEl = box.querySelector("#pt-translation-title");
    if (titleEl) titleEl.textContent = labels.translationTitle;
    const closeBtn = box.querySelector("#pt-close");
    if (closeBtn) closeBtn.setAttribute("aria-label", labels.close);
    const playBtn = box.querySelector("#pt-play");
    if (playBtn) {
      playBtn.dataset.label = labels.play;
      if (!playBtn.disabled) playBtn.textContent = labels.play;
    }
  }
}

function getUiLabels() {
  const lang = normalizeLanguage(currentLanguage);
  return UI_LABELS[lang] || UI_LABELS[DEFAULT_LANGUAGE];
}

function enableSettingsDrag(handle, target) {
  if (!handle || !target) return;

  handle.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;

    const rect = target.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    let moved = false;

    const onMove = (ev) => {
      if (!moved) {
        const delta = Math.abs(ev.clientY - e.clientY);
        if (delta < 3) return;
        moved = true;
      }

      const nextTop = clamp(
        ev.clientY - offsetY,
        BOX_MARGIN,
        window.innerHeight - rect.height - BOX_MARGIN
      );
      target.style.top = `${nextTop}px`;
      target.style.transform = "translateY(0)";
    };

    const onUp = () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
      settingsDragMoved = moved;
    };

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
  });
}
