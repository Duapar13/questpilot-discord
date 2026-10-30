(function () {
  'use strict';

  const ELECTRON_UA =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Discord/1.0.0 Chrome/120.0.0.0 Electron/28.0.0 Safari/537.36';

  try {
    Object.defineProperty(navigator, 'userAgent', { get: () => ELECTRON_UA, configurable: true });
    Object.defineProperty(navigator, 'platform', { get: () => 'Win32', configurable: true });
    console.info('[QuestPilot] User-Agent override active:', ELECTRON_UA);
  } catch (error) {
    console.error('[QuestPilot] Failed to override user agent:', error);
  }
})();
