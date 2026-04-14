injectGlobalStyles();
ext.runtime.onMessage.addListener((msg) => {
  if (msg?.type !== "SHOW_TRANSLATION") return;
  const { original, translated } = msg;
  showTranslation(original, translated);
});

document.addEventListener("selectionchange", scheduleSelectionUpdate, true);
document.addEventListener("mouseup", scheduleSelectionUpdate, true);
document.addEventListener("keyup", scheduleSelectionUpdate, true);
document.addEventListener("keydown", handleQuickChatShortcut, true);
document.addEventListener("keydown", (e) => {
  if (
    e.altKey && !e.ctrlKey && !e.shiftKey && !e.metaKey &&
    e.code === PAGE_TRANSLATE_SHORTCUT_CODE
  ) {
    if (e.target.isContentEditable || e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
    e.preventDefault();
    translatePage();
  }
}, true);
window.addEventListener("scroll", scheduleSelectionUpdate, true);
window.addEventListener("resize", scheduleSelectionUpdate, true);
initLanguageSettings();
ensureChatTrigger();

