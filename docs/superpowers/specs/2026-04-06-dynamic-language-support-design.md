# Dynamic Language Support Design

**Date:** 2026-04-06

## Overview

Replace the fixed three-language system (zh/ja/en) with a fully dynamic language list. Users can add any language (e.g. French, Spanish, Korean) from the settings panel. The extension UI adapts to the selected language — presets (Traditional Chinese, Japanese, English) use hardcoded labels; other languages get labels AI-generated on first use and cached permanently in storage.

---

## Goals

1. Support any translation target language
2. Extension UI language follows the selected translation language
3. Users can manage a personal language list (add / remove)
4. Default language: English
5. Settings panel UI/UX improvements

---

## Data Model

### Storage Keys

| Key | Type | Description |
|-----|------|-------------|
| `ptLanguage` | `string` | Current language full name, e.g. `"French"` |
| `ptLanguageList` | `string[]` | User's saved language list, e.g. `["English", "Traditional Chinese", "French"]` |
| `ptLabelCache` | `object` | AI-generated UI labels keyed by language name |

### Language Identifier

Language is identified by its full display name (English string), not a short code.

**Preset languages** (hardcoded, always available):
- `"Traditional Chinese"` → zh UI labels, prompt name `"Traditional Chinese"`
- `"Japanese"` → ja UI labels, prompt name `"Japanese"`
- `"English"` → en UI labels, prompt name `"English"`

**Custom languages**: full name used directly as prompt target (e.g. `"French"` → `Translate to French`).

### Default State (first install)

```
ptLanguage: "English"
ptLanguageList: ["English", "Traditional Chinese", "Japanese"]
ptLabelCache: {}
```

### Migration

On load, if `ptLanguage` is an old short code, map it:
```
"zh" → "Traditional Chinese"
"ja" → "Japanese"
"en" → "English"
```

---

## `getUiLabels()` Logic

```
1. currentLanguage === "Traditional Chinese" → hardcoded zh labels
2. currentLanguage === "Japanese"            → hardcoded ja labels
3. currentLanguage === "English"             → hardcoded en labels
4. labelCache[currentLanguage] exists        → cached AI-generated labels
5. fallback                                  → hardcoded en labels
```

---

## Settings Panel UI

### Language Section (replaces `<select>` dropdown)

```
Language
──────────────────────────────────
[Traditional Chinese ×] [English ×]
[Japanese ×] [French ···]
──────────────────────────────────
[  Add a language...        ] [+]
```

- **Pill** = one language in the list. Click to switch.
- **Selected pill** = orange background (`#ff6b3d`) with white text.
- **Pending pill** = dimmed (`opacity: 0.5`) with `···` suffix while AI generates labels.
- **Failed pill** = `⚠` suffix; clicking re-triggers generation.
- **× button** = remove language. Hidden when list has only 1 item.
- **Add input** = free-form text (e.g. "French"). Enter or `+` button to submit. Trims and title-cases input.
- Pill list scrolls if overflow (max 3 rows visible).

### Settings Toggle Badge

Settings toggle button shows current language abbreviation:

| Language | Badge |
|----------|-------|
| English | `EN` |
| Traditional Chinese | `中` |
| Japanese | `日` |
| French | `FR` (first 2 chars uppercased) |
| Korean | `KO` |

### Other Panel Improvements

- API section collapsed label shows current provider: `▸ API · LM Studio`
- All input `focus` states use orange outline (`2px solid rgba(255,107,61,.6)`)
- Panel open uses `pt-fade-in` animation (already injected globally)
- Clear section dividers between Language / Fast Mode / API blocks

---

## AI Label Generation

### Trigger

When a non-preset language is first selected or added and `ptLabelCache[language]` is absent.

### Message Flow

```
content.js → background.js: { type: "GENERATE_LABELS", language: "French" }
background.js → AI: prompt with JSON of en labels + instruction to translate
background.js → content.js: { ok: true, labels: { translateBtn: "Traduire", ... } }
content.js: labelCache["French"] = labels; storageSet({ ptLabelCache }); updateUI()
```

### Prompt

**System:**
```
You are a UI translator. Return only valid JSON, no explanation.
```

**User:**
```
Translate these UI strings into {{language}}.
Return the exact same JSON structure with translated values:

{
  "translateBtn": "Translate",
  "translationTitle": "Translation",
  "play": "Play",
  "close": "Close",
  "loading": "Translating...",
  "ttsGenerating": "Generating",
  "ttsFailed": "Failed",
  "chatTitle": "English Helper",
  "chatTriggerLabel": "English Helper",
  "chatLauncherPlaceholder": "Ask a quick English question...",
  "chatLauncherHint": "Press Command + / to open or close",
  "chatInputPlaceholder": "Ask another English question...",
  "chatEmpty": "Ask about vocabulary, grammar, tone, or usage.",
  "chatThinking": "Thinking...",
  "chatFailed": "Chat failed",
  "minimize": "Hide",
  "chatReset": "Clear and close",
  "toggle": "Lang",
  "title": "Translation Language",
  "fast": "Fast Translate",
  "apiHint": "OpenAI and Gemini need a key. Self-hosted OpenAI-compatible APIs can leave it blank."
}
```

### Error Handling

| Scenario | Handling |
|----------|----------|
| Invalid JSON response | Fallback to English labels; pill shows `⚠` |
| Network / API error | Same as above; pill is clickable to retry |
| Missing keys in response | Fill missing keys from English fallback |
| Language not found by AI | AI will still produce best-effort translation |

---

## Files Changed

### `content.js`
- `DEFAULT_LANGUAGE` → `"English"`
- Remove `LANGUAGE_OPTIONS`, `LANGUAGE_VALUES`
- Add `PRESET_LANGUAGES` map: `{ "Traditional Chinese": { labels: UI_LABELS.zh, ... }, ... }`
- Add `LABEL_CACHE_KEY = "ptLabelCache"`, `LANGUAGE_LIST_KEY = "ptLanguageList"`
- Add `let labelCache = {}`, `let languageList = []`
- Update `getUiLabels()` with new 5-step logic
- Add `getLanguageBadge(lang)` helper

### `content.settings.js`
- Replace `<select>` with pill list + add input
- Add `renderLanguagePills()`, `addLanguage(lang)`, `removeLanguage(lang)`
- Add pending/error pill state management
- Update `updateSettingsPanelText()` for badge
- Update `initLanguageSettings()` to load `ptLanguageList`
- Update `saveLanguageSetting()` to also save list

### `background.js`
- `DEFAULT_LANGUAGE` → `"English"`
- `normalizeLanguage()`: migrate old codes, accept any non-empty string
- `getTargetLanguageName()`: preset map + passthrough for custom
- Add `GENERATE_LABELS` message handler
- Update `ensureSettingsLoaded()` to migrate old code on read

### `content.bootstrap.js`
- On init, read `ptLabelCache` from storage into `labelCache`

---

## Out of Scope

- Translating chat system prompts per language (chat always in English-teaching mode)
- Language detection from page content
- Per-site language preferences
- Reordering the language list
