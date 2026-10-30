chrome.runtime.onInstalled.addListener(() => {
  console.info('[QuestPilot] Extension installed');
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getVersion') {
    sendResponse({ version: chrome.runtime.getManifest().version });
    return false;
  }

  if (request.action === 'executeQuestCode') {
    if (!sender.tab?.id) {
      sendResponse({ success: false, error: 'No tab ID found' });
      return false;
    }

    const tabId = sender.tab.id;
    const version = chrome.runtime.getManifest().version;

    chrome.scripting
      .executeScript({ target: { tabId }, func: (v) => { window.__QUEST_VERSION = v; }, args: [version], world: 'MAIN' })
      .then(() => chrome.scripting.executeScript({ target: { tabId }, files: ['src/content/questEngine.js'], world: 'MAIN' }))
      .then(() => sendResponse({ success: true }))
      .catch((error) => {
        console.error('[QuestPilot] Error injecting quest engine:', error);
        sendResponse({ success: false, error: error.message });
      });

    return true;
  }

  return false;
});
