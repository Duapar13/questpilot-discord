(function () {
  'use strict';

  const COLORS = {
    bg: '#2b2d31',
    bgElevated: '#1e1f22',
    accent: '#5865f2',
    accentHover: '#4752c4',
    success: '#23a559',
    danger: '#f23f42',
    text: '#f2f3f5',
    muted: '#949ba4',
    track: '#404249',
    orb: '#c77dff'
  };

  const ICONS = {
    bolt: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z"/></svg>',
    chevron:
      '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>',
    check:
      '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    spinner:
      '<svg viewBox="0 0 24 24" width="14" height="14" class="qp-spin"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="3" stroke-dasharray="40 100" stroke-linecap="round"/></svg>',
    orb:
      '<svg viewBox="0 0 24 24" width="11" height="11"><circle cx="12" cy="12" r="9" fill="currentColor"/><circle cx="9" cy="9" r="2.5" fill="rgba(255,255,255,.55)"/></svg>',
    clock:
      '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/></svg>'
  };

  let panelExpanded = false;
  let fabButtonText;
  let fabIcon;
  let chevronBtn;
  let lastSeenAt = null;
  let statusTickInterval = null;
  const questCache = new Map();

  function injectStyles() {
    if (document.getElementById('qp-styles')) return;
    const style = document.createElement('style');
    style.id = 'qp-styles';
    style.textContent = `
      #qp-root, #qp-root * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
      #qp-root { position: fixed; bottom: 20px; right: 20px; z-index: 2147483000; display: flex; flex-direction: column; align-items: flex-end; gap: 10px; }
      .qp-fab { display: flex; align-items: center; gap: 8px; background: ${COLORS.accent}; color: #fff; border: none; border-radius: 999px; padding: 10px 16px; cursor: pointer; box-shadow: 0 6px 20px rgba(0,0,0,.35); transition: background .2s ease, transform .15s ease; font-size: 14px; font-weight: 600; }
      .qp-fab:hover { background: ${COLORS.accentHover}; transform: translateY(-1px); }
      .qp-fab.qp-success { background: ${COLORS.success}; }
      .qp-fab.qp-danger { background: ${COLORS.danger}; }
      .qp-fab-icon { display: flex; align-items: center; justify-content: center; }
      .qp-chevron { display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,.15); border: none; border-radius: 50%; width: 22px; height: 22px; color: #fff; cursor: pointer; transition: transform .25s ease, background .2s ease; }
      .qp-chevron:hover { background: rgba(255,255,255,.28); }
      .qp-chevron.qp-open { transform: rotate(180deg); }
      .qp-panel { width: 280px; background: ${COLORS.bg}; color: ${COLORS.text}; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,.45); overflow: hidden; animation: qp-slide-in .18s ease; border: 1px solid rgba(255,255,255,.06); }
      .qp-panel-header { display: flex; align-items: center; gap: 8px; padding: 12px 14px; background: ${COLORS.bgElevated}; }
      .qp-panel-header .qp-title { font-size: 14px; font-weight: 700; flex: 1; }
      .qp-panel-header .qp-version { font-size: 11px; color: ${COLORS.muted}; }
      .qp-status-row { display: flex; align-items: center; gap: 6px; padding: 8px 14px; font-size: 11.5px; color: ${COLORS.muted}; border-bottom: 1px solid rgba(255,255,255,.06); }
      .qp-status-dot { width: 7px; height: 7px; border-radius: 50%; background: ${COLORS.muted}; flex-shrink: 0; }
      .qp-status-dot.qp-live { background: ${COLORS.success}; box-shadow: 0 0 0 0 rgba(35,165,89,.6); animation: qp-pulse 1.6s ease-out infinite; }
      .qp-status-dot.qp-slow { background: #faa61a; }
      .qp-status-dot.qp-stalled { background: ${COLORS.danger}; }
      @keyframes qp-pulse { 0% { box-shadow: 0 0 0 0 rgba(35,165,89,.6); } 70% { box-shadow: 0 0 0 6px rgba(35,165,89,0); } 100% { box-shadow: 0 0 0 0 rgba(35,165,89,0); } }
      .qp-list { max-height: 260px; overflow-y: auto; padding: 10px 14px; scrollbar-width: thin; scrollbar-color: ${COLORS.track} transparent; }
      .qp-list::-webkit-scrollbar { width: 6px; }
      .qp-list::-webkit-scrollbar-track { background: transparent; }
      .qp-list::-webkit-scrollbar-thumb { background: ${COLORS.track}; border-radius: 10px; }
      .qp-list::-webkit-scrollbar-thumb:hover { background: ${COLORS.accent}; }
      .qp-empty { font-size: 12.5px; color: ${COLORS.muted}; padding: 6px 0; }
      .qp-quest { padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,.06); }
      .qp-quest:last-child { border-bottom: none; }
      .qp-quest-top { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 6px; }
      .qp-quest-name { font-size: 12.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; }
      .qp-quest-status { font-size: 11px; font-family: ui-monospace, Consolas, monospace; color: ${COLORS.muted}; display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
      .qp-quest-status.qp-done { color: ${COLORS.success}; }
      .qp-bar-track { height: 5px; border-radius: 4px; background: ${COLORS.track}; overflow: hidden; }
      .qp-bar-fill { height: 100%; border-radius: 4px; background: linear-gradient(90deg, ${COLORS.accent}, #8a7dff); transition: width .4s ease, background .3s ease; }
      .qp-bar-fill.qp-done { background: ${COLORS.success}; }
      .qp-quest-meta { display: flex; justify-content: space-between; align-items: center; margin-top: 5px; font-size: 10.5px; color: ${COLORS.muted}; }
      .qp-eta { display: flex; align-items: center; gap: 3px; }
      .qp-orb-badge { display: flex; align-items: center; gap: 3px; color: ${COLORS.orb}; font-weight: 600; }
      .qp-panel-footer { display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; font-size: 11.5px; color: ${COLORS.muted}; border-top: 1px solid rgba(255,255,255,.06); }
      .qp-panel-footer .qp-eta, .qp-panel-footer .qp-orb-badge { font-size: 12px; }
      .qp-panel-footer .qp-orb-badge { color: ${COLORS.orb}; }
      .qp-spin { animation: qp-rotate 0.9s linear infinite; }
      @keyframes qp-rotate { to { transform: rotate(360deg); } }
      @keyframes qp-slide-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
    `;
    document.head.appendChild(style);
  }

  function setFabState(mode, label) {
    const fab = document.getElementById('qp-fab');
    if (!fab) return;
    fab.classList.remove('qp-success', 'qp-danger');
    if (mode === 'success') fab.classList.add('qp-success');
    if (mode === 'danger') fab.classList.add('qp-danger');
    fabIcon.innerHTML = mode === 'running' ? ICONS.spinner : ICONS.bolt;
    fabButtonText.textContent = label;
  }

  function resetFabStateLater() {
    setTimeout(() => setFabState('idle', 'Run Quests'), 2200);
  }

  function handleFabClick() {
    if (typeof chrome === 'undefined' || !chrome.runtime?.id) {
      setFabState('danger', 'Extension error');
      resetFabStateLater();
      return;
    }

    setFabState('running', 'Running...');

    chrome.runtime.sendMessage({ action: 'executeQuestCode' }, (response) => {
      if (chrome.runtime.lastError || !response?.success) {
        console.error('[QuestPilot] Error:', chrome.runtime.lastError || response?.error);
        setFabState('danger', 'Error');
      } else {
        setFabState('success', 'Started!');
        if (!panelExpanded) togglePanel();
      }
      resetFabStateLater();
    });
  }

  function createRoot() {
    if (document.getElementById('qp-root')) return;

    injectStyles();

    const root = document.createElement('div');
    root.id = 'qp-root';

    const fab = document.createElement('button');
    fab.id = 'qp-fab';
    fab.className = 'qp-fab';

    fabIcon = document.createElement('span');
    fabIcon.className = 'qp-fab-icon';
    fabIcon.innerHTML = ICONS.bolt;
    fab.appendChild(fabIcon);

    fabButtonText = document.createElement('span');
    fabButtonText.textContent = 'Run Quests';
    fab.appendChild(fabButtonText);

    chevronBtn = document.createElement('button');
    chevronBtn.className = 'qp-chevron';
    chevronBtn.innerHTML = ICONS.chevron;
    chevronBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePanel();
    });
    fab.appendChild(chevronBtn);

    fab.addEventListener('click', handleFabClick);

    root.appendChild(fab);
    document.body.appendChild(root);

    chrome.storage?.local.get(['qpPanelExpanded'], (result) => {
      if (result?.qpPanelExpanded) {
        panelExpanded = true;
        chevronBtn.classList.add('qp-open');
        renderPanel();
      }
    });
  }

  function renderPanel() {
    if (document.getElementById('qp-panel')) return;

    const panel = document.createElement('div');
    panel.id = 'qp-panel';
    panel.className = 'qp-panel';

    const header = document.createElement('div');
    header.className = 'qp-panel-header';
    header.innerHTML = `<span class="qp-title">QuestPilot</span><span class="qp-version"></span>`;
    panel.appendChild(header);

    chrome.runtime.sendMessage({ action: 'getVersion' }, (res) => {
      const versionEl = header.querySelector('.qp-version');
      if (versionEl && res?.version) versionEl.textContent = `v${res.version}`;
    });

    const statusRow = document.createElement('div');
    statusRow.id = 'qp-status-row';
    statusRow.className = 'qp-status-row';
    statusRow.innerHTML = `<span class="qp-status-dot"></span><span class="qp-status-text">Not started</span>`;
    panel.appendChild(statusRow);
    updateStatusRow();
    clearInterval(statusTickInterval);
    statusTickInterval = setInterval(updateStatusRow, 1000);

    const list = document.createElement('div');
    list.id = 'qp-list';
    list.className = 'qp-list';
    renderQuestList(list);
    panel.appendChild(list);

    const footer = document.createElement('div');
    footer.id = 'qp-summary';
    footer.className = 'qp-panel-footer';
    footer.innerHTML = `
      <span class="qp-eta">${ICONS.clock}<span id="qp-total-eta">—</span></span>
      <span class="qp-orb-badge">${ICONS.orb}<span id="qp-total-orbs">—</span></span>
    `;
    panel.appendChild(footer);
    updateSummary();

    document.getElementById('qp-root').insertBefore(panel, document.getElementById('qp-fab'));
  }

  function formatDuration(totalSeconds) {
    const s = Math.max(0, Math.round(totalSeconds));
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  }

  function updateSummary() {
    const etaEl = document.getElementById('qp-total-eta');
    const orbsEl = document.getElementById('qp-total-orbs');
    if (!etaEl || !orbsEl) return;

    const quests = [...questCache.values()];
    const totalOrbs = quests.reduce((sum, q) => sum + (q.orbs ?? 0), 0);
    const remainingSeconds = quests.reduce((sum, q) => (q.completed ? sum : sum + Math.max(0, q.target - q.progress)), 0);
    const hasPending = quests.some((q) => !q.completed);

    etaEl.textContent = quests.length === 0 ? '—' : hasPending ? `~${formatDuration(remainingSeconds)} left` : 'Done';
    orbsEl.textContent = quests.length === 0 ? '—' : `${totalOrbs}`;
  }

  function renderQuestList(list) {
    list.innerHTML = '';
    if (questCache.size === 0) {
      list.innerHTML = '<div class="qp-empty">No active quests detected yet.</div>';
      return;
    }
    questCache.forEach((quest) => upsertQuestRow(list, quest));
  }

  function upsertQuestRow(list, quest) {
    const emptyState = list.querySelector('.qp-empty');
    if (emptyState) emptyState.remove();

    let row = document.getElementById(`qp-quest-${quest.id}`);
    if (!row) {
      row = document.createElement('div');
      row.id = `qp-quest-${quest.id}`;
      row.className = 'qp-quest';
      row.innerHTML = `
        <div class="qp-quest-top">
          <span class="qp-quest-name" title="${quest.name}"></span>
          <span class="qp-quest-status"></span>
        </div>
        <div class="qp-bar-track"><div class="qp-bar-fill"></div></div>
        <div class="qp-quest-meta">
          <span class="qp-eta"></span>
          <span class="qp-orb-badge"></span>
        </div>
      `;
      row.querySelector('.qp-quest-name').textContent = quest.name;
      list.appendChild(row);
    }

    const statusEl = row.querySelector('.qp-quest-status');
    const fillEl = row.querySelector('.qp-bar-fill');
    const etaEl = row.querySelector('.qp-eta');
    const orbEl = row.querySelector('.qp-orb-badge');
    const pct = quest.target > 0 ? Math.min(100, (quest.progress / quest.target) * 100) : 0;

    fillEl.style.width = `${pct}%`;
    fillEl.classList.toggle('qp-done', quest.completed);
    statusEl.classList.toggle('qp-done', quest.completed);
    statusEl.innerHTML = quest.completed ? ICONS.check : `${quest.progress}/${quest.target}`;

    etaEl.innerHTML = quest.completed
      ? ''
      : `${ICONS.clock}<span>~${formatDuration(Math.max(0, quest.target - quest.progress))}</span>`;
    orbEl.innerHTML = typeof quest.orbs === 'number' ? `${ICONS.orb}<span>${quest.orbs}</span>` : '';

    updateSummary();
  }

  function updateStatusRow() {
    const dot = document.querySelector('#qp-status-row .qp-status-dot');
    const text = document.querySelector('#qp-status-row .qp-status-text');
    if (!dot || !text) return;

    dot.classList.remove('qp-live', 'qp-slow', 'qp-stalled');

    if (lastSeenAt === null) {
      text.textContent = allQuestsCompleted() ? 'All quests completed' : 'Waiting for Discord to load...';
      if (allQuestsCompleted() && questCache.size > 0) dot.classList.add('qp-live');
      return;
    }

    if (allQuestsCompleted()) {
      dot.classList.add('qp-live');
      text.textContent = 'All quests completed';
      return;
    }

    const elapsed = Math.round((Date.now() - lastSeenAt) / 1000);
    if (elapsed < 25) {
      dot.classList.add('qp-live');
      text.textContent = `Running — updated ${elapsed}s ago`;
    } else if (elapsed < 60) {
      dot.classList.add('qp-slow');
      text.textContent = `Still running — updated ${elapsed}s ago`;
    } else {
      dot.classList.add('qp-stalled');
      text.textContent = `No update in ${elapsed}s — may be stuck, try refreshing`;
    }
  }

  function allQuestsCompleted() {
    return questCache.size > 0 && [...questCache.values()].every((q) => q.completed);
  }

  function markSeen() {
    lastSeenAt = Date.now();
    updateStatusRow();
  }

  function togglePanel() {
    panelExpanded = !panelExpanded;
    chevronBtn.classList.toggle('qp-open', panelExpanded);
    chrome.storage?.local.set({ qpPanelExpanded: panelExpanded });

    if (panelExpanded) {
      renderPanel();
    } else {
      clearInterval(statusTickInterval);
      document.getElementById('qp-panel')?.remove();
    }
  }

  function removeWidget() {
    clearInterval(statusTickInterval);
    document.getElementById('qp-root')?.remove();
  }

  function syncWidgetForLocation() {
    if (window.location.pathname.includes('/quest-home')) {
      createRoot();
    } else {
      removeWidget();
    }
  }

  window.addEventListener('message', ({ source, data }) => {
    if (source !== window || !data || data.prefix !== 'QUESTPILOT') return;

    if (data.type === 'QUEST_LIST') {
      questCache.clear();
      data.data.forEach((q) => questCache.set(q.id, q));
      const list = document.getElementById('qp-list');
      if (list) renderQuestList(list);
      markSeen();
    } else if (data.type === 'QUEST_UPDATE') {
      questCache.set(data.data.id, data.data);
      const list = document.getElementById('qp-list');
      if (list) upsertQuestRow(list, data.data);
      markSeen();
    } else if (data.type === 'QUEST_TICK') {
      markSeen();
    } else if (data.type === 'QUEST_ERROR') {
      console.warn('[QuestPilot]', data.data.message);
      const text = document.querySelector('#qp-status-row .qp-status-text');
      const dot = document.querySelector('#qp-status-row .qp-status-dot');
      if (text && dot) {
        dot.classList.remove('qp-live', 'qp-slow');
        dot.classList.add('qp-stalled');
        text.textContent = data.data.message;
      }
    }
  });

  function init() {
    syncWidgetForLocation();

    let lastUrl = window.location.href;
    new MutationObserver(() => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        syncWidgetForLocation();
      }
    }).observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
