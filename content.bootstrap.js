ext.runtime.onMessage.addListener((msg) => {
  if (msg?.type !== "SHOW_TRANSLATION") return;
  const { original, translated } = msg;
  showTranslation(original, translated);
});

document.addEventListener("selectionchange", scheduleSelectionUpdate, true);
document.addEventListener("mouseup", scheduleSelectionUpdate, true);
document.addEventListener("keyup", scheduleSelectionUpdate, true);
document.addEventListener("keydown", handleQuickChatShortcut, true);
window.addEventListener("scroll", scheduleSelectionUpdate, true);
window.addEventListener("resize", scheduleSelectionUpdate, true);
initLanguageSettings();

