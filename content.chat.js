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
  minBtn.textContent = "-";
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
