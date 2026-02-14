# Private AI Translator (Firefox)

A lightweight Firefox extension that translates selected text using a local LM Studio model. It adds a small translate button near your selection, shows a draggable floating translation panel, and can play the original text via local `pyttsx3` TTS.

## Features

- Selection translate button (appears near the last selected character)
- Draggable floating translation panel with close + play buttons
- Language selector (中文 / 日文 / 英文)
- Fast translate mode toggle
- Local prompts you can edit
- Optional local TTS via `pyttsx3`

## Requirements

- Firefox
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

4. (Optional) Start TTS server:

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

Prompts are plain text files under `prompts/`.

- Translation prompts:
  - `prompts/translate_system.txt`
  - `prompts/translate_user.txt`
  - `prompts/translate_system_ja.txt`
  - `prompts/translate_user_ja.txt`
  - `prompts/translate_system_en.txt`
  - `prompts/translate_user_en.txt`
- Word mode prompts:
  - `prompts/word_system_zh.txt`
  - `prompts/word_user_zh.txt`
  - `prompts/word_system.txt` (Japanese)
  - `prompts/word_user.txt` (Japanese)
  - `prompts/word_system_en.txt`
  - `prompts/word_user_en.txt`

After editing prompts, reload the extension.

## Fast Translate Mode

When **快速翻譯** is enabled:

- All selections use the translation prompt
- If the selection is a single word, the prompt adds one example sentence + translation

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
