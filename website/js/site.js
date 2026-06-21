const STORAGE_KEY = 'gacha_cup_campaign';
const GLOBAL_STATS_KEY = 'gacha_cup_global_stats';
const MAX_TON = 4;

// Fixed global kickoff — same countdown for every visitor
const KICKOFF_END_MS = Date.parse('2026-06-25T18:00:00Z');

const SHARE_TWEET_TEXT = `Just joined the @GachaCup World Cup Airdrop and locked my 4.00 $TON bag! 🎒🏆

Fast, clean, and 100% free. Don't miss the biggest kickoff on TON: https://footballgacha.sbs/

#GachaCup #TON #Airdrop #WorldCup`;

const CONFIG = {
    initialPlayers: 1000,
    initialPool: 4000,
    poolDecrementPerClaim: 4,
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
            id: 'share_post',
            step: '3',
            title: 'Shout From the Stands',
            description: 'Post the kickoff message on 𝕏 to spread the word.',
            reward: '+1.00 TON',
            urlKey: 'shareTweet',
            confirmLabel: 'I Posted'
        },
        {
            id: 'join_telegram',
            step: '4',
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
    globalStats: loadGlobalStats()
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
    scheduleServerSync();
}

function getApiBase() {
    const meta = document.querySelector('meta[name="api-origin"]')?.content?.trim();
    return (meta || window.location.origin).replace(/\/$/, '');
}

function mergeProgress(local, remote) {
    if (!remote) return { ...local };
    const tasks = [...new Set([...(local.completedTasks || []), ...(remote.completedTasks || [])])];
    const earnedTon = Math.min(MAX_TON, Math.max(local.earnedTon || 0, remote.earnedTon || 0, tasks.length));
    return {
        completedTasks: tasks,
        earnedTon,
        claimed: !!(local.claimed || remote.claimed),
        walletAddress: local.walletAddress || remote.walletAddress || ''
    };
}

let syncTimer = null;

function scheduleServerSync() {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => { syncToServer().catch(() => {}); }, 350);
}

async function syncToServer() {
    syncWalletFromInput();
    const wallet = state.progress.walletAddress;
    if (!isValidWalletAddress(wallet)) {
        return { ok: false, message: 'Enter a valid TON address (UQ... or EQ..., 48+ characters).' };
    }

    try {
        const res = await fetch(`${getApiBase()}/api/airdrop/progress`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                walletAddress: wallet,
                completedTasks: state.progress.completedTasks,
                earnedTon: state.progress.earnedTon,
                claimed: state.progress.claimed
            })
        });
        let data = {};
        try {
            data = await res.json();
        } catch {
            return { ok: false, message: `Server error (${res.status}). Try again shortly.` };
        }
        if (!res.ok || !data.success) {
            return { ok: false, message: data.message || `Server error (${res.status})` };
        }
        if (data.stats) {
            state.globalStats = data.stats;
            saveGlobalStats();
            updateGlobalStatsUI();
        }
        return { ok: true };
    } catch {
        return { ok: false, message: 'Network error — check your connection and try again.' };
    }
}

async function pullFromServer(wallet) {
    const w = normalizeWalletInput(wallet || state.progress.walletAddress);
    try {
        const url = isValidWalletAddress(w)
            ? `${getApiBase()}/api/airdrop/progress?wallet=${encodeURIComponent(w)}`
            : `${getApiBase()}/api/airdrop/progress`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.stats) {
            state.globalStats = data.stats;
            saveGlobalStats();
            updateGlobalStatsUI();
        }
        if (data.progress && isValidWalletAddress(w)) {
            const localSnapshot = { ...state.progress };
            state.progress = mergeProgress(localSnapshot, data.progress);
            if (!state.progress.walletAddress) state.progress.walletAddress = w;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress));
        }
        return data;
    } catch {
        return null;
    }
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
    if (task.urlKey === 'shareTweet') {
        return `https://twitter.com/intent/tweet?text=${encodeURIComponent(SHARE_TWEET_TEXT)}`;
    }
    if (task.urlKey) return CONFIG[task.urlKey] || '';
    return task.url || '';
}

function getTaskActionLabel(task) {
    if (task.id === 'join_telegram') return 'Join Telegram';
    if (task.id === 'share_post') return 'Post on 𝕏';
    return 'Open Link';
}

function getTaskPendingHint(task, done, opened, linkReady) {
    if (done) return '';
    if (task.id === 'share_post' && linkReady) {
        return opened
            ? 'Tap confirm after posting the message on 𝕏.'
            : 'Post the kickoff message on 𝕏, then confirm.';
    }
    if (task.id === 'retweet' && !linkReady && task.urlKey) {
        return 'Like & repost the post, then confirm.';
    }
    if (!done && opened && linkReady) {
        return 'Tap confirm after completing the action.';
    }
    if (!done && linkReady) {
        return 'Open the link, complete the action, then confirm.';
    }
    return '';
}

function maskAddress(addr) {
    if (!addr || addr.length < 12) return addr || '—';
    return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

function normalizeWalletInput(value) {
    let s = String(value || '').trim().replace(/\s+/g, '');
    const friendly = s.match(/(?:EQ|UQ|kQ|eq|uq|kq)[A-Za-z0-9_-]{43,48}/i);
    if (friendly) {
        const addr = friendly[0];
        return addr.slice(0, 2).toUpperCase() + addr.slice(2);
    }
    const raw = s.match(/0:[a-fA-F0-9]{64}/);
    if (raw) return raw[0];
    return s;
}

function isValidWalletAddress(addr) {
    const w = normalizeWalletInput(addr);
    if (w.startsWith('0:')) return /^0:[a-fA-F0-9]{64}$/.test(w);
    return /^[EUk]Q[A-Za-z0-9_-]{43,48}$/.test(w);
}

function syncWalletFromInput() {
    const input = $('#wallet-address');
    if (!input) return state.progress.walletAddress || '';
    const trimmed = normalizeWalletInput(input.value);
    state.progress.walletAddress = trimmed;
    if (input.value !== trimmed) input.value = trimmed;
    return trimmed;
}

function isWalletConnected() {
    return isValidWalletAddress(syncWalletFromInput() || state.progress.walletAddress);
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
        return { text: 'Airdrop claimed! Your 4.00 TON allocation is secured for kickoff. 🎒', maxed: true };
    }
    if (earned >= MAX_TON) {
        return { text: 'MAXED OUT! 🎒 Enter your TON wallet below to secure your allocation.', maxed: true };
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
    const inputPanel = $('#wallet-input-panel');
    const boundPanel = $('#wallet-bound-panel');
    const input = $('#wallet-address');
    const hint = $('#wallet-hint');
    const clearBtn = $('#wallet-clear');
    const connected = isWalletConnected();

    if (!inputPanel || !boundPanel) return;

    if (state.progress.claimed) {
        inputPanel.hidden = true;
        boundPanel.hidden = false;
        const masked = $('#masked-address');
        if (masked) masked.textContent = maskAddress(state.progress.walletAddress);
        return;
    }

    inputPanel.hidden = false;
    boundPanel.hidden = true;
    if (input) input.disabled = false;
    if (clearBtn) clearBtn.disabled = false;

    if (hint) {
        if (connected) {
            hint.textContent = '✓ Address ready. You can still edit or clear it before claiming.';
            hint.classList.add('wallet-paste-hint--ok');
        } else if (state.progress.walletAddress) {
            hint.textContent = 'Enter a full TON address (UQ... or EQ..., 48+ characters).';
            hint.classList.remove('wallet-paste-hint--ok');
        } else {
            hint.textContent = 'Paste your public receiving address. You can edit or clear it anytime before claiming.';
            hint.classList.remove('wallet-paste-hint--ok');
        }
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

    const taskTotal = CONFIG.tasks.length;

    if (!allTasksDone()) {
        note.textContent = `Complete all ${taskTotal} tasks and enter your TON wallet first.`;
    } else if (!isWalletConnected()) {
        note.textContent = 'Almost there — paste your TON wallet address above.';
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
                       onclick="openTaskLink('${task.id}')">${getTaskActionLabel(task)}</a>
                </div>`;
        } else {
            actions = `
                <div class="task-actions">
                    <button type="button" onclick="confirmTask('${task.id}')">${task.confirmLabel}</button>
                </div>`;
        }

        const pendingHint = getTaskPendingHint(task, done, opened, linkReady);
        const pendingHtml = pendingHint
            ? `<div class="muted" style="font-size:0.78rem;margin-top:4px;">${escapeHtml(pendingHint)}</div>`
            : '';

        return `
            <div class="task-item ${done ? 'task-item--done' : ''}">
                <div>
                    <div class="task-step">${task.step}. ${escapeHtml(task.title)}</div>
                    <div style="font-weight:700;">${escapeHtml(task.description)}</div>
                    <div class="task-reward">${task.reward}</div>
                    ${pendingHtml}
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

async function markClaimed() {
    if (state.progress.claimed) return true;

    syncWalletFromInput();
    state.progress.claimed = true;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress));
    clearTimeout(syncTimer);

    const ok = await syncToServer();
    if (!ok.ok) {
        state.progress.claimed = false;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress));
        showToast(ok.message || 'Could not save your claim. Try again.', true);
        return false;
    }

    updateStash();
    renderTasks();
    return true;
}

async function handleClaim() {
    syncWalletFromInput();

    if (!allTasksDone() || !isWalletConnected()) {
        showToast(`❌ Please complete all ${CONFIG.tasks.length} tasks and enter your wallet address!`, true);
        return;
    }

    if (state.globalStats.playersRemaining <= 0 && !state.progress.claimed) {
        showToast('All spots are filled. See you at launch!', true);
        return;
    }

    if (!state.progress.claimed) {
        const preSync = await syncToServer();
        if (!preSync.ok) {
            showToast(preSync.message || 'Could not reach the server. Try again.', true);
            return;
        }

        const ok = await markClaimed();
        if (!ok) return;
    } else {
        const resync = await syncToServer();
        if (!resync.ok) {
            showToast(resync.message || 'Could not sync claim status.', true);
            return;
        }
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

function bindWalletInput() {
    const input = $('#wallet-address');
    const clearBtn = $('#wallet-clear');
    if (!input) return;

    if (state.progress.walletAddress) {
        input.value = state.progress.walletAddress;
    }

    const applyLocal = () => {
        syncWalletFromInput();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress));
        updateWalletUI();
        updateStash();
    };

    input.addEventListener('input', applyLocal);
    input.addEventListener('change', applyLocal);

    clearBtn?.addEventListener('click', () => {
        if (state.progress.claimed) return;
        input.value = '';
        state.progress.walletAddress = '';
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress));
        updateWalletUI();
        updateStash();
    });
}

async function refreshLiveStats() {
    await pullFromServer();
}

async function init() {
    initParticles();
    bindFaq();
    bindWalletInput();
    await pullFromServer();
    if (state.progress.walletAddress && !state.progress.claimed) {
        const input = $('#wallet-address');
        if (input) input.value = state.progress.walletAddress;
    }
    renderTasks();
    updateStash();
    $('#claim-btn').addEventListener('click', () => { handleClaim(); });
    $('#success-close')?.addEventListener('click', closeSuccessModal);
    $('#success-overlay')?.addEventListener('click', (e) => {
        if (e.target.id === 'success-overlay') closeSuccessModal();
    });
    updateCountdown();
    setInterval(updateCountdown, 1000);
    setInterval(() => { refreshLiveStats().catch(() => {}); }, 20000);
}

init();
