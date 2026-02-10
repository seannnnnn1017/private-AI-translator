let box;
let translateBtn;
let lastSelectionText = "";
let selectionUpdateTimer;

const BTN_MARGIN = 8;
const BOX_MARGIN = 8;
const SETTINGS_KEY = "ptLanguage";
const SETTINGS_FAST_KEY = "ptFastTranslate";
const DEFAULT_LANGUAGE = "zh";
const DEFAULT_FAST_MODE = false;
const LANGUAGE_OPTIONS = [
  { value: "zh", label: "中文" },
  { value: "ja", label: "日文" },
  { value: "en", label: "英文" }
];
const LANGUAGE_VALUES = new Set(LANGUAGE_OPTIONS.map((opt) => opt.value));

let currentLanguage = DEFAULT_LANGUAGE;
let currentFastMode = DEFAULT_FAST_MODE;
let settingsWidget;
let settingsPanel;
let settingsSelect;
let fastModeToggle;
let ttsAudio;
let ttsCacheKey = "";
let ttsCacheUrl = "";
let ttsInFlight = false;
let lastSelectionRect = null;
let lastRequestRect = null;
let lastSelectionLineRect = null;

browser.runtime.onMessage.addListener((msg) => {
  if (msg?.type !== "SHOW_TRANSLATION") return;
  const { original, translated } = msg;
  showTranslation(original, translated);
});

function ensureTranslateButton() {
  if (translateBtn) return translateBtn;

  translateBtn = document.createElement("button");
  translateBtn.type = "button";
  translateBtn.textContent = "翻譯";
  translateBtn.style.cssText = `
    position: fixed;
    z-index: 2147483647;
    display: none;
    padding: 6px 10px;
    border: none;
    border-radius: 999px;
    background: #111;
    color: #fff;
    font-size: 12px;
    line-height: 1;
    box-shadow: 0 6px 18px rgba(0,0,0,.25);
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

    const text = lastSelectionText?.trim();
    if (!text) return;
    showTranslation(text, "翻譯中...", { loading: true });
    browser.runtime.sendMessage({
      type: "TRANSLATE_TEXT",
      text,
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
    max-height: 55vh;
    overflow: auto;
    z-index: 2147483647;
    background: #111;
    color: #fff;
    padding: 12px 12px 10px;
    border-radius: 12px;
    box-shadow: 0 10px 30px rgba(0,0,0,.35);
    font-size: 13px;
    line-height: 1.4;
    white-space: pre-wrap;
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

  container.innerHTML =
    `<div id="pt-header" style="display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:8px;cursor:move;user-select:none;">` +
    `<div style="font-weight:700;white-space:normal;">${safeOriginal}</div>` +
    `<div style="display:flex;gap:6px;align-items:center;">` +
    `<button id="pt-play" aria-label="播放" style="cursor:pointer;border:none;border-radius:999px;padding:4px 10px;background:#1d1d1d;color:#fff;font-size:12px;">播放</button>` +
    `<button id="pt-close" aria-label="關閉" style="cursor:pointer;border:none;border-radius:999px;width:24px;height:24px;line-height:24px;text-align:center;background:#1d1d1d;color:#fff;font-size:16px;">×</button>` +
    `</div>` +
    `</div>` +
    `<div style="opacity:.85;margin-bottom:6px;font-weight:600;">翻譯</div>` +
    `<div style="background:#1d1d1d;padding:8px;border-radius:10px;${isLoading ? "opacity:.7;font-style:italic;" : ""}">${safeTranslated || "翻譯中..."}</div>`;

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

function normalizeInlineText(input) {
  return String(input || "")
    .replace(/\s+/g, " ")
    .trim();
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

  const cacheKey = `${currentLanguage}::${trimmed}`;
  if (ttsCacheKey === cacheKey && ttsCacheUrl) {
    playAudioUrl(ttsCacheUrl);
    return;
  }

  const originalLabel = button?.textContent || "播放";
  ttsInFlight = true;
  if (button) {
    button.textContent = "生成中";
    button.disabled = true;
  }

  try {
    const result = await browser.runtime.sendMessage({
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
    if (button) button.textContent = "失敗";
    setTimeout(() => {
      if (button) button.textContent = originalLabel;
    }, 1200);
  } finally {
    ttsInFlight = false;
    if (button) {
      button.disabled = false;
      if (button.textContent !== "失敗") button.textContent = originalLabel;
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
  toggle.type = "button";
  toggle.textContent = "語言";
  toggle.style.cssText = `
    display: block;
    width: 44px;
    padding: 10px 6px;
    border: none;
    border-radius: 999px;
    background: #111;
    color: #fff;
    font-size: 12px;
    line-height: 1;
    box-shadow: 0 8px 20px rgba(0,0,0,.3);
    cursor: pointer;
  `;

  settingsPanel = document.createElement("div");
  settingsPanel.style.cssText = `
    display: none;
    margin-top: 8px;
    background: #111;
    color: #fff;
    padding: 10px 12px;
    border-radius: 12px;
    box-shadow: 0 10px 30px rgba(0,0,0,.35);
    width: 160px;
  `;

  const title = document.createElement("div");
  title.textContent = "翻譯語言";
  title.style.cssText = "font-weight: 700; font-size: 12px; margin-bottom: 8px;";

  settingsSelect = document.createElement("select");
  settingsSelect.style.cssText = `
    width: 100%;
    padding: 6px 8px;
    border-radius: 8px;
    border: 1px solid #2a2a2a;
    background: #1d1d1d;
    color: #fff;
    font-size: 12px;
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
  fastModeToggle.style.cssText = "cursor:pointer;";

  const fastLabel = document.createElement("span");
  fastLabel.textContent = "快速翻譯";

  fastRow.appendChild(fastModeToggle);
  fastRow.appendChild(fastLabel);

  settingsPanel.appendChild(title);
  settingsPanel.appendChild(settingsSelect);
  settingsPanel.appendChild(fastRow);
  settingsWidget.appendChild(toggle);
  settingsWidget.appendChild(settingsPanel);
  document.documentElement.appendChild(settingsWidget);

  toggle.addEventListener("click", (e) => {
    e.preventDefault();
    settingsPanel.style.display =
      settingsPanel.style.display === "none" ? "block" : "none";
  });

  settingsSelect.addEventListener("change", () => {
    const nextLang = normalizeLanguage(settingsSelect.value);
    currentLanguage = nextLang;
    saveLanguageSetting(nextLang);
  });

  fastModeToggle.addEventListener("change", () => {
    const nextValue = Boolean(fastModeToggle.checked);
    currentFastMode = nextValue;
    saveFastModeSetting(nextValue);
  });

  document.addEventListener(
    "click",
    (e) => {
      if (!settingsWidget.contains(e.target)) {
        settingsPanel.style.display = "none";
      }
    },
    true
  );

  return settingsWidget;
}

function notifyLanguage(lang) {
  try {
    browser.runtime.sendMessage({
      type: "SET_LANGUAGE",
      language: lang
    });
  } catch (err) {
    // ignore
  }
}

function notifyFastMode(enabled) {
  try {
    browser.runtime.sendMessage({
      type: "SET_FAST_MODE",
      enabled: Boolean(enabled)
    });
  } catch (err) {
    // ignore
  }
}

async function saveLanguageSetting(lang) {
  try {
    await browser.storage.local.set({ [SETTINGS_KEY]: lang });
  } catch (err) {
    // ignore
  }
  notifyLanguage(lang);
}

async function saveFastModeSetting(enabled) {
  try {
    await browser.storage.local.set({ [SETTINGS_FAST_KEY]: Boolean(enabled) });
  } catch (err) {
    // ignore
  }
  notifyFastMode(Boolean(enabled));
}

async function initLanguageSettings() {
  ensureSettingsWidget();
  try {
    const stored = await browser.storage.local.get([
      SETTINGS_KEY,
      SETTINGS_FAST_KEY
    ]);
    const nextLang = normalizeLanguage(stored?.[SETTINGS_KEY]);
    currentLanguage = nextLang;
    currentFastMode =
      typeof stored?.[SETTINGS_FAST_KEY] === "boolean"
        ? stored[SETTINGS_FAST_KEY]
        : DEFAULT_FAST_MODE;
  } catch (err) {
    currentLanguage = DEFAULT_LANGUAGE;
    currentFastMode = DEFAULT_FAST_MODE;
  }

  if (settingsSelect) settingsSelect.value = currentLanguage;
  if (fastModeToggle) fastModeToggle.checked = currentFastMode;
  notifyLanguage(currentLanguage);
  notifyFastMode(currentFastMode);
}
