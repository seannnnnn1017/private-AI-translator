# Private AI Translator (Firefox + Chrome)

A lightweight Firefox/Chrome extension that translates selected text using local or remote LLM APIs. It adds a small translate button near your selection, shows a draggable floating translation panel, and can play the original text via local `pyttsx3` TTS.

## Features

- Selection translate button (appears near the last selected character)
- Draggable floating translation panel with close + play buttons
- Language selector (中文 / 日文 / 英文)
- Fast translate mode toggle
- Configurable model API provider (LM Studio, OpenAI, Gemini, custom OpenAI-compatible API)
- Quick English helper chat with `Command + /` (toggle open/close)
- Draggable and resizable chat panel with in-page history
- Markdown-rendered chat replies (headings, lists, dividers, tables, code blocks)
- Selection-aware chat questions (the next chat message can refer to your highlighted text)
- Context-aware single-word translation (uses the surrounding sentence to disambiguate)
- Local prompts you can edit
- Optional local TTS via `pyttsx3`

## Requirements

- Firefox (109+) or Chrome (Chromium-based, MV3)
- One translation backend:
  - LM Studio running locally
  - OpenAI API key
  - Google Gemini API key
  - A self-hosted OpenAI-compatible API server
- Python 3 + `pyttsx3` (for TTS)

## Setup

1. Pick the browser manifest (this copies the right file into `manifest.json`):

```bash
./use-manifest.sh firefox
```

Use `./use-manifest.sh chrome` before loading in Chrome.

2. Load the extension in Firefox:

- Open `about:debugging`
- Click **This Firefox**
- Click **Load Temporary Add-on...**
- Select `manifest.json`

3. Load the extension in Chrome:

- Open `chrome://extensions`
- Enable **Developer mode**
- Click **Load unpacked**
- Select this folder (the one with `manifest.json`)

4. Open the extension settings panel on any page and choose your provider:

- `LM Studio`: local OpenAI-compatible endpoint, default `http://127.0.0.1:1234`
- `OpenAI / GPT`: set your OpenAI API key and model
- `Google Gemini`: set your Gemini API key and model
- `Custom API`: your own OpenAI-compatible server URL, model, and optional key

5. (Optional) Start TTS server:

```bash
pip install pyttsx3
python3 tts_server.py
```

## How to Use

- Select text on any page.
- Click the small **翻譯** button near the selection.
- The floating panel shows the translation. You can drag or close it.
- Click **播放** to speak the original text (requires TTS server).
- Use the right-side settings panel to choose language, toggle fast mode, and configure the API provider/base URL/model/key.
- Press `Command + /` to toggle the English chat UI.
- On the first open (with no history), a quick input appears near the lower center of the page.
- Press `Enter` in that quick input to open the full chat panel.
- Once history exists, `Command + /` toggles the full chat panel directly.
- If you highlight text before pressing `Command + /`, your next chat question can refer to that selection (for example, “how do I use this word?”).
- Drag the chat header to move it, and drag the bottom-right `◢` handle to resize it.
- In the chat header, `-` hides the panel but keeps history, while `×` clears history and fully closes it.
- Chat replies render Markdown, including tables and `---` dividers.

## Prompts

Prompts are plain text files under `prompts/`. All prompts are written in English and use `{{target_language}}` to control output language (Traditional Chinese / Japanese / English).

- Translation prompts:
  - `prompts/translate_system.txt`
  - `prompts/translate_user.txt`
- Word mode prompts:
  - `prompts/word_system.txt`
  - `prompts/word_user.txt`
- Two-stage word prompts:
  - Meanings only: `prompts/word_meaning.txt`
  - Examples only: `prompts/word_example.txt`
- Fast word prompt (context-aware):
  - `prompts/word_fast.txt`
- English helper chat prompts:
  - `prompts/chat_system.txt`
  - `prompts/chat_user.txt`

After editing prompts, reload the extension.

## Fast Translate Mode

When **快速翻譯** is enabled:

- Sentences use the translation prompt
- Single words use a dedicated fast word prompt and include:
  - The word meaning (best fit for the context sentence)
  - One example sentence (with **bold** word) + translation

## Word Mode (Default for Single Word)

When **快速翻譯** is disabled and you select a single word:

- Stage 1: get meanings + POS only (fast)
- Stage 2: generate one example sentence per meaning
- The context sentence is passed to Stage 1 to improve accuracy

## TTS Notes

- The extension sends TTS requests to `http://127.0.0.1:5005/tts`
- TTS speaks the original text
- The TTS server must keep running in the background

## Troubleshooting

- No translation:
  - `LM Studio`: verify LM Studio is running and the base URL/model are correct.
  - `OpenAI / Gemini`: verify the API key is valid and the selected model is available.
  - `Custom API`: verify the server is OpenAI-compatible and reachable from the browser.
- Chat table not rendering:
  - Make sure the reply uses a normal Markdown table, not a fenced code block.
  - Reload the extension after updating `content.js` or prompt files.
- No TTS audio: verify `python3 tts_server.py` is running and `say "hello"` works.
- Changes not applied: reload the extension in `about:debugging` or `chrome://extensions`.
- Firefox install error about `background.service_worker`: run `./use-manifest.sh firefox` and reload the temporary add-on.
- `Could not establish connection. Receiving end does not exist.`:
  - In Chrome, make sure you loaded the Chrome manifest (`manifest.json` now defaults to Chrome settings).
  - In Firefox, run `./use-manifest.sh firefox`, then reload the temporary add-on so the background script matches Firefox.

## Files

- `content.js`: selection UI, floating panels, quick chat UI, Markdown chat rendering, settings UI, TTS button
- `background.js`: provider-aware translation and chat requests, prompt loading, settings state, TTS request
- `tts_server.py`: local pyttsx3 TTS server
- `manifest.firefox.json`: Firefox manifest (`background.scripts`)
- `manifest.chrome.json`: Chrome manifest (`background.service_worker`)
- `manifest.json`: active manifest used when loading the extension
- `use-manifest.sh`: copies the selected browser manifest into `manifest.json`
