(function () {
  'use strict';

  const SUPPORTED_TASKS = ['WATCH_VIDEO', 'PLAY_ON_DESKTOP', 'STREAM_ON_DESKTOP', 'PLAY_ACTIVITY', 'WATCH_VIDEO_ON_MOBILE'];
  const LOG_PREFIX = '[QuestPilot]';

  function waitForWebpack(callback) {
    const checkInterval = 100;
    const maxAttempts = 100;
    let attempts = 0;

    const check = () => {
      if (attempts >= maxAttempts) {
        console.warn(`${LOG_PREFIX} Gave up waiting for Discord's webpack runtime.`);
        sendUpdate('QUEST_ERROR', { message: "Timed out waiting for Discord to load. Try refreshing the page." });
        return;
      }

      if (typeof window.webpackChunkdiscord_app === 'undefined') {
        attempts++;
        setTimeout(check, checkInterval);
        return;
      }

      try {
        const originalJQuery = window.$;
        delete window.$;

        const webpackRequire = window.webpackChunkdiscord_app.push([[Symbol()], {}, (require) => require]);
        window.webpackChunkdiscord_app.pop();

        if (originalJQuery) window.$ = originalJQuery;

        if (!webpackRequire?.c || Object.keys(webpackRequire.c).length < 10) {
          attempts++;
          setTimeout(check, checkInterval);
          return;
        }

        callback(webpackRequire);
      } catch (error) {
        attempts++;
        setTimeout(check, checkInterval);
      }
    };

    check();
  }

  function findModule(webpackRequire, filter) {
    for (const module of Object.values(webpackRequire.c)) {
      const exports = module?.exports;
      if (!exports) continue;
      if (exports.A && filter(exports.A)) return exports.A;
      if (exports.Ay && filter(exports.Ay)) return exports.Ay;
      if (exports.ZP && filter(exports.ZP)) return exports.ZP;
      if (filter(exports)) return exports;
    }
    return null;
  }

  function sendUpdate(type, data) {
    window.postMessage({ prefix: 'QUESTPILOT', type, data }, '*');
  }

  function loadStores(webpackRequire) {
    try {
      const QuestsStore = findModule(webpackRequire, (m) => m.__proto__?.getQuest);
      const ChannelStore = findModule(webpackRequire, (m) => m.__proto__?.getAllThreadsForParent);
      const GuildChannelStore = findModule(webpackRequire, (m) => m.getSFWDefaultChannel);
      const apiModule = findModule(webpackRequire, (m) => m.Bo?.get || m.tn?.get);

      if (!QuestsStore || !apiModule) return null;

      return { QuestsStore, ChannelStore, GuildChannelStore, api: apiModule.Bo || apiModule.tn || apiModule };
    } catch (error) {
      console.error(`${LOG_PREFIX} Failed to load Discord stores:`, error);
      return null;
    }
  }

  function getActiveQuests(QuestsStore) {
    return [...QuestsStore.quests.values()].filter((quest) => {
      const isExpired = new Date(quest.config.expiresAt).getTime() <= Date.now();
      const isCompleted = !!quest.userStatus?.completedAt;
      const isEnrolled = !!quest.userStatus?.enrolledAt;
      const taskConfig = quest.config.taskConfig ?? quest.config.taskConfigV2;
      const hasSupportedTask = SUPPORTED_TASKS.some((type) => taskConfig.tasks[type] != null);

      return isEnrolled && !isCompleted && !isExpired && hasSupportedTask;
    });
  }

  function initializeQuestState(quest) {
    const taskConfig = quest.config.taskConfig ?? quest.config.taskConfigV2;
    const taskType = SUPPORTED_TASKS.find((type) => taskConfig.tasks[type] != null);
    const taskData = taskConfig.tasks[taskType];
    const secondsNeeded = taskData?.target ?? 0;
    const currentProgress = quest.userStatus?.progress?.[taskType]?.value ?? quest.userStatus?.streamProgressSeconds ?? 0;

    return {
      quest,
      taskType,
      secondsNeeded,
      currentProgress,
      completed: currentProgress >= secondsNeeded,
      questName: quest.config.messages.questName
    };
  }

  function notifyUI(quest, progress, target, completed) {
    sendUpdate('QUEST_UPDATE', { id: quest.id, name: quest.config.messages.questName, progress, target, completed });
  }

  async function processVideoStep(state, api) {
    const { quest, secondsNeeded, currentProgress } = state;
    const nextTime = Math.min(secondsNeeded, currentProgress + 1 + Math.random());

    try {
      const res = await api.post({ url: `/quests/${quest.id}/video-progress`, body: { timestamp: nextTime } });
      state.currentProgress = nextTime;
      notifyUI(quest, Math.floor(state.currentProgress), secondsNeeded, false);

      if (res.body.completed_at !== null || state.currentProgress >= secondsNeeded) {
        state.completed = true;
        notifyUI(quest, secondsNeeded, secondsNeeded, true);
        await api.post({ url: `/quests/${quest.id}/video-progress`, body: { timestamp: secondsNeeded } });
      }
    } catch (error) {
      console.error(`${LOG_PREFIX} Video step failed for "${state.questName}":`, error);
    }
  }

  async function processHeartbeatStep(state, stores) {
    const { api, ChannelStore, GuildChannelStore } = stores;
    const { quest, taskType, secondsNeeded } = state;

    let channelId = ChannelStore?.getSortedPrivateChannels()[0]?.id;
    if (!channelId && GuildChannelStore) {
      const guilds = Object.values(GuildChannelStore.getAllGuilds());
      const voice = guilds.find((g) => g?.VOCAL?.length > 0);
      if (voice) channelId = voice.VOCAL[0].channel.id;
    }

    const streamKey = channelId ? `call:${channelId}:1` : `call:${quest.id}:1`;

    try {
      const response = await api.post({ url: `/quests/${quest.id}/heartbeat`, body: { stream_key: streamKey, terminal: false } });
      const serverProgress = response.body?.progress?.[taskType]?.value ?? 0;
      state.currentProgress = serverProgress;
      notifyUI(quest, Math.floor(state.currentProgress), secondsNeeded, state.currentProgress >= secondsNeeded);

      if (state.currentProgress >= secondsNeeded) {
        await api.post({ url: `/quests/${quest.id}/heartbeat`, body: { stream_key: streamKey, terminal: true } });
        state.completed = true;
        notifyUI(quest, secondsNeeded, secondsNeeded, true);
      }
    } catch (error) {
      console.error(`${LOG_PREFIX} Heartbeat step failed for "${state.questName}":`, error);
    }
  }

  async function runQuestEngine(webpackRequire) {
    const version = window.__QUEST_VERSION || 'unknown';
    if ('__QUEST_VERSION' in window) {
      try { delete window.__QUEST_VERSION; } catch { /* non-configurable in some builds, safe to ignore */ }
    }
    console.info(`${LOG_PREFIX} Initializing... (v${version})`);

    const stores = loadStores(webpackRequire);
    if (!stores) {
      console.warn(`${LOG_PREFIX} Could not locate Discord's internal quest stores.`);
      sendUpdate('QUEST_ERROR', { message: "Couldn't find Discord's quest stores." });
      return;
    }

    const activeQuests = getActiveQuests(stores.QuestsStore);
    if (activeQuests.length === 0) {
      console.info(`${LOG_PREFIX} No uncompleted active quests found.`);
      sendUpdate('QUEST_LIST', []);
      return;
    }

    const questStates = activeQuests.map(initializeQuestState);

    sendUpdate(
      'QUEST_LIST',
      questStates.map((state) => ({
        id: state.quest.id,
        name: state.questName,
        progress: Math.floor(state.currentProgress),
        target: state.secondsNeeded,
        completed: state.completed
      }))
    );

    for (const state of questStates) {
      if (state.completed) continue;

      while (!state.completed) {
        sendUpdate('QUEST_TICK', { id: state.quest.id });
        const isVideo = state.taskType.startsWith('WATCH_VIDEO');

        if (isVideo) {
          await processVideoStep(state, stores.api);
          if (!state.completed) await new Promise((r) => setTimeout(r, 1000 + Math.random() * 500));
        } else {
          await processHeartbeatStep(state, stores);
          if (!state.completed) await new Promise((r) => setTimeout(r, 20000 + Math.random() * 2000));
        }
      }
    }

    console.info(`${LOG_PREFIX} All quests finished.`);
  }

  waitForWebpack(runQuestEngine);
})();
