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
const LANGUAGE_PROMPT_NAMES = {
  zh: "Traditional Chinese",
  ja: "Japanese",
  en: "English"
};
const LANGUAGE_VALUES = new Set(Object.keys(LANGUAGE_LABELS));

const TTS_ENDPOINT = "http://127.0.0.1:5005/tts";

const PROMPT_CONFIG = {
  translate: {
    system: {
      file: "prompts/translate_system.txt",
      fallback:
        "You are a professional translator. Translate accurately and naturally into {{target_language}}. Keep proper nouns and technical terms."
    },
    user: {
      file: "prompts/translate_user.txt",
      fallback: "Translate into {{target_language}}:\n\n{{text}}"
    }
  },
  word: {
    system: {
      file: "prompts/word_system.txt",
      fallback:
        "You are a bilingual lexicographer and IELTS tutor. Write explanations in {{target_language}}. Keep the target word and example sentences in English. Use Markdown with **bold** section titles."
    },
    user: {
      file: "prompts/word_user.txt",
      fallback: `Word: {{text}}

Output 1-3 common senses (do not force 3; avoid rare/archaic). If proper noun/abbr/non-word, briefly note likely meaning.
Use POS abbreviations: N., V., Adj., Adv., Prep., Conj., Pron., Det., Interj.
Each sense:
1. **Meaning in {{target_language}}** (N.)
   IELTS-style English example with **word**
   Translation in {{target_language}}
2. **Meaning in {{target_language}}** (N.)
   IELTS-style English example with **word**
   Translation in {{target_language}}
3. **Meaning in {{target_language}}** (N.)
   IELTS-style English example with **word**
   Translation in {{target_language}}`
    }
  },
  wordMeaning: {
    system: {
      file: "prompts/word_system.txt",
      fallback:
        "You are a bilingual lexicographer and IELTS tutor. Write explanations in {{target_language}}. Keep the target word and example sentences in English. Use Markdown with **bold** section titles."
    },
    user: {
      file: "prompts/word_meaning.txt",
      fallback: `Word: {{text}}
Context sentence: {{context}}

Stage 1: output only meanings + POS. No examples.
If a context sentence is provided, prioritize meanings that fit the context.
Use POS abbreviations: N., V., Adj., Adv., Prep., Conj., Pron., Det., Interj.
Use numbered lines; one meaning per line. No extra text.

Format:
1. Meaning in {{target_language}} (N.)`
    }
  },
  wordExample: {
    system: {
      file: "prompts/word_system.txt",
      fallback:
        "You are a bilingual lexicographer and IELTS tutor. Write explanations in {{target_language}}. Keep the target word and example sentences in English. Use Markdown with **bold** section titles."
    },
    user: {
      file: "prompts/word_example.txt",
      fallback: `Word: {{text}}
Meanings:
{{meaning}}

For each meaning (same order), write one IELTS-style English example sentence with **word**, and a translation in {{target_language}}.
Output only the example section:
1. English example
   Translation in {{target_language}}
2. English example
   Translation in {{target_language}}
3. English example
   Translation in {{target_language}}`
    }
  },
  wordFast: {
    system: {
      file: "prompts/word_system.txt",
      fallback:
        "You are a bilingual lexicographer and IELTS tutor. Write explanations in {{target_language}}. Keep the target word and example sentences in English. Use Markdown with **bold** section titles."
    },
    user: {
      file: "prompts/word_fast.txt",
      fallback: `Target word: {{text}}
Context sentence: {{context}}

Translate only the target word (do not translate the whole sentence). Choose the meaning that best fits the context.
Use POS abbreviations: N., V., Adj., Adv., Prep., Conj., Pron., Det., Interj.
Add one English example sentence with **word** and a translation in {{target_language}}.
No extra text.

Format:
**Meaning in {{target_language}}** (N.)
English example sentence with **word**
Translation in {{target_language}}`
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

function getTargetLanguageName(lang) {
  const normalized = normalizeLanguage(lang);
  return (
    LANGUAGE_PROMPT_NAMES[normalized] ||
    LANGUAGE_PROMPT_NAMES[DEFAULT_LANGUAGE]
  );
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

async function loadPromptSet(config) {
  const [system, user] = await Promise.all([
    loadPromptFile(config.system.file, config.system.fallback),
    loadPromptFile(config.user.file, config.user.fallback)
  ]);

  return { system, user };
}

async function ensurePrompts() {
  const key = "default";
  if (promptsCache.has(key)) return promptsCache.get(key);

  if (!promptsPromise.has(key)) {
    const config = PROMPT_CONFIG;
    promptsPromise.set(
      key,
      (async () => {
        const translate = await loadPromptSet(config.translate);
        const word = await loadPromptSet(config.word);
        const wordMeaning = await loadPromptSet(
          config.wordMeaning || config.word
        );
        const wordExample = await loadPromptSet(
          config.wordExample || config.word
        );
        const wordFast = await loadPromptSet(
          config.wordFast || config.word
        );

        return { translate, word, wordMeaning, wordExample, wordFast };
      })()
    );
  }

  const prompts = await promptsPromise.get(key);
  promptsCache.set(key, prompts);
  return prompts;
}

function applyTemplate(template, vars) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    const value = vars[key];
    return value == null ? "" : String(value);
  });
}

function parseNumberedBlocks(text) {
  const lines = String(text || "").split(/\r?\n/);
  const blocks = [];
  let current = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const match = line.match(/^(\d+)[.)]\s*(.+)$/);
    if (match) {
      if (current) blocks.push(current);
      current = { num: match[1], line: match[2], extra: [] };
      continue;
    }
    if (current) current.extra.push(line);
  }

  if (current) blocks.push(current);
  return blocks;
}

function limitMeaningList(text, maxItems = 3) {
  const blocks = parseNumberedBlocks(text);
  if (blocks.length) {
    const limited = blocks.slice(0, maxItems).map((block, index) => ({
      num: String(index + 1),
      line: block.line
    }));
    return limited.map((block) => `${block.num}. ${block.line}`).join("\n");
  }

  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, maxItems);

  return lines.join("\n");
}

function mergeMeaningAndExamples(meaningText, exampleText) {
  const meanings = parseNumberedBlocks(meaningText);
  if (!meanings.length) return `${meaningText}\n\n${exampleText}`.trim();

  const examples = parseNumberedBlocks(exampleText);
  const exampleMap = new Map(examples.map((b) => [b.num, b]));

  const blocks = meanings.map((meaning) => {
    const lines = [`${meaning.num}. ${meaning.line}`];
    const ex = exampleMap.get(meaning.num);
    if (ex) {
      lines.push(ex.line);
      if (ex.extra.length) lines.push(...ex.extra);
    }
    return lines.join("\n");
  });

  return blocks.join("\n\n");
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

async function sendWordTwoStage(
  tabId,
  originalText,
  promptText,
  language,
  context
) {
  const rawMeaning = await translateWithLMStudio(
    promptText,
    "wordMeaning",
    language,
    { context }
  );
  const meaning = limitMeaningList(rawMeaning, 3);

  if (tabId != null) {
    browser.tabs.sendMessage(tabId, {
      type: "SHOW_TRANSLATION",
      original: originalText,
      translated: meaning
    });
  }

  try {
    const examples = await translateWithLMStudio(
      promptText,
      "wordExample",
      language,
      { meaning }
    );

    const combined = mergeMeaningAndExamples(meaning, examples);
    if (tabId != null) {
      browser.tabs.sendMessage(tabId, {
        type: "SHOW_TRANSLATION",
        original: originalText,
        translated: combined
      });
    }
  } catch (err) {
    if (tabId != null) {
      browser.tabs.sendMessage(tabId, {
        type: "SHOW_TRANSLATION",
        original: originalText,
        translated: `${meaning}\n\n（例句生成失敗）`
      });
    }
  }
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
    const mode = currentFastMode
      ? isWord
        ? "wordFast"
        : "translate"
      : isWord
        ? "word"
        : "translate";
    const promptText = isWord ? sanitizeSingleWord(text) : text;
    const context = "";
    if (isWord && !currentFastMode) {
      await sendWordTwoStage(
        tab.id,
        text,
        promptText,
        currentLanguage,
        context
      );
      return;
    }
    const translated = await translateWithLMStudio(
      promptText,
      mode,
      currentLanguage,
      { context }
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
  const context = isWord ? String(msg.context || "").trim() : "";

  const tabId = sender?.tab?.id;
  const sendResult = async () => {
    await ensureSettingsLoaded();
    const language = normalizeLanguage(msg.language || currentLanguage);
    const fastMode =
      typeof msg.fastMode === "boolean" ? msg.fastMode : currentFastMode;
    if (msg.language) await setLanguage(language);
    if (typeof msg.fastMode === "boolean") await setFastMode(fastMode);

    const mode = fastMode
      ? isWord
        ? "wordFast"
        : "translate"
      : isWord
        ? "word"
        : "translate";

    try {
      if (isWord && !fastMode) {
        await sendWordTwoStage(tabId, text, promptText, language, context);
        return;
      }
      const translated = await translateWithLMStudio(
        promptText,
        mode,
        language,
        { context }
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
  const prompts = await ensurePrompts();
  const prompt = prompts[mode] || prompts.translate;
  const system = prompt.system;
  const targetLanguage = getTargetLanguageName(language);
  let user = applyTemplate(prompt.user, {
    text,
    meaning: options.meaning || "",
    context: options.context || "",
    target_language: targetLanguage
  });
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
