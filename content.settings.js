if (!currentApiSettings) {
  currentApiSettings = createDefaultApiSettings();
}

function normalizeLanguage(lang) {
  return LANGUAGE_VALUES.has(lang) ? lang : DEFAULT_LANGUAGE;
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

  settingsSelect = document.createElement("select");
  settingsSelect.style.cssText = `
    width: 100%;
    padding: 6px 8px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(26, 26, 26, 0.7);
    color: #f5f5f5;
    font-size: 12px;
    box-sizing: border-box;
  `;

  LANGUAGE_OPTIONS.forEach((opt) => {
    const option = document.createElement("option");
    option.value = opt.value;
    option.textContent = opt.label;
    settingsSelect.appendChild(option);
  });

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
  settingsPanel.appendChild(settingsSelect);
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

  settingsSelect.addEventListener("change", () => {
    const nextLang = normalizeLanguage(settingsSelect.value);
    currentLanguage = nextLang;
    updateSettingsPanelText();
    saveLanguageSetting(nextLang);
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
  syncApiInputsFromState();
  setApiSectionExpanded(false);
  updateSettingsPanelText();
  return settingsWidget;
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
    await storageSet({ [SETTINGS_KEY]: lang });
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
      API_SETTINGS_KEY
    ]);
    const nextLang = normalizeLanguage(stored?.[SETTINGS_KEY]);
    currentLanguage = nextLang;
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

  if (settingsSelect) settingsSelect.value = currentLanguage;
  if (fastModeToggle) fastModeToggle.checked = currentFastMode;
  syncApiInputsFromState();
  updateSettingsPanelText();
  notifyLanguage(currentLanguage);
  notifyFastMode(currentFastMode);
  notifyApiSettings(currentApiSettings);
}

function updateSettingsPanelText() {
  const lang = normalizeLanguage(currentLanguage);
  const labels = UI_LABELS[lang] || UI_LABELS[DEFAULT_LANGUAGE];
  const optionLabels =
    LANGUAGE_OPTION_LABELS[lang] || LANGUAGE_OPTION_LABELS[DEFAULT_LANGUAGE];
  const providerLabels =
    API_PROVIDER_OPTION_LABELS[lang] ||
    API_PROVIDER_OPTION_LABELS[DEFAULT_LANGUAGE];

  if (settingsToggle) settingsToggle.textContent = labels.toggle;
  if (settingsTitle) settingsTitle.textContent = labels.title;
  if (fastModeLabel) fastModeLabel.textContent = labels.fast;
  if (apiTitle) apiTitle.textContent = labels.providerTitle;
  if (providerLabel) providerLabel.textContent = labels.provider;
  if (baseUrlLabel) baseUrlLabel.textContent = labels.baseUrl;
  if (modelLabel) modelLabel.textContent = labels.model;
  if (apiKeyLabel) apiKeyLabel.textContent = labels.apiKey;
  if (apiHint) apiHint.textContent = labels.apiHint;
  if (chatLauncherInput) {
    chatLauncherInput.placeholder = labels.chatLauncherPlaceholder;
  }
  if (chatLauncherHint) chatLauncherHint.textContent = labels.chatLauncherHint;
  if (chatPanelTitle) chatPanelTitle.textContent = labels.chatTitle;
  if (chatPanelShortcut) chatPanelShortcut.textContent = CHAT_SHORTCUT_LABEL;
  if (chatPanelInput) chatPanelInput.placeholder = labels.chatInputPlaceholder;
  if (chatPanelMinimize) {
    chatPanelMinimize.setAttribute("aria-label", labels.minimize);
  }
  if (chatPanelClose) {
    chatPanelClose.setAttribute("aria-label", labels.chatReset);
  }
  if (translateBtn) translateBtn.textContent = labels.translateBtn;

  if (settingsSelect && optionLabels) {
    Array.from(settingsSelect.options).forEach((opt) => {
      const nextLabel = optionLabels[opt.value];
      if (nextLabel) opt.textContent = nextLabel;
    });
  }

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

function getUiLabels() {
  const lang = normalizeLanguage(currentLanguage);
  return UI_LABELS[lang] || UI_LABELS[DEFAULT_LANGUAGE];
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
