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
    fireAndForgetMessage({
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
    `<button id="pt-close" aria-label="${labels.close}" style="cursor:pointer;border:none;border-radius:999px;width:24px;height:24px;line-height:24px;text-align:center;background:rgba(255,107,61,.18);color:#ff6b3d;font-size:16px;">x</button>` +
    `</div>` +
    `</div>` +
    `<div id="pt-translation-title" style="opacity:.9;margin-bottom:6px;font-weight:700;color:#ff6b3d;">${labels.translationTitle}</div>` +
    `<div style="background:rgba(26,26,26,.6);padding:8px;border-radius:10px;border:1px solid rgba(255,255,255,.06);${isLoading ? "opacity:.7;font-style:italic;" : ""}">${safeTranslated || labels.loading}</div>`;

  container.style.animation = "pt-fade-in 0.15s ease-out";

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

  const punct = /[.!?。！？]/;
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

// ─── Page translation ────────────────────────────────────────────────────────

const PAGE_TRANSLATE_ATTR = "data-pt-translated";
const PAGE_TRANSLATE_SIBLING_CLASS = "pt-page-translation";
const PT_TRANSLATE_SELECTOR = "p, h1, h2, h3, h4, h5, h6, li, td, th, blockquote, figcaption, dt, dd";
const PT_MIN_TEXT_LENGTH = 10;
const PT_MAX_TEXT_LENGTH = 3000;
// Elements that cannot have block-level siblings — insert translation as child instead
const PT_INNER_INSERT_TAGS = new Set(["LI", "TD", "TH", "DT", "DD"]);

const pageTranslateCache = new Map();

let pageTranslateProgressEl = null;

function getPageTranslateElements() {
  return Array.from(document.querySelectorAll(PT_TRANSLATE_SELECTOR)).filter((el) => {
    if (el.closest('[id^="pt-"]')) return false;
    if (el.classList.contains(PAGE_TRANSLATE_SIBLING_CLASS)) return false;
    if (el.hasAttribute(PAGE_TRANSLATE_ATTR)) return false;
    const text = (el.innerText || el.textContent || "").trim();
    return text.length >= PT_MIN_TEXT_LENGTH && text.length <= PT_MAX_TEXT_LENGTH;
  });
}

function makeTranslationDiv(translatedText) {
  const div = document.createElement("div");
  div.className = PAGE_TRANSLATE_SIBLING_CLASS;
  div.style.cssText = `
    margin: 2px 0 10px;
    padding: 4px 10px;
    border-left: 3px solid rgba(255,107,61,0.55);
    background: rgba(255,107,61,0.06);
    border-radius: 0 4px 4px 0;
    font-size: 0.92em;
    line-height: 1.6;
    font-family: inherit;
    color: inherit;
    opacity: 0.88;
  `;
  div.innerHTML = formatRichText(translatedText);
  return div;
}

function insertPageTranslation(el, translatedText) {
  el.setAttribute(PAGE_TRANSLATE_ATTR, "true");

  if (PT_INNER_INSERT_TAGS.has(el.tagName)) {
    // Insert inside the element to avoid breaking parent layout (ul/ol, tr, dl)
    const existing = el.querySelector(`:scope > .${PAGE_TRANSLATE_SIBLING_CLASS}`);
    if (existing) {
      existing.innerHTML = formatRichText(translatedText);
      return;
    }
    el.appendChild(makeTranslationDiv(translatedText));
  } else {
    // Insert as next sibling
    const existing = el.nextElementSibling;
    if (existing?.classList.contains(PAGE_TRANSLATE_SIBLING_CLASS)) {
      existing.innerHTML = formatRichText(translatedText);
      return;
    }
    el.insertAdjacentElement("afterend", makeTranslationDiv(translatedText));
  }
}

function removePageTranslations() {
  document.querySelectorAll(`.${PAGE_TRANSLATE_SIBLING_CLASS}`).forEach((el) => el.remove());
  document.querySelectorAll(`[${PAGE_TRANSLATE_ATTR}]`).forEach((el) => {
    el.removeAttribute(PAGE_TRANSLATE_ATTR);
  });
}

function showPageTranslateProgress(current, total) {
  if (!pageTranslateProgressEl) {
    pageTranslateProgressEl = document.createElement("div");
    pageTranslateProgressEl.style.cssText = `
      position: fixed;
      top: 16px;
      right: 16px;
      z-index: 2147483647;
      background: rgba(36,36,36,0.92);
      color: #f5f5f5;
      border: 1px solid rgba(255,107,61,0.35);
      border-radius: 999px;
      padding: 6px 8px 6px 14px;
      font-size: 12px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      box-shadow: 0 4px 14px rgba(0,0,0,.32);
      display: flex;
      align-items: center;
      gap: 8px;
    `;
    const stopBtn = document.createElement("button");
    stopBtn.style.cssText = `
      border: none;
      background: rgba(255,107,61,.22);
      color: #ff6b3d;
      border-radius: 999px;
      padding: 2px 10px;
      cursor: pointer;
      font-size: 11px;
      line-height: 1.6;
    `;
    stopBtn.addEventListener("click", cancelPageTranslation);
    pageTranslateProgressEl._stopBtn = stopBtn;
    pageTranslateProgressEl.appendChild(stopBtn);
    document.documentElement.appendChild(pageTranslateProgressEl);
  }

  const labels = getUiLabels();
  const stopBtn = pageTranslateProgressEl._stopBtn;

  if (total === 0) {
    pageTranslateProgressEl.textContent = labels.pageTranslateDone || "Done";
  } else {
    const label = `${labels.pageTranslating || "Translating"} ${current}/${total}`;
    pageTranslateProgressEl.textContent = label;
    stopBtn.textContent = labels.pageTranslateCancel || "Stop";
    pageTranslateProgressEl.appendChild(stopBtn);
  }
}

function hidePageTranslateProgress() {
  if (pageTranslateProgressEl) {
    pageTranslateProgressEl.remove();
    pageTranslateProgressEl = null;
  }
}

function cancelPageTranslation() {
  pageTranslateAborted = true;
  pageTranslateActive = false;
  hidePageTranslateProgress();
}

const PAGE_TRANSLATE_CONCURRENCY = 3;

async function translatePage() {
  // Toggle off: if active, cancel; if translations exist, remove them
  if (pageTranslateActive) {
    cancelPageTranslation();
    removePageTranslations();
    return;
  }
  if (document.querySelector(`.${PAGE_TRANSLATE_SIBLING_CLASS}`)) {
    removePageTranslations();
    return;
  }

  pageTranslateActive = true;
  pageTranslateAborted = false;

  const elements = getPageTranslateElements();
  if (!elements.length) {
    pageTranslateActive = false;
    return;
  }

  const total = elements.length;
  let completed = 0;
  showPageTranslateProgress(0, total);

  async function translateOne(el) {
    if (pageTranslateAborted) return;
    const text = (el.innerText || el.textContent || "").trim();
    if (!text) return;

    const cacheKey = `${currentLanguage}::${text}`;
    let translated = pageTranslateCache.get(cacheKey);

    if (!translated) {
      try {
        const response = await sendMessage({
          type: "TRANSLATE_ELEMENT",
          text,
          language: currentLanguage
        });
        if (response?.ok && response?.translated) {
          translated = response.translated;
          pageTranslateCache.set(cacheKey, translated);
        }
      } catch (_err) {
        // skip elements that fail, continue with the rest
      }
    }

    if (!pageTranslateAborted && translated) {
      insertPageTranslation(el, translated);
    }

    completed += 1;
    if (!pageTranslateAborted) {
      showPageTranslateProgress(completed, total);
    }
  }

  // Concurrency pool: run PAGE_TRANSLATE_CONCURRENCY tasks at a time
  const queue = [...elements];
  async function runWorker() {
    while (queue.length && !pageTranslateAborted) {
      await translateOne(queue.shift());
    }
  }

  const workers = Array.from(
    { length: Math.min(PAGE_TRANSLATE_CONCURRENCY, elements.length) },
    () => runWorker()
  );
  await Promise.all(workers);

  if (!pageTranslateAborted) {
    showPageTranslateProgress(total, 0);
    setTimeout(hidePageTranslateProgress, 2000);
  }

  pageTranslateActive = false;
}

// ─── End page translation ─────────────────────────────────────────────────────

function requestTtsPlayback(text, button) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return;
  if (!window.speechSynthesis) return;

  const labels = getUiLabels();

  if (speechSynthesis.speaking) speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(trimmed);
  utterance.lang = "en-US";

  if (button) {
    button.disabled = true;
    button.textContent = labels.ttsGenerating;
  }

  utterance.onend = () => {
    if (button) {
      button.disabled = false;
      button.textContent = button.dataset.label || labels.play;
    }
  };

  utterance.onerror = () => {
    if (button) {
      button.disabled = false;
      button.textContent = labels.ttsFailed;
      setTimeout(() => {
        if (button) button.textContent = button.dataset.label || labels.play;
      }, 1200);
    }
  };

  speechSynthesis.speak(utterance);
}

