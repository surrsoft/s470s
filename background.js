// Service worker for s470s
// Enables side panel in Chrome; falls back to popup in unsupported browsers

(async () => {
  try {
    if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
      await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
      await chrome.action.setPopup({ popup: '' }); // disable popup so panel opens
    }
  } catch {
    // Side panel not supported — default_popup remains active
  }
})();
