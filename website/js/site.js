const STORAGE_KEY = 'gacha_cup_campaign';
const GLOBAL_STATS_KEY = 'gacha_cup_global_stats';
const MAX_TON = 3;

// Fixed global kickoff — same countdown for every visitor
const KICKOFF_END_MS = Date.parse('2026-06-25T18:00:00Z');

const CONFIG = {
    initialPlayers: 1000,
    initialPool: 3000,
    poolDecrementPerClaim: 3,
    // Set this when your RT post is live (Step 2 link)
    rtPostUrl: 'https://x.com/FootballGacha/status/2068753921137373385',
    tasks: [
        {
            id: 'follow_x',
            step: '1',
            title: 'Scout the Pitch on 𝕏',
            description: 'Follow @FootballGacha for drop intel.',
            reward: '+1.00 TON',
            url: 'https://x.com/FootballGacha',
            confirmLabel: 'I Followed'
        },
        {
            id: 'retweet',
            step: '2',
            title: 'Pass the Ball',
            description: 'Like and repost our Kick-Off Airdrop post on 𝕏.',
            reward: '+1.00 TON',
            urlKey: 'rtPostUrl',
            confirmLabel: 'I Liked & Reposted'
        },
        {
            id: 'join_telegram',
            step: '3',
            title: 'Enter the Locker Room',
            description: 'Join the GC Telegram Alpha Community.',
            reward: '+1.00 TON',
            url: 'https://t.me/FootballGacha',
            confirmLabel: 'I Joined'
        }
    ]
};

const state = {
    progress: loadProgress(),
    taskOpened: {},
    globalStats: loadGlobalStats(),
    tonConnectUI: null
};

const $ = (sel) => document.querySelector(sel);

function loadProgress() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : {
            completedTasks: [],
            earnedTon: 0,
            walletAddress: '',
            claimed: false
        };
    } catch {
        return { completedTasks: [], earnedTon: 0, walletAddress: '', claimed: false };
    }
}

function saveProgress() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress));
}

function loadGlobalStats() {
    try {
        const raw = localStorage.getItem(GLOBAL_STATS_KEY);
        if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return {
        playersRemaining: CONFIG.initialPlayers,
        tonPoolRemaining: CONFIG.initialPool
    };
}

function saveGlobalStats() {
    localStorage.setItem(GLOBAL_STATS_KEY, JSON.stringify(state.globalStats));
}

function formatTon(n) {
    return Number(n).toFixed(2);
}

function formatInt(n) {
    return Number(n).toLocaleString('en-US');
}

function showToast(msg, isError = false) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.toggle('toast--error', isError);
    el.classList.add('toast--show');
    setTimeout(() => el.classList.remove('toast--show'), 3500);
}

function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
}

function getTaskUrl(task) {
    if (task.urlKey) return CONFIG[task.urlKey] || '';
    return task.url || '';
}

function getManifestUrl() {
    const meta = document.querySelector('meta[name="ton-api-origin"]')?.content?.trim();
    const origin = (meta || window.location.origin).replace(/\/$/, '');
    return `${origin}/tonconnect-manifest.json`;
}

function maskAddress(addr) {
    if (!addr || addr.length < 12) return addr || '—';
    return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

function isWalletConnected() {
    return !!(state.progress.walletAddress && state.progress.walletAddress.length >= 10);
}

function initParticles() {
    const container = $('#particles');
    if (!container) return;
    for (let i = 0; i < 36; i++) {
        const p = document.createElement('div');
        p.className = 'particle';
        const size = 2 + Math.random() * 3;
        p.style.width = `${size}px`;
        p.style.height = `${size}px`;
        p.style.left = `${Math.random() * 100}%`;
        p.style.opacity = `${0.3 + Math.random() * 0.6}`;
        p.style.animationDuration = `${7 + Math.random() * 10}s`;
        p.style.animationDelay = `${Math.random() * 8}s`;
        container.appendChild(p);
    }
}

function getKickoffEnd() {
    return KICKOFF_END_MS;
}

function updateCountdown() {
    const el = $('#countdown');
    const diff = getKickoffEnd() - Date.now();
    if (diff <= 0) {
        el.textContent = 'Kickoff!';
        return;
    }
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    el.textContent = `${d}d ${h}h ${m}m ${s}s`;
}

function updateGlobalStatsUI() {
    $('#stat-participants').textContent = formatInt(state.globalStats.playersRemaining);
    $('#stat-pool').textContent = formatInt(state.globalStats.tonPoolRemaining);
}

function getStashMessage(earned) {
    if (state.progress.claimed) {
        return { text: 'Airdrop claimed! Your 3.00 TON allocation is secured for kickoff. 🎒', maxed: true };
    }
    if (earned >= MAX_TON) {
        return { text: 'MAXED OUT! 🎒 Connect your TON wallet below to secure your allocation.', maxed: true };
    }
    if (earned > 0) {
        return { text: 'Stacking in progress... Don\'t leave free TON on the pitch!', maxed: false };
    }
    return { text: 'Your bag is empty, Coach. Warm up and score your first TON below! 👇', maxed: false };
}

function allTasksDone() {
    return CONFIG.tasks.every((t) => state.progress.completedTasks.includes(t.id));
}

function updateWalletUI() {
    const connected = isWalletConnected();
    const connectPanel = $('#wallet-connect-panel');
    const boundPanel = $('#wallet-bound-panel');
    const desc = $('.secure-zone__desc');

    if (!connectPanel || !boundPanel) return;

    if (connected || state.progress.claimed) {
        connectPanel.hidden = true;
        boundPanel.hidden = false;
        if (desc) desc.hidden = true;
        const masked = $('#masked-address');
        if (masked) masked.textContent = maskAddress(state.progress.walletAddress);
    } else {
        connectPanel.hidden = false;
        boundPanel.hidden = true;
        if (desc) desc.hidden = false;
    }
}

function updateStash() {
    const earned = state.progress.earnedTon || 0;
    const taskCount = state.progress.completedTasks.length;
    const pct = Math.round((taskCount / CONFIG.tasks.length) * 100);

    $('#earned-ton').textContent = formatTon(earned);
    $('#reward-progress').style.width = `${pct}%`;
    const glow = $('#reward-progress-glow');
    if (glow) {
        glow.style.left = `calc(${pct}% - 8px)`;
        glow.style.opacity = pct > 0 ? '1' : '0';
    }
    $('#progress-pct').textContent = `${pct}%`;
    $('#progress-tasks').textContent = `${taskCount} / ${CONFIG.tasks.length} tasks`;

    const hint = $('#reward-hint');
    const msg = getStashMessage(earned);
    hint.textContent = msg.text;
    hint.classList.toggle('player-meta--max', msg.maxed);

    const btn = $('#claim-btn');
    const note = $('#claim-note');

    updateWalletUI();

    btn.textContent = 'CLAIM AIRDROP';

    if (state.progress.claimed) {
        btn.disabled = true;
        btn.classList.add('claim-done');
        btn.classList.remove('claim-locked');
        note.textContent = 'Claim confirmed! Rewards will be sent when the launch countdown ends.';
        return;
    }

    const ready = allTasksDone() && isWalletConnected() && state.globalStats.playersRemaining > 0;
    btn.disabled = !ready;
    btn.classList.toggle('claim-locked', !ready);
    btn.classList.remove('claim-done');

    if (!allTasksDone()) {
        note.textContent = 'Complete all 3 tasks and connect your TON wallet first.';
    } else if (!isWalletConnected()) {
        note.textContent = 'Almost there — connect your TON wallet above.';
    } else if (state.globalStats.playersRemaining <= 0) {
        note.textContent = 'All spots are filled. See you at launch!';
    } else {
        note.textContent = 'You\'re ready! Tap the button to claim your airdrop.';
    }
}

function completeTask(taskId) {
    if (state.progress.completedTasks.includes(taskId)) return;
    if (!CONFIG.tasks.find((t) => t.id === taskId)) return;
    state.progress.completedTasks.push(taskId);
    state.progress.earnedTon = Math.min(MAX_TON, (state.progress.earnedTon || 0) + 1);
    saveProgress();
}

function renderTasks() {
    const grid = $('#tasks-grid');
    const completed = new Set(state.progress.completedTasks);

    grid.innerHTML = CONFIG.tasks.map((task) => {
        const done = completed.has(task.id);
        const url = getTaskUrl(task);
        const linkReady = !!url;
        const opened = !!state.taskOpened[task.id];

        let actions = '';
        if (done) {
            actions = '<button disabled>✓ Done</button>';
        } else if (!linkReady && task.urlKey) {
            actions = '<button disabled>Link Soon</button>';
        } else if (!opened) {
            actions = `
                <div class="task-actions">
                    <a class="action-btn secondary" href="${escapeHtml(url)}" target="_blank" rel="noopener"
                       onclick="openTaskLink('${task.id}')">${task.id === 'join_telegram' ? 'Join Telegram' : 'Open Link'}</a>
                </div>`;
        } else {
            actions = `
                <div class="task-actions">
                    <button type="button" onclick="confirmTask('${task.id}')">${task.confirmLabel}</button>
                </div>`;
        }

        const pendingHint = !done && opened && linkReady
            ? '<div class="muted" style="font-size:0.78rem;margin-top:4px;">Tap confirm after completing the action.</div>'
            : !done && linkReady
                ? '<div class="muted" style="font-size:0.78rem;margin-top:4px;">Open the link, complete the action, then confirm.</div>'
                : !done && !linkReady && task.urlKey
                    ? '<div class="muted" style="font-size:0.78rem;margin-top:4px;">Like & repost the post, then confirm.</div>'
                    : '';

        return `
            <div class="task-item ${done ? 'task-item--done' : ''}">
                <div>
                    <div class="task-step">${task.step}. ${escapeHtml(task.title)}</div>
                    <div style="font-weight:700;">${escapeHtml(task.description)}</div>
                    <div class="task-reward">${task.reward}</div>
                    ${pendingHint}
                </div>
                ${actions}
            </div>`;
    }).join('');
}

window.openTaskLink = (taskId) => {
    state.taskOpened[taskId] = true;
    setTimeout(renderTasks, 150);
};

window.confirmTask = (taskId) => {
    if (state.progress.completedTasks.includes(taskId)) return;
    completeTask(taskId);
    renderTasks();
    updateStash();
    showToast('+1.00 TON added to your stash!');
};

function openSuccessModal() {
    const overlay = $('#success-overlay');
    if (overlay) overlay.hidden = false;
}

function closeSuccessModal() {
    const overlay = $('#success-overlay');
    if (overlay) overlay.hidden = true;
}

function markClaimed() {
    if (state.progress.claimed) return;

    state.progress.claimed = true;
    saveProgress();

    state.globalStats.playersRemaining = Math.max(0, state.globalStats.playersRemaining - 1);
    state.globalStats.tonPoolRemaining = Math.max(0, state.globalStats.tonPoolRemaining - CONFIG.poolDecrementPerClaim);
    saveGlobalStats();

    updateGlobalStatsUI();
    updateStash();
    renderTasks();
}

function handleClaim() {
    if (!allTasksDone() || !isWalletConnected()) {
        showToast('❌ Please complete all 3 tasks and connect your wallet first!', true);
        return;
    }

    if (state.globalStats.playersRemaining <= 0 && !state.progress.claimed) {
        showToast('All spots are filled. See you at launch!', true);
        return;
    }

    if (!state.progress.claimed) {
        markClaimed();
    }

    openSuccessModal();
}

function bindFaq() {
    const faq = $('#faq');
    if (!faq) return;

    faq.querySelectorAll('.faq__item').forEach((trigger) => {
        trigger.addEventListener('click', () => {
            const expanded = trigger.getAttribute('aria-expanded') === 'true';
            const answer = trigger.nextElementSibling;
            if (!answer?.classList.contains('faq__a')) return;

            trigger.setAttribute('aria-expanded', expanded ? 'false' : 'true');
            answer.hidden = expanded;
        });
    });
}

async function setupTonConnect() {
    if (!window.TON_CONNECT_UI) {
        console.warn('TonConnect UI not loaded');
        return;
    }

    const tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
        manifestUrl: getManifestUrl(),
        buttonRootId: 'ton-connect'
    });

    state.tonConnectUI = tonConnectUI;

    $('#connect-ton-btn')?.addEventListener('click', () => {
        tonConnectUI.openModal();
    });

    tonConnectUI.onStatusChange((wallet) => {
        if (wallet?.account?.address) {
            state.progress.walletAddress = wallet.account.address;
            saveProgress();
            showToast('Wallet connected!');
        } else if (!state.progress.claimed) {
            state.progress.walletAddress = '';
            saveProgress();
        }
        updateStash();
    });

    try {
        const restored = await tonConnectUI.connectionRestored;
        if (restored && tonConnectUI.wallet?.account?.address) {
            state.progress.walletAddress = tonConnectUI.wallet.account.address;
            saveProgress();
        }
    } catch { /* ignore */ }

    updateWalletUI();
}

function init() {
    initParticles();
    bindFaq();
    updateGlobalStatsUI();
    renderTasks();
    updateStash();
    $('#claim-btn').addEventListener('click', handleClaim);
    $('#success-close')?.addEventListener('click', closeSuccessModal);
    $('#success-overlay')?.addEventListener('click', (e) => {
        if (e.target.id === 'success-overlay') closeSuccessModal();
    });
    updateCountdown();
    setInterval(updateCountdown, 1000);
    setupTonConnect();
}

init();
