// ============================================================================
//  panti — админка (одна страница /admin). Использует тот же токен авторизации.
// ============================================================================
(function () {
    'use strict';
    const $ = (id) => document.getElementById(id);
    function getToken() { try { return localStorage.getItem('panti_auth'); } catch (e) { return null; } }
    function setToken(t) { try { localStorage.setItem('panti_auth', t); } catch (e) {} }

    function formatRu(raw) {
        let d = String(raw || '').replace(/\D/g, '');
        if (!d) return '';
        if (d[0] === '8') d = '7' + d.slice(1); else if (d[0] !== '7') d = '7' + d;
        d = d.slice(0, 11); const r = d.slice(1); let o = '+7';
        if (r.length) o += ' (' + r.slice(0, 3); if (r.length >= 3) o += ')';
        if (r.length > 3) o += ' ' + r.slice(3, 6); if (r.length > 6) o += '-' + r.slice(6, 8); if (r.length > 8) o += '-' + r.slice(8, 10);
        return o;
    }

    async function api(path, opts) {
        opts = opts || {};
        const headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
        const t = getToken();
        if (t) headers['Authorization'] = 'Bearer ' + t;
        let res;
        try {
            res = await fetch('/api' + path, { method: opts.method || 'GET', headers, body: opts.body ? JSON.stringify(opts.body) : undefined });
        } catch (e) { return { ok: false, status: 0, data: {} }; }
        let data = null; try { data = await res.json(); } catch (e) {}
        return { ok: res.ok, status: res.status, data: data || {} };
    }

    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }
    function fmtDate(ts) {
        if (!ts) return '—';
        const d = new Date(ts);
        return d.toLocaleDateString('ru-RU') + ' ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    }
    function initials(name) {
        const p = String(name || '').trim().split(/\s+/);
        return ((p[0] || '').charAt(0) + (p[1] ? p[1].charAt(0) : '')).toUpperCase() || '?';
    }
    function avatar(name, url) { return url ? `<img class="ad-av-img" src="${esc(url)}">` : esc(initials(name)); }

    // ---- дашборд ----
    async function loadDash() {
        const r = await api('/admin/stats');
        if (!r.ok) return false;
        const s = r.data;
        $('ad-dash').innerHTML = [
            ['Игроков', s.totalUsers], ['Сегодня', s.newToday], ['За неделю', s.newWeek],
            ['Онлайн', s.onlineNow], ['С Telegram', s.withTelegram],
            ['Онлайн-игр', s.onlineGames], ['С компом', s.compGames]
        ].map(([l, v]) => `<div class="ad-stat"><div class="ad-stat-v">${v}</div><div class="ad-stat-l">${l}</div></div>`).join('');
        return true;
    }

    // ---- пользователи ----
    let searchTimer = null;
    async function loadUsers(q) {
        const box = $('ad-users');
        box.innerHTML = '<div class="ad-empty">Загрузка…</div>';
        const r = await api('/admin/users?q=' + encodeURIComponent(q || ''));
        if (!r.ok) { box.innerHTML = '<div class="ad-empty">Ошибка</div>'; return; }
        const users = r.data.users || [];
        if (!users.length) { box.innerHTML = '<div class="ad-empty">Никого не найдено</div>'; return; }
        box.innerHTML = users.map(u => `
            <div class="ad-card" data-id="${u.id}">
                <div class="ad-card-head">
                    <div class="ad-av">${avatar(u.name, u.avatarUrl)}${u.online ? '<span class="ad-dot"></span>' : ''}</div>
                    <div class="ad-card-info">
                        <div class="ad-card-name">${esc(u.name)} ${u.isAdmin ? '<span class="ad-badge">админ</span>' : ''}</div>
                        <div class="ad-card-sub">id ${u.id} · ${u.phone ? esc(u.phone) : 'без номера'} · ${u.telegramId ? 'TG' : 'нет TG'}</div>
                        <div class="ad-card-sub">рег: ${fmtDate(u.createdAt)}</div>
                    </div>
                </div>
                <div class="ad-card-stats">
                    🌐 ${u.stats.online.wins}П/${u.stats.online.losses}пор (${u.stats.online.games} игр) · 🖥 ${u.stats.comp.wins}П/${u.stats.comp.losses}пор
                </div>
                <div class="ad-card-actions">
                    <button class="ad-mini" data-act="edit">Имя</button>
                    <button class="ad-mini" data-act="stats">Статы</button>
                    <button class="ad-mini" data-act="reset">Сброс</button>
                    <button class="ad-mini" data-act="merge">Слить</button>
                    <button class="ad-mini ad-danger" data-act="del">Удалить</button>
                </div>
            </div>`).join('');
        box.querySelectorAll('.ad-card').forEach(card => {
            const id = parseInt(card.dataset.id, 10);
            const u = users.find(x => x.id === id);
            card.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => userAction(b.dataset.act, u)));
        });
    }

    async function userAction(act, u) {
        if (act === 'edit') {
            const first = prompt('Имя:', u.firstName); if (first === null) return;
            const last = prompt('Фамилия (можно пусто):', u.lastName) || '';
            const r = await api('/admin/users/' + u.id, { method: 'POST', body: { firstName: first, lastName: last } });
            if (r.ok) refresh(); else alert(r.data.error || 'Ошибка');
        } else if (act === 'stats') {
            const ow = prompt('Онлайн победы:', u.stats.online.wins); if (ow === null) return;
            const ol = prompt('Онлайн поражения:', u.stats.online.losses); if (ol === null) return;
            const og = prompt('Онлайн игр всего:', u.stats.online.games); if (og === null) return;
            const cw = prompt('С компом победы:', u.stats.comp.wins); if (cw === null) return;
            const cl = prompt('С компом поражения:', u.stats.comp.losses); if (cl === null) return;
            const cg = prompt('С компом игр всего:', u.stats.comp.games); if (cg === null) return;
            const r = await api('/admin/users/' + u.id + '/stats', { method: 'POST', body: { onlineWins: ow, onlineLosses: ol, onlineGames: og, compWins: cw, compLosses: cl, compGames: cg } });
            if (r.ok) refresh(); else alert(r.data.error || 'Ошибка');
        } else if (act === 'reset') {
            if (!confirm(`Сбросить всю статистику игрока ${u.name}?`)) return;
            const r = await api('/admin/users/' + u.id + '/reset-stats', { method: 'POST' });
            if (r.ok) refresh(); else alert(r.data.error || 'Ошибка');
        } else if (act === 'del') {
            if (!confirm(`Удалить аккаунт ${u.name} (id ${u.id}) НАВСЕГДА?`)) return;
            const r = await api('/admin/users/' + u.id, { method: 'DELETE' });
            if (r.ok) refresh(); else alert(r.data.error || 'Ошибка');
        } else if (act === 'merge') {
            const mergeId = prompt(`Объединение. Оставляем аккаунт id ${u.id} (${u.name}).\nВведите id ВТОРОГО аккаунта, который влить в этот (он будет удалён, статистика суммируется):`);
            if (!mergeId) return;
            const r = await api('/admin/merge', { method: 'POST', body: { keepId: u.id, mergeId: parseInt(mergeId, 10) } });
            if (r.ok) { alert('Объединено в: ' + r.data.user.name); refresh(); } else alert(r.data.error || 'Ошибка');
        }
    }

    // ---- комнаты ----
    async function loadRooms() {
        const box = $('ad-rooms');
        box.innerHTML = '<div class="ad-empty">Загрузка…</div>';
        const r = await api('/admin/rooms');
        if (!r.ok) { box.innerHTML = '<div class="ad-empty">Ошибка</div>'; return; }
        const list = r.data.rooms || [];
        if (!list.length) { box.innerHTML = '<div class="ad-empty">Активных игр нет</div>'; return; }
        box.innerHTML = list.map(rm => `
            <div class="ad-card">
                <div class="ad-card-name">Комната ${esc(rm.roomId)} · ${esc(rm.format)} ${rm.ended ? '· завершена' : rm.started ? '· идёт' : '· ожидание'}</div>
                <div class="ad-card-sub">Раунд ${rm.round} · до ${rm.targetScore} · счёт ${(rm.totalScores || []).join(':') || '—'}</div>
                <div class="ad-card-sub">${rm.players.map(p => esc(p.name) + (p.connected ? '🟢' : '⚪')).join(', ')}</div>
                <div class="ad-card-actions"><button class="ad-mini ad-danger" data-close="${esc(rm.roomId)}">Закрыть</button></div>
            </div>`).join('');
        box.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', async () => {
            if (!confirm('Закрыть комнату ' + b.dataset.close + '?')) return;
            const r = await api('/admin/rooms/' + b.dataset.close + '/close', { method: 'POST' });
            if (r.ok) loadRooms(); else alert('Ошибка');
        }));
    }

    // ---- рассылка ----
    function setupBroadcast() {
        $('ad-bc-send').addEventListener('click', async () => {
            const text = $('ad-bc-text').value.trim();
            if (!text) { alert('Введите текст'); return; }
            if (!confirm('Отправить это сообщение ВСЕМ пользователям с Telegram?')) return;
            const btn = $('ad-bc-send'); btn.disabled = true; btn.textContent = 'Отправляем…';
            const r = await api('/admin/broadcast', { method: 'POST', body: { text } });
            btn.disabled = false; btn.textContent = 'Отправить всем';
            if (r.ok) {
                $('ad-bc-result').textContent = `Готово: отправлено ${r.data.sent} из ${r.data.total} (ошибок: ${r.data.failed})`;
                $('ad-bc-text').value = '';
            } else { $('ad-bc-result').textContent = 'Ошибка: ' + (r.data.error || ''); }
        });
    }

    // ---- табы ----
    function setupTabs() {
        document.querySelectorAll('.ad-tab').forEach(t => t.addEventListener('click', () => {
            document.querySelectorAll('.ad-tab').forEach(x => x.classList.toggle('active', x === t));
            ['users', 'rooms', 'broadcast'].forEach(name => $('ad-tab-' + name).classList.toggle('hidden', name !== t.dataset.tab));
            if (t.dataset.tab === 'rooms') loadRooms();
        }));
    }

    function refresh() {
        loadDash();
        const active = document.querySelector('.ad-tab.active');
        const tab = active ? active.dataset.tab : 'users';
        if (tab === 'users') loadUsers($('ad-user-search').value);
        else if (tab === 'rooms') loadRooms();
    }

    // ---- вход прямо в админке (номер + звонок) ----
    let loginPoll = null;
    function showLogin() {
        $('ad-login').classList.remove('hidden');
        const ph = $('ad-phone');
        ph.addEventListener('focus', () => { if (!ph.value.trim()) ph.value = '+7 '; });
        ph.addEventListener('input', () => { ph.value = formatRu(ph.value); });
        $('ad-login-start').addEventListener('click', startLogin);
    }
    function loginErr(m) { const e = $('ad-login-error'); if (m) { e.textContent = m; e.classList.remove('hidden'); } else e.classList.add('hidden'); }

    async function startLogin() {
        loginErr(null);
        const phone = ($('ad-phone').value || '').trim();
        if (phone.replace(/\D/g, '').length < 10) { loginErr('Введите корректный номер'); return; }
        const btn = $('ad-login-start'); btn.disabled = true; btn.textContent = 'Отправляем…';
        const r = await api('/auth/phone/wait/start', { method: 'POST', body: { phone } });
        btn.disabled = false; btn.textContent = 'Получить звонок';
        if (!r.ok) { loginErr(r.data.error || 'Ошибка'); return; }
        $('ad-login-phone').classList.add('hidden');
        $('ad-login-wait').classList.remove('hidden');
        if (r.data.dev || r.data.number === 'DEV') { $('ad-call-box').classList.add('hidden'); $('ad-login-wait-text').textContent = 'Подтверждаем…'; }
        else {
            const num = String(r.data.number), link = $('ad-call-number');
            link.textContent = num; const clean = num.replace(/[^\d+]/g, '');
            link.href = 'tel:' + clean;
            link.addEventListener('click', () => { try { navigator.clipboard && navigator.clipboard.writeText(clean); } catch (e) {} });
        }
        if (loginPoll) clearInterval(loginPoll);
        loginPoll = setInterval(async () => {
            const s = await api('/auth/phone/wait/status', { method: 'POST', body: { phone, pollToken: r.data.pollToken } });
            if (s.status === 404) { clearInterval(loginPoll); loginErr('Сессия истекла'); resetLoginUI(); return; }
            if (!s.ok) return;
            if (s.data.status === 'expired') { clearInterval(loginPoll); loginErr('Время вышло'); resetLoginUI(); }
            else if (s.data.status === 'confirmed') {
                clearInterval(loginPoll);
                if (s.data.token) setToken(s.data.token);
                $('ad-login').classList.add('hidden');
                start(); // повторная проверка прав
            }
        }, 2500);
    }
    function resetLoginUI() { $('ad-login-phone').classList.remove('hidden'); $('ad-login-wait').classList.add('hidden'); }

    async function start() {
        const ok = await loadDash();
        if (!ok) {
            // токен есть, но не админ → если вообще нет токена показываем вход, иначе «нет доступа»
            if (!getToken()) showLogin();
            else $('ad-noaccess').classList.remove('hidden');
            const lo = $('ad-logout'); if (lo) lo.addEventListener('click', () => { try { localStorage.removeItem('panti_auth'); } catch (e) {} location.reload(); });
            return;
        }
        $('ad-noaccess').classList.add('hidden');
        $('ad-login').classList.add('hidden');
        $('ad-main').classList.remove('hidden');
        setupTabs(); setupBroadcast();
        loadUsers('');
        $('ad-user-search').addEventListener('input', () => {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => loadUsers($('ad-user-search').value), 250);
        });
        $('ad-refresh').addEventListener('click', refresh);
    }

    async function init() {
        if (!getToken()) { showLogin(); return; }
        start();
    }
    init();
})();
