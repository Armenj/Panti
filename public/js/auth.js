// ============================================================================
//  panti — клиентская авторизация по телефону + личный кабинет.
//  Управляет экраном входа, онбордингом, навигацией кабинета и разделами
//  (Быстрая игра / Онлайн / Друзья / Статистика / Лидеры / Люди).
// ============================================================================
(function () {
    'use strict';

    const TOKEN_KEY = 'panti_auth';
    const $ = (id) => document.getElementById(id);

    let currentUser = null;
    let isGuest = false;
    let pollPhone = null;
    let pollToken = null;
    let pollTimer = null;
    const LOCKED_SECTIONS = ['cab-online', 'cab-friends', 'cab-stats', 'cab-leaders', 'cab-people'];

    // ---- токен ----
    function getToken() { try { return localStorage.getItem(TOKEN_KEY); } catch (e) { return null; } }
    function setToken(t) { try { localStorage.setItem(TOKEN_KEY, t); } catch (e) {} }
    function clearToken() { try { localStorage.removeItem(TOKEN_KEY); } catch (e) {} }
    function clearGuestFlag() { try { sessionStorage.removeItem('panti_guest'); } catch (e) {} }

    // Кэш профиля — чтобы кабинет рисовался МГНОВЕННО, без ожидания /api/me (анти-белый-экран)
    function cacheUser(u) { try { localStorage.setItem('panti_user', JSON.stringify(u)); } catch (e) {} }
    function getCachedUser() { try { return JSON.parse(localStorage.getItem('panti_user') || 'null'); } catch (e) { return null; } }
    function clearUserCache() { try { localStorage.removeItem('panti_user'); } catch (e) {} }

    function hideSplash() { window.__pantiBooted = true; const e = $('app-splash'); if (e) e.classList.add('hidden'); }

    // ---- Telegram Mini App ----
    function tgApp() { return window.Telegram && window.Telegram.WebApp; }
    function inTelegram() { const t = tgApp(); return !!(t && t.initData && t.initData.length > 0); }

    // Отступ под хедер Telegram (Закрыть/•••), чтобы не наезжал на аватар
    function applyTgInsets() {
        const tg = tgApp();
        if (!tg) return;
        const sa = tg.safeAreaInset || {};
        const csa = tg.contentSafeAreaInset || {};
        const top = (sa.top || 0) + (csa.top || 0);
        document.documentElement.style.setProperty('--tg-top', top + 'px');
    }

    let tgChromeDone = false;
    function setupTgChrome() {
        if (tgChromeDone) return;
        tgChromeDone = true;
        const tg = tgApp();
        document.body.classList.add('tg-app');
        try {
            tg.ready(); tg.expand();
            if (tg.setHeaderColor) tg.setHeaderColor('#1d4b40');
            applyTgInsets();
            if (tg.onEvent) {
                tg.onEvent('safeAreaChanged', applyTgInsets);
                tg.onEvent('contentSafeAreaChanged', applyTgInsets);
                tg.onEvent('viewportChanged', applyTgInsets);
                // Возврат в Mini App после сворачивания — пробуем восстановить онлайн-игру
                tg.onEvent('activated', tgResume);
            }
        } catch (e) {}
        document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') tgResume(); });
    }
    function tgResume() {
        try { if (window.gameClient && gameClient.roomId && typeof gameClient.checkConnectionAndReconnect === 'function') gameClient.checkConnectionAndReconnect(); } catch (e) {}
    }

    async function initTelegram() {
        const tg = tgApp();
        setupTgChrome();

        const r = await api('/auth/telegram', { method: 'POST', body: { initData: tg.initData } });
        if (!r.ok || !r.data.token) {
            // Подпись не прошла / ошибка — показываем экран входа по номеру как запасной
            authStep('phone');
            authError('Не удалось войти через Telegram, войдите по номеру');
            showAuth();
            return;
        }
        setToken(r.data.token);
        cacheUser(r.data.user);
        // Сокет уже подключился анонимно (токена не было на момент загрузки) —
        // переподключаем с токеном, чтобы онлайн-статистика привязалась к аккаунту.
        try {
            if (window.gameClient && gameClient.socket) {
                gameClient.socket.auth = { token: r.data.token };
                gameClient.socket.disconnect().connect();
            }
        } catch (e) {}
        setupCabinet(r.data.user);
        showCabinet();

        // Один раз предлагаем привязать номер (объединить с PWA-аккаунтом)
        if (r.data.needsPhoneLink && typeof tg.requestContact === 'function') {
            try {
                if (!localStorage.getItem('panti_tg_link_asked')) {
                    localStorage.setItem('panti_tg_link_asked', '1');
                    showPhoneLinkPrompt();
                }
            } catch (e) {}
        }
    }

    function showPhoneLinkPrompt() {
        removeEl('tg-link-pop');
        const o = document.createElement('div');
        o.id = 'tg-link-pop'; o.className = 'cab-overlay';
        o.innerHTML = `<div class="cab-pop">
            <div class="cab-pop-title">Объединить аккаунт</div>
            <div class="cab-pop-sub">Если вы уже играли на сайте по номеру телефона — подтяните статистику и друзей. Если номер в Telegram совпадает с тем, что был на сайте — хватит одного тапа.</div>
            <div class="cab-pop-btns">
                <button class="primary-btn" id="tg-link-share">Поделиться номером Telegram</button>
                <button class="secondary-btn" id="tg-link-manual">Указать другой номер</button>
            </div>
            <button class="cab-pop-cancel">Позже</button>
        </div>`;
        document.body.appendChild(o);
        o.querySelector('.cab-pop-cancel').addEventListener('click', () => removeEl('tg-link-pop'));
        $('tg-link-manual').addEventListener('click', () => { removeEl('tg-link-pop'); showManualPhoneLink(); });
        $('tg-link-share').addEventListener('click', () => {
            const tg = tgApp();
            removeEl('tg-link-pop');
            if (!tg || typeof tg.requestContact !== 'function') { notify('Недоступно в этой версии Telegram', 'error'); return; }
            tg.requestContact(async (ok, ev) => {
                if (!ok) return;
                // Извлекаем подписанную строку контакта (формат отличается между версиями)
                const signed = ev && (ev.response || (ev.responseUnsafe && ev.responseUnsafe.response));
                if (!signed) { notify('Не удалось получить номер', 'error'); return; }
                const lr = await api('/me/link-contact', { method: 'POST', body: { contact: signed } });
                if (lr.ok) {
                    currentUser = lr.data.user; cacheUser(currentUser);
                    applyUser(currentUser);
                    notify('Аккаунт объединён ✓', 'success');
                } else {
                    notify((lr.data && lr.data.error) || 'Не удалось привязать номер', 'error');
                }
            });
        });
    }

    // ---- API ----
    async function api(path, opts) {
        opts = opts || {};
        const headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
        const t = getToken();
        if (t) headers['Authorization'] = 'Bearer ' + t;
        let res;
        // Таймаут 12с, чтобы запрос не «висел» вечно (иначе списки застревают на «Загрузка…»)
        const ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
        const to = ctrl ? setTimeout(() => ctrl.abort(), 12000) : null;
        try {
            res = await fetch('/api' + path, {
                method: opts.method || 'GET',
                headers,
                body: opts.body ? JSON.stringify(opts.body) : undefined,
                signal: ctrl ? ctrl.signal : undefined
            });
        } catch (e) {
            if (to) clearTimeout(to);
            return { ok: false, status: 0, data: { error: 'Нет связи с сервером' } };
        }
        if (to) clearTimeout(to);
        let data = null;
        try { data = await res.json(); } catch (e) {}
        return { ok: res.ok, status: res.status, data: data || {} };
    }

    function notify(msg, type) {
        if (typeof window.showNotification === 'function') window.showNotification(msg, type || 'info');
    }

    // Маска российского номера: пользователь вводит как угодно (с +7, 8 или сразу
    // цифры мобильного) — приводим к виду +7 (999) 123-45-67. Сервер всё равно
    // нормализует, но так удобнее вводить.
    function formatRu(raw) {
        let d = String(raw || '').replace(/\D/g, '');
        if (!d) return '';
        if (d[0] === '8') d = '7' + d.slice(1);
        else if (d[0] !== '7') d = '7' + d; // ввели сразу 9XX... → добавляем код страны
        d = d.slice(0, 11);
        const r = d.slice(1);
        let out = '+7';
        if (r.length) out += ' (' + r.slice(0, 3);
        if (r.length >= 3) out += ')';
        if (r.length > 3) out += ' ' + r.slice(3, 6);
        if (r.length > 6) out += '-' + r.slice(6, 8);
        if (r.length > 8) out += '-' + r.slice(8, 10);
        return out;
    }
    function attachPhoneMask(input) {
        if (!input || input._maskAttached) return;
        input._maskAttached = true;
        input.setAttribute('inputmode', 'tel');
        input.addEventListener('focus', () => { if (!input.value.trim()) input.value = '+7 '; });
        input.addEventListener('input', () => { input.value = formatRu(input.value); });
        input.addEventListener('blur', () => { if (input.value === '+7' || input.value === '+7 ') input.value = ''; });
    }

    // Тап по номеру для дозвона: пробуем открыть набор + копируем в буфер (фолбэк,
    // если tel: в Mini App не сработал — пользователь вставит вручную).
    function wireCallNumber(el, num) {
        if (!el) return;
        const clean = String(num).replace(/[^\d+]/g, '');
        el.setAttribute('href', 'tel:' + clean);
        el.addEventListener('click', () => {
            try { if (navigator.clipboard) navigator.clipboard.writeText(clean); } catch (e) {}
            const tg = tgApp();
            try {
                if (tg && typeof tg.openLink === 'function') tg.openLink('tel:' + clean);
                else window.location.href = 'tel:' + clean;
            } catch (e) {}
            notify('Номер скопирован', 'success');
        });
    }

    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
            ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    // ---- управление экранами верхнего уровня ----
    function hideAllScreens() {
        ['auth-screen', 'game-setup', 'game-board', 'game-results'].forEach(id => {
            const e = $(id); if (e) e.classList.add('hidden');
        });
    }
    function showAuth() { hideSplash(); hideAllScreens(); $('auth-screen').classList.remove('hidden'); }
    function showCabinet() { hideSplash(); hideAllScreens(); $('game-setup').classList.remove('hidden'); }
    function inActiveGame() {
        return !$('game-board').classList.contains('hidden') || !$('game-results').classList.contains('hidden');
    }

    // ---- шаги экрана входа ----
    function authStep(step) {
        ['auth-step-phone', 'auth-step-wait', 'auth-step-name'].forEach(id => {
            const e = $(id); if (e) e.classList.add('hidden');
        });
        const el = $('auth-step-' + step);
        if (el) el.classList.remove('hidden');
    }
    function authError(msg) {
        const e = $('auth-error');
        if (!e) return;
        if (msg) { e.textContent = msg; e.classList.remove('hidden'); }
        else { e.classList.add('hidden'); }
    }

    // ---- поллинг подтверждения звонка ----
    function stopPolling() { if (pollTimer) { clearInterval(pollTimer); pollTimer = null; } }

    function startPolling() {
        stopPolling();
        pollTimer = setInterval(async () => {
            if (!pollPhone || !pollToken) return;
            const r = await api('/auth/phone/wait/status', {
                method: 'POST', body: { phone: pollPhone, pollToken }
            });
            if (!r.ok) {
                if (r.status === 404) { stopPolling(); backToPhone('Сессия истекла, попробуйте снова'); }
                return;
            }
            if (r.data.status === 'expired') {
                stopPolling();
                backToPhone('Время ожидания вышло, попробуйте снова');
            } else if (r.data.status === 'confirmed') {
                stopPolling();
                if (r.data.token) setToken(r.data.token);
                clearGuestFlag();
                if (r.data.user) cacheUser(r.data.user);
                if (r.data.isNew) {
                    authStep('name');
                    setTimeout(() => { const f = $('auth-firstname'); if (f) f.focus(); }, 100);
                } else {
                    // профиль уже есть — перезагружаемся, чтобы сокет подхватил токен
                    location.reload();
                }
            }
        }, 2500);
    }

    function backToPhone(msg) {
        authStep('phone');
        if (msg) authError(msg);
    }

    async function onStartLogin() {
        authError(null);
        const phone = ($('auth-phone').value || '').trim();
        const digits = phone.replace(/\D/g, '');
        if (digits.length < 10) { authError('Введите корректный номер телефона'); return; }

        const btn = $('auth-start-btn');
        btn.disabled = true; btn.textContent = 'Отправляем…';
        const r = await api('/auth/phone/wait/start', { method: 'POST', body: { phone } });
        btn.disabled = false; btn.textContent = 'Продолжить';

        if (!r.ok) { authError(r.data.error || 'Не удалось начать вход'); return; }

        pollPhone = phone;
        pollToken = r.data.pollToken;

        const callBox = $('auth-call-box');
        const waitText = $('auth-wait-text');
        if (r.data.dev || r.data.number === 'DEV') {
            // dev-режим: звонок имитируется, просто ждём подтверждения
            if (callBox) callBox.classList.add('hidden');
            if (waitText) waitText.textContent = 'Подтверждаем вход…';
        } else {
            if (callBox) callBox.classList.remove('hidden');
            const num = String(r.data.number);
            const link = $('auth-call-number');
            if (link) { link.textContent = num; wireCallNumber(link, num); }
            if (waitText) waitText.textContent = 'Ожидаем звонок…';
        }
        authStep('wait');
        startPolling();
    }

    async function onSubmitName() {
        const errEl = $('auth-name-error');
        const first = ($('auth-firstname').value || '').trim();
        const last = ($('auth-lastname').value || '').trim();
        if (!first) {
            if (errEl) { errEl.textContent = 'Имя обязательно'; errEl.classList.remove('hidden'); }
            return;
        }
        if (errEl) errEl.classList.add('hidden');
        const btn = $('auth-name-btn');
        btn.disabled = true; btn.textContent = 'Сохраняем…';
        const r = await api('/me/profile', { method: 'POST', body: { firstName: first, lastName: last } });
        btn.disabled = false; btn.textContent = 'Готово';
        if (!r.ok) {
            if (errEl) { errEl.textContent = r.data.error || 'Ошибка сохранения'; errEl.classList.remove('hidden'); }
            return;
        }
        if (r.data.user) cacheUser(r.data.user);
        location.reload();
    }

    async function onLogout() {
        await api('/auth/logout', { method: 'POST' });
        clearToken();
        clearUserCache();
        clearGuestFlag();
        location.reload();
    }

    // ---- гостевой режим (игра без входа: только быстрая игра) ----
    function enterGuest(skipShow) {
        isGuest = true;
        try { sessionStorage.setItem('panti_guest', '1'); } catch (e) {}
        const nameEl = $('cab-username');
        if (nameEl) nameEl.textContent = 'Гость';
        const avEl = $('cab-avatar');
        if (avEl) avEl.textContent = 'Г';
        const editBtn = $('cab-edit-profile');
        if (editBtn) editBtn.style.display = 'none';

        document.querySelectorAll('.cab-nav-btn').forEach(b => {
            b.addEventListener('click', () => {
                if (LOCKED_SECTIONS.includes(b.dataset.section)) promptLogin();
                else activateSection(b.dataset.section);
            });
        });
        const peopleBtn = $('cab-people-btn');
        if (peopleBtn) peopleBtn.addEventListener('click', promptLogin);
        const createBtn = $('cab-create-btn');
        if (createBtn) createBtn.addEventListener('click', promptLogin);
        const logoutBtn = $('cab-logout-btn');
        if (logoutBtn) { logoutBtn.textContent = 'Войти'; logoutBtn.title = 'Войти в аккаунт'; logoutBtn.addEventListener('click', promptLogin); }

        if (skipShow) { hideSplash(); return; } // идёт восстановленная игра — кабинет готов на выход
        showCabinet();
        activateSection('cab-quick');
    }
    function promptLogin() {
        authStep('phone');
        authError(null);
        showAuth();
    }

    // ---- кабинет: навигация ----
    function activateSection(sectionId) {
        if (isGuest && LOCKED_SECTIONS.includes(sectionId)) { promptLogin(); return; }
        document.querySelectorAll('.cab-section').forEach(s => s.classList.add('hidden'));
        const sec = $(sectionId);
        if (sec) sec.classList.remove('hidden');
        document.querySelectorAll('.cab-nav-btn').forEach(b =>
            b.classList.toggle('active', b.dataset.section === sectionId));
        // прокрутка тела кабинета вверх
        const body = document.querySelector('.cab-body');
        if (body) body.scrollTop = 0;

        if (sectionId === 'cab-friends') loadFriends();
        else if (sectionId === 'cab-stats') loadStats();
        else if (sectionId === 'cab-leaders') loadLeaders();
        else if (sectionId === 'cab-people') loadPeople('');
    }

    // ---- разделы ----
    async function loadFriends(silent) {
        const box = $('friends-list');
        if (!silent) box.innerHTML = '<div class="cab-empty">Загрузка…</div>';
        const r = await api('/friends');
        if (!r.ok) { box.innerHTML = '<div class="cab-empty">Ошибка загрузки</div>'; return; }
        const friends = r.data.friends || [];
        if (!friends.length) {
            box.innerHTML = '<div class="cab-empty">Пока никого. Найдите игроков в разделе «Люди» 👥</div>';
            return;
        }
        box.innerHTML = friends.map(f => `
            <div class="cab-row">
                <div class="cab-row-main">
                    <div class="cab-avatar">${avatarInner(f.name, f.avatarUrl)}<span class="cab-dot ${f.online ? 'on' : 'off'}"></span></div>
                    <div class="cab-row-info">
                        <div class="cab-row-name">${esc(f.name)}</div>
                        <div class="cab-row-sub">${f.online ? '🟢 в сети' : 'не в сети'} · Побед: ${f.wins}</div>
                    </div>
                </div>
                <div class="cab-row-actions">
                    <button class="cab-mini-btn ${f.online ? 'cab-mini-accent' : 'cab-mini-ghost'}" data-invite="${f.id}" data-name="${esc(f.name)}" data-online="${f.online ? '1' : '0'}">🎮 Позвать</button>
                    <button class="cab-mini-btn cab-mini-danger" data-remove="${f.id}">Удалить</button>
                </div>
            </div>`).join('');
        box.querySelectorAll('[data-remove]').forEach(b => {
            b.addEventListener('click', async () => {
                await api('/friends/' + b.dataset.remove, { method: 'DELETE' });
                loadFriends();
            });
        });
        box.querySelectorAll('[data-invite]').forEach(b => {
            b.addEventListener('click', () => {
                if (b.dataset.online !== '1') { notify('Друг сейчас не в сети', 'error'); return; }
                showInviteChooser(parseInt(b.dataset.invite, 10), b.dataset.name);
            });
        });
    }

    async function loadStats() {
        const box = $('stats-content');
        box.innerHTML = '<div class="cab-empty">Загрузка…</div>';
        const r = await api('/stats');
        if (!r.ok) { box.innerHTML = '<div class="cab-empty">Ошибка загрузки</div>'; return; }
        const s = r.data.user.stats;
        const o = s.online, c = s.comp;
        const owr = o.games ? Math.round((o.wins / o.games) * 100) : 0;
        const cwr = c.games ? Math.round((c.wins / c.games) * 100) : 0;
        box.innerHTML = `
            <div class="stats-card">
                <div class="stats-card-title">🌐 Онлайн-игры</div>
                <div class="stats-grid">
                    <div class="stat-cell"><span class="stat-num">${o.games}</span><span class="stat-lbl">Игр</span></div>
                    <div class="stat-cell stat-win"><span class="stat-num">${o.wins}</span><span class="stat-lbl">Побед</span></div>
                    <div class="stat-cell stat-loss"><span class="stat-num">${o.losses}</span><span class="stat-lbl">Поражений</span></div>
                    <div class="stat-cell"><span class="stat-num">${owr}%</span><span class="stat-lbl">Винрейт</span></div>
                </div>
            </div>
            <div class="stats-card">
                <div class="stats-card-title">🖥️ Против компьютера</div>
                <div class="stats-grid">
                    <div class="stat-cell"><span class="stat-num">${c.games}</span><span class="stat-lbl">Игр</span></div>
                    <div class="stat-cell stat-win"><span class="stat-num">${c.wins}</span><span class="stat-lbl">Побед</span></div>
                    <div class="stat-cell stat-loss"><span class="stat-num">${c.losses}</span><span class="stat-lbl">Поражений</span></div>
                    <div class="stat-cell"><span class="stat-num">${cwr}%</span><span class="stat-lbl">Винрейт</span></div>
                </div>
            </div>`;
    }

    async function loadLeaders() {
        const box = $('leaders-list');
        box.innerHTML = '<div class="cab-empty">Загрузка…</div>';
        const r = await api('/leaderboard');
        if (!r.ok) { box.innerHTML = '<div class="cab-empty">Ошибка загрузки</div>'; return; }
        const leaders = r.data.leaders || [];
        if (!leaders.length) { box.innerHTML = '<div class="cab-empty">Пока нет сыгранных онлайн-матчей</div>'; return; }
        box.innerHTML = leaders.map(l => {
            const medal = l.rank === 1 ? '🥇' : l.rank === 2 ? '🥈' : l.rank === 3 ? '🥉' : l.rank;
            return `
            <div class="cab-row ${l.isMe ? 'cab-row-me' : ''}">
                <div class="cab-row-main">
                    <div class="cab-rank">${medal}</div>
                    <div class="cab-avatar cab-avatar-sm">${avatarInner(l.name, l.avatarUrl)}</div>
                    <div class="cab-row-info">
                        <div class="cab-row-name">${esc(l.name)}${l.isMe ? ' <em>(вы)</em>' : ''}</div>
                        <div class="cab-row-sub">Винрейт ${l.winrate}% · Игр: ${l.games}</div>
                    </div>
                </div>
                <div class="cab-wins">${l.wins}<span>побед</span></div>
            </div>`;
        }).join('');
    }

    let peopleSearchTimer = null;
    async function loadPeople(q, silent) {
        const box = $('people-list');
        if (!silent) box.innerHTML = '<div class="cab-empty">Загрузка…</div>';
        const r = await api('/users?q=' + encodeURIComponent(q || ''));
        if (!r.ok) { box.innerHTML = '<div class="cab-empty">Ошибка загрузки</div>'; return; }
        const users = r.data.users || [];
        if (!users.length) { box.innerHTML = '<div class="cab-empty">Никого не найдено</div>'; return; }
        box.innerHTML = users.map(u => `
            <div class="cab-row">
                <div class="cab-row-main">
                    <div class="cab-avatar">${avatarInner(u.name, u.avatarUrl)}<span class="cab-dot ${u.online ? 'on' : 'off'}"></span></div>
                    <div class="cab-row-info">
                        <div class="cab-row-name">${esc(u.name)}</div>
                        <div class="cab-row-sub">${u.online ? '🟢 в сети' : 'не в сети'} · Побед: ${u.wins}</div>
                    </div>
                </div>
                <button class="cab-mini-btn ${u.isFriend ? 'cab-mini-ghost' : 'cab-mini-accent'}"
                        data-id="${u.id}" data-friend="${u.isFriend ? '1' : '0'}">
                    ${u.isFriend ? 'В друзьях ✓' : '+ В друзья'}
                </button>
            </div>`).join('');
        box.querySelectorAll('[data-id]').forEach(b => {
            b.addEventListener('click', async () => {
                const id = b.dataset.id;
                if (b.dataset.friend === '1') {
                    await api('/friends/' + id, { method: 'DELETE' });
                } else {
                    await api('/friends', { method: 'POST', body: { friendId: parseInt(id, 10) } });
                }
                loadPeople($('people-search').value || '');
            });
        });
    }

    function initials(name) {
        const parts = String(name || '').trim().split(/\s+/);
        let s = (parts[0] || '').charAt(0);
        if (parts[1]) s += parts[1].charAt(0);
        return s.toUpperCase() || '?';
    }

    // Содержимое аватар-кружка: фото, если есть, иначе инициалы
    function avatarInner(name, url) {
        return url ? `<img class="cab-avatar-img" src="${esc(url)}" alt="">` : esc(initials(name));
    }

    // ---- приглашения в игру ----
    function removeEl(id) { const e = $(id); if (e) e.remove(); }

    function showInviteChooser(friendId, name) {
        removeEl('invite-chooser');
        const o = document.createElement('div');
        o.id = 'invite-chooser'; o.className = 'cab-overlay';
        o.innerHTML = `<div class="cab-pop">
            <div class="cab-pop-title">Позвать ${esc(name)} в игру</div>
            <div class="cab-pop-sub">Выберите длину (1 на 1)</div>
            <div class="cab-pop-btns">
                <button class="primary-btn" data-t="21">До 21 очка</button>
                <button class="primary-btn" data-t="11">До 11 очков</button>
            </div>
            <button class="cab-pop-cancel">Отмена</button>
        </div>`;
        document.body.appendChild(o);
        o.querySelectorAll('[data-t]').forEach(b => b.addEventListener('click', () => {
            removeEl('invite-chooser');
            gameClient.inviteFriend(friendId, parseInt(b.dataset.t, 10));
            showInviteWaiting(name);
        }));
        o.querySelector('.cab-pop-cancel').addEventListener('click', () => removeEl('invite-chooser'));
        o.addEventListener('click', e => { if (e.target === o) removeEl('invite-chooser'); });
    }

    function showInviteWaiting(name) {
        removeEl('invite-waiting');
        const o = document.createElement('div');
        o.id = 'invite-waiting'; o.className = 'cab-overlay';
        o.innerHTML = `<div class="cab-pop">
            <div class="auth-spinner"></div>
            <div class="cab-pop-title">Ждём ответа…</div>
            <div class="cab-pop-sub">Приглашение отправлено: ${esc(name)}</div>
            <button class="cab-pop-cancel">Отмена</button>
        </div>`;
        document.body.appendChild(o);
        o.querySelector('.cab-pop-cancel').addEventListener('click', () => {
            hideInviteWaiting();
            try { gameClient.leaveGame(); } catch (e) {}
        });
    }
    function hideInviteWaiting() { removeEl('invite-waiting'); }

    function showIncomingInvite(data) {
        removeEl('incoming-invite');
        const o = document.createElement('div');
        o.id = 'incoming-invite'; o.className = 'cab-overlay invite-overlay';
        const len = data.targetScore === 11 ? 'до 11 очков' : 'до 21 очка';
        o.innerHTML = `<div class="cab-pop invite-pop">
            <div class="ib-emoji">🎴</div>
            <div class="cab-pop-title">${esc(data.fromName)} зовёт в игру</div>
            <div class="cab-pop-sub">1 на 1 · ${len}</div>
            <div class="cab-pop-btns">
                <button class="primary-btn ib-accept">Принять</button>
                <button class="secondary-btn ib-decline">Отклонить</button>
            </div>
        </div>`;
        document.body.appendChild(o);
        try { const tg = tgApp(); if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('warning'); } catch (e) {}
        o.querySelector('.ib-accept').addEventListener('click', () => { gameClient.respondInvite(data.inviteId, true); hideIncomingInvite(); });
        o.querySelector('.ib-decline').addEventListener('click', () => { gameClient.respondInvite(data.inviteId, false); hideIncomingInvite(); });
        setTimeout(() => hideIncomingInvite(), 60000);
    }
    function hideIncomingInvite() { removeEl('incoming-invite'); }

    function wireInviteHooks() {
        gameClient.onGameInvite = showIncomingInvite;
        gameClient.onInviteSent = (data) => {
            // приглашающий — слот 0 в созданной комнате
            try { gameState.isOnlineGame = true; gameState.roomId = data.roomId; gameState.playerIndex = 0; } catch (e) {}
        };
        gameClient.onInviteDeclined = (data) => { hideInviteWaiting(); notify((data && data.byName || 'Друг') + ' отклонил приглашение', 'error'); };
        gameClient.onInviteExpired = () => { hideInviteWaiting(); hideIncomingInvite(); notify('Приглашение истекло', 'info'); };
        gameClient.onInviteFailed = (data) => { hideInviteWaiting(); notify(data && data.reason === 'offline' ? 'Друг сейчас не в сети' : 'Не удалось пригласить', 'error'); };
        // при старте игры закрываем оверлеи приглашений (сохраняя обработчик main.js)
        const prev = gameClient.onGameStart;
        gameClient.onGameStart = function (gs) { hideInviteWaiting(); hideIncomingInvite(); if (typeof prev === 'function') prev(gs); };

        // презенс в реальном времени → тихо обновляем активную вкладку со статусами
        gameClient.onPresence = () => refreshPresenceTab();
    }

    // Тихо обновляет вкладку, где показан онлайн-статус (Друзья/Люди), без мигания «Загрузка…»
    let presenceTimer = null;
    function refreshPresenceTab() {
        clearTimeout(presenceTimer);
        presenceTimer = setTimeout(() => {
            if (isGuest) return;
            if (!$('cab-friends').classList.contains('hidden')) loadFriends(true);
            else if (!$('cab-people').classList.contains('hidden')) loadPeople($('people-search').value || '', true);
        }, 400);
    }

    // Ручная привязка номера с сайта (PWA) через звонок — для случая, когда номер
    // в Telegram отличается от номера регистрации на сайте.
    let linkPollTimer = null;
    function stopLinkPoll() { if (linkPollTimer) { clearInterval(linkPollTimer); linkPollTimer = null; } }

    function showManualPhoneLink() {
        removeEl('manual-link-pop');
        const o = document.createElement('div');
        o.id = 'manual-link-pop'; o.className = 'cab-overlay';
        o.innerHTML = `<div class="cab-pop">
            <div class="cab-pop-title">Привязать аккаунт с сайта</div>
            <div class="cab-pop-sub">Введите номер, на который вы регистрировались на сайте. Подтверждение — звонком (код вводить не нужно).</div>
            <div id="ml-step-phone">
                <input id="ml-phone" class="auth-input" type="tel" inputmode="tel" placeholder="+7 999 123-45-67">
                <button id="ml-start" class="primary-btn auth-btn">Получить звонок</button>
            </div>
            <div id="ml-step-wait" class="hidden">
                <div id="ml-call-box" class="auth-call-box">
                    <p>Позвоните на этот номер (звонок бесплатный, сбросится сам):</p>
                    <a id="ml-call-number" class="auth-call-number" href="#"></a>
                </div>
                <div class="auth-spinner"></div>
                <p class="auth-waiting" id="ml-wait-text">Ожидаем звонок…</p>
            </div>
            <div id="ml-error" class="auth-error hidden"></div>
            <button class="cab-pop-cancel">Закрыть</button>
        </div>`;
        document.body.appendChild(o);
        attachPhoneMask($('ml-phone'));
        const close = () => { stopLinkPoll(); removeEl('manual-link-pop'); };
        o.querySelector('.cab-pop-cancel').addEventListener('click', close);

        const err = (m) => { const e = $('ml-error'); if (m) { e.textContent = m; e.classList.remove('hidden'); } else e.classList.add('hidden'); };

        $('ml-start').addEventListener('click', async () => {
            err(null);
            const phone = ($('ml-phone').value || '').trim();
            if (phone.replace(/\D/g, '').length < 10) { err('Введите корректный номер'); return; }
            const btn = $('ml-start'); btn.disabled = true; btn.textContent = 'Отправляем…';
            const r = await api('/me/link-phone/start', { method: 'POST', body: { phone } });
            btn.disabled = false; btn.textContent = 'Получить звонок';
            if (!r.ok) { err(r.data.error || 'Не удалось начать'); return; }

            $('ml-step-phone').classList.add('hidden');
            $('ml-step-wait').classList.remove('hidden');
            if (r.data.dev || r.data.number === 'DEV') {
                $('ml-call-box').classList.add('hidden');
                $('ml-wait-text').textContent = 'Подтверждаем…';
            } else {
                const num = String(r.data.number);
                const link = $('ml-call-number');
                link.textContent = num; wireCallNumber(link, num);
            }
            // поллинг подтверждения
            stopLinkPoll();
            linkPollTimer = setInterval(async () => {
                const s = await api('/me/link-phone/status', { method: 'POST', body: { phone, pollToken: r.data.pollToken } });
                if (s.status === 404) { stopLinkPoll(); err('Сессия истекла, попробуйте снова'); $('ml-step-phone').classList.remove('hidden'); $('ml-step-wait').classList.add('hidden'); return; }
                if (!s.ok) {
                    if (s.data && s.data.error) { stopLinkPoll(); err(s.data.error); $('ml-step-phone').classList.remove('hidden'); $('ml-step-wait').classList.add('hidden'); }
                    return;
                }
                if (s.data.status === 'expired') { stopLinkPoll(); err('Время вышло, попробуйте снова'); $('ml-step-phone').classList.remove('hidden'); $('ml-step-wait').classList.add('hidden'); }
                else if (s.data.status === 'confirmed') {
                    stopLinkPoll();
                    currentUser = s.data.user; cacheUser(currentUser); applyUser(currentUser);
                    removeEl('manual-link-pop');
                    notify('Аккаунт объединён ✓', 'success');
                }
            }, 2500);
        });
    }

    // ---- профиль: аватар + редактирование ----
    function refreshGreetingAvatar() {
        const el = $('cab-avatar');
        if (!el) return;
        if (currentUser && currentUser.avatarUrl) {
            el.innerHTML = `<img class="cab-avatar-img" src="${esc(currentUser.avatarUrl)}" alt="">`;
        } else {
            el.textContent = currentUser ? initials(currentUser.name) : '?';
        }
    }

    // Ужимаем выбранное фото до 256×256 (квадрат, обрезка по центру), JPEG
    function resizeImage(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = () => reject(new Error('read'));
            reader.onload = () => {
                const img = new Image();
                img.onerror = () => reject(new Error('img'));
                img.onload = () => {
                    const S = 256;
                    const canvas = document.createElement('canvas');
                    canvas.width = S; canvas.height = S;
                    const ctx = canvas.getContext('2d');
                    const side = Math.min(img.width, img.height);
                    const sx = (img.width - side) / 2;
                    const sy = (img.height - side) / 2;
                    ctx.drawImage(img, sx, sy, side, side, 0, 0, S, S);
                    resolve(canvas.toDataURL('image/jpeg', 0.85));
                };
                img.src = reader.result;
            };
            reader.readAsDataURL(file);
        });
    }

    let pendingAvatar = null;
    function showProfileEditor() {
        if (!currentUser) return;
        pendingAvatar = null;
        removeEl('profile-editor');
        const o = document.createElement('div');
        o.id = 'profile-editor'; o.className = 'cab-overlay';
        o.innerHTML = `<div class="cab-pop">
            <div class="cab-pop-title">Профиль</div>
            <div class="pe-avatar-wrap">
                <div id="pe-avatar" class="pe-avatar">${avatarInner(currentUser.name, currentUser.avatarUrl)}</div>
                <button id="pe-pick" class="cab-mini-btn cab-mini-accent">Изменить фото</button>
                <input id="pe-file" type="file" accept="image/*" style="display:none">
            </div>
            <input id="pe-first" class="auth-input" placeholder="Имя (обязательно)" maxlength="40" value="${esc(currentUser.firstName)}">
            <input id="pe-last" class="auth-input" placeholder="Фамилия (по желанию)" maxlength="40" value="${esc(currentUser.lastName)}">
            <div id="pe-error" class="auth-error hidden"></div>
            <button id="pe-save" class="primary-btn auth-btn">Сохранить</button>
            ${(inTelegram() && !currentUser.hasPhone) ? '<button id="pe-link-phone" class="secondary-btn auth-btn">🔗 Привязать аккаунт с сайта</button>' : ''}
            <button class="cab-pop-cancel">Отмена</button>
        </div>`;
        document.body.appendChild(o);
        const peLink = $('pe-link-phone');
        if (peLink) peLink.addEventListener('click', () => { removeEl('profile-editor'); showManualPhoneLink(); });
        o.addEventListener('click', e => { if (e.target === o) removeEl('profile-editor'); });
        o.querySelector('.cab-pop-cancel').addEventListener('click', () => removeEl('profile-editor'));

        const fileInput = $('pe-file');
        $('pe-pick').addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', async () => {
            const f = fileInput.files && fileInput.files[0];
            if (!f) return;
            try {
                pendingAvatar = await resizeImage(f);
                $('pe-avatar').innerHTML = `<img class="cab-avatar-img" src="${pendingAvatar}" alt="">`;
            } catch (e) { notify('Не удалось обработать фото', 'error'); }
        });

        $('pe-save').addEventListener('click', async () => {
            const errEl = $('pe-error');
            const first = ($('pe-first').value || '').trim();
            const last = ($('pe-last').value || '').trim();
            if (!first) { errEl.textContent = 'Имя обязательно'; errEl.classList.remove('hidden'); return; }
            errEl.classList.add('hidden');
            const btn = $('pe-save'); btn.disabled = true; btn.textContent = 'Сохраняем…';

            let res = await api('/me/profile', { method: 'POST', body: { firstName: first, lastName: last } });
            if (res.ok && pendingAvatar) {
                res = await api('/me/avatar', { method: 'POST', body: { image: pendingAvatar } });
            }
            btn.disabled = false; btn.textContent = 'Сохранить';
            if (!res.ok) { errEl.textContent = (res.data && res.data.error) || 'Ошибка сохранения'; errEl.classList.remove('hidden'); return; }

            currentUser = res.data.user;
            cacheUser(currentUser);
            const nameEl = $('cab-username');
            if (nameEl) nameEl.textContent = currentUser.firstName || currentUser.name;
            refreshGreetingAvatar();
            removeEl('profile-editor');
            notify('Профиль обновлён', 'success');
        });
    }

    // ---- настройка кабинета после входа ----
    // applyUser — данные пользователя (можно звать многократно: из кэша, затем из /me)
    function applyUser(user) {
        currentUser = user;
        const nameEl = $('cab-username');
        if (nameEl) nameEl.textContent = user.firstName || user.name || 'Игрок';
        refreshGreetingAvatar();
        // Подставляем имя в онлайн-формы и прячем поля ввода имени (имя берём из аккаунта)
        const createName = $('create-name');
        const joinName = $('join-name');
        if (createName) { createName.value = user.name; hideGroup(createName); }
        if (joinName) { joinName.value = user.name; hideGroup(joinName); }
    }

    let cabinetWired = false;
    function wireCabinetOnce() {
        if (cabinetWired) return;
        cabinetWired = true;

        const editBtn = $('cab-edit-profile');
        if (editBtn) editBtn.addEventListener('click', showProfileEditor);
        const avBtn = $('cab-avatar');
        if (avBtn) avBtn.addEventListener('click', showProfileEditor);

        document.querySelectorAll('.cab-nav-btn').forEach(b => {
            b.addEventListener('click', () => activateSection(b.dataset.section));
        });
        const peopleBtn = $('cab-people-btn');
        if (peopleBtn) peopleBtn.addEventListener('click', () => activateSection('cab-people'));
        const createBtn = $('cab-create-btn');
        if (createBtn) createBtn.addEventListener('click', () => {
            activateSection('cab-online');
            if (typeof window.switchOnlineTab === 'function') window.switchOnlineTab('create');
        });
        const logoutBtn = $('cab-logout-btn');
        if (logoutBtn) logoutBtn.addEventListener('click', onLogout);

        wireInviteHooks();

        const search = $('people-search');
        if (search) search.addEventListener('input', () => {
            clearTimeout(peopleSearchTimer);
            peopleSearchTimer = setTimeout(() => loadPeople(search.value), 250);
        });

        // Автообновление статусов: при возврате в приложение и раз в 20с (страховка,
        // если real-time презенс-событие было пропущено из-за обрыва связи).
        document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refreshPresenceTab(); });
        setInterval(() => { if (document.visibilityState === 'visible') refreshPresenceTab(); }, 20000);

        // приглашение по ссылке ?room=XXX → сразу к онлайн-входу
        const roomId = new URLSearchParams(location.search).get('room');
        if (roomId) {
            activateSection('cab-online');
            if (typeof window.switchOnlineTab === 'function') window.switchOnlineTab('join');
            const ri = $('room-id'); if (ri) ri.value = roomId;
        }
    }

    function setupCabinet(user) {
        applyUser(user);
        wireCabinetOnce();
    }

    function hideGroup(input) {
        const g = input.closest('.input-group');
        if (g) g.classList.add('hidden');
    }

    // Ждём загрузки Telegram SDK (он async) с таймаутом — чтобы не зависнуть, если
    // telegram.org недоступен. Если это явно не Telegram — не ждём вовсе.
    function waitForTelegram(timeoutMs) {
        return new Promise((resolve) => {
            if (window.Telegram && window.Telegram.WebApp) return resolve();
            const maybeTg = !!(window.TelegramWebviewProxy || window.Telegram || location.hash.indexOf('tgWebApp') >= 0);
            if (!maybeTg) return resolve(); // обычный браузер/PWA — SDK не нужен
            const t0 = Date.now();
            const iv = setInterval(() => {
                if ((window.Telegram && window.Telegram.WebApp) || Date.now() - t0 > timeoutMs) {
                    clearInterval(iv); resolve();
                }
            }, 50);
        });
    }

    // ---- инициализация ----
    async function init() {
        await waitForTelegram(2500);
        // обработчики экрана входа
        const startBtn = $('auth-start-btn');
        if (startBtn) startBtn.addEventListener('click', onStartLogin);
        const phoneInput = $('auth-phone');
        if (phoneInput) {
            attachPhoneMask(phoneInput);
            phoneInput.addEventListener('keydown', e => { if (e.key === 'Enter') onStartLogin(); });
        }
        const nameBtn = $('auth-name-btn');
        if (nameBtn) nameBtn.addEventListener('click', onSubmitName);
        const lastInput = $('auth-lastname');
        if (lastInput) lastInput.addEventListener('keydown', e => { if (e.key === 'Enter') onSubmitName(); });
        const cancelBtn = $('auth-cancel-btn');
        if (cancelBtn) cancelBtn.addEventListener('click', () => { stopPolling(); backToPhone(); });
        const guestBtn = $('auth-guest-btn');
        if (guestBtn) guestBtn.addEventListener('click', () => enterGuest());

        // Если main.js уже восстановил игру — не перекрываем её сплэшем
        const gameActive = inActiveGame();
        if (gameActive) hideSplash();

        // Внутри Telegram — оформление (отступы под хедер) всегда, вход — если не идёт игра
        if (inTelegram()) {
            setupTgChrome();
            if (!gameActive) { await initTelegram(); return; }
        }

        // нет токена → либо гость (если выбирал в этой сессии), либо экран входа
        if (!getToken()) {
            let wasGuest = false;
            try { wasGuest = sessionStorage.getItem('panti_guest') === '1'; } catch (e) {}
            if (gameActive) { enterGuest(true); return; } // восстановленная гостевая игра
            if (wasGuest) { enterGuest(); return; }
            authStep('phone');
            showAuth();
            return;
        }

        // МГНОВЕННО рисуем кабинет из кэша профиля (без ожидания сети) — анти-белый-экран
        const cached = getCachedUser();
        if (cached && cached.registered && !gameActive) {
            setupCabinet(cached);
            showCabinet();
        }

        // Фоновая проверка/обновление профиля
        const r = await api('/me');
        if (!r.ok) {
            if (r.status === 401) {
                // токен недействителен — выходим на экран входа
                clearToken(); clearUserCache();
                authStep('phone');
                showAuth();
            } else if (!cached) {
                // нет сети и нечего показать — экран входа с подсказкой
                authStep('phone');
                authError('Нет связи с сервером, попробуйте ещё раз');
                showAuth();
            }
            // если кэш был — оставляем уже показанный кабинет (офлайн-режим)
            return;
        }

        const user = r.data.user;
        cacheUser(user);
        if (!user.registered) {
            // токен есть, но онбординг не пройден
            authStep('name');
            showAuth();
            return;
        }

        setupCabinet(user);
        if (!inActiveGame()) showCabinet();
    }

    // ---- публичный API для main.js ----
    window.PantiAuth = {
        getToken,
        getUser: () => currentUser,
        reportComputerResult: function (win) {
            if (!getToken()) return;
            api('/game/result', { method: 'POST', body: { mode: 'computer', result: win ? 'win' : 'loss' } });
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
