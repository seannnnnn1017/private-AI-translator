const LMSTUDIO_BASE = "http://127.0.0.1:1234";
const MODEL = "qwen/qwen3-8b"; // 改成 LM Studio 的 model 名稱

const SETTINGS_KEY = "ptLanguage";
const SETTINGS_FAST_KEY = "ptFastTranslate";
const DEFAULT_LANGUAGE = "zh";
const DEFAULT_FAST_MODE = false;
const LANGUAGE_LABELS = {
  zh: "中文",
  ja: "日文",
  en: "英文"
};
const LANGUAGE_VALUES = new Set(Object.keys(LANGUAGE_LABELS));

const TTS_ENDPOINT = "http://127.0.0.1:5005/tts";

const FAST_WORD_SUFFIX = {
  zh: "\nAlso add one English example sentence (bold the word) and its Chinese translation.",
  ja: "\n単語のみの場合は、英語例文を1つ（単語は**太字**）と日本語訳を付ける。",
  en: "\nIf input is a single word, add one English example sentence with **word** and a brief English paraphrase."
};

const PROMPT_CONFIG = {
  zh: {
    translate: {
      system: {
        file: "prompts/translate_system.txt",
        fallback:
          "You are a professional translator. Translate accurately and naturally. Keep proper nouns and technical terms."
      },
      user: {
        file: "prompts/translate_user.txt",
        fallback: "Translate to Traditional Chinese:\n\n{{text}}"
      }
    },
    word: {
      system: {
        file: "prompts/word_system_zh.txt",
        fallback:
          "你是雙語詞典編輯與 IELTS 講師。解釋請用繁體中文，目標單字與例句保持英文。請用 Markdown 的 **粗體** 標題。"
      },
      user: {
        file: "prompts/word_user_zh.txt",
        fallback: `請就以下單字輸出：
1) 詞性（可多個）
2) 意思（1〜3 個，優先常用）
3) 每個意思給 1 句 IELTS 風格例句（Band 7+）

規則:
- 不要硬湊 3 個。若只有 1〜2 個常用意思就只輸出那些。
- 避免罕見、不自然或古語用法。
- 若為專有名詞、縮寫或非英文字，請簡短說明並給出最可能解釋。
- 英文例句中的目標單字需 **加粗**。
- 需提供例句中文翻譯。

單字: {{text}}

格式（Markdown，只輸出存在的意思）:
1. **中文意思** (詞性)
   English example sentence with **word**
   中文翻譯
2. **中文意思** (詞性)
   English example sentence with **word**
   中文翻譯
3. **中文意思** (詞性)
   English example sentence with **word**
   中文翻譯`
      }
    }
  },
  ja: {
    translate: {
      system: {
        file: "prompts/translate_system_ja.txt",
        fallback:
          "あなたはプロの翻訳者です。正確で自然な日本語に訳し、固有名詞と専門用語は保持してください。"
      },
      user: {
        file: "prompts/translate_user_ja.txt",
        fallback: "以下の文章を日本語に翻訳してください:\n\n{{text}}"
      }
    },
    word: {
      system: {
        file: "prompts/word_system.txt",
        fallback:
          "あなたはバイリンガルの語彙学者兼IELTS講師です。説明は日本語で簡潔に書き、ターゲット単語と例文は英語のままにしてください。Markdown で **太字** の見出しを使ってください。"
      },
      user: {
        file: "prompts/word_user.txt",
        fallback: `以下の単語について、次を出力してください:
1) 品詞（複数可）
2) 意味（1〜3件、一般的な用法を優先）
3) 各意味につき IELTS 風の英作文（Band 7+）を1文ずつ

ルール:
- 3つに無理やり合わせない。一般的な意味が1〜2つならそれだけ出力。
- まれ／不自然／古語の意味は避ける。
- 固有名詞・略語・英単語でない場合は簡潔に説明し、最も可能性の高い解釈を示す。
- 英文例の中のターゲット語は **太字** にする。
- 例文の日本語訳を付ける。

単語: {{text}}

形式（Markdown、存在する意味のみ出力）:
1. **日本語の意味** (品詞)
   English example sentence with **word**
   日本語訳
2. **日本語の意味** (品詞)
   English example sentence with **word**
   日本語訳
3. **日本語の意味** (品詞)
   English example sentence with **word**
   日本語訳`
      }
    }
  },
  en: {
    translate: {
      system: {
        file: "prompts/translate_system_en.txt",
        fallback:
          "You are a professional translator. Translate accurately and naturally. Keep proper nouns and technical terms."
      },
      user: {
        file: "prompts/translate_user_en.txt",
        fallback: "Translate to English:\n\n{{text}}"
      }
    },
    word: {
      system: {
        file: "prompts/word_system_en.txt",
        fallback:
          "You are a bilingual lexicographer and IELTS tutor. Provide clear, concise explanations in English, but keep the target word and example sentences in English. Use Markdown with **bold** section titles."
      },
      user: {
        file: "prompts/word_user_en.txt",
        fallback: `For the word below, provide:
1) Part of speech (may be multiple)
2) Meaning (1-3 senses, prioritize common usage)
3) Each sense must include exactly one IELTS-style example sentence (band 7+)

Rules:
- Do NOT force 3 senses. If only 1 or 2 common senses exist, output only those.
- Avoid rare, contrived, or archaic senses.
- If the word is a proper noun, abbreviation, or not a valid English word, say so briefly and give the most likely interpretation.
- Keep the target word bolded in English example sentences.
- Add a short English paraphrase of the sentence.

Word: {{text}}

Format (Markdown, only include existing senses):
1. **Meaning in English** (POS)
   English example sentence with **word**
   English paraphrase
2. **Meaning in English** (POS)
   English example sentence with **word**
   English paraphrase
3. **Meaning in English** (POS)
   English example sentence with **word**
   English paraphrase`
      }
    }
  }
};

let currentLanguage = DEFAULT_LANGUAGE;
let currentFastMode = DEFAULT_FAST_MODE;
let settingsPromise = null;
const promptsCache = new Map();
const promptsPromise = new Map();

function normalizeLanguage(lang) {
  return LANGUAGE_VALUES.has(lang) ? lang : DEFAULT_LANGUAGE;
}

function getFastWordSuffix(language) {
  const lang = normalizeLanguage(language);
  return FAST_WORD_SUFFIX[lang] || FAST_WORD_SUFFIX[DEFAULT_LANGUAGE] || "";
}

async function loadSettings() {
  try {
    const stored = await browser.storage.local.get([
      SETTINGS_KEY,
      SETTINGS_FAST_KEY
    ]);
    currentLanguage = normalizeLanguage(stored?.[SETTINGS_KEY]);
    currentFastMode =
      typeof stored?.[SETTINGS_FAST_KEY] === "boolean"
        ? stored[SETTINGS_FAST_KEY]
        : DEFAULT_FAST_MODE;
  } catch (err) {
    currentLanguage = DEFAULT_LANGUAGE;
    currentFastMode = DEFAULT_FAST_MODE;
  }
}

function ensureSettingsLoaded() {
  if (!settingsPromise) {
    settingsPromise = loadSettings();
  }
  return settingsPromise;
}

async function setLanguage(lang) {
  const nextLang = normalizeLanguage(lang);
  currentLanguage = nextLang;
  try {
    await browser.storage.local.set({ [SETTINGS_KEY]: nextLang });
  } catch (err) {
    // ignore
  }
  return nextLang;
}

async function setFastMode(enabled) {
  const nextValue = Boolean(enabled);
  currentFastMode = nextValue;
  try {
    await browser.storage.local.set({ [SETTINGS_FAST_KEY]: nextValue });
  } catch (err) {
    // ignore
  }
  return nextValue;
}

async function synthesizeSpeech(text, language) {
  const payload = {
    text,
    language
  };

  const res = await fetch(TTS_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`TTS HTTP ${res.status}: ${body}`);
  }

  const contentType = (res.headers.get("content-type") || "").toLowerCase();

  if (contentType.startsWith("audio/")) {
    const buffer = await res.arrayBuffer();
    if (!buffer || buffer.byteLength === 0) {
      throw new Error("TTS empty response");
    }
    return { ok: true, buffer, mimeType: contentType || "audio/wav" };
  }

  const data = await res.json().catch(() => null);
  if (data && data.ok === false) {
    throw new Error(data.error || "TTS failed");
  }

  return { ok: true, mode: "server" };
}

async function loadPromptFile(path, fallback) {
  try {
    const res = await fetch(browser.runtime.getURL(path));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    return text.trim() || fallback;
  } catch (err) {
    return fallback;
  }
}

async function ensurePrompts(language) {
  const lang = normalizeLanguage(language);
  if (promptsCache.has(lang)) return promptsCache.get(lang);

  if (!promptsPromise.has(lang)) {
    const config = PROMPT_CONFIG[lang] || PROMPT_CONFIG[DEFAULT_LANGUAGE];
    promptsPromise.set(
      lang,
      (async () => {
        const [translateSystem, translateUser, wordSystem, wordUser] =
          await Promise.all([
            loadPromptFile(
              config.translate.system.file,
              config.translate.system.fallback
            ),
            loadPromptFile(
              config.translate.user.file,
              config.translate.user.fallback
            ),
            loadPromptFile(config.word.system.file, config.word.system.fallback),
            loadPromptFile(config.word.user.file, config.word.user.fallback)
          ]);

        return {
          translate: { system: translateSystem, user: translateUser },
          word: { system: wordSystem, user: wordUser }
        };
      })()
    );
  }

  const prompts = await promptsPromise.get(lang);
  promptsCache.set(lang, prompts);
  return prompts;
}

function applyTemplate(template, vars) {
  return template.replace(/\{\{\s*text\s*\}\}/g, vars.text);
}

function sanitizeSingleWord(text) {
  const trimmed = text.trim();
  if (!trimmed) return "";

  let core = trimmed;
  try {
    core = trimmed.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
  } catch (err) {
    core = trimmed.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, "");
  }

  return core || trimmed;
}

function isSingleWord(text) {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (/\s/.test(trimmed)) return false;
  return Boolean(sanitizeSingleWord(trimmed));
}

ensureSettingsLoaded();

browser.runtime.onInstalled.addListener(() => {
  browser.contextMenus.create({
    id: "translate-selection",
    title: "翻譯選取文字（本地 LLM）",
    contexts: ["selection"]
  });
});

browser.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "translate-selection") return;

  const text = info.selectionText || "";
  if (!text.trim()) return;

  await ensureSettingsLoaded();

  try {
    const isWord = isSingleWord(text);
    const mode = currentFastMode ? "translate" : isWord ? "word" : "translate";
    const promptText = isWord ? sanitizeSingleWord(text) : text;
    const includeExample = currentFastMode && isWord;
    const translated = await translateWithLMStudio(
      promptText,
      mode,
      currentLanguage,
      { includeExample }
    );
    browser.tabs.sendMessage(tab.id, {
      type: "SHOW_TRANSLATION",
      original: text,
      translated
    });
  } catch (err) {
    browser.tabs.sendMessage(tab.id, {
      type: "SHOW_TRANSLATION",
      original: text,
      translated: `（翻譯失敗）${String(err?.message || err)}`
    });
  }
});

browser.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "SET_LANGUAGE") {
    return setLanguage(msg.language);
  }

  if (msg?.type === "SET_FAST_MODE") {
    return setFastMode(msg.enabled);
  }

  if (msg?.type === "SPEAK_TEXT") {
    const text = String(msg.text || "").trim();
    if (!text) {
      sendResponse({ ok: false, error: "EMPTY_TEXT" });
      return true;
    }

    // Respond immediately; TTS runs in the background without blocking.
    sendResponse({ ok: true, mode: "server" });

    (async () => {
      await ensureSettingsLoaded();
      const language = normalizeLanguage(msg.language || currentLanguage);
      try {
        await synthesizeSpeech(text, language);
      } catch (err) {
        console.warn("TTS request failed:", err);
      }
    })();
    return true;
  }

  if (msg?.type !== "TRANSLATE_TEXT") return;

  const text = msg.text || "";
  if (!text.trim()) return;

  const isWord = isSingleWord(text);
  const promptText = isWord ? sanitizeSingleWord(text) : text;

  const tabId = sender?.tab?.id;
  const sendResult = async () => {
    await ensureSettingsLoaded();
    const language = normalizeLanguage(msg.language || currentLanguage);
    const fastMode =
      typeof msg.fastMode === "boolean" ? msg.fastMode : currentFastMode;
    if (msg.language) await setLanguage(language);
    if (typeof msg.fastMode === "boolean") await setFastMode(fastMode);

    const mode = fastMode ? "translate" : isWord ? "word" : "translate";
    const includeExample = fastMode && isWord;

    try {
      const translated = await translateWithLMStudio(
        promptText,
        mode,
        language,
        { includeExample }
      );
      if (tabId != null) {
        browser.tabs.sendMessage(tabId, {
          type: "SHOW_TRANSLATION",
          original: text,
          translated
        });
      }
    } catch (err) {
      if (tabId != null) {
        browser.tabs.sendMessage(tabId, {
          type: "SHOW_TRANSLATION",
          original: text,
          translated: `（翻譯失敗）${String(err?.message || err)}`
        });
      }
    }
  };

  return sendResult();
});

async function translateWithLMStudio(
  text,
  mode = "translate",
  language,
  options = {}
) {
  const prompts = await ensurePrompts(language);
  const prompt = prompts[mode] || prompts.translate;
  const system = prompt.system;
  let user = applyTemplate(prompt.user, { text });
  if (options.includeExample) {
    user = `${user}${getFastWordSuffix(language)}`;
  }

  const res = await fetch(`${LMSTUDIO_BASE}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      temperature: 0.2
    })
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${body}`);
  }

  const data = await res.json();
  const out = data?.choices?.[0]?.message?.content;
  if (!out) throw new Error("No content in response");
  return out.trim();
}
