if (!currentApiSettings) {
  currentApiSettings = createDefaultApiSettings();
}

function normalizeLanguage(lang) {
  if (!lang || typeof lang !== "string") return DEFAULT_LANGUAGE;
  const trimmed = lang.trim();
  const migrated = { zh: "Traditional Chinese", ja: "Japanese", en: "English" }[trimmed];
  return migrated || (trimmed ? trimmed : DEFAULT_LANGUAGE);
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

function updateActiveApiProfile(patch) {
  const provider = normalizeProvider(currentApiSettings.provider);
  const profiles = { ...currentApiSettings.profiles };
  profiles[provider] = normalizeApiProfile(provider, {
    ...profiles[provider],
    ...patch
  });
  currentApiSettings = {
    provider,
    profiles
  };
}

function syncApiInputsFromState() {
  const settings = normalizeApiSettings(currentApiSettings);
  currentApiSettings = settings;
  const profile = getActiveApiProfile(settings);

  if (providerSelect) providerSelect.value = settings.provider;
  if (baseUrlInput) baseUrlInput.value = profile.baseUrl;
  if (modelInput) modelInput.value = profile.model;
  if (apiKeyInput) apiKeyInput.value = profile.apiKey;
}

function setApiSectionExpanded(expanded) {
  apiSectionExpanded = Boolean(expanded);

  if (apiSectionBody) {
    apiSectionBody.style.display = apiSectionExpanded ? "block" : "none";
  }

  if (apiSectionToggle) {
    apiSectionToggle.setAttribute(
      "aria-expanded",
      apiSectionExpanded ? "true" : "false"
    );
  }

  if (apiSectionChevron) {
    apiSectionChevron.textContent = apiSectionExpanded ? "▾" : "▸";
  }
}

function ensureSettingsWidget() {
  if (settingsWidget) return settingsWidget;

  settingsWidget = document.createElement("div");
  settingsWidget.style.cssText = `
    position: fixed;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
    z-index: 2147483647;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  `;

  const toggle = document.createElement("button");
  settingsToggle = toggle;
  toggle.type = "button";
  toggle.textContent = "Lang";
  toggle.style.cssText = `
    display: block;
    width: 44px;
    padding: 10px 6px;
    border: none;
    border-radius: 999px;
    background: rgba(46, 46, 46, 0.75);
    color: #f5f5f5;
    border: 1px solid rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(12px) saturate(120%);
    -webkit-backdrop-filter: blur(12px) saturate(120%);
    font-size: 12px;
    line-height: 1;
    box-shadow: 0 8px 20px rgba(0,0,0,.3);
    cursor: pointer;
  `;

  settingsPanel = document.createElement("div");
  settingsPanel.style.cssText = `
    display: none;
    margin-top: 8px;
    background: rgba(46, 46, 46, 0.72);
    color: #f5f5f5;
    border: 1px solid rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(14px) saturate(120%);
    -webkit-backdrop-filter: blur(14px) saturate(120%);
    padding: 10px 12px;
    border-radius: 12px;
    box-shadow: 0 10px 30px rgba(0,0,0,.35);
    width: 280px;
  `;

  const title = document.createElement("div");
  settingsTitle = title;
  title.textContent = "Translation Language";
  title.style.cssText =
    "font-weight: 700; font-size: 12px; margin-bottom: 8px; color: #ff6b3d;";

  const pillsContainer = document.createElement("div");
  languagePillsContainer = pillsContainer;
  pillsContainer.style.cssText =
    "display:flex;flex-wrap:wrap;gap:6px;margin-bottom:4px;min-height:28px;max-height:96px;overflow-y:auto;";

  const addRow = document.createElement("div");
  addRow.style.cssText = "display:flex;gap:6px;align-items:center;margin-bottom:2px;";

  const addInput = document.createElement("input");
  languageAddInput = addInput;
  addInput.type = "text";
  addInput.placeholder = "Add a language...";
  addInput.spellcheck = false;
  addInput.autocomplete = "off";
  addInput.style.cssText = `
    flex: 1;
    padding: 5px 8px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(26, 26, 26, 0.7);
    color: #f5f5f5;
    font-size: 12px;
    box-sizing: border-box;
  `;

  const addBtn = document.createElement("button");
  languageAddBtn = addBtn;
  addBtn.type = "button";
  addBtn.textContent = "+";
  addBtn.style.cssText = `
    padding: 5px 10px;
    border-radius: 8px;
    border: none;
    background: #ff6b3d;
    color: #fff;
    font-size: 14px;
    cursor: pointer;
    flex-shrink: 0;
    line-height: 1;
  `;

  addRow.appendChild(addInput);
  addRow.appendChild(addBtn);

  const fastRow = document.createElement("label");
  fastRow.style.cssText =
    "display:flex;align-items:center;gap:8px;margin-top:10px;font-size:12px;cursor:pointer;";

  fastModeToggle = document.createElement("input");
  fastModeToggle.type = "checkbox";
  fastModeToggle.style.cssText = "cursor:pointer; accent-color:#ff6b3d;";

  const fastLabel = document.createElement("span");
  fastModeLabel = fastLabel;
  fastLabel.textContent = "Fast Translate";

  fastRow.appendChild(fastModeToggle);
  fastRow.appendChild(fastLabel);

  const divider = document.createElement("div");
  divider.style.cssText =
    "height:1px;margin:12px 0;background:rgba(255,255,255,.08);";

  const apiHeader = document.createElement("button");
  apiSectionToggle = apiHeader;
  apiHeader.type = "button";
  apiHeader.style.cssText = `
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 0;
    border: none;
    background: transparent;
    cursor: pointer;
    color: #f5f5f5;
  `;

  const apiHeaderText = document.createElement("span");
  apiTitle = apiHeaderText;
  apiHeaderText.textContent = "Model API";
  apiHeaderText.style.cssText =
    "font-weight:700;font-size:12px;color:#ff6b3d;text-align:left;";

  const apiHeaderChevron = document.createElement("span");
  apiSectionChevron = apiHeaderChevron;
  apiHeaderChevron.textContent = "▸";
  apiHeaderChevron.style.cssText =
    "font-size:12px;line-height:1;color:rgba(255,255,255,.8);";

  apiHeader.appendChild(apiHeaderText);
  apiHeader.appendChild(apiHeaderChevron);

  const apiFields = document.createElement("div");
  apiSectionBody = apiFields;
  apiFields.style.cssText = "display:none;padding-top:8px;";

  const providerText = document.createElement("div");
  providerLabel = providerText;
  providerText.textContent = "Provider";
  providerText.style.cssText =
    "font-size:11px;opacity:.82;margin-bottom:4px;";

  providerSelect = document.createElement("select");
  providerSelect.style.cssText = `
    width: 100%;
    padding: 6px 8px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(26, 26, 26, 0.7);
    color: #f5f5f5;
    font-size: 12px;
    box-sizing: border-box;
  `;

  Array.from(API_PROVIDER_VALUES).forEach((provider) => {
    const option = document.createElement("option");
    option.value = provider;
    option.textContent = provider;
    providerSelect.appendChild(option);
  });

  const baseUrlText = document.createElement("div");
  baseUrlLabel = baseUrlText;
  baseUrlText.textContent = "API Base URL";
  baseUrlText.style.cssText =
    "font-size:11px;opacity:.82;margin:10px 0 4px;";

  baseUrlInput = document.createElement("input");
  baseUrlInput.type = "url";
  baseUrlInput.spellcheck = false;
  baseUrlInput.autocomplete = "off";
  baseUrlInput.style.cssText = `
    width: 100%;
    padding: 6px 8px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(26, 26, 26, 0.7);
    color: #f5f5f5;
    font-size: 12px;
    box-sizing: border-box;
  `;

  const modelText = document.createElement("div");
  modelLabel = modelText;
  modelText.textContent = "Model";
  modelText.style.cssText =
    "font-size:11px;opacity:.82;margin:10px 0 4px;";

  modelInput = document.createElement("input");
  modelInput.type = "text";
  modelInput.spellcheck = false;
  modelInput.autocomplete = "off";
  modelInput.style.cssText = `
    width: 100%;
    padding: 6px 8px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(26, 26, 26, 0.7);
    color: #f5f5f5;
    font-size: 12px;
    box-sizing: border-box;
  `;

  const apiKeyText = document.createElement("div");
  apiKeyLabel = apiKeyText;
  apiKeyText.textContent = "API Key";
  apiKeyText.style.cssText =
    "font-size:11px;opacity:.82;margin:10px 0 4px;";

  apiKeyInput = document.createElement("input");
  apiKeyInput.type = "password";
  apiKeyInput.spellcheck = false;
  apiKeyInput.autocomplete = "off";
  apiKeyInput.style.cssText = `
    width: 100%;
    padding: 6px 8px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(26, 26, 26, 0.7);
    color: #f5f5f5;
    font-size: 12px;
    box-sizing: border-box;
  `;

  const apiHintText = document.createElement("div");
  apiHint = apiHintText;
  apiHintText.style.cssText =
    "margin-top:8px;font-size:11px;line-height:1.4;opacity:.74;";

  settingsPanel.appendChild(title);
  settingsPanel.appendChild(pillsContainer);
  settingsPanel.appendChild(addRow);
  settingsPanel.appendChild(fastRow);
  settingsPanel.appendChild(divider);
  settingsPanel.appendChild(apiHeader);
  apiFields.appendChild(providerText);
  apiFields.appendChild(providerSelect);
  apiFields.appendChild(baseUrlText);
  apiFields.appendChild(baseUrlInput);
  apiFields.appendChild(modelText);
  apiFields.appendChild(modelInput);
  apiFields.appendChild(apiKeyText);
  apiFields.appendChild(apiKeyInput);
  apiFields.appendChild(apiHintText);
  settingsPanel.appendChild(apiFields);
  settingsWidget.appendChild(toggle);
  settingsWidget.appendChild(settingsPanel);
  document.documentElement.appendChild(settingsWidget);

  toggle.addEventListener("click", (e) => {
    e.preventDefault();
    if (settingsDragMoved) {
      settingsDragMoved = false;
      return;
    }
    const isOpening = settingsPanel.style.display === "none";
    settingsPanel.style.display = isOpening ? "block" : "none";
    if (isOpening) {
      setApiSectionExpanded(false);
    }
  });

  fastModeToggle.addEventListener("change", () => {
    const nextValue = Boolean(fastModeToggle.checked);
    currentFastMode = nextValue;
    saveFastModeSetting(nextValue);
  });

  apiSectionToggle.addEventListener("click", (e) => {
    e.preventDefault();
    setApiSectionExpanded(!apiSectionExpanded);
  });

  providerSelect.addEventListener("change", () => {
    currentApiSettings = normalizeApiSettings({
      ...currentApiSettings,
      provider: providerSelect.value
    });
    syncApiInputsFromState();
    updateSettingsPanelText();
    saveApiSettings();
  });

  baseUrlInput.addEventListener("change", () => {
    updateActiveApiProfile({ baseUrl: baseUrlInput.value });
    syncApiInputsFromState();
    saveApiSettings();
  });

  modelInput.addEventListener("change", () => {
    updateActiveApiProfile({ model: modelInput.value });
    syncApiInputsFromState();
    saveApiSettings();
  });

  apiKeyInput.addEventListener("change", () => {
    updateActiveApiProfile({ apiKey: apiKeyInput.value });
    syncApiInputsFromState();
    saveApiSettings();
  });

  document.addEventListener(
    "click",
    (e) => {
      if (!settingsWidget.contains(e.target)) {
        settingsPanel.style.display = "none";
        setApiSectionExpanded(false);
      }
    },
    true
  );

  enableSettingsDrag(toggle, settingsWidget);

  addBtn.addEventListener("click", () => {
    const val = addInput.value.trim();
    if (val) {
      addLanguage(val);
      addInput.value = "";
    }
  });

  addInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const val = addInput.value.trim();
      if (val) {
        addLanguage(val);
        addInput.value = "";
      }
    }
  });

  addInput.addEventListener("focus", () => {
    addInput.style.outline = "2px solid rgba(255,107,61,.6)";
    addInput.style.outlineOffset = "0";
  });
  addInput.addEventListener("blur", () => {
    addInput.style.outline = "";
    addInput.style.outlineOffset = "";
  });

  syncApiInputsFromState();
  setApiSectionExpanded(false);
  updateSettingsPanelText();
  return settingsWidget;
}

function renderLanguagePills() {
  if (!languagePillsContainer) return;
  languagePillsContainer.innerHTML = "";
  languageList.forEach((lang) => {
    const pill = document.createElement("button");
    pill.type = "button";
    const isSelected = lang === currentLanguage;
    const state = languagePillStates[lang];

    pill.style.cssText = `
      display: inline-flex; align-items: center; gap: 5px;
      padding: 4px 10px; border-radius: 999px;
      border: 1px solid ${isSelected ? "#ff6b3d" : "rgba(255,255,255,.12)"};
      background: ${isSelected ? "#ff6b3d" : "rgba(255,255,255,.06)"};
      color: ${isSelected ? "#fff" : "#f5f5f5"};
      font-size: 12px; cursor: pointer; line-height: 1.4;
      opacity: ${state === "pending" ? "0.5" : "1"};
    `;

    const nameSpan = document.createElement("span");
    nameSpan.textContent =
      lang + (state === "pending" ? " ···" : state === "failed" ? " ⚠" : "");
    pill.appendChild(nameSpan);

    if (languageList.length > 1) {
      const removeBtn = document.createElement("span");
      removeBtn.textContent = "×";
      removeBtn.style.cssText =
        "font-size:10px;opacity:.7;margin-left:2px;line-height:1;";
      removeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        removeLanguage(lang);
      });
      pill.appendChild(removeBtn);
    }

    pill.addEventListener("click", () => {
      if (state === "failed") {
        triggerLabelGeneration(lang);
        return;
      }
      if (state === "pending") return;
      if (lang === currentLanguage) return;
      currentLanguage = lang;
      saveLanguageSetting(lang);
      updateSettingsPanelText();
      renderLanguagePills();
      if (!PRESET_LANGUAGES[lang] && !labelCache[lang]) {
        triggerLabelGeneration(lang);
      }
    });

    languagePillsContainer.appendChild(pill);
  });
}

function addLanguage(rawInput) {
  const trimmed = rawInput.trim();
  if (!trimmed) return;
  const lang = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  if (languageList.includes(lang)) {
    if (lang !== currentLanguage) {
      currentLanguage = lang;
      saveLanguageSetting(lang);
      updateSettingsPanelText();
      renderLanguagePills();
    }
    return;
  }
  languageList = [...languageList, lang];
  currentLanguage = lang;
  saveLanguageSetting(lang);
  updateSettingsPanelText();
  renderLanguagePills();
  if (!PRESET_LANGUAGES[lang] && !labelCache[lang]) {
    triggerLabelGeneration(lang);
  }
}

function removeLanguage(lang) {
  if (languageList.length <= 1) return;
  languageList = languageList.filter((l) => l !== lang);
  delete languagePillStates[lang];
  if (currentLanguage === lang) {
    currentLanguage = languageList[0];
    saveLanguageSetting(currentLanguage);
    updateSettingsPanelText();
  } else {
    storageSet({ [LANGUAGE_LIST_KEY]: languageList }).catch(() => {});
  }
  renderLanguagePills();
}

async function triggerLabelGeneration(lang) {
  languagePillStates[lang] = "pending";
  renderLanguagePills();
  try {
    const res = await sendMessage({ type: "GENERATE_LABELS", language: lang });
    if (!res || !res.ok) throw new Error(res?.error || "Generation failed");
    labelCache[lang] = res.labels;
    await storageSet({ [LABEL_CACHE_KEY]: labelCache });
    delete languagePillStates[lang];
    if (currentLanguage === lang) updateSettingsPanelText();
    renderLanguagePills();
  } catch (err) {
    languagePillStates[lang] = "failed";
    renderLanguagePills();
  }
}

function notifyLanguage(lang) {
  try {
    sendMessage({
      type: "SET_LANGUAGE",
      language: lang
    });
  } catch (err) {
    // ignore
  }
}

function notifyFastMode(enabled) {
  try {
    sendMessage({
      type: "SET_FAST_MODE",
      enabled: Boolean(enabled)
    });
  } catch (err) {
    // ignore
  }
}

function notifyApiSettings(settings) {
  try {
    sendMessage({
      type: "SET_API_SETTINGS",
      settings
    });
  } catch (err) {
    // ignore
  }
}

async function saveLanguageSetting(lang) {
  try {
    await storageSet({ [SETTINGS_KEY]: lang, [LANGUAGE_LIST_KEY]: languageList });
  } catch (err) {
    // ignore
  }
  notifyLanguage(lang);
}

async function saveFastModeSetting(enabled) {
  try {
    await storageSet({ [SETTINGS_FAST_KEY]: Boolean(enabled) });
  } catch (err) {
    // ignore
  }
  notifyFastMode(Boolean(enabled));
}

async function saveApiSettings() {
  const nextSettings = normalizeApiSettings(currentApiSettings);
  currentApiSettings = nextSettings;
  try {
    await storageSet({ [API_SETTINGS_KEY]: nextSettings });
  } catch (err) {
    // ignore
  }
  notifyApiSettings(nextSettings);
}

async function initLanguageSettings() {
  ensureSettingsWidget();
  try {
    const stored = await storageGet([
      SETTINGS_KEY,
      SETTINGS_FAST_KEY,
      API_SETTINGS_KEY,
      LANGUAGE_LIST_KEY,
      LABEL_CACHE_KEY
    ]);
    const nextLang = normalizeLanguage(stored?.[SETTINGS_KEY]);
    currentLanguage = nextLang;
    currentFastMode =
      typeof stored?.[SETTINGS_FAST_KEY] === "boolean"
        ? stored[SETTINGS_FAST_KEY]
        : DEFAULT_FAST_MODE;
    currentApiSettings = normalizeApiSettings(stored?.[API_SETTINGS_KEY]);

    const storedList = stored?.[LANGUAGE_LIST_KEY];
    if (Array.isArray(storedList) && storedList.length) {
      languageList = storedList;
    } else {
      languageList = [...DEFAULT_LANGUAGE_LIST];
    }
    if (!languageList.includes(currentLanguage)) {
      languageList = [currentLanguage, ...languageList];
    }

    const storedCache = stored?.[LABEL_CACHE_KEY];
    if (storedCache && typeof storedCache === "object") {
      labelCache = storedCache;
    }
  } catch (err) {
    currentLanguage = DEFAULT_LANGUAGE;
    currentFastMode = DEFAULT_FAST_MODE;
    currentApiSettings = createDefaultApiSettings();
    languageList = [...DEFAULT_LANGUAGE_LIST];
    labelCache = {};
  }

  if (fastModeToggle) fastModeToggle.checked = currentFastMode;
  syncApiInputsFromState();
  updateSettingsPanelText();
  renderLanguagePills();

  if (!PRESET_LANGUAGES[currentLanguage] && !labelCache[currentLanguage]) {
    triggerLabelGeneration(currentLanguage);
  }

  notifyLanguage(currentLanguage);
  notifyFastMode(currentFastMode);
  notifyApiSettings(currentApiSettings);
}

function updateSettingsPanelText() {
  const labels = getUiLabels();
  const preset = PRESET_LANGUAGES[currentLanguage];
  const providerLabels = preset
    ? API_PROVIDER_OPTION_LABELS[preset.uiKey]
    : API_PROVIDER_OPTION_LABELS.en;

  if (settingsToggle) settingsToggle.textContent = getLanguageBadge(currentLanguage);
  if (settingsTitle) settingsTitle.textContent = labels.title;
  if (fastModeLabel) fastModeLabel.textContent = labels.fast;
  if (apiTitle) apiTitle.textContent = labels.providerTitle || UI_LABELS.en.providerTitle;
  if (providerLabel) providerLabel.textContent = labels.provider || UI_LABELS.en.provider;
  if (baseUrlLabel) baseUrlLabel.textContent = labels.baseUrl || UI_LABELS.en.baseUrl;
  if (modelLabel) modelLabel.textContent = labels.model || UI_LABELS.en.model;
  if (apiKeyLabel) apiKeyLabel.textContent = labels.apiKey || UI_LABELS.en.apiKey;
  if (apiHint) apiHint.textContent = labels.apiHint || UI_LABELS.en.apiHint;
  if (chatLauncherInput) chatLauncherInput.placeholder = labels.chatLauncherPlaceholder;
  if (chatLauncherHint) chatLauncherHint.textContent = labels.chatLauncherHint;
  if (chatPanelTitle) chatPanelTitle.textContent = labels.chatTitle;
  if (chatPanelShortcut) chatPanelShortcut.textContent = CHAT_SHORTCUT_LABEL;
  if (chatPanelInput) chatPanelInput.placeholder = labels.chatInputPlaceholder;
  if (chatPanelMinimize) chatPanelMinimize.setAttribute("aria-label", labels.minimize);
  if (chatPanelClose) chatPanelClose.setAttribute("aria-label", labels.chatReset);
  if (chatTrigger) chatTrigger.children[1].textContent = labels.chatTriggerLabel;
  if (translateBtn) translateBtn.textContent = labels.translateBtn;

  if (providerSelect && providerLabels) {
    Array.from(providerSelect.options).forEach((opt) => {
      const nextLabel = providerLabels[opt.value];
      if (nextLabel) opt.textContent = nextLabel;
    });
  }

  if (chatPanelMessages && (chatPending || !chatHistory.length)) {
    renderChatHistory();
  }

  if (box) {
    const titleEl = box.querySelector("#pt-translation-title");
    if (titleEl) titleEl.textContent = labels.translationTitle;
    const closeBtn = box.querySelector("#pt-close");
    if (closeBtn) closeBtn.setAttribute("aria-label", labels.close);
    const playBtn = box.querySelector("#pt-play");
    if (playBtn) {
      playBtn.dataset.label = labels.play;
      if (!playBtn.disabled) playBtn.textContent = labels.play;
    }
  }
}

function enableSettingsDrag(handle, target) {
  if (!handle || !target) return;

  handle.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;

    const rect = target.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    let moved = false;

    const onMove = (ev) => {
      if (!moved) {
        const delta = Math.abs(ev.clientY - e.clientY);
        if (delta < 3) return;
        moved = true;
      }

      const nextTop = clamp(
        ev.clientY - offsetY,
        BOX_MARGIN,
        window.innerHeight - rect.height - BOX_MARGIN
      );
      target.style.top = `${nextTop}px`;
      target.style.transform = "translateY(0)";
    };

    const onUp = () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
      settingsDragMoved = moved;
    };

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
  });
}
