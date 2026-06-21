// ============================================================================
//  panti — регистрация/авторизация по телефону (SMSC «Звонок-Ожидание») +
//  пользователи, друзья, статистика, лидеры.
//  Самодостаточный модуль: SQLite (better-sqlite3) + REST на express.
// ============================================================================

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const https = require('https');
const Database = require('better-sqlite3');

// ---------------------------------------------------------------------------
// Мини-загрузчик .env (без зависимости dotenv)
// ---------------------------------------------------------------------------
(function loadEnv() {
    try {
        const envPath = path.join(__dirname, '.env');
        if (!fs.existsSync(envPath)) return;
        const lines = fs.readFileSync(envPath, 'utf8').split('\n');
        for (let line of lines) {
            line = line.trim();
            if (!line || line.startsWith('#')) continue;
            const eq = line.indexOf('=');
            if (eq === -1) continue;
            const key = line.slice(0, eq).trim();
            let val = line.slice(eq + 1).trim();
            // снимаем обрамляющие кавычки, если есть
            if ((val.startsWith('"') && val.endsWith('"')) ||
                (val.startsWith("'") && val.endsWith("'"))) {
                val = val.slice(1, -1);
            }
            if (!(key in process.env)) process.env[key] = val;
        }
    } catch (e) {
        console.error('Ошибка чтения .env:', e.message);
    }
})();

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const SMSC_LOGIN = process.env.SMSC_LOGIN || '';
const SMSC_APIKEY = process.env.SMSC_APIKEY || '';
const SMSC_CALLBACK_SECRET = process.env.SMSC_CALLBACK_SECRET || 'change-me-secret';
// Dev-фолбэк: подтверждать вход без реального звонка (для тестов, пока SMSC не настроен)
const DEV_FALLBACK = process.env.AUTH_DEV_FALLBACK === '1' || !SMSC_LOGIN || !SMSC_APIKEY;

const WAIT_TTL_MS = 10 * 60 * 1000;     // сессия ожидания звонка живёт 10 мин
const START_COOLDOWN_MS = 30 * 1000;     // антиспам на /start по номеру

// ---------------------------------------------------------------------------
// База данных
// ---------------------------------------------------------------------------
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new Database(path.join(DATA_DIR, 'panti.db'));
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    phone        TEXT UNIQUE NOT NULL,
    first_name   TEXT,
    last_name    TEXT,
    created_at   INTEGER,
    online_games   INTEGER DEFAULT 0,
    online_wins    INTEGER DEFAULT 0,
    online_losses  INTEGER DEFAULT 0,
    online_draws   INTEGER DEFAULT 0,
    comp_games     INTEGER DEFAULT 0,
    comp_wins      INTEGER DEFAULT 0,
    comp_losses    INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sessions (
    token      TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL,
    created_at INTEGER,
    last_seen  INTEGER
);

CREATE TABLE IF NOT EXISTS phone_wait_sessions (
    phone           TEXT PRIMARY KEY,
    assigned_number TEXT,
    poll_token      TEXT,
    status          TEXT DEFAULT 'waiting',
    expires_at      INTEGER,
    confirmed_at    INTEGER,
    created_at      INTEGER
);

CREATE TABLE IF NOT EXISTS friends (
    user_id    INTEGER NOT NULL,
    friend_id  INTEGER NOT NULL,
    created_at INTEGER,
    PRIMARY KEY (user_id, friend_id)
);
`);

// Миграция: колонка версии аватара (для кэш-бастинга). Безопасно при повторном запуске.
try { db.exec('ALTER TABLE users ADD COLUMN avatar_ver INTEGER DEFAULT 0'); } catch (e) { /* уже есть */ }
// Миграция: Telegram-аккаунт (вход через Mini App). phone становится опциональным.
try { db.exec('ALTER TABLE users ADD COLUMN telegram_id INTEGER'); } catch (e) { /* уже есть */ }
try { db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_tg ON users(telegram_id) WHERE telegram_id IS NOT NULL'); } catch (e) {}
// Миграция: флаг администратора.
try { db.exec('ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0'); } catch (e) { /* уже есть */ }
// Назначаем владельца админом (по его номеру и/или Telegram-id), какой бы аккаунт ни был.
try { db.exec("UPDATE users SET is_admin = 1 WHERE phone = '79283394503' OR telegram_id = 231925791"); } catch (e) {}

// Папка под аватары (отдаётся статикой из public/avatars/<id>.jpg)
const AVATAR_DIR = path.join(__dirname, 'public', 'avatars');
if (!fs.existsSync(AVATAR_DIR)) fs.mkdirSync(AVATAR_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// Хелперы
// ---------------------------------------------------------------------------
function now() { return Date.now(); }
function genToken() { return crypto.randomBytes(24).toString('hex'); }

// Единая нормализация номера: только цифры, ведущая 8 → 7 (для РФ).
function normalizePhone(raw) {
    if (!raw) return '';
    let d = String(raw).replace(/\D/g, '');
    if (d.length === 11 && d.startsWith('8')) d = '7' + d.slice(1);
    if (d.length === 10) d = '7' + d; // номер без кода страны
    return d;
}

// Вызов SMSC wait_call.php → возвращает номер для набора (или бросает ошибку).
function smscGetWaitNumber(phoneDigits) {
    return new Promise((resolve, reject) => {
        const params = new URLSearchParams({
            login: SMSC_LOGIN,
            apikey: SMSC_APIKEY,      // КРИТИЧНО: apikey, не psw
            phone: phoneDigits,
            fmt: '3'
        });
        const url = `https://smsc.ru/sys/wait_call.php?${params.toString()}`;
        const req = https.get(url, (res) => {
            let body = '';
            res.on('data', (c) => body += c);
            res.on('end', () => {
                try {
                    const json = JSON.parse(body);
                    if (json && json.phone) resolve(String(json.phone));
                    else reject(new Error(json && json.error ? json.error : 'SMSC: нет номера'));
                } catch (e) {
                    reject(new Error('SMSC: невалидный ответ'));
                }
            });
        });
        req.on('error', reject);
        // Жёсткий таймаут — чтобы запрос НИКОГДА не висел (иначе фронт ловит abort → «Нет связи»)
        req.setTimeout(8000, () => { req.destroy(new Error('SMSC: таймаут')); });
    });
}

// --- prepared statements ---
const Q = {
    userByPhone: db.prepare('SELECT * FROM users WHERE phone = ?'),
    userById: db.prepare('SELECT * FROM users WHERE id = ?'),
    insertUser: db.prepare('INSERT INTO users (phone, first_name, last_name, created_at) VALUES (?, ?, ?, ?)'),
    updateNames: db.prepare('UPDATE users SET first_name = ?, last_name = ? WHERE id = ?'),
    allUsers: db.prepare('SELECT id, first_name, last_name, online_wins, online_games, avatar_ver FROM users ORDER BY first_name COLLATE NOCASE'),

    insertSession: db.prepare('INSERT INTO sessions (token, user_id, created_at, last_seen) VALUES (?, ?, ?, ?)'),
    sessionByToken: db.prepare('SELECT * FROM sessions WHERE token = ?'),
    touchSession: db.prepare('UPDATE sessions SET last_seen = ? WHERE token = ?'),
    deleteSession: db.prepare('DELETE FROM sessions WHERE token = ?'),

    waitByPhone: db.prepare('SELECT * FROM phone_wait_sessions WHERE phone = ?'),
    upsertWait: db.prepare(`
        INSERT INTO phone_wait_sessions (phone, assigned_number, poll_token, status, expires_at, confirmed_at, created_at)
        VALUES (@phone, @assigned_number, @poll_token, 'waiting', @expires_at, NULL, @created_at)
        ON CONFLICT(phone) DO UPDATE SET
            assigned_number = @assigned_number,
            poll_token = @poll_token,
            status = 'waiting',
            expires_at = @expires_at,
            confirmed_at = NULL,
            created_at = @created_at
    `),
    confirmWait: db.prepare("UPDATE phone_wait_sessions SET status = 'confirmed', confirmed_at = ? WHERE phone = ? AND status = 'waiting'"),

    addFriend: db.prepare('INSERT OR IGNORE INTO friends (user_id, friend_id, created_at) VALUES (?, ?, ?)'),
    removeFriend: db.prepare('DELETE FROM friends WHERE user_id = ? AND friend_id = ?'),
    friendIds: db.prepare('SELECT friend_id FROM friends WHERE user_id = ?'),
    isFriend: db.prepare('SELECT 1 FROM friends WHERE user_id = ? AND friend_id = ?'),

    leaderboard: db.prepare(`
        SELECT id, first_name, last_name, online_wins, online_losses, online_games, comp_wins, avatar_ver
        FROM users
        ORDER BY online_wins DESC, online_games ASC, first_name COLLATE NOCASE
        LIMIT 100
    `),

    recordComp: db.prepare('UPDATE users SET comp_games = comp_games + 1, comp_wins = comp_wins + ?, comp_losses = comp_losses + ? WHERE id = ?'),
    recordOnline: db.prepare('UPDATE users SET online_games = online_games + 1, online_wins = online_wins + ?, online_losses = online_losses + ?, online_draws = online_draws + ? WHERE id = ?'),
    bumpAvatar: db.prepare('UPDATE users SET avatar_ver = avatar_ver + 1 WHERE id = ?')
};

// --- Telegram queries ---
Object.assign(Q, {
    userByTgId: db.prepare('SELECT * FROM users WHERE telegram_id = ?'),
    insertTgUser: db.prepare('INSERT INTO users (phone, telegram_id, first_name, last_name, created_at) VALUES (?, ?, ?, ?, ?)'),
    setTgId: db.prepare('UPDATE users SET telegram_id = ? WHERE id = ?'),
    setPhone: db.prepare('UPDATE users SET phone = ? WHERE id = ?')
});

// Проверка подписи Telegram (initData ИЛИ signed-строка контакта). Возвращает
// объект распарсенных параметров при валидной подписи, иначе null.
// Алгоритм: secret = HMAC_SHA256("WebAppData", bot_token); hash = HMAC_SHA256(secret, data_check_string).
function verifyTelegramSigned(rawQuery) {
    if (!rawQuery || !TELEGRAM_BOT_TOKEN) return null;
    try {
        const params = new URLSearchParams(rawQuery);
        const hash = params.get('hash');
        if (!hash) return null;
        const pairs = [];
        for (const [k, v] of params.entries()) {
            if (k === 'hash') continue;
            pairs.push(`${k}=${v}`);
        }
        pairs.sort();
        const dataCheckString = pairs.join('\n');
        const secret = crypto.createHmac('sha256', 'WebAppData').update(TELEGRAM_BOT_TOKEN).digest();
        const calc = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');
        if (calc !== hash) return null;
        const out = {};
        for (const [k, v] of params.entries()) out[k] = v;
        return out;
    } catch (e) {
        return null;
    }
}

// Проверка Telegram Login Widget (вход через Telegram на сайте/в PWA).
// ВНИМАНИЕ: алгоритм ОТЛИЧАЕТСЯ от Mini App initData:
// secret_key = SHA256(bot_token); hash = HMAC_SHA256(secret_key, data_check_string).
function verifyTelegramWidget(data) {
    if (!data || !data.hash || !TELEGRAM_BOT_TOKEN) return null;
    try {
        const pairs = [];
        for (const k of Object.keys(data)) {
            if (k === 'hash') continue;
            if (data[k] === undefined || data[k] === null) continue;
            pairs.push(`${k}=${data[k]}`);
        }
        pairs.sort();
        const dataCheckString = pairs.join('\n');
        const secret = crypto.createHash('sha256').update(TELEGRAM_BOT_TOKEN).digest();
        const calc = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');
        if (calc !== String(data.hash)) return null;
        // подпись не старше суток
        const authDate = parseInt(data.auth_date, 10);
        if (!authDate || (Date.now() / 1000 - authDate) > 86400) return null;
        return data;
    } catch (e) {
        return null;
    }
}

// Вход/создание аккаунта по Telegram-пользователю (общий для Mini App и Login Widget).
// Возвращает { token, user, needsPhoneLink } либо null.
function loginByTelegramUser(tgUser) {
    const tgId = tgUser && parseInt(tgUser.id, 10);
    if (!tgId) return null;
    let user = Q.userByTgId.get(tgId);
    if (!user) {
        const first = (tgUser.first_name || '').toString().slice(0, 40) || 'Игрок';
        const last = (tgUser.last_name || '').toString().slice(0, 40) || null;
        const info = Q.insertTgUser.run('tg:' + tgId, tgId, first, last, now());
        user = Q.userById.get(info.lastInsertRowid);
    }
    const token = genToken();
    Q.insertSession.run(token, user.id, now(), now());
    const hasRealPhone = user.phone && !String(user.phone).startsWith('tg:');
    return { token, user: publicUser(user), needsPhoneLink: !hasRealPhone };
}

// Привязать/объединить телефон с аккаунтом meId (телефон уже ПОДТВЕРЖДЁН — звонком
// или подписью контакта). Если номер принадлежит другому аккаунту (PWA) — объединяем:
// тот аккаунт (с историей) остаётся основным, текущий пустой Telegram-аккаунт удаляется.
// Возвращает id выжившего аккаунта. Бросает 'phone-linked-other-tg' при конфликте.
function linkPhoneToUser(meId, phone) {
    const me = Q.userById.get(meId);
    const other = Q.userByPhone.get(phone);
    const tx = db.transaction(() => {
        if (other && other.id !== me.id) {
            if (other.telegram_id && me.telegram_id && other.telegram_id !== me.telegram_id) {
                throw new Error('phone-linked-other-tg');
            }
            const tgId = me.telegram_id;
            db.prepare('UPDATE sessions SET user_id = ? WHERE user_id = ?').run(other.id, me.id);
            db.prepare('INSERT OR IGNORE INTO friends (user_id, friend_id, created_at) SELECT ?, friend_id, created_at FROM friends WHERE user_id = ? AND friend_id != ?').run(other.id, me.id, other.id);
            db.prepare('INSERT OR IGNORE INTO friends (user_id, friend_id, created_at) SELECT user_id, ?, created_at FROM friends WHERE friend_id = ? AND user_id != ?').run(other.id, me.id, other.id);
            db.prepare('DELETE FROM friends WHERE user_id = ? OR friend_id = ?').run(me.id, me.id);
            // Сначала освобождаем telegram_id у текущего аккаунта (защита от UNIQUE),
            // затем удаляем его и переносим tg на основной (PWA) аккаунт.
            if (tgId) Q.setTgId.run(null, me.id);
            db.prepare('DELETE FROM users WHERE id = ?').run(me.id);
            if (tgId) Q.setTgId.run(tgId, other.id);
            return other.id;
        }
        Q.setPhone.run(phone, me.id); // своего номера ещё не было — просто записываем
        return me.id;
    });
    return tx();
}

// URL аватара пользователя (или null, если не загружен)
function avatarUrlFor(u) {
    if (!u || !u.avatar_ver) return null;
    return `/avatars/${u.id}.jpg?v=${u.avatar_ver}`;
}
function userAvatarUrl(userId) { return avatarUrlFor(Q.userById.get(userId)); }

function fullName(u) {
    return [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || 'Игрок';
}

function publicUser(u) {
    return {
        id: u.id,
        firstName: u.first_name || '',
        lastName: u.last_name || '',
        name: fullName(u),
        registered: !!u.first_name,
        avatarUrl: avatarUrlFor(u),
        hasPhone: !!(u.phone && !String(u.phone).startsWith('tg:')),
        hasTelegram: !!u.telegram_id,
        stats: {
            online: { games: u.online_games, wins: u.online_wins, losses: u.online_losses, draws: u.online_draws },
            comp: { games: u.comp_games, wins: u.comp_wins, losses: u.comp_losses }
        }
    };
}

// ---------------------------------------------------------------------------
// Присутствие онлайн (userId → набор socketId)
// ---------------------------------------------------------------------------
const onlineUsers = new Map();
// Возвращает true, если пользователь ТОЛЬКО ЧТО стал онлайн (был оффлайн) — чтобы
// сервер один раз разослал презенс-событие.
function setUserOnline(userId, socketId) {
    if (!userId) return false;
    const wasOffline = !onlineUsers.has(userId);
    if (wasOffline) onlineUsers.set(userId, new Set());
    onlineUsers.get(userId).add(socketId);
    return wasOffline;
}
// Возвращает true, если пользователь стал полностью оффлайн (закрыл последнюю вкладку).
function setUserOffline(userId, socketId) {
    if (!userId || !onlineUsers.has(userId)) return false;
    const set = onlineUsers.get(userId);
    set.delete(socketId);
    if (set.size === 0) { onlineUsers.delete(userId); return true; }
    return false;
}
function isUserOnline(userId) { return onlineUsers.has(userId); }
function getUserSockets(userId) {
    return onlineUsers.has(userId) ? Array.from(onlineUsers.get(userId)) : [];
}

// ---------------------------------------------------------------------------
// Публичные функции для серверной части (socket-слой)
// ---------------------------------------------------------------------------
function getUserByToken(token) {
    if (!token) return null;
    const s = Q.sessionByToken.get(token);
    if (!s) return null;
    Q.touchSession.run(now(), token);
    return Q.userById.get(s.user_id) || null;
}

// Возвращает пользователя, если он админ (для защиты админ-роутов и в server.js)
function getAdminUser(token) {
    const u = getUserByToken(token);
    return (u && u.is_admin) ? u : null;
}
function allTelegramIds() {
    return db.prepare('SELECT telegram_id FROM users WHERE telegram_id IS NOT NULL').all().map(r => r.telegram_id);
}

// Запись результата онлайн-матча. participantIds — все user_id за столом,
// winnerIds — множество user_id победивших (для 2v2 — оба из команды).
function recordOnlineMatch(participantIds, winnerIds) {
    const winners = new Set(winnerIds || []);
    const tx = db.transaction(() => {
        for (const uid of participantIds) {
            if (!uid) continue;
            const isWin = winners.has(uid) ? 1 : 0;
            Q.recordOnline.run(isWin, isWin ? 0 : 1, 0, uid);
        }
    });
    try { tx(); } catch (e) { console.error('recordOnlineMatch error:', e.message); }
}

// ---------------------------------------------------------------------------
// Монтирование REST-роутов
// ---------------------------------------------------------------------------
function getToken(req) {
    const h = req.headers['authorization'];
    if (h && h.startsWith('Bearer ')) return h.slice(7);
    if (req.cookies && req.cookies.panti_token) return req.cookies.panti_token;
    return null;
}

function requireAuth(req, res, next) {
    const u = getUserByToken(getToken(req));
    if (!u) return res.status(401).json({ error: 'unauthorized' });
    req.user = u;
    next();
}

// простейший rate-limit в памяти
const rl = new Map();
function rateLimit(key, max, windowMs) {
    const t = now();
    const e = rl.get(key);
    if (!e || t - e.start > windowMs) { rl.set(key, { start: t, count: 1 }); return true; }
    e.count++;
    return e.count <= max;
}

function mountAuth(app, io) {
    // ---- старт ожидания звонка ----
    app.post('/api/auth/phone/wait/start', async (req, res) => {
        const phone = normalizePhone(req.body && req.body.phone);
        if (phone.length < 11) return res.status(400).json({ error: 'Некорректный номер' });
        if (!rateLimit('start:' + phone, 3, START_COOLDOWN_MS)) {
            return res.status(429).json({ error: 'Слишком часто, подождите' });
        }

        const pollToken = genToken();
        let number;
        try {
            if (DEV_FALLBACK) {
                number = 'DEV'; // звонок не нужен
            } else {
                number = await smscGetWaitNumber(phone);
            }
        } catch (e) {
            console.error('SMSC wait_call error:', e.message);
            if (DEV_FALLBACK) number = 'DEV';
            else return res.status(502).json({ error: 'Сервис звонков недоступен: ' + e.message });
        }

        Q.upsertWait.run({
            phone,
            assigned_number: number,
            poll_token: pollToken,
            expires_at: now() + WAIT_TTL_MS,
            created_at: now()
        });

        // В dev-режиме сразу подтверждаем — звонок имитируется.
        if (DEV_FALLBACK) Q.confirmWait.run(now(), phone);

        res.json({
            number,
            pollToken,
            expiresAt: now() + WAIT_TTL_MS,
            dev: DEV_FALLBACK
        });
    });

    // ---- поллинг статуса ----
    app.post('/api/auth/phone/wait/status', (req, res) => {
        const phone = normalizePhone(req.body && req.body.phone);
        const pollToken = req.body && req.body.pollToken;
        if (!phone || !pollToken) return res.status(400).json({ error: 'bad request' });

        const sess = Q.waitByPhone.get(phone);
        if (!sess || sess.poll_token !== pollToken) {
            return res.status(404).json({ error: 'Сессия не найдена' });
        }
        if (now() > sess.expires_at && sess.status !== 'confirmed') {
            return res.json({ status: 'expired' });
        }
        if (sess.status !== 'confirmed') {
            return res.json({ status: 'waiting' });
        }

        // confirmed → find-or-create пользователя
        let user = Q.userByPhone.get(phone);
        let isNew = false;
        if (!user) {
            const info = Q.insertUser.run(phone, null, null, now());
            user = Q.userById.get(info.lastInsertRowid);
            isNew = true;
        }
        // новый, но без имени — тоже требует онбординга
        if (!user.first_name) isNew = true;

        const token = genToken();
        Q.insertSession.run(token, user.id, now(), now());

        res.cookie && res.cookie('panti_token', token, {
            httpOnly: false, maxAge: 365 * 24 * 60 * 60 * 1000, sameSite: 'Lax'
        });

        res.json({ status: 'confirmed', token, isNew, user: publicUser(user) });
    });

    // ---- callback от SMSC ----
    const callbackHandler = (req, res) => {
        if (req.params.secret !== SMSC_CALLBACK_SECRET) {
            return res.status(404).send('Not found');
        }
        // SMSC шлёт лишние поля — читаем что есть, без строгой валидации
        const src = Object.assign({}, req.query, req.body);
        const phone = normalizePhone(src.phone || src.caller || src.from);
        if (phone) {
            const sess = Q.waitByPhone.get(phone);
            if (sess && sess.status === 'waiting') {
                Q.confirmWait.run(now(), phone);
            }
        }
        res.send('OK'); // идемпотентно, всегда 200
    };
    app.post('/api/auth/phone/smsc-callback/:secret', callbackHandler);
    app.get('/api/auth/phone/smsc-callback/:secret', callbackHandler);

    // ---- вход через Telegram Mini App (по initData, без звонка) ----
    app.post('/api/auth/telegram', (req, res) => {
        const initData = req.body && req.body.initData;
        const parsed = verifyTelegramSigned(initData);
        if (!parsed || !parsed.user) return res.status(401).json({ error: 'Неверная подпись Telegram' });

        let tgUser;
        try { tgUser = JSON.parse(parsed.user); } catch (e) { return res.status(400).json({ error: 'bad user' }); }
        const result = loginByTelegramUser(tgUser);
        if (!result) return res.status(400).json({ error: 'no tg id' });
        res.json(result);
    });

    // ---- Вход через Telegram Login Widget (сайт/PWA, без звонка) ----
    app.post('/api/auth/telegram-widget', (req, res) => {
        const data = req.body && req.body.tgAuth;
        const parsed = verifyTelegramWidget(data);
        if (!parsed) return res.status(401).json({ error: 'Неверная подпись Telegram' });
        const result = loginByTelegramUser({
            id: parsed.id, first_name: parsed.first_name, last_name: parsed.last_name
        });
        if (!result) return res.status(400).json({ error: 'no tg id' });
        res.json(result);
    });

    // ---- привязка номера в Mini App (объединение с PWA-аккаунтом) ----
    // Принимает подписанные Telegram данные контакта; номер = собственный номер юзера.
    app.post('/api/me/link-contact', requireAuth, (req, res) => {
        const contactInit = req.body && req.body.contact; // signed query string от requestContact
        const parsed = verifyTelegramSigned(contactInit);
        if (!parsed || !parsed.contact) return res.status(401).json({ error: 'Неверная подпись контакта' });

        let contact;
        try { contact = JSON.parse(parsed.contact); } catch (e) { return res.status(400).json({ error: 'bad contact' }); }
        const phone = normalizePhone(contact.phone_number);
        if (phone.length < 11) return res.status(400).json({ error: 'Некорректный номер' });

        let resultId;
        try { resultId = linkPhoneToUser(req.user.id, phone); }
        catch (e) {
            if (e.message === 'phone-linked-other-tg') return res.status(409).json({ error: 'Этот номер уже привязан к другому Telegram' });
            console.error('link-contact error:', e.message);
            return res.status(500).json({ error: 'Не удалось привязать' });
        }
        res.json({ user: publicUser(Q.userById.get(resultId)) });
    });

    // ---- ручная привязка номера к аккаунту через звонок (для разных номеров) ----
    app.post('/api/me/link-phone/start', requireAuth, async (req, res) => {
        const phone = normalizePhone(req.body && req.body.phone);
        if (phone.length < 11) return res.status(400).json({ error: 'Некорректный номер' });
        if (!rateLimit('linkstart:' + req.user.id, 3, START_COOLDOWN_MS)) {
            return res.status(429).json({ error: 'Слишком часто, подождите' });
        }
        // Нельзя привязать номер, который уже привязан к ДРУГОМУ Telegram-аккаунту
        const other = Q.userByPhone.get(phone);
        if (other && other.id !== req.user.id && other.telegram_id && other.telegram_id !== req.user.telegram_id) {
            return res.status(409).json({ error: 'Этот номер уже привязан к другому Telegram' });
        }

        const pollToken = genToken();
        let number;
        try {
            number = DEV_FALLBACK ? 'DEV' : await smscGetWaitNumber(phone);
        } catch (e) {
            if (DEV_FALLBACK) number = 'DEV';
            else return res.status(502).json({ error: 'Сервис звонков недоступен: ' + e.message });
        }
        Q.upsertWait.run({ phone, assigned_number: number, poll_token: pollToken, expires_at: now() + WAIT_TTL_MS, created_at: now() });
        if (DEV_FALLBACK) Q.confirmWait.run(now(), phone);
        res.json({ number, pollToken, expiresAt: now() + WAIT_TTL_MS, dev: DEV_FALLBACK });
    });

    app.post('/api/me/link-phone/status', requireAuth, (req, res) => {
        const phone = normalizePhone(req.body && req.body.phone);
        const pollToken = req.body && req.body.pollToken;
        const sess = phone && Q.waitByPhone.get(phone);
        if (!sess || sess.poll_token !== pollToken) return res.status(404).json({ error: 'Сессия не найдена' });
        if (now() > sess.expires_at && sess.status !== 'confirmed') return res.json({ status: 'expired' });
        if (sess.status !== 'confirmed') return res.json({ status: 'waiting' });

        let resultId;
        try { resultId = linkPhoneToUser(req.user.id, phone); }
        catch (e) {
            if (e.message === 'phone-linked-other-tg') return res.status(409).json({ error: 'Этот номер уже привязан к другому Telegram' });
            console.error('link-phone error:', e.message);
            return res.status(500).json({ error: 'Не удалось привязать' });
        }
        res.json({ status: 'confirmed', user: publicUser(Q.userById.get(resultId)) });
    });

    // ---- профиль (онбординг: имя обязателен, фамилия по желанию) ----
    app.post('/api/me/profile', requireAuth, (req, res) => {
        const first = (req.body && req.body.firstName || '').toString().trim().slice(0, 40);
        const last = (req.body && req.body.lastName || '').toString().trim().slice(0, 40);
        if (!first) return res.status(400).json({ error: 'Имя обязательно' });
        Q.updateNames.run(first, last || null, req.user.id);
        res.json({ user: publicUser(Q.userById.get(req.user.id)) });
    });

    // ---- загрузка аватара (base64 JPEG/PNG, уже ужатый на клиенте) ----
    app.post('/api/me/avatar', requireAuth, (req, res) => {
        const img = req.body && req.body.image;
        if (!img || typeof img !== 'string') return res.status(400).json({ error: 'Нет изображения' });
        const m = img.match(/^data:image\/(jpe?g|png);base64,(.+)$/);
        if (!m) return res.status(400).json({ error: 'Неверный формат' });
        const buf = Buffer.from(m[2], 'base64');
        if (buf.length > 700 * 1024) return res.status(413).json({ error: 'Файл слишком большой' });
        try {
            fs.writeFileSync(path.join(AVATAR_DIR, req.user.id + '.jpg'), buf);
            Q.bumpAvatar.run(req.user.id);
        } catch (e) {
            console.error('avatar save error:', e.message);
            return res.status(500).json({ error: 'Не удалось сохранить' });
        }
        res.json({ user: publicUser(Q.userById.get(req.user.id)) });
    });

    // ---- кто я ----
    app.get('/api/me', requireAuth, (req, res) => {
        res.json({ user: publicUser(req.user) });
    });

    // ---- выход ----
    app.post('/api/auth/logout', (req, res) => {
        const t = getToken(req);
        if (t) Q.deleteSession.run(t);
        res.clearCookie && res.clearCookie('panti_token');
        res.json({ ok: true });
    });

    // ---- статистика (своя) ----
    app.get('/api/stats', requireAuth, (req, res) => {
        res.json({ user: publicUser(Q.userById.get(req.user.id)) });
    });

    // ---- все пользователи («Люди») ----
    app.get('/api/users', requireAuth, (req, res) => {
        const fIds = new Set(Q.friendIds.all(req.user.id).map(r => r.friend_id));
        const q = (req.query.q || '').toString().trim().toLowerCase();
        const list = Q.allUsers.all()
            .filter(u => u.id !== req.user.id && u.first_name) // только зарегистрированные
            .filter(u => !q || fullName(u).toLowerCase().includes(q))
            .map(u => ({
                id: u.id,
                name: fullName(u),
                wins: u.online_wins,
                games: u.online_games,
                avatarUrl: avatarUrlFor(u),
                isFriend: fIds.has(u.id),
                online: isUserOnline(u.id),
                avatarUrl: avatarUrlFor(u)
            }));
        res.json({ users: list });
    });

    // ---- друзья ----
    app.get('/api/friends', requireAuth, (req, res) => {
        const ids = Q.friendIds.all(req.user.id).map(r => r.friend_id);
        const friends = ids.map(id => Q.userById.get(id)).filter(Boolean).map(u => ({
            id: u.id,
            name: fullName(u),
            wins: u.online_wins,
            losses: u.online_losses,
            games: u.online_games,
            online: isUserOnline(u.id),
            avatarUrl: avatarUrlFor(u)
        }));
        res.json({ friends });
    });

    app.post('/api/friends', requireAuth, (req, res) => {
        const fid = parseInt(req.body && req.body.friendId, 10);
        if (!fid || fid === req.user.id) return res.status(400).json({ error: 'bad id' });
        if (!Q.userById.get(fid)) return res.status(404).json({ error: 'Пользователь не найден' });
        Q.addFriend.run(req.user.id, fid, now());
        res.json({ ok: true });
    });

    app.delete('/api/friends/:id', requireAuth, (req, res) => {
        const fid = parseInt(req.params.id, 10);
        Q.removeFriend.run(req.user.id, fid);
        res.json({ ok: true });
    });

    // ---- лидеры ----
    app.get('/api/leaderboard', requireAuth, (req, res) => {
        const rows = Q.leaderboard.all().filter(u => u.first_name);
        const list = rows.map((u, i) => {
            const games = u.online_games || 0;
            const winrate = games > 0 ? Math.round((u.online_wins / games) * 100) : 0;
            return {
                rank: i + 1,
                id: u.id,
                name: fullName(u),
                wins: u.online_wins,
                losses: u.online_losses,
                games,
                winrate,
                avatarUrl: avatarUrlFor(u),
                isMe: u.id === req.user.id
            };
        });
        res.json({ leaders: list });
    });

    // ---- результат игры против компьютера ----
    app.post('/api/game/result', requireAuth, (req, res) => {
        const mode = req.body && req.body.mode;
        const result = req.body && req.body.result; // 'win' | 'loss'
        if (mode !== 'computer' || !['win', 'loss'].includes(result)) {
            return res.status(400).json({ error: 'bad request' });
        }
        const win = result === 'win' ? 1 : 0;
        Q.recordComp.run(win, win ? 0 : 1, req.user.id);
        res.json({ ok: true });
    });

    // ====================== АДМИНКА ======================
    function requireAdmin(req, res, next) {
        const u = getAdminUser(getToken(req));
        if (!u) return res.status(403).json({ error: 'forbidden' });
        req.admin = u;
        next();
    }

    // дашборд
    app.get('/api/admin/stats', requireAdmin, (req, res) => {
        const dayAgo = now() - 24 * 60 * 60 * 1000;
        const weekAgo = now() - 7 * 24 * 60 * 60 * 1000;
        const g = (sql, ...a) => db.prepare(sql).get(...a).c;
        const sums = db.prepare('SELECT COALESCE(SUM(online_games),0) og, COALESCE(SUM(comp_games),0) cg FROM users').get();
        res.json({
            totalUsers: g('SELECT COUNT(*) c FROM users WHERE first_name IS NOT NULL'),
            newToday: g('SELECT COUNT(*) c FROM users WHERE created_at > ?', dayAgo),
            newWeek: g('SELECT COUNT(*) c FROM users WHERE created_at > ?', weekAgo),
            withTelegram: g('SELECT COUNT(*) c FROM users WHERE telegram_id IS NOT NULL'),
            onlineNow: onlineUsers.size,
            onlineGames: sums.og,
            compGames: sums.cg
        });
    });

    // список пользователей
    app.get('/api/admin/users', requireAdmin, (req, res) => {
        const q = (req.query.q || '').toString().trim().toLowerCase();
        const rows = db.prepare('SELECT * FROM users ORDER BY created_at DESC').all()
            .filter(u => !q || fullName(u).toLowerCase().includes(q) || String(u.phone).includes(q))
            .map(u => ({
                id: u.id, name: fullName(u), firstName: u.first_name || '', lastName: u.last_name || '',
                phone: String(u.phone).startsWith('tg:') ? null : u.phone,
                telegramId: u.telegram_id || null,
                avatarUrl: avatarUrlFor(u),
                online: isUserOnline(u.id),
                isAdmin: !!u.is_admin,
                createdAt: u.created_at,
                stats: { online: { games: u.online_games, wins: u.online_wins, losses: u.online_losses }, comp: { games: u.comp_games, wins: u.comp_wins, losses: u.comp_losses } }
            }));
        res.json({ users: rows });
    });

    // редактировать имя
    app.post('/api/admin/users/:id', requireAdmin, (req, res) => {
        const id = parseInt(req.params.id, 10);
        const u = Q.userById.get(id);
        if (!u) return res.status(404).json({ error: 'not found' });
        const first = (req.body.firstName || '').toString().trim().slice(0, 40);
        const last = (req.body.lastName || '').toString().trim().slice(0, 40);
        if (first) Q.updateNames.run(first, last || null, id);
        res.json({ ok: true });
    });

    // задать/поправить статистику напрямую
    app.post('/api/admin/users/:id/stats', requireAdmin, (req, res) => {
        const id = parseInt(req.params.id, 10);
        if (!Q.userById.get(id)) return res.status(404).json({ error: 'not found' });
        const b = req.body || {};
        const n = (v, d) => (v === undefined || v === null || v === '') ? d : Math.max(0, parseInt(v, 10) || 0);
        const cur = Q.userById.get(id);
        db.prepare(`UPDATE users SET online_games=?, online_wins=?, online_losses=?, comp_games=?, comp_wins=?, comp_losses=? WHERE id=?`).run(
            n(b.onlineGames, cur.online_games), n(b.onlineWins, cur.online_wins), n(b.onlineLosses, cur.online_losses),
            n(b.compGames, cur.comp_games), n(b.compWins, cur.comp_wins), n(b.compLosses, cur.comp_losses), id
        );
        res.json({ ok: true });
    });

    // сбросить статистику
    app.post('/api/admin/users/:id/reset-stats', requireAdmin, (req, res) => {
        const id = parseInt(req.params.id, 10);
        if (!Q.userById.get(id)) return res.status(404).json({ error: 'not found' });
        db.prepare('UPDATE users SET online_games=0, online_wins=0, online_losses=0, online_draws=0, comp_games=0, comp_wins=0, comp_losses=0 WHERE id=?').run(id);
        res.json({ ok: true });
    });

    // удалить аккаунт
    app.delete('/api/admin/users/:id', requireAdmin, (req, res) => {
        const id = parseInt(req.params.id, 10);
        if (id === req.admin.id) return res.status(400).json({ error: 'Нельзя удалить себя' });
        if (!Q.userById.get(id)) return res.status(404).json({ error: 'not found' });
        const tx = db.transaction(() => {
            db.prepare('DELETE FROM friends WHERE user_id=? OR friend_id=?').run(id, id);
            db.prepare('DELETE FROM sessions WHERE user_id=?').run(id);
            db.prepare('DELETE FROM users WHERE id=?').run(id);
        });
        tx();
        try { fs.unlinkSync(path.join(AVATAR_DIR, id + '.jpg')); } catch (e) {}
        res.json({ ok: true });
    });

    // ручное объединение аккаунтов: mergeId вливается в keepId
    app.post('/api/admin/merge', requireAdmin, (req, res) => {
        const keepId = parseInt(req.body.keepId, 10);
        const mergeId = parseInt(req.body.mergeId, 10);
        if (!keepId || !mergeId || keepId === mergeId) return res.status(400).json({ error: 'bad ids' });
        const keep = Q.userById.get(keepId), merge = Q.userById.get(mergeId);
        if (!keep || !merge) return res.status(404).json({ error: 'not found' });
        try {
            const tx = db.transaction(() => {
                // суммируем статистику
                db.prepare('UPDATE users SET online_games=online_games+?, online_wins=online_wins+?, online_losses=online_losses+?, comp_games=comp_games+?, comp_wins=comp_wins+?, comp_losses=comp_losses+? WHERE id=?')
                    .run(merge.online_games, merge.online_wins, merge.online_losses, merge.comp_games, merge.comp_wins, merge.comp_losses, keepId);
                // если у keep нет telegram, а у merge есть — переносим
                if (!keep.telegram_id && merge.telegram_id) { Q.setTgId.run(null, mergeId); Q.setTgId.run(merge.telegram_id, keepId); }
                // если у keep синтетический телефон, а у merge реальный — переносим
                if (String(keep.phone).startsWith('tg:') && merge.phone && !String(merge.phone).startsWith('tg:')) {
                    Q.setPhone.run('tg:' + (merge.telegram_id || mergeId) + 'x', mergeId);
                    Q.setPhone.run(merge.phone, keepId);
                }
                db.prepare('UPDATE sessions SET user_id=? WHERE user_id=?').run(keepId, mergeId);
                db.prepare('INSERT OR IGNORE INTO friends (user_id,friend_id,created_at) SELECT ?,friend_id,created_at FROM friends WHERE user_id=? AND friend_id!=?').run(keepId, mergeId, keepId);
                db.prepare('DELETE FROM friends WHERE user_id=? OR friend_id=?').run(mergeId, mergeId);
                db.prepare('DELETE FROM sessions WHERE user_id=?').run(mergeId);
                db.prepare('DELETE FROM users WHERE id=?').run(mergeId);
            });
            tx();
            try { fs.unlinkSync(path.join(AVATAR_DIR, mergeId + '.jpg')); } catch (e) {}
            // Живые сокеты слитого аккаунта держат старый userId → рвём их,
            // чтобы переподключились и зарегистрировали презенс под keepId.
            try {
                if (io) getUserSockets(mergeId).forEach(sid => {
                    const s = io.sockets.sockets.get(sid);
                    if (s) s.disconnect(true);
                });
            } catch (e) {}
        } catch (e) {
            console.error('admin merge error:', e.message);
            return res.status(500).json({ error: 'Не удалось объединить: ' + e.message });
        }
        res.json({ user: publicUser(Q.userById.get(keepId)) });
    });

    console.log(`[auth] смонтирован. SMSC dev-fallback: ${DEV_FALLBACK ? 'ВКЛ (звонки имитируются)' : 'выкл (реальные звонки)'}`);
}

module.exports = {
    mountAuth, getUserByToken, recordOnlineMatch, normalizePhone,
    setUserOnline, setUserOffline, isUserOnline, getUserSockets, userAvatarUrl,
    getAdminUser, allTelegramIds,
    userById: (id) => Q.userById.get(id), areFriends: (a, b) => !!Q.isFriend.get(a, b)
};
