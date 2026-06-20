const tg = window.Telegram?.WebApp;
if (tg) {
    tg.expand();
    tg.ready();
}

const state = {
    user: null,
    inventory: [],
    selectedBurn: [],
    depositInfo: null,
    linkedWallet: ''
};

function apiHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    if (tg?.initData) headers['x-telegram-init-data'] = tg.initData;
    return headers;
}

async function api(path, options = {}) {
    const res = await fetch(`/api${path}`, {
        ...options,
        headers: { ...apiHeaders(), ...(options.headers || {}) },
        body: options.body ? JSON.stringify(options.body) : undefined
    });
    const data = await res.json();
    if (!res.ok || data.success === false) {
        throw new Error(data.message || 'Request failed');
    }
    return data;
}

function toast(message) {
    const wrap = document.getElementById('toast-wrap');
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = message;
    wrap.appendChild(el);
    setTimeout(() => el.remove(), 3200);
}

function jerseySvg(card) {
    const primary = card.primary || '#2563eb';
    const secondary = card.secondary || '#ffffff';
    const number = card.number || 10;
    const nation = card.nation || 'INT';

    return `
    <svg viewBox="0 0 120 140" class="jersey-svg" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad-${card.uid}" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${primary}"/>
          <stop offset="100%" stop-color="${secondary}"/>
        </linearGradient>
      </defs>
      <path d="M35 18 L25 34 L15 42 L22 52 L30 46 L30 118 Q60 128 90 118 L90 46 L98 52 L105 42 L95 34 L85 18 Q60 28 35 18 Z"
        fill="url(#grad-${card.uid})" stroke="#cbd5e1" stroke-width="2"/>
      <text x="60" y="78" text-anchor="middle" fill="#fff" font-size="28" font-weight="700">${number}</text>
      <text x="60" y="102" text-anchor="middle" fill="#e2e8f0" font-size="11" font-weight="700">${nation}</text>
    </svg>`;
}

function cardTierClass(tierId) {
    if (tierId === 4) return 'legendary';
    if (tierId === 3) return 'epic';
    if (tierId === 2) return 'rare';
    return 'common';
}

function renderCard(card, extra = '') {
    return `
      <div class="jersey-card ${cardTierClass(card.tierId)} ${extra}">
        ${jerseySvg(card)}
        <div class="card-meta">
          <div>${card.tierName}</div>
          <div style="font-weight:700;margin-top:4px;">${card.player}</div>
          ${card.value > 0 ? `<div style="color:var(--gold);margin-top:4px;">${card.value} TON</div>` : ''}
        </div>
      </div>`;
}

function updateStats() {
    if (!state.user) return;
    document.getElementById('ui-balance').textContent = `${state.user.virtualBalance.toFixed(3)} TON`;
    document.getElementById('ui-coins').textContent = `${state.user.cupCoins} CC`;
    document.getElementById('ui-points').textContent = `${state.user.gamePoints} / 100`;
    document.getElementById('ui-games').textContent = String(state.user.gamesLeft);
    document.getElementById('ui-games-btn').textContent = String(state.user.gamesLeft);
}

async function loadUser() {
    const data = await api('/user', { method: 'POST', body: {} });
    state.user = data.user;
    state.inventory = data.user.inventory || [];
    updateStats();
}

async function loadDepositInfo() {
    const data = await api('/deposit-info');
    state.depositInfo = data;
    document.getElementById('deposit-wallet').textContent = data.depositWallet;
    document.getElementById('deposit-memo').textContent = data.memo;
}

function switchTab(tabId, el) {
    document.querySelectorAll('.section').forEach((s) => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach((n) => n.classList.remove('active'));
    document.getElementById(`sec-${tabId}`).classList.add('active');
    if (el) el.classList.add('active');

    if (['burn', 'sell', 'collection'].includes(tabId)) renderInventorySections();
    if (tabId === 'tasks') loadTasks();
    if (tabId === 'wallet') loadDepositInfo();
}

function openDrawer() { document.getElementById('drawer').classList.add('open'); }
function closeDrawer() { document.getElementById('drawer').classList.remove('open'); }

async function buyPack(packType) {
    try {
        const overlay = document.getElementById('opening-overlay');
        overlay.classList.add('active');

        const data = await api('/open-pack', { method: 'POST', body: { packType } });

        setTimeout(() => {
            overlay.classList.remove('active');
            showResults(data.items);
            state.inventory = data.inventory;
            state.user.virtualBalance = data.balance;
            updateStats();
            toast('Pack opened!');
        }, 1800);
    } catch (e) {
        document.getElementById('opening-overlay').classList.remove('active');
        toast(e.message);
    }
}

async function claimFreePack() {
    try {
        const data = await api('/claim-free-pack', { method: 'POST', body: {} });
        state.user = data.user;
        updateStats();
        showResults(data.items);
        toast('Daily free pack claimed!');
    } catch (e) {
        toast(e.message);
    }
}

function showResults(items) {
    const wrapper = document.getElementById('result-cards-wrapper');
    wrapper.innerHTML = items.map((item) => `<div class="reveal-card">${renderCard(item)}</div>`).join('');
    document.getElementById('results-container').classList.add('active');
}

function closeResults() {
    document.getElementById('results-container').classList.remove('active');
    loadUser().catch(() => {});
}

function renderInventorySections() {
    const commons = state.inventory.filter((c) => c.tierId === 1);
    const valuables = state.inventory.filter((c) => c.value > 0);

    document.getElementById('burn-grid').innerHTML = commons.map((c) =>
        `<div id="b-${c.uid}" onclick="toggleBurn('${c.uid}')">${renderCard(c)}</div>`
    ).join('') || '<p class="muted">No Common cards to burn.</p>';

    document.getElementById('sell-grid').innerHTML = valuables.map((c) => `
      <div>${renderCard(c)}
        <button class="action-btn secondary" style="margin-top:8px;font-size:0.85rem;padding:10px;" onclick="sellCard('${c.uid}')">Sell ${c.value} TON</button>
      </div>`).join('') || '<p class="muted">No sellable cards yet.</p>';

    document.getElementById('collection-grid').innerHTML = state.inventory.map((c) => renderCard(c)).join('')
        || '<p class="muted">Your collection is empty. Open a pack!</p>';

    updateBurnBtn();
}

function toggleBurn(uid) {
    const el = document.getElementById(`b-${uid}`)?.firstElementChild;
    if (!el) return;

    if (state.selectedBurn.includes(uid)) {
        state.selectedBurn = state.selectedBurn.filter((id) => id !== uid);
        el.classList.remove('selected');
    } else {
        if (state.selectedBurn.length >= 10) return toast('Maximum 10 cards.');
        state.selectedBurn.push(uid);
        el.classList.add('selected');
    }
    updateBurnBtn();
}

function updateBurnBtn() {
    document.getElementById('burn-btn').textContent = `Burn ${state.selectedBurn.length} / 10 Cards`;
}

async function executeBurn() {
    if (state.selectedBurn.length !== 10) return toast('Select exactly 10 Common cards.');
    try {
        const data = await api('/burn', { method: 'POST', body: { cardUids: state.selectedBurn } });
        state.selectedBurn = [];
        showResults(data.items);
        await loadUser();
        toast(data.message);
    } catch (e) { toast(e.message); }
}

async function sellCard(uid) {
    if (!confirm('Sell this card to the house?')) return;
    try {
        const data = await api('/sell', { method: 'POST', body: { cardUid: uid } });
        await loadUser();
        renderInventorySections();
        toast(data.message);
    } catch (e) { toast(e.message); }
}

async function submitWithdraw() {
    const amount = Number(document.getElementById('withdraw-amount').value);
    const walletAddress = document.getElementById('withdraw-wallet').value || state.linkedWallet;
    try {
        const data = await api('/withdraw', { method: 'POST', body: { amount, walletAddress } });
        await loadUser();
        toast(data.message);
    } catch (e) { toast(e.message); }
}

async function loadTasks() {
    const data = await api('/tasks');
    const list = document.getElementById('tasks-list');
    list.innerHTML = data.tasks.map((task) => `
      <div class="task-item">
        <div>
          <div style="font-weight:700;">${task.title}</div>
          <div class="muted">${task.reward}</div>
          ${task.url ? `<a href="${task.url}" target="_blank" style="color:var(--primary);font-size:0.8rem;">Open link</a>` : ''}
        </div>
        <button ${task.done ? 'disabled' : ''} onclick="claimTask('${task.id}')">${task.done ? 'Done' : 'Claim'}</button>
      </div>`).join('');

    document.getElementById('referral-link').textContent = data.referralLink;
}

async function claimTask(taskId) {
    try {
        const data = await api('/tasks/claim', { method: 'POST', body: { taskId } });
        state.user = data.user;
        updateStats();
        loadTasks();
        toast(data.message);
    } catch (e) { toast(e.message); }
}

function copyText(id) {
    const text = document.getElementById(id).textContent;
    navigator.clipboard.writeText(text).then(() => toast('Copied!'));
}

// Score! Hero style mini game
let gameRunning = false;
let gameScore = 0;
let gameTime = 30;
let gameLoopId = null;
let timerId = null;
let playerX = 80;
let playerY = 220;
let velocityY = 0;
let onGround = true;

const canvas = () => document.getElementById('game-canvas');
const ctx = () => canvas().getContext('2d');

function drawGame() {
    const c = canvas();
    const g = ctx();
    if (!g) return;

    g.clearRect(0, 0, c.width, c.height);

    g.fillStyle = '#166534';
    g.fillRect(0, c.height - 40, c.width, 40);

    g.fillStyle = '#fef08a';
    g.fillRect(c.width - 70, c.height - 120, 50, 80);
    g.strokeStyle = '#fff';
    g.strokeRect(c.width - 70, c.height - 120, 50, 80);

    g.fillStyle = '#38bdf8';
    g.fillRect(playerX, playerY, 28, 36);
    g.fillStyle = '#fff';
    g.fillRect(playerX + 18, playerY + 8, 12, 12);
}

function gameStep() {
    const c = canvas();
    velocityY += 0.8;
    playerY += velocityY;

    if (playerY >= c.height - 76) {
        playerY = c.height - 76;
        velocityY = 0;
        onGround = true;
    } else {
        onGround = false;
    }

    if (playerX > c.width - 90 && onGround) {
        gameScore += 1;
        playerX = 20;
        toast('GOAL! +1 point');
    }

    drawGame();
    if (gameRunning) gameLoopId = requestAnimationFrame(gameStep);
}

function jump() {
    if (onGround) velocityY = -12;
}

function startGameUI() {
    if (!state.user || state.user.gamesLeft <= 0) return toast('No games left today.');

    const c = canvas();
    c.width = c.clientWidth;
    c.height = c.clientHeight;

    gameRunning = true;
    gameScore = 0;
    gameTime = 30;
    playerX = 20;
    playerY = c.height - 76;
    velocityY = 0;

    document.getElementById('game-score').textContent = `Score: ${gameScore}`;
    document.getElementById('game-time').textContent = `Time: ${gameTime}s`;
    document.getElementById('start-game-btn').disabled = true;

    timerId = setInterval(() => {
        gameTime -= 1;
        document.getElementById('game-time').textContent = `Time: ${gameTime}s`;
        if (gameTime <= 0) endGameUI();
    }, 1000);

    gameLoopId = requestAnimationFrame(gameStep);
}

async function endGameUI() {
    gameRunning = false;
    cancelAnimationFrame(gameLoopId);
    clearInterval(timerId);

    const points = gameScore * 10;
    document.getElementById('start-game-btn').disabled = false;

    try {
        const data = await api('/play-game', { method: 'POST', body: { score: points } });
        state.user = data.user;
        updateStats();
        toast(data.message);
        if (data.freePackItems?.length) showResults(data.freePackItems);
    } catch (e) {
        toast(e.message);
    }
}

function bindGameControls() {
    const c = canvas();
    c.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (!gameRunning) return;
        const touchX = e.touches[0].clientX;
        playerX = Math.min(c.width - 40, playerX + 24);
        if (touchX > c.width * 0.65) jump();
    });

    c.addEventListener('click', () => {
        if (!gameRunning) return;
        playerX = Math.min(c.width - 40, playerX + 24);
        jump();
    });
}

async function setupTonConnect() {
    if (!window.TON_CONNECT_UI) return;

    const tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
        manifestUrl: `${window.location.origin}/tonconnect-manifest.json`,
        buttonRootId: 'ton-connect'
    });

    tonConnectUI.onStatusChange((wallet) => {
        if (wallet?.account?.address) {
            state.linkedWallet = wallet.account.address;
            document.getElementById('withdraw-wallet').value = wallet.account.address;
            api('/wallet', { method: 'POST', body: { walletAddress: wallet.account.address } }).catch(() => {});
        }
    });
}

window.switchTab = switchTab;
window.openDrawer = openDrawer;
window.closeDrawer = closeDrawer;
window.buyPack = buyPack;
window.claimFreePack = claimFreePack;
window.closeResults = closeResults;
window.toggleBurn = toggleBurn;
window.executeBurn = executeBurn;
window.sellCard = sellCard;
window.submitWithdraw = submitWithdraw;
window.claimTask = claimTask;
window.copyText = copyText;
window.startGameUI = startGameUI;

document.addEventListener('DOMContentLoaded', async () => {
    bindGameControls();
    setupTonConnect();

    try {
        await loadUser();
        await loadDepositInfo();
    } catch (e) {
        toast('Open this app inside Telegram for full access.');
        if (!tg?.initData) {
            state.user = { virtualBalance: 0, cupCoins: 0, gamePoints: 0, gamesLeft: 2 };
            updateStats();
        }
    }
});
