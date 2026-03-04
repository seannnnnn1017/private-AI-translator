const ext = typeof browser !== "undefined" ? browser : chrome;

function asPromise(result, fallback) {
  return result && typeof result.then === "function" ? result : fallback();
}

function storageGet(keys) {
  try {
    return asPromise(ext.storage.local.get(keys), () =>
      new Promise((resolve, reject) => {
        ext.storage.local.get(keys, (res) => {
          const err = ext.runtime?.lastError;
          err ? reject(err) : resolve(res);
        });
      })
    );
  } catch (err) {
    return Promise.reject(err);
  }
}

function storageSet(payload) {
  try {
    return asPromise(ext.storage.local.set(payload), () =>
      new Promise((resolve, reject) => {
        ext.storage.local.set(payload, () => {
          const err = ext.runtime?.lastError;
          err ? reject(err) : resolve();
        });
      })
    );
  } catch (err) {
    return Promise.reject(err);
  }
}

const SETTINGS_KEY = "ptLanguage";
const SETTINGS_FAST_KEY = "ptFastTranslate";
const API_SETTINGS_KEY = "ptApiSettings";
const DEFAULT_LANGUAGE = "zh";
const DEFAULT_FAST_MODE = false;
const DEFAULT_API_PROVIDER = "lmstudio";
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
const API_PROVIDER_DEFAULTS = {
  lmstudio: {
    baseUrl: "http://127.0.0.1:1234",
    model: "qwen/qwen3-8b",
    apiKey: ""
  },
  openai: {
    baseUrl: "https://api.openai.com",
    model: "gpt-4.1-mini",
    apiKey: ""
  },
  gemini: {
    baseUrl: "https://generativelanguage.googleapis.com",
    model: "gemini-2.0-flash",
    apiKey: ""
  },
  custom: {
    baseUrl: "http://127.0.0.1:1234",
    model: "qwen/qwen3-8b",
    apiKey: ""
  }
};
const API_PROVIDER_VALUES = new Set(Object.keys(API_PROVIDER_DEFAULTS));

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
  },
  chat: {
    system: {
      file: "prompts/chat_system.txt",
      fallback:
        "You are an English learning coach. Answer questions about English vocabulary, grammar, tone, usage, writing, and pronunciation. Explain mainly in {{target_language}} unless the user asks for another language. Keep example sentences in English when useful. Be concise, practical, and accurate."
    },
    user: {
      file: "prompts/chat_user.txt",
      fallback: "{{question}}"
    }
  }
};

let currentLanguage = DEFAULT_LANGUAGE;
let currentFastMode = DEFAULT_FAST_MODE;
let currentApiSettings = createDefaultApiSettings();
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

function normalizeProvider(provider) {
  return API_PROVIDER_VALUES.has(provider)
    ? provider
    : DEFAULT_API_PROVIDER;
}

function trimString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function trimBaseUrl(value) {
  return trimString(value).replace(/\/+$/g, "");
}

function createDefaultApiProfiles() {
  return Object.fromEntries(
    Object.entries(API_PROVIDER_DEFAULTS).map(([provider, defaults]) => [
      provider,
      { ...defaults }
    ])
  );
}

function createDefaultApiSettings() {
  return {
    provider: DEFAULT_API_PROVIDER,
    profiles: createDefaultApiProfiles()
  };
}

function normalizeApiProfile(provider, profile) {
  const normalizedProvider = normalizeProvider(provider);
  const defaults =
    API_PROVIDER_DEFAULTS[normalizedProvider] ||
    API_PROVIDER_DEFAULTS[DEFAULT_API_PROVIDER];
  const source = profile && typeof profile === "object" ? profile : {};

  return {
    baseUrl: trimBaseUrl(source.baseUrl) || defaults.baseUrl,
    model: trimString(source.model) || defaults.model,
    apiKey: trimString(source.apiKey)
  };
}

function normalizeApiProfiles(profiles) {
  const source = profiles && typeof profiles === "object" ? profiles : {};
  return Object.fromEntries(
    Array.from(API_PROVIDER_VALUES).map((provider) => [
      provider,
      normalizeApiProfile(provider, source[provider])
    ])
  );
}

function normalizeApiSettings(settings) {
  const source = settings && typeof settings === "object" ? settings : {};
  const provider = normalizeProvider(source.provider);
  const profiles = normalizeApiProfiles(source.profiles);

  return { provider, profiles };
}

function getActiveApiProfile(settings = currentApiSettings) {
  const normalized = normalizeApiSettings(settings);
  return (
    normalized.profiles[normalized.provider] ||
    normalizeApiProfile(normalized.provider)
  );
}

async function loadSettings() {
  try {
    const stored = await storageGet([
      SETTINGS_KEY,
      SETTINGS_FAST_KEY,
      API_SETTINGS_KEY
    ]);
    currentLanguage = normalizeLanguage(stored?.[SETTINGS_KEY]);
    currentFastMode =
      typeof stored?.[SETTINGS_FAST_KEY] === "boolean"
        ? stored[SETTINGS_FAST_KEY]
        : DEFAULT_FAST_MODE;
    currentApiSettings = normalizeApiSettings(stored?.[API_SETTINGS_KEY]);
  } catch (err) {
    currentLanguage = DEFAULT_LANGUAGE;
    currentFastMode = DEFAULT_FAST_MODE;
    currentApiSettings = createDefaultApiSettings();
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
    await storageSet({ [SETTINGS_KEY]: nextLang });
  } catch (err) {
    // ignore
  }
  return nextLang;
}

async function setFastMode(enabled) {
  const nextValue = Boolean(enabled);
  currentFastMode = nextValue;
  try {
    await storageSet({ [SETTINGS_FAST_KEY]: nextValue });
  } catch (err) {
    // ignore
  }
  return nextValue;
}

async function setApiSettings(settings) {
  const nextSettings = normalizeApiSettings(settings);
  currentApiSettings = nextSettings;
  try {
    await storageSet({ [API_SETTINGS_KEY]: nextSettings });
  } catch (err) {
    // ignore
  }
  return nextSettings;
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
    const res = await fetch(ext.runtime.getURL(path));
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
        const chat = await loadPromptSet(
          config.chat || config.translate
        );

        return {
          translate,
          word,
          wordMeaning,
          wordExample,
          wordFast,
          chat
        };
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

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function boldWordInLine(line, word) {
  if (!line || !word) return line;
  if (line.includes("**")) return line;

  const target = String(word).trim();
  if (!target) return line;

  const escaped = escapeRegExp(target);
  try {
    const unicodeRe = new RegExp(
      `(^|[^\\p{L}\\p{N}])(${escaped})(?=[^\\p{L}\\p{N}]|$)`,
      "iu"
    );
    if (unicodeRe.test(line)) {
      return line.replace(unicodeRe, "$1**$2**");
    }
  } catch (err) {
    // fall back to ASCII boundary
  }

  const asciiRe = new RegExp(`(^|[^A-Za-z0-9])(${escaped})(?=[^A-Za-z0-9]|$)`, "i");
  if (asciiRe.test(line)) {
    return line.replace(asciiRe, "$1**$2**");
  }

  return line;
}

function highlightExampleText(exampleText, word) {
  const blocks = parseNumberedBlocks(exampleText);
  if (!blocks.length) return exampleText;

  return blocks
    .map((block) => {
      const line = boldWordInLine(block.line, word);
      const lines = [`${block.num}. ${line}`];
      if (block.extra.length) lines.push(...block.extra);
      return lines.join("\n");
    })
    .join("\n");
}

function highlightFastOutput(text, word) {
  const lines = String(text || "").split(/\r?\n/);
  const nonEmpty = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].trim()) nonEmpty.push(i);
  }
  if (nonEmpty.length >= 2) {
    const idx = nonEmpty[1];
    lines[idx] = boldWordInLine(lines[idx], word);
  }
  return lines.join("\n");
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
    ext.tabs.sendMessage(tabId, {
      type: "SHOW_TRANSLATION",
      original: originalText,
      translated: meaning
    });
  }

  try {
    const rawExamples = await translateWithLMStudio(
      promptText,
      "wordExample",
      language,
      { meaning }
    );
    const examples = highlightExampleText(rawExamples, promptText);

    const combined = mergeMeaningAndExamples(meaning, examples);
    if (tabId != null) {
      ext.tabs.sendMessage(tabId, {
        type: "SHOW_TRANSLATION",
        original: originalText,
        translated: combined
      });
    }
  } catch (err) {
    if (tabId != null) {
      ext.tabs.sendMessage(tabId, {
        type: "SHOW_TRANSLATION",
        original: originalText,
        translated: `${meaning}\n\n（例句生成失敗）`
      });
    }
  }
}

ensureSettingsLoaded();

ext.runtime.onInstalled.addListener(() => {
  ext.contextMenus.create({
    id: "translate-selection",
    title: "翻譯選取文字（本地 LLM）",
    contexts: ["selection"]
  });
});

ext.contextMenus.onClicked.addListener(async (info, tab) => {
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
    const resultText =
      mode === "wordFast" && isWord
        ? highlightFastOutput(translated, promptText)
        : translated;
    ext.tabs.sendMessage(tab.id, {
      type: "SHOW_TRANSLATION",
      original: text,
      translated: resultText
    });
  } catch (err) {
    ext.tabs.sendMessage(tab.id, {
      type: "SHOW_TRANSLATION",
      original: text,
      translated: `（翻譯失敗）${String(err?.message || err)}`
    });
  }
});

ext.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "SET_LANGUAGE") {
    return setLanguage(msg.language);
  }

  if (msg?.type === "SET_FAST_MODE") {
    return setFastMode(msg.enabled);
  }

  if (msg?.type === "SET_API_SETTINGS") {
    return setApiSettings(msg.settings);
  }

  if (msg?.type === "CHAT_QUERY") {
    const question = String(msg.question || "").trim();
    if (!question) {
      sendResponse({ ok: false, error: "EMPTY_QUESTION" });
      return true;
    }

    (async () => {
      try {
        await ensureSettingsLoaded();
        const language = normalizeLanguage(msg.language || currentLanguage);
        if (msg.language) await setLanguage(language);
        const history = sanitizeChatHistory(msg.history);
        const selection = sanitizeChatSelection(msg.selection);
        const answer = await answerEnglishChat(
          question,
          history,
          language,
          selection
        );
        sendResponse({ ok: true, answer });
      } catch (err) {
        sendResponse({
          ok: false,
          error: String(err?.message || err || "Chat failed")
        });
      }
    })();

    return true;
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
      const resultText =
        mode === "wordFast" && isWord
          ? highlightFastOutput(translated, promptText)
          : translated;
      if (tabId != null) {
        ext.tabs.sendMessage(tabId, {
          type: "SHOW_TRANSLATION",
          original: text,
          translated: resultText
        });
      }
    } catch (err) {
      if (tabId != null) {
        ext.tabs.sendMessage(tabId, {
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
  const targetLanguage = getTargetLanguageName(language);
  const templateVars = {
    text,
    meaning: options.meaning || "",
    context: options.context || "",
    target_language: targetLanguage
  };
  const system = applyTemplate(prompt.system, templateVars);
  const user = applyTemplate(prompt.user, templateVars);
  const messages = [
    { role: "system", content: system },
    { role: "user", content: user }
  ];
  return requestProviderCompletion(messages);
}

function sanitizeChatHistory(history) {
  if (!Array.isArray(history)) return [];

  return history
    .map((entry) => {
      const role = entry?.role === "assistant" ? "assistant" : "user";
      const text = trimString(entry?.text);
      if (!text) return null;
      return { role, text };
    })
    .filter(Boolean)
    .slice(-12);
}

function sanitizeChatSelection(selection) {
  if (!selection || typeof selection !== "object") return null;

  const text = trimString(selection.text).slice(0, 160);
  if (!text) return null;

  const context = trimString(selection.context).slice(0, 320);
  return {
    text,
    context: context && context !== text ? context : ""
  };
}

function buildSelectionAwareQuestion(question, selection) {
  const currentSelection = sanitizeChatSelection(selection);
  if (!currentSelection) return question;

  const lines = [
    "Selected text from the page:",
    currentSelection.text
  ];

  if (currentSelection.context) {
    lines.push("", "Context sentence:", currentSelection.context);
  }

  lines.push(
    "",
    'Treat the selected text above as the reference when the user says "this", "this word", "this phrase", or similar.',
    "",
    "User question:",
    question
  );

  return lines.join("\n");
}

async function answerEnglishChat(question, history, language, selection) {
  const prompts = await ensurePrompts();
  const prompt = prompts.chat || prompts.translate;
  const targetLanguage = getTargetLanguageName(language);
  const system = applyTemplate(prompt.system, {
    target_language: targetLanguage
  });
  const userQuestion = applyTemplate(prompt.user, {
    question,
    text: question,
    target_language: targetLanguage
  });
  const messages = [{ role: "system", content: system }];

  for (const item of sanitizeChatHistory(history)) {
    messages.push({
      role: item.role,
      content: item.text
    });
  }

  messages.push({
    role: "user",
    content: buildSelectionAwareQuestion(userQuestion, selection)
  });

  return requestProviderCompletion(messages);
}

function readOpenAiMessageContent(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";

  return content
    .map((part) => {
      if (typeof part === "string") return part;
      if (part?.type === "text" && typeof part.text === "string") {
        return part.text;
      }
      return "";
    })
    .join("")
    .trim();
}

function buildOpenAiCompatibleUrl(baseUrl) {
  const normalized = trimBaseUrl(baseUrl);
  if (/\/chat\/completions$/i.test(normalized)) {
    return normalized;
  }
  if (/\/v1$/i.test(normalized)) {
    return `${normalized}/chat/completions`;
  }
  return `${normalized}/v1/chat/completions`;
}

function buildGeminiUrl(baseUrl, model, apiKey) {
  const normalized = trimBaseUrl(baseUrl);
  const apiRoot = /\/v1beta$/i.test(normalized)
    ? normalized
    : `${normalized}/v1beta`;
  return (
    `${apiRoot}/models/${encodeURIComponent(model)}` +
    `:generateContent?key=${encodeURIComponent(apiKey)}`
  );
}

function getProviderErrorMessage(provider, body, fallbackStatus) {
  const message = trimString(body?.error?.message);
  if (message) return message;
  return `${provider} HTTP ${fallbackStatus}`;
}

async function requestOpenAiCompatibleCompletion(provider, profile, messages) {
  const headers = { "Content-Type": "application/json" };

  if (provider === "openai" && !profile.apiKey) {
    throw new Error("OpenAI API key is required");
  }
  if (profile.apiKey) {
    headers.Authorization = `Bearer ${profile.apiKey}`;
  }

  const res = await fetch(buildOpenAiCompatibleUrl(profile.baseUrl), {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: profile.model,
      messages,
      temperature: 0.2
    })
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message = getProviderErrorMessage(provider, data, res.status);
    throw new Error(message);
  }

  const out = readOpenAiMessageContent(
    data?.choices?.[0]?.message?.content
  );
  if (!out) throw new Error("No content in response");
  return out.trim();
}

function normalizeGeminiModel(model) {
  return trimString(model).replace(/^models\//, "") || "gemini-2.0-flash";
}

async function requestGeminiCompletion(profile, messages) {
  if (!profile.apiKey) {
    throw new Error("Gemini API key is required");
  }

  const systemMessage = messages.find((msg) => msg.role === "system");
  const userText = messages
    .filter((msg) => msg.role !== "system")
    .map((msg) =>
      msg.role === "user"
        ? msg.content
        : `${msg.role}:\n${msg.content}`
    )
    .join("\n\n")
    .trim();

  const body = {
    contents: [
      {
        role: "user",
        parts: [{ text: userText }]
      }
    ],
    generationConfig: {
      temperature: 0.2
    }
  };

  if (systemMessage?.content) {
    body.systemInstruction = {
      parts: [{ text: systemMessage.content }]
    };
  }

  const model = normalizeGeminiModel(profile.model);
  const url = buildGeminiUrl(profile.baseUrl, model, profile.apiKey);

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message = getProviderErrorMessage("Gemini", data, res.status);
    throw new Error(message);
  }

  const out = (data?.candidates?.[0]?.content?.parts || [])
    .map((part) => (typeof part?.text === "string" ? part.text : ""))
    .join("")
    .trim();

  if (!out) {
    const finishReason = trimString(data?.candidates?.[0]?.finishReason);
    if (finishReason) {
      throw new Error(`Gemini returned no text (${finishReason})`);
    }
    throw new Error("No content in Gemini response");
  }

  return out;
}

async function requestProviderCompletion(messages) {
  const settings = normalizeApiSettings(currentApiSettings);
  const provider = settings.provider;
  const profile = getActiveApiProfile(settings);

  if (provider === "gemini") {
    return requestGeminiCompletion(profile, messages);
  }

  return requestOpenAiCompatibleCompletion(provider, profile, messages);
}
