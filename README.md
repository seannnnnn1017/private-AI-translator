# Private AI Translator (Firefox + Chrome)

A lightweight Firefox/Chrome extension that translates selected text using a local LM Studio model. It adds a small translate button near your selection, shows a draggable floating translation panel, and can play the original text via local `pyttsx3` TTS.

## Features

- Selection translate button (appears near the last selected character)
- Draggable floating translation panel with close + play buttons
- Language selector (中文 / 日文 / 英文)
- Fast translate mode toggle
- Context-aware single-word translation (uses the surrounding sentence to disambiguate)
- Local prompts you can edit
- Optional local TTS via `pyttsx3`

## Requirements

- Firefox (109+) or Chrome (Chromium-based, MV3)
- LM Studio running locally at `http://127.0.0.1:1234`
- A chat model available in LM Studio (configure in `background.js`)
- Python 3 + `pyttsx3` (for TTS)

## Setup

1. Start LM Studio and load your model.
2. Update the model name in `background.js` if needed:

```js
const MODEL = "qwen/qwen3-8b";
```

3. Load the extension in Firefox:

- Open `about:debugging`
- Click **This Firefox**
- Click **Load Temporary Add-on...**
- Select `manifest.json`

4. Load the extension in Chrome:

- Open `chrome://extensions`
- Enable **Developer mode**
- Click **Load unpacked**
- Select this folder (the one with `manifest.json`)

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
- Use the right-side settings panel to choose language and toggle fast mode.

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

- No translation: verify LM Studio is running and `MODEL` is correct.
- No TTS audio: verify `python3 tts_server.py` is running and `say "hello"` works.
- Changes not applied: reload the extension in `about:debugging`.

## Files

- `content.js`: selection UI, floating panel, settings UI, TTS button
- `background.js`: LM Studio request, prompt loading, language/fast mode, TTS request
- `tts_server.py`: local pyttsx3 TTS server
- `manifest.json`: extension manifest
