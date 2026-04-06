# UI/UX Improvements Design

**Date:** 2026-04-06

## Overview

Polish the extension's UI while preserving the existing dark glass + orange accent aesthetic. Five targeted improvements: floating chat trigger button, launcher send button with focus ring, translation card animation, chat panel empty state icon, and global input focus ring.

---

## Style System (Unchanged)

- Background: `rgba(46, 46, 46, 0.72)` with `backdrop-filter: blur(14px) saturate(120%)`
- Border: `1px solid rgba(255, 255, 255, 0.08)`
- Accent: `#ff6b3d` (orange)
- Font: `-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
- Radius: `12px` panels, `999px` pills/buttons

---

## Section 1 — Floating Chat Trigger Button

**File:** `content.chat.js`

A persistent pill-shaped button at bottom-right that opens the chat launcher (same as ⌘/).

**Markup (created by `ensureChatTrigger()`):**
```html
<button id="pt-chat-trigger">
  <span>✦</span>
  <span>English Helper</span>
  <span>⌘/</span>
</button>
```

**Styles:**
- `position: fixed; right: 20px; bottom: 20px`
- `display: flex; align-items: center; gap: 6px`
- `padding: 8px 16px; border-radius: 999px`
- `background: rgba(46, 46, 46, 0.82); border: 1px solid rgba(255, 255, 255, 0.1)`
- `backdrop-filter: blur(14px)`
- `box-shadow: 0 8px 24px rgba(0,0,0,.3)`
- `color: #f5f5f5; font-size: 13px; cursor: pointer`
- ✦ icon: `color: #ff6b3d; font-size: 14px`
- kbd badge: `padding: 2px 6px; border-radius: 4px; background: rgba(255,255,255,.08); color: #ffb498; font-size: 11px`
- Hover: `background: rgba(56, 56, 56, 0.9); box-shadow: 0 10px 28px rgba(255,107,61,.2)`
- Transition: `background 0.15s, box-shadow 0.15s`

**Behaviour:**
- Click: same as ⌘/ (calls `handleQuickChatShortcut` logic: opens launcher or panel)
- Always visible (z-index 2147483646, one below UI panels)
- `isChatUiTarget()` updated to include trigger element

---

## Section 2 — Chat Launcher: Send Button + Focus Ring

**File:** `content.chat.js` → `ensureChatLauncher()`

### Send button
Sits inside the launcher as a row: `[input field] [↵ button]`

```html
<div style="display:flex;gap:8px;align-items:center;">
  <input ...>
  <button id="pt-launcher-send">↵</button>
</div>
```

Send button styles:
- `padding: 8px 14px; border-radius: 10px; border: none`
- `background: #ff6b3d; color: #fff; font-size: 14px; cursor: pointer`
- `box-shadow: 0 4px 12px rgba(255,107,61,.3); flex-shrink: 0`
- Hover: `background: #ff825a`
- Disabled (when pending): `opacity: 0.5; cursor: not-allowed`
- Click fires same action as Enter keydown

### Focus ring (input)
```css
outline: 2px solid rgba(255, 107, 61, 0.6);
outline-offset: 0;
```
Applied via inline style on `focus` / removed on `blur` event.

### Fade-in + slide-up animation
```css
@keyframes pt-slide-up {
  from { opacity: 0; transform: translateX(-50%) translateY(8px); }
  to   { opacity: 1; transform: translateX(-50%) translateY(0); }
}
```
Applied to `chatLauncher` element on `showChatLauncher()`:
`animation: pt-slide-up 0.18s ease-out`

Injected via `<style id="pt-animations">` in `content.js` (Section 5).

---

## Section 3 — Translation Card Fade-In

**File:** `content.translate.js` → `showTranslation()`

After building `container.innerHTML`, add:
```js
container.style.animation = "pt-fade-in 0.15s ease-out";
```

Animation definition (shared `<style>` block from Section 5):
```css
@keyframes pt-fade-in {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

---

## Section 4 — Chat Panel: Empty State Icon + Send Button

**File:** `content.chat.js`

### Empty state icon
In `renderChatHistory()`, replace the plain text empty state with:
```html
<div style="...">
  <div style="font-size:22px;color:#ff6b3d;margin-bottom:6px;">✦</div>
  <div>{labels.chatEmpty}</div>
</div>
```
Centered vertically and horizontally with `text-align:center; display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:80px`.

### Send button in panel input row
Same pattern as Section 2: wrap the existing `<input>` in a flex row with a `↵` send button.

```html
<div style="display:flex;gap:8px;align-items:center;flex-shrink:0;">
  <input ...>
  <button id="pt-panel-send">↵</button>
</div>
```

Same styles as Section 2 send button. `setChatPendingState()` also disables/enables this button.

---

## Section 5 — Global Input Focus Ring via Injected `<style>`

**File:** `content.js`

On init, inject once:
```js
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

Call `injectGlobalStyles()` at the top of `initExtension()`.

---

## Out of Scope

- Voice selection UI
- Rate/pitch controls
- Settings panel redesign
- New translation providers
- Keyboard shortcut customization
