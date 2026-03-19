// Henry's Work Dashboard — Main App
(function () {
  'use strict';

  const DATA_URL = 'data/dashboard.json';
  const POLL_INTERVAL = 30000;

  const MODE_ICONS = {
    BUILD: '🔨',
    THINK: '🧠',
    EXPLORE: '🔍',
    MAINTAIN: '🔧',
  };

  const MODE_CLASS = {
    BUILD: 'mode-build',
    THINK: 'mode-think',
    EXPLORE: 'mode-explore',
    MAINTAIN: 'mode-maintain',
  };

  // --- State ---
  let currentData = null;
  let pollTimer = null;

  // --- DOM refs ---
  const $ = (sel) => document.querySelector(sel);
  const timeline = $('#timeline');
  const statusBanner = $('#statusBanner');
  const taskDetail = $('#taskDetail');

  // --- Rendering ---

  function renderBanner(current) {
    if (!current) return;
    $('#currentMode').textContent = `${MODE_ICONS[current.mode] || ''} ${current.mode}`;
    $('#currentTask').textContent = current.task;
    const ind = $('#statusIndicator');
    ind.textContent = current.status;
    ind.className = 'status-indicator';
    if (current.status === 'in-progress') ind.classList.add('pulse');
    else if (current.status === 'done') ind.classList.add('done');
    else ind.classList.add('idle');
  }

  function renderStats(stats) {
    if (!stats) return;
    $('#blocksCompleted').textContent = stats.blocksCompleted;
    $('#blocksTotal').textContent = stats.blocksTotal;
    const dist = stats.modeDistribution || {};
    const modesHTML = Object.entries(dist)
      .map(([m, n]) => `<span class="mode-dot ${MODE_CLASS[m] || ''}">${n}</span>`)
      .join('');
    $('#modeDistribution').innerHTML = modesHTML;
  }

  function renderTimeline(schedule) {
    if (!schedule || !schedule.blocks) return;
    timeline.innerHTML = schedule.blocks
      .map((block, i) => {
        const modeClass = MODE_CLASS[block.mode] || '';
        const statusClass = block.status || 'upcoming';
        const statusLabel =
          block.status === 'done' ? '✅' :
          block.status === 'in-progress' ? '🔄' :
          block.status === 'skipped' ? '⏭' : '';

        const artifactsHTML = (block.artifacts || [])
          .map((a) => `<a class="artifact-badge" href="${esc(a.url)}" target="_blank">${esc(a.type)}: ${esc(a.title)}</a>`)
          .join('');

        return `
          <div class="block ${statusClass}" data-index="${i}">
            <div class="block-time">${esc(block.time)}</div>
            <div class="block-dot ${modeClass}"></div>
            <div class="block-content">
              <div class="block-title">${statusLabel} ${esc(block.task)}</div>
              ${block.summary ? `<div class="block-status">${esc(block.summary)}</div>` : ''}
              ${artifactsHTML ? `<div class="block-artifacts">${artifactsHTML}</div>` : ''}
            </div>
          </div>`;
      })
      .join('');

    // Scroll current block into view
    const active = timeline.querySelector('.block.in-progress');
    if (active) active.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function renderArtifacts(artifacts) {
    const grid = $('#artifactsGrid');
    if (!artifacts || artifacts.length === 0) {
      grid.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;">No artifacts yet today.</p>';
      return;
    }
    grid.innerHTML = artifacts
      .map((a) => `
        <a class="artifact-card" href="${esc(a.url)}" target="_blank">
          <div class="artifact-type">${esc(a.type)}</div>
          <div class="artifact-title">${esc(a.title)}</div>
          ${a.description ? `<div class="artifact-desc">${esc(a.description)}</div>` : ''}
        </a>`)
      .join('');
  }

  function renderDetail(block) {
    if (!block) {
      taskDetail.hidden = true;
      taskDetail.classList.remove('open');
      return;
    }
    taskDetail.hidden = false;
    // Force reflow for animation
    void taskDetail.offsetHeight;
    taskDetail.classList.add('open');

    $('#detailTime').textContent = block.time;
    $('#detailMode').textContent = `${MODE_ICONS[block.mode] || ''} ${block.mode}`;
    $('#detailMode').className = `detail-mode`;
    $('#detailTitle').textContent = block.task;
    $('#detailSummary').textContent = block.details || block.summary || 'No details yet.';

    const artifactsEl = $('#detailArtifacts');
    artifactsEl.innerHTML = (block.artifacts || [])
      .map((a) => `<a class="artifact-badge" href="${esc(a.url)}" target="_blank">${esc(a.type)}: ${esc(a.title)}</a>`)
      .join('');
  }

  function renderAll(data) {
    renderBanner(data.current);
    renderStats(data.stats);
    renderTimeline(data.schedule);
    renderArtifacts(data.artifacts);
    $('#lastUpdated').textContent = new Date(data.generated).toLocaleTimeString();
  }

  // --- Events ---

  timeline.addEventListener('click', (e) => {
    const block = e.target.closest('.block');
    if (!block || !currentData) return;
    const idx = parseInt(block.dataset.index, 10);
    const blockData = currentData.schedule.blocks[idx];
    renderDetail(blockData);
  });

  $('#detailClose').addEventListener('click', () => renderDetail(null));

  // --- Polling ---

  async function fetchData() {
    try {
      const res = await fetch(DATA_URL + '?t=' + Date.now());
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();
      currentData = data;
      renderAll(data);
      $('#pollStatus').className = 'poll-status';
      $('#pollStatus').textContent = '●';
    } catch (err) {
      console.warn('Poll failed:', err);
      $('#pollStatus').className = 'poll-status error';
      $('#pollStatus').textContent = '●';
    }
  }

  function startPolling() {
    fetchData();
    pollTimer = setInterval(fetchData, POLL_INTERVAL);
  }

  // --- Util ---

  function esc(str) {
    if (!str) return '';
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  // --- Init ---
  startPolling();
})();
