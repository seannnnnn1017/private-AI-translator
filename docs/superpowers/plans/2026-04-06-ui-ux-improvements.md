# UI/UX Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the extension UI with a floating chat trigger button, send buttons in inputs, entrance animations, an empty-state icon, and a global focus ring — all without changing the existing dark glass + orange aesthetic.

**Architecture:** Vanilla JS browser extension (no build step). All UI is built imperatively in content scripts. Animations are defined in a single `<style id="pt-global-styles">` injected once at startup. Tasks are ordered so shared infrastructure (global styles, new vars) lands first.

**Tech Stack:** Vanilla JS, CSS keyframe animations, Browser Extension content scripts (Chrome/Firefox MV3).

---

### File map

| File | Changes |
|------|---------|
| `content.js` | Add `injectGlobalStyles()`, `chatTrigger`, `chatLauncherSend`, `chatPanelSend` vars, add `chatTriggerLabel` to `UI_LABELS` |
| `content.chat.js` | Add `ensureChatTrigger()`, update `isChatUiTarget()`, `ensureChatLauncher()`, `showChatLauncher()`, `ensureChatPanel()`, `renderChatHistory()`, `setChatPendingState()` |
| `content.translate.js` | One-line change in `showTranslation()` |
| `content.bootstrap.js` | Call `injectGlobalStyles()` and `ensureChatTrigger()` |

---

### Task 1: Inject global CSS animations

**Files:**
- Modify: `content.js` (after `normalizeInlineText` at line 649)
- Modify: `content.bootstrap.js`

- [ ] **Step 1: Add `injectGlobalStyles` function to `content.js`**

Add this function after `normalizeInlineText` (the current last function, ending at line 654):

```javascript
function injectGlobalStyles() {
  if (document.getElementById("pt-global-styles")) return;
  const style = document.createElement("style");
  style.id = "pt-global-styles";
  style.textContent = `
    @keyframes pt-fade-in {
      from { opacity:0; transform:translateY(4px); }
      to   { opacity:1; transform:translateY(0); }
    }
    @keyframes pt-slide-up {
      from { opacity:0; transform:translateX(-50%) translateY(8px); }
      to   { opacity:1; transform:translateX(-50%) translateY(0); }
    }
    #pt-chat-trigger:focus-visible {
      outline: 2px solid rgba(255,107,61,.7);
      outline-offset: 2px;
    }
  `;
  document.documentElement.appendChild(style);
}
```

- [ ] **Step 2: Call `injectGlobalStyles()` in `content.bootstrap.js`**

The current file starts with `ext.runtime.onMessage.addListener`. Insert one line at the very top before the listener:

```javascript
injectGlobalStyles();
ext.runtime.onMessage.addListener((msg) => {
  if (msg?.type !== "SHOW_TRANSLATION") return;
  const { original, translated } = msg;
  showTranslation(original, translated);
});

document.addEventListener("selectionchange", scheduleSelectionUpdate, true);
document.addEventListener("mouseup", scheduleSelectionUpdate, true);
document.addEventListener("keyup", scheduleSelectionUpdate, true);
document.addEventListener("keydown", handleQuickChatShortcut, true);
window.addEventListener("scroll", scheduleSelectionUpdate, true);
window.addEventListener("resize", scheduleSelectionUpdate, true);
initLanguageSettings();
```

- [ ] **Step 3: Commit**

```bash
git add content.js content.bootstrap.js
git commit -m "feat: inject global CSS animation keyframes on startup"
```

---

### Task 2: Translation card fade-in

**Files:**
- Modify: `content.translate.js` (`showTranslation`, around line 185)

- [ ] **Step 1: Add fade-in to `showTranslation()`**

In `showTranslation()`, after the `container.innerHTML = ...` assignment (line ~185), add one line:

```javascript
  container.innerHTML =
    `<div id="pt-header" ...` +
    /* ... rest of existing innerHTML ... */
    `</div>`;

  container.style.animation = "pt-fade-in 0.15s ease-out";
```

The exact edit: find this line:

```javascript
  container.querySelector("#pt-close")?.addEventListener("click", () => {
```

And insert `container.style.animation = "pt-fade-in 0.15s ease-out";` directly above it:

```javascript
  container.style.animation = "pt-fade-in 0.15s ease-out";

  container.querySelector("#pt-close")?.addEventListener("click", () => {
```

- [ ] **Step 2: Manual verify**

Reload the extension. Select any word on a webpage, click the translate button. The result card should fade in and slide up 4 px over 150 ms.

- [ ] **Step 3: Commit**

```bash
git add content.translate.js
git commit -m "feat: add fade-in animation to translation card"
```

---

### Task 3: Chat launcher — send button, focus ring, slide-up animation

**Files:**
- Modify: `content.js` (add `chatLauncherSend` global var)
- Modify: `content.chat.js` (`ensureChatLauncher`, `showChatLauncher`, `setChatPendingState`)

- [ ] **Step 1: Add `chatLauncherSend` global var to `content.js`**

Find the block of chat-related let declarations (around line 232–234):

```javascript
let chatLauncher;
let chatLauncherInput;
let chatLauncherHint;
```

Replace with:

```javascript
let chatLauncher;
let chatLauncherInput;
let chatLauncherHint;
let chatLauncherSend;
```

- [ ] **Step 2: Rewrite `ensureChatLauncher()` in `content.chat.js`**

Replace the entire `ensureChatLauncher` function (lines 86–164) with:

```javascript
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

  const row = document.createElement("div");
  row.style.cssText = "display:flex;gap:8px;align-items:center;";

  const input = document.createElement("input");
  chatLauncherInput = input;
  input.type = "text";
  input.autocomplete = "off";
  input.spellcheck = false;
  input.placeholder = labels.chatLauncherPlaceholder;
  input.style.cssText = `
    flex: 1 1 auto;
    min-width: 0;
    padding: 10px 12px;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(26, 26, 26, 0.7);
    color: #f5f5f5;
    font-size: 13px;
    box-sizing: border-box;
  `;
  input.addEventListener("focus", () => {
    input.style.outline = "2px solid rgba(255,107,61,.6)";
    input.style.outlineOffset = "0";
  });
  input.addEventListener("blur", () => {
    input.style.outline = "";
    input.style.outlineOffset = "";
  });

  const sendBtn = document.createElement("button");
  chatLauncherSend = sendBtn;
  sendBtn.type = "button";
  sendBtn.textContent = "↵";
  sendBtn.style.cssText = `
    flex-shrink: 0;
    padding: 8px 14px;
    border-radius: 10px;
    border: none;
    background: #ff6b3d;
    color: #fff;
    font-size: 14px;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(255,107,61,.3);
    transition: background 0.12s;
  `;
  sendBtn.addEventListener("mouseenter", () => {
    if (!sendBtn.disabled) sendBtn.style.background = "#ff825a";
  });
  sendBtn.addEventListener("mouseleave", () => {
    if (!sendBtn.disabled) sendBtn.style.background = "#ff6b3d";
  });

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

  sendBtn.addEventListener("click", () => {
    submitChatQuestion(input.value, "launcher");
  });

  row.appendChild(input);
  row.appendChild(sendBtn);
  launcher.appendChild(row);
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
```

- [ ] **Step 3: Add slide-up animation in `showChatLauncher()`**

Find `showChatLauncher()` (lines 166–182). After `launcher.style.display = "block";`, add the animation reset + trigger:

```javascript
function showChatLauncher() {
  if (chatHistory.length) {
    showChatPanel();
    focusChatInput();
    return;
  }

  const launcher = ensureChatLauncher();
  launcher.style.display = "block";
  launcher.style.animation = "none";
  requestAnimationFrame(() => {
    launcher.style.animation = "pt-slide-up 0.18s ease-out";
  });
  if (chatLauncherInput) {
    chatLauncherInput.disabled = chatPending;
    requestAnimationFrame(() => {
      chatLauncherInput.focus();
      chatLauncherInput.select();
    });
  }
}
```

- [ ] **Step 4: Update `setChatPendingState()` in `content.chat.js`**

Find `setChatPendingState` (lines 482–487). Add `chatLauncherSend` disable:

```javascript
function setChatPendingState(value) {
  chatPending = Boolean(value);

  if (chatLauncherInput) chatLauncherInput.disabled = chatPending;
  if (chatLauncherSend) chatLauncherSend.disabled = chatPending;
  if (chatPanelInput) chatPanelInput.disabled = chatPending;
}
```

(Note: `chatPanelSend` is added in Task 4 — it will be added together in Task 4's step.)

- [ ] **Step 5: Manual verify**

Reload extension. Press ⌘/ on any page. The chat launcher should:
- Slide up 8 px with fade over 180 ms
- Input shows orange ring on focus
- ↵ button submits the question (same as Enter)
- ↵ button disables while response is loading

- [ ] **Step 6: Commit**

```bash
git add content.js content.chat.js
git commit -m "feat: chat launcher send button, focus ring, slide-up animation"
```

---

### Task 4: Chat panel — send button, focus ring, empty state icon

**Files:**
- Modify: `content.js` (add `chatPanelSend` global var)
- Modify: `content.chat.js` (`ensureChatPanel`, `renderChatHistory`, `setChatPendingState`)

- [ ] **Step 1: Add `chatPanelSend` global var to `content.js`**

Find:

```javascript
let chatPanelMinimize;
let chatPanelClose;
```

Replace with:

```javascript
let chatPanelMinimize;
let chatPanelClose;
let chatPanelSend;
```

- [ ] **Step 2: Wrap panel input + add send button in `ensureChatPanel()`**

In `ensureChatPanel()` (lines 215–373), find the `input` element creation block (lines 319–344):

```javascript
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
```

Replace with:

```javascript
  const inputRow = document.createElement("div");
  inputRow.style.cssText = "display:flex;gap:8px;align-items:center;flex-shrink:0;";

  const input = document.createElement("input");
  chatPanelInput = input;
  input.type = "text";
  input.autocomplete = "off";
  input.spellcheck = false;
  input.placeholder = labels.chatInputPlaceholder;
  input.style.cssText = `
    flex: 1 1 auto;
    min-width: 0;
    padding: 10px 12px;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(26, 26, 26, 0.7);
    color: #f5f5f5;
    font-size: 13px;
    box-sizing: border-box;
  `;
  input.addEventListener("focus", () => {
    input.style.outline = "2px solid rgba(255,107,61,.6)";
    input.style.outlineOffset = "0";
  });
  input.addEventListener("blur", () => {
    input.style.outline = "";
    input.style.outlineOffset = "";
  });
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

  const panelSendBtn = document.createElement("button");
  chatPanelSend = panelSendBtn;
  panelSendBtn.type = "button";
  panelSendBtn.textContent = "↵";
  panelSendBtn.style.cssText = `
    flex-shrink: 0;
    padding: 8px 14px;
    border-radius: 10px;
    border: none;
    background: #ff6b3d;
    color: #fff;
    font-size: 14px;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(255,107,61,.3);
    transition: background 0.12s;
  `;
  panelSendBtn.addEventListener("mouseenter", () => {
    if (!panelSendBtn.disabled) panelSendBtn.style.background = "#ff825a";
  });
  panelSendBtn.addEventListener("mouseleave", () => {
    if (!panelSendBtn.disabled) panelSendBtn.style.background = "#ff6b3d";
  });
  panelSendBtn.addEventListener("click", () => {
    submitChatQuestion(input.value, "panel");
  });

  inputRow.appendChild(input);
  inputRow.appendChild(panelSendBtn);
```

Then find where `panel.appendChild(input);` is (around line 364) and replace it with `panel.appendChild(inputRow);`:

```javascript
  panel.appendChild(header);
  panel.appendChild(messages);
  panel.appendChild(inputRow);
  panel.appendChild(resizeHandle);
```

- [ ] **Step 3: Update empty state in `renderChatHistory()`**

Find the empty state block in `renderChatHistory()` (lines 457–461):

```javascript
    const empty = document.createElement("div");
    empty.textContent = labels.chatEmpty;
    empty.style.cssText =
      "padding:10px 12px;border-radius:12px;background:rgba(26,26,26,.5);border:1px solid rgba(255,255,255,.05);opacity:.78;line-height:1.45;";
    chatPanelMessages.appendChild(empty);
```

Replace with:

```javascript
    const empty = document.createElement("div");
    empty.style.cssText =
      "padding:10px 12px;border-radius:12px;background:rgba(26,26,26,.5);border:1px solid rgba(255,255,255,.05);opacity:.78;line-height:1.45;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:80px;";
    const emptyIcon = document.createElement("div");
    emptyIcon.textContent = "✦";
    emptyIcon.style.cssText = "font-size:22px;color:#ff6b3d;margin-bottom:6px;";
    const emptyText = document.createElement("div");
    emptyText.textContent = labels.chatEmpty;
    empty.appendChild(emptyIcon);
    empty.appendChild(emptyText);
    chatPanelMessages.appendChild(empty);
```

- [ ] **Step 4: Update `setChatPendingState()` to include `chatPanelSend`**

Find `setChatPendingState` (updated in Task 3 Step 4):

```javascript
function setChatPendingState(value) {
  chatPending = Boolean(value);

  if (chatLauncherInput) chatLauncherInput.disabled = chatPending;
  if (chatLauncherSend) chatLauncherSend.disabled = chatPending;
  if (chatPanelInput) chatPanelInput.disabled = chatPending;
}
```

Replace with:

```javascript
function setChatPendingState(value) {
  chatPending = Boolean(value);

  if (chatLauncherInput) chatLauncherInput.disabled = chatPending;
  if (chatLauncherSend) chatLauncherSend.disabled = chatPending;
  if (chatPanelInput) chatPanelInput.disabled = chatPending;
  if (chatPanelSend) chatPanelSend.disabled = chatPending;
}
```

- [ ] **Step 5: Manual verify**

Reload extension. Press ⌘/ to open chat panel (after at least one question so panel shows). Verify:
- Empty state shows ✦ icon in orange above the hint text
- Panel input shows orange focus ring on focus
- ↵ button submits the question
- ↵ button and input both disable while loading

- [ ] **Step 6: Commit**

```bash
git add content.js content.chat.js
git commit -m "feat: chat panel send button, focus ring, empty state icon"
```

---

### Task 5: Floating chat trigger button

**Files:**
- Modify: `content.js` (add `chatTriggerLabel` to `UI_LABELS`, add `chatTrigger` var)
- Modify: `content.chat.js` (add `ensureChatTrigger()`, update `isChatUiTarget()`)
- Modify: `content.bootstrap.js` (call `ensureChatTrigger()`)

- [ ] **Step 1: Add `chatTriggerLabel` to `UI_LABELS` in `content.js`**

In the `UI_LABELS` object (lines 98–182), add `chatTriggerLabel` to all three language blocks.

In the `zh` block, add after `chatTitle`:
```javascript
    chatTriggerLabel: "English Helper",
```

In the `ja` block, add after `chatTitle`:
```javascript
    chatTriggerLabel: "English Helper",
```

In the `en` block, add after `chatTitle`:
```javascript
    chatTriggerLabel: "English Helper",
```

- [ ] **Step 2: Add `chatTrigger` global var to `content.js`**

Find:

```javascript
let chatLauncher;
```

Replace with:

```javascript
let chatTrigger;
let chatLauncher;
```

- [ ] **Step 3: Add `ensureChatTrigger()` to `content.chat.js`**

Add this function before `isEditableTarget` (the first function in the file):

```javascript
function ensureChatTrigger() {
  if (chatTrigger) return chatTrigger;

  const labels = getUiLabels();
  const btn = document.createElement("button");
  chatTrigger = btn;
  btn.id = "pt-chat-trigger";
  btn.type = "button";
  btn.style.cssText = `
    position: fixed;
    right: 20px;
    bottom: 20px;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(46, 46, 46, 0.82);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    box-shadow: 0 8px 24px rgba(0,0,0,.3);
    color: #f5f5f5;
    font-size: 13px;
    cursor: pointer;
    z-index: 2147483646;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    transition: background 0.15s, box-shadow 0.15s;
  `;

  const icon = document.createElement("span");
  icon.textContent = "✦";
  icon.style.cssText = "color:#ff6b3d;font-size:14px;line-height:1;";

  const label = document.createElement("span");
  label.textContent = labels.chatTriggerLabel;

  const kbd = document.createElement("span");
  kbd.textContent = "⌘/";
  kbd.style.cssText =
    "padding:2px 6px;border-radius:4px;background:rgba(255,255,255,.08);color:#ffb498;font-size:11px;line-height:1;";

  btn.appendChild(icon);
  btn.appendChild(label);
  btn.appendChild(kbd);

  btn.addEventListener("mouseenter", () => {
    btn.style.background = "rgba(56,56,56,0.9)";
    btn.style.boxShadow = "0 10px 28px rgba(255,107,61,.2)";
  });
  btn.addEventListener("mouseleave", () => {
    btn.style.background = "rgba(46,46,46,0.82)";
    btn.style.boxShadow = "0 8px 24px rgba(0,0,0,.3)";
  });

  btn.addEventListener("click", () => {
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
    } else {
      showChatLauncher();
    }
  });

  document.documentElement.appendChild(btn);
  return btn;
}
```

- [ ] **Step 4: Update `isChatUiTarget()` in `content.chat.js`**

Find `isChatUiTarget` (lines 12–19):

```javascript
function isChatUiTarget(target) {
  const el =
    target?.nodeType === Node.ELEMENT_NODE ? target : target?.parentElement;
  if (!el) return false;
  if (chatLauncher && chatLauncher.contains(el)) return true;
  if (chatPanel && chatPanel.contains(el)) return true;
  return false;
}
```

Replace with:

```javascript
function isChatUiTarget(target) {
  const el =
    target?.nodeType === Node.ELEMENT_NODE ? target : target?.parentElement;
  if (!el) return false;
  if (chatTrigger && chatTrigger.contains(el)) return true;
  if (chatLauncher && chatLauncher.contains(el)) return true;
  if (chatPanel && chatPanel.contains(el)) return true;
  return false;
}
```

- [ ] **Step 5: Call `ensureChatTrigger()` in `content.bootstrap.js`**

Add the call at the end of `content.bootstrap.js`, after `initLanguageSettings()`:

```javascript
injectGlobalStyles();
ext.runtime.onMessage.addListener((msg) => {
  if (msg?.type !== "SHOW_TRANSLATION") return;
  const { original, translated } = msg;
  showTranslation(original, translated);
});

document.addEventListener("selectionchange", scheduleSelectionUpdate, true);
document.addEventListener("mouseup", scheduleSelectionUpdate, true);
document.addEventListener("keyup", scheduleSelectionUpdate, true);
document.addEventListener("keydown", handleQuickChatShortcut, true);
window.addEventListener("scroll", scheduleSelectionUpdate, true);
window.addEventListener("resize", scheduleSelectionUpdate, true);
initLanguageSettings();
ensureChatTrigger();
```

- [ ] **Step 6: Manual verify**

Reload extension. Visit any page. Verify:
- Pill button appears bottom-right: `✦ English Helper ⌘/`
- Hover → darker background + orange box shadow
- Click → opens launcher (first time) or chat panel (if history exists)
- Click again while open → closes launcher or panel
- `focus-visible` outline appears when tabbing to the button

- [ ] **Step 7: Commit**

```bash
git add content.js content.chat.js content.bootstrap.js
git commit -m "feat: floating chat trigger button at bottom-right"
```

---

### Task 6: Final smoke test & push

- [ ] **Step 1: Full flow test**

  1. Open any English page
  2. Confirm trigger button `✦ English Helper ⌘/` at bottom-right
  3. Click trigger → launcher slides up, input focused
  4. Type a question, click ↵ → chat panel opens, answer arrives
  5. Close panel with × → reopen with ⌘/ → sends to panel directly
  6. Select a word → translate button appears → click → result card fades in

- [ ] **Step 2: Push**

```bash
git push
```
