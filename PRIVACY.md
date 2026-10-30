# Privacy

QuestPilot runs entirely in your browser.

- It does not collect, store, or transmit any personal data to any server owned by this project.
- It communicates only with Discord's own API (`discord.com`), using the same session you're already logged into.
- The only persisted state is a single local preference (whether the widget panel is expanded), stored via `chrome.storage.local` and never sent anywhere.
- No analytics, telemetry, or third-party network requests are made by this extension.

Source code is fully open — read it yourself in [src/content](src/content) and [background.js](background.js).
