const express = require('express');
const http = require('http');
const https = require('https');
const socketIo = require('socket.io');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const fs = require('fs');
const cookieParser = require('cookie-parser');
const auth = require('./auth');
const { mountAuth, getUserByToken, recordOnlineMatch } = auth;

// Активные приглашения в игру: inviteId → { roomId, fromUserId, toUserId, timer }
const invites = new Map();

// РФ-сервер не достучивается до api.telegram.org напрямую (DPI-блок) —
// TELEGRAM_API_BASE_URL указывает на Cloudflare Worker-relay, если задан.
const TELEGRAM_API_BASE = process.env.TELEGRAM_API_BASE_URL || 'https://api.telegram.org';
const TELEGRAM_BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME || 'panty_game_bot';

// Общий helper для вызовов Telegram Bot API (sendMessage/answerCallbackQuery/editMessageReplyMarkup/getUpdates).
function telegramApi(method, payload) {
    return new Promise((resolve) => {
        const token = process.env.TELEGRAM_BOT_TOKEN;
        if (!token) return resolve({ ok: false, error: 'no token' });
        const body = JSON.stringify(payload || {});
        const r = https.request(`${TELEGRAM_API_BASE}/bot${token}/${method}`,
            { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } },
            (resp) => { let d = ''; resp.on('data', c => d += c); resp.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { resolve({ ok: false, error: 'bad response' }); } }); });
        r.on('error', (e) => resolve({ ok: false, error: e.message }));
        r.write(body); r.end();
    });
}

// DM другу-оффлайну о приглашении в игру: кнопка «Открыть игру» (обычный Mini App deep-link;
// специальной логики авто-принятия не нужно — как только человек залогинится, сокет-хендлер
// connection сам найдёт висящий инвайт по toUserId и пришлёт game-invite, дальше обычный
// попап Принять/Отклонить) и «Пока не могу» (callback_query → decline, см. pollTelegramUpdates
// ниже), чтобы позвавший не ждал молча — увидит invite-declined и сможет позвать кого-то ещё.
function sendTelegramInvite(telegramId, inviteId, text) {
    telegramApi('sendMessage', {
        chat_id: telegramId,
        text,
        reply_markup: {
            inline_keyboard: [[
                { text: '🎴 Открыть игру', url: `https://t.me/${TELEGRAM_BOT_USERNAME}?startapp=invite` },
                { text: '❌ Пока не могу', callback_data: `decline:${inviteId}` }
            ]]
        }
    }).then(r => { r.ok ? console.log(`[invite] DM отправлена telegramId=${telegramId}`) : console.error('[invite] DM НЕ отправлена:', JSON.stringify(r)); });
}

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Включение CORS
app.use(cors());

// Парсинг тела запросов и cookie (для REST-API авторизации)
app.use(express.json({ limit: '1mb' })); // запас под загрузку аватара (base64)
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// REST-API: регистрация/авторизация по телефону, пользователи, друзья, статистика
mountAuth(app, io);

// ---- Админские роуты, которым нужны live-комнаты / бот (поэтому здесь, не в auth.js) ----
function adminFromReq(req) {
    let token = null;
    const h = req.headers['authorization'];
    if (h && h.startsWith('Bearer ')) token = h.slice(7);
    else if (req.cookies && req.cookies.panti_token) token = req.cookies.panti_token;
    return auth.getAdminUser(token);
}
function requireAdminMw(req, res, next) {
    if (!adminFromReq(req)) return res.status(403).json({ error: 'forbidden' });
    next();
}

// live-комнаты
app.get('/api/admin/rooms', requireAdminMw, (req, res) => {
    const list = [];
    for (const [id, gs] of rooms.entries()) {
        list.push({
            roomId: id,
            format: gs.format || '1v1',
            started: !!gs.gameStarted,
            ended: !!gs.gameEnded,
            round: gs.roundNumber || 1,
            targetScore: gs.targetScore || 21,
            players: (gs.players || []).map(p => ({ name: p.name, connected: !!p.connected, userId: p.userId || null })),
            totalScores: gs.totalScores || []
        });
    }
    res.json({ rooms: list, count: list.length });
});

// закрыть зависшую комнату
app.post('/api/admin/rooms/:id/close', requireAdminMw, (req, res) => {
    const id = req.params.id;
    if (rooms.has(id)) {
        io.to(id).emit('opponent-left', { playerName: 'Администратор', playerIndex: -1 });
        rooms.delete(id);
        deleteRoomFile(id);
        return res.json({ ok: true });
    }
    res.status(404).json({ error: 'not found' });
});

// рассылка всем пользователям с Telegram через бота
app.post('/api/admin/broadcast', requireAdminMw, async (req, res) => {
    const text = (req.body && req.body.text || '').toString().trim();
    if (!text) return res.status(400).json({ error: 'Пустое сообщение' });
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return res.status(500).json({ error: 'Нет токена бота' });

    const ids = auth.allTelegramIds();
    let sent = 0, failed = 0;
    for (const chatId of ids) {
        const r = await telegramApi('sendMessage', { chat_id: chatId, text });
        r.ok ? sent++ : failed++;
        await new Promise(r => setTimeout(r, 40)); // ~25 msg/sec, под лимит Telegram
    }
    res.json({ ok: true, total: ids.length, sent, failed });
});

// Обработка кнопки «Пока не могу» на офлайн-инвайте (callback_query из pollTelegramUpdates
// ниже — webhook пробовали, но Telegram не смог достучаться ДО этого RF-сервера, "Connection
// timed out", тот же класс блокировки что и в обратную сторону, см. TELEGRAM_API_BASE).
function handleCallbackQuery(cq) {
    if (!cq || typeof cq.data !== 'string' || !cq.data.startsWith('decline:')) return;

    const inviteId = cq.data.slice('decline:'.length);
    const inv = invites.get(inviteId);
    if (inv) {
        clearTimeout(inv.timer);
        invites.delete(inviteId);
        auth.getUserSockets(inv.fromUserId).forEach(sid => io.to(sid).emit('invite-declined', {
            byName: inv.toName || 'Игрок', multi: !!inv.multi
        }));
        if (!inv.multi && rooms.has(inv.roomId)) { rooms.delete(inv.roomId); deleteRoomFile(inv.roomId); }
    }

    telegramApi('answerCallbackQuery', {
        callback_query_id: cq.id,
        text: inv ? 'Хорошо, дал знать другу' : 'Приглашение уже неактуально'
    });
    if (cq.message) {
        telegramApi('editMessageReplyMarkup', {
            chat_id: cq.message.chat.id, message_id: cq.message.message_id,
            reply_markup: { inline_keyboard: [[{ text: '❌ Отклонено', callback_data: 'noop' }]] }
        });
    }
}

// Long-polling getUpdates вместо webhook — тот же паттерн, что уже работает у остальных
// ботов (povod/aarpi), а не push от Telegram к нам (см. комментарий в handleCallbackQuery).
let tgPollOffset = 0;
async function pollTelegramUpdates() {
    if (!process.env.TELEGRAM_BOT_TOKEN) return;
    const r = await telegramApi('getUpdates', { offset: tgPollOffset, timeout: 30, allowed_updates: ['callback_query'] });
    if (r.ok && Array.isArray(r.result)) {
        for (const upd of r.result) {
            tgPollOffset = upd.update_id + 1;
            if (upd.callback_query) handleCallbackQuery(upd.callback_query);
        }
    } else if (!r.ok) {
        console.error('[invite] getUpdates failed:', JSON.stringify(r));
        await new Promise(res => setTimeout(res, 5000)); // не долбить API при ошибке
    }
    setImmediate(pollTelegramUpdates);
}

// страница админки
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Обслуживание статических файлов
app.use(express.static(path.join(__dirname, 'public')));

// Путь для хранения комнат
const ROOMS_STORAGE_PATH = path.join(__dirname, 'game_rooms');

// Создаем директорию для хранения комнат, если ее нет
if (!fs.existsSync(ROOMS_STORAGE_PATH)) {
    fs.mkdirSync(ROOMS_STORAGE_PATH, { recursive: true });
}

// Хранение активных игровых комнат
const rooms = new Map();

// Функция для сохранения комнаты в файл
function saveRoomToFile(roomId, gameState) {
    try {
        const filePath = path.join(ROOMS_STORAGE_PATH, `${roomId}.json`);
        fs.writeFileSync(filePath, JSON.stringify(gameState, null, 2));
        console.log(`Комната ${roomId} сохранена в файл`);
    } catch (error) {
        console.error(`Ошибка при сохранении комнаты ${roomId}:`, error);
    }
}

// Функция для загрузки комнаты из файла
function loadRoomFromFile(roomId) {
    try {
        const filePath = path.join(ROOMS_STORAGE_PATH, `${roomId}.json`);
        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error(`Ошибка при загрузке комнаты ${roomId}:`, error);
    }
    return null;
}

// Функция для удаления сохраненной комнаты
function deleteRoomFile(roomId) {
    try {
        const filePath = path.join(ROOMS_STORAGE_PATH, `${roomId}.json`);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`Файл комнаты ${roomId} удален`);
        }
    } catch (error) {
        console.error(`Ошибка при удалении файла комнаты ${roomId}:`, error);
    }
}

// Функция для генерации уникального ID комнаты
function generateUniqueRoomId() {
    // Генерируем короткий ID (3 цифры) и проверяем, что он уникален
    let roomId;
    do {
        roomId = String(Math.floor(100 + Math.random() * 900));
    } while (rooms.has(roomId) || fs.existsSync(path.join(ROOMS_STORAGE_PATH, `${roomId}.json`)));

    return roomId;
}

// Функция для создания новой колоды
function createDeck() {
    const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
    const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const deck = [];

    for (const suit of suits) {
        for (const value of values) {
            let numericValue = 0;
            if (value === 'A') numericValue = 1;
            else if (['J', 'Q', 'K'].includes(value)) numericValue = 10;
            else numericValue = parseInt(value);

            deck.push({ suit, value, numericValue });
        }
    }

    // Перемешиваем колоду
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    return deck;
}

// Функция для инициализации новой игры
function initializeGame(numPlayers = 2, format = '1v1') {
    const gameState = {
        deck: createDeck(),
        tableCards: [],
        players: [],
        numPlayers,
        format,
        currentPlayerIndex: 0,
        lastPlayerWhoTook: null,
        gameStarted: false,
        gameEnded: false,
        lastTakenCards: [],
        lastTakenBy: null,
        totalScores: new Array(numPlayers).fill(0),
        roundNumber: 1,
        targetScore: 21
    };

    for (let i = 0; i < numPlayers; i++) {
        gameState.players.push({
            id: null,
            name: `Игрок ${i + 1}`,
            hand: [],
            collected: [],
            score: 0,
            bonusPoints: 0,
            connected: false
        });
    }

    for (const player of gameState.players) {
        player.hand = drawCards(gameState.deck, 4);
    }
    gameState.tableCards = drawCards(gameState.deck, 4);

    return gameState;
}

// Функция для взятия карт из колоды
function drawCards(deck, count) {
    const cards = [];
    for (let i = 0; i < count && deck.length > 0; i++) {
        cards.push(deck.pop());
    }
    return cards;
}

// Обработка WebSocket соединений
io.on('connection', (socket) => {
    console.log('Новое соединение:', socket.id);

    // Привязка сокета к аккаунту (если клиент передал токен в handshake)
    try {
        const token = socket.handshake && socket.handshake.auth && socket.handshake.auth.token;
        const u = token ? getUserByToken(token) : null;
        if (u) {
            socket.userId = u.id;
            socket.userName = [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || null;
            const becameOnline = auth.setUserOnline(u.id, socket.id);
            // Презенс в реальном времени: оповещаем всех, что игрок появился в сети
            if (becameOnline) io.emit('presence', { userId: u.id, online: true });

            // Догоняем приглашения, отправленные пока юзер был офлайн (DM в Telegram) —
            // если он открыл приложение сам, а не по кнопке из сообщения, попап всё равно должен появиться.
            let pendingCount = 0;
            for (const [inviteId, inv] of invites) {
                if (inv.toUserId === u.id) {
                    pendingCount++;
                    console.log(`[invite] socket подключился userId=${u.id}, догоняем висящий invite ${inviteId} (room ${inv.roomId})`);
                    socket.emit('game-invite', {
                        inviteId, roomId: inv.roomId, fromName: inv.fromName || 'Игрок',
                        format: inv.format, targetScore: inv.targetScore, multi: inv.multi
                    });
                }
            }
            console.log(`[invite] connect: userId=${u.id}, всего активных invites=${invites.size}, из них для этого юзера=${pendingCount}`);
        } else if (token) {
            // Токен передан, но недействителен (аккаунт слит/удалён, сессия истекла).
            // Сокет остаётся анонимным → презенс не регистрируется. Просим клиент
            // перелогиниться и переподключиться с актуальным токеном.
            console.log('[invite] connect: токен есть, но невалиден — auth-invalid');
            socket.emit('auth-invalid');
        } else {
            console.log('[invite] connect: без токена вообще (анонимный сокет)');
        }
    } catch (e) { console.log('[invite] connect: ошибка при авторизации сокета:', e.message); }

    // Создание новой игровой комнаты
    socket.on('create-room', (data) => {
        const playerName = typeof data === 'string' ? data : (data && data.playerName ? data.playerName : 'Игрок 1');
        const format = (typeof data === 'object' && data && data.format) ? data.format : '1v1';
        const numPlayers = format === '3p' ? 3 : format === '2v2' ? 4 : 2;

        const roomId = generateUniqueRoomId();
        const gameState = initializeGame(numPlayers, format);

        gameState.players[0].id = socket.id;
        gameState.players[0].name = playerName;
        gameState.players[0].connected = true;
        gameState.players[0].userId = socket.userId || null;
        gameState.players[0].avatar = socket.userId ? auth.userAvatarUrl(socket.userId) : null;

        rooms.set(roomId, gameState);
        saveRoomToFile(roomId, gameState);

        socket.join(roomId);
        socket.roomId = roomId;

        socket.emit('room-created', {
            roomId,
            gameState,
            playerId: socket.id,
            playerIndex: 0
        });

        console.log(`Создана комната: ${roomId}, формат: ${format}, игроков: ${numPlayers}`);
    });

    // Запуск нового раунда
    // Исправление в функции startNewRound в server.js
    socket.on('start-new-round', (roomId) => {
        if (!rooms.has(roomId)) {
            // Пробуем загрузить из файла
            const gameState = loadRoomFromFile(roomId);
            if (gameState) {
                rooms.set(roomId, gameState);
            } else {
                socket.emit('error', { message: 'Комната не найдена' });
                return;
            }
        }

        const gameState = rooms.get(roomId);

        // ОЧЕНЬ ВАЖНАЯ ПРОВЕРКА: убедимся, что стол пуст перед началом нового раунда
        if (gameState.tableCards.length > 0) {
            console.log(`Перед началом нового раунда в комнате ${roomId} на столе остались ${gameState.tableCards.length} карт`);

            const lpIdx = resolveLastTakerIndex(gameState);
            console.log(`Передаем оставшиеся карты игроку ${gameState.players[lpIdx].name}`);
            gameState.players[lpIdx].collected.push(...gameState.tableCards);

            // Очищаем стол
            gameState.tableCards = [];

            // Сохраняем промежуточное состояние с распределенными картами
            rooms.set(roomId, gameState);
            saveRoomToFile(roomId, gameState);
        }

        // Увеличиваем номер раунда
        gameState.roundNumber++;

        // Сохраняем имена игроков, привязку к аккаунту и общий счет
        const numPlayers = gameState.numPlayers || 2;
        const format = gameState.format || '1v1';
        const playerInfo = gameState.players.map(p => ({
            id: p.id, name: p.name, connected: p.connected, userId: p.userId || null, avatar: p.avatar || null
        }));
        const totalScores = [...(gameState.totalScores || new Array(numPlayers).fill(0))];
        const roundNumber = gameState.roundNumber;
        const targetScore = gameState.targetScore || 21;  // НЕ терять выбранную длину (11/21)

        const newGameState = initializeGame(numPlayers, format);

        playerInfo.forEach((info, i) => {
            newGameState.players[i].id = info.id;
            newGameState.players[i].name = info.name;
            newGameState.players[i].connected = info.connected;
            newGameState.players[i].userId = info.userId;   // иначе статистика матча не запишется
            newGameState.players[i].avatar = info.avatar;
        });
        newGameState.totalScores = totalScores;
        newGameState.roundNumber = roundNumber;
        newGameState.targetScore = targetScore;
        newGameState.gameStarted = true;
        newGameState.currentPlayerIndex = Math.floor(Math.random() * numPlayers);

        // Обновляем состояние комнаты
        rooms.set(roomId, newGameState);
        saveRoomToFile(roomId, newGameState);

        // Оповещаем игроков о начале нового раунда
        io.to(roomId).emit('game-start', newGameState);

        console.log(`Начат новый раунд в комнате: ${roomId}`);
    });

    // Присоединение к существующей комнате
    socket.on('join-room', (data) => {
        const { roomId, playerName } = data;
        let gameState;

        if (rooms.has(roomId)) {
            gameState = rooms.get(roomId);
        } else {
            gameState = loadRoomFromFile(roomId);
            if (gameState) {
                rooms.set(roomId, gameState);
                console.log(`Комната ${roomId} загружена из файла`);
            } else {
                socket.emit('error', { message: 'Комната не найдена' });
                return;
            }
        }

        const numPlayers = gameState.numPlayers || 2;

        // Find first slot with no id or disconnected player
        let slotIndex = gameState.players.findIndex(p => !p.id);
        if (slotIndex === -1) {
            slotIndex = gameState.players.findIndex(p => p.id && !p.connected);
        }

        if (slotIndex === -1) {
            socket.emit('error', { message: 'Комната уже заполнена' });
            return;
        }

        gameState.players[slotIndex].id = socket.id;
        gameState.players[slotIndex].name = playerName || `Игрок ${slotIndex + 1}`;
        gameState.players[slotIndex].connected = true;
        gameState.players[slotIndex].userId = socket.userId || null;
        gameState.players[slotIndex].avatar = socket.userId ? auth.userAvatarUrl(socket.userId) : null;

        socket.join(roomId);
        socket.roomId = roomId;

        const connectedCount = gameState.players.filter(p => p.connected).length;
        const allConnected = connectedCount === numPlayers;

        if (allConnected && !gameState.gameStarted) {
            gameState.currentPlayerIndex = Math.floor(Math.random() * numPlayers);
            gameState.gameStarted = true;
        }

        rooms.set(roomId, gameState);
        saveRoomToFile(roomId, gameState);

        socket.emit('room-joined', {
            roomId,
            gameState,
            playerId: socket.id,
            playerIndex: slotIndex
        });

        if (allConnected) {
            io.to(roomId).emit('game-start', gameState);
        } else {
            // Notify others that someone joined (game not started yet)
            socket.to(roomId).emit('player-joined', {
                gameState,
                joinedPlayerIndex: slotIndex,
                waitingFor: numPlayers - connectedCount
            });
        }

        console.log(`Игрок присоединился к комнате: ${roomId}, слот: ${slotIndex}, подключено: ${connectedCount}/${numPlayers}`);
    });

    // Кик игрока из лобби (только для создателя комнаты, до начала игры)
    socket.on('kick-player', (data) => {
        const { roomId, playerIndex } = data;
        if (!rooms.has(roomId)) {
            socket.emit('error', { message: 'Комната не найдена' });
            return;
        }

        const gameState = rooms.get(roomId);

        // Только создатель (playerIndex 0) может кикать
        if (gameState.players[0].id !== socket.id) {
            socket.emit('error', { message: 'Только создатель может исключать игроков' });
            return;
        }

        // Нельзя кикать после старта игры
        if (gameState.gameStarted) {
            socket.emit('error', { message: 'Нельзя исключить игрока после начала игры' });
            return;
        }

        // Нельзя кикнуть самого себя
        if (playerIndex === 0) {
            socket.emit('error', { message: 'Нельзя исключить себя' });
            return;
        }

        const kickedPlayer = gameState.players[playerIndex];
        if (!kickedPlayer) return;

        // Если игрок подключён — кикаем и очищаем слот
        if (kickedPlayer.id) {
            const kickedSocketId = kickedPlayer.id;
            io.to(kickedSocketId).emit('kicked-from-room', { message: 'Вы были исключены из комнаты' });
            const kickedSocket = io.sockets.sockets.get(kickedSocketId);
            if (kickedSocket) {
                kickedSocket.leave(roomId);
                kickedSocket.roomId = null;
            }
        }

        // Удаляем слот из массива игроков и уменьшаем numPlayers
        gameState.players.splice(playerIndex, 1);
        gameState.numPlayers = gameState.players.length;

        // Обновляем формат
        if (gameState.numPlayers === 2) gameState.format = '1v1';
        else if (gameState.numPlayers === 3) gameState.format = '3p';

        rooms.set(roomId, gameState);
        saveRoomToFile(roomId, gameState);

        // Обновляем лобби для оставшихся
        const connectedCount = gameState.players.filter(p => p.connected).length;
        io.to(roomId).emit('lobby-updated', {
            gameState,
            waitingFor: gameState.numPlayers - connectedCount
        });

        console.log(`Слот ${playerIndex} удалён из комнаты ${roomId}, осталось ${gameState.numPlayers} слотов`);
    });

    // Принудительный запуск игры создателем (когда есть хотя бы 2 подключённых)
    socket.on('force-start-game', (roomId) => {
        if (!rooms.has(roomId)) {
            socket.emit('error', { message: 'Комната не найдена' });
            return;
        }

        const gameState = rooms.get(roomId);

        if (gameState.players[0].id !== socket.id) {
            socket.emit('error', { message: 'Только создатель может запустить игру' });
            return;
        }

        if (gameState.gameStarted) {
            socket.emit('error', { message: 'Игра уже запущена' });
            return;
        }

        const connectedCount = gameState.players.filter(p => p.connected).length;
        if (connectedCount < 2) {
            socket.emit('error', { message: 'Нужно минимум 2 игрока' });
            return;
        }

        // Удаляем пустые слоты
        gameState.players = gameState.players.filter(p => p.id && p.connected);
        gameState.numPlayers = gameState.players.length;

        if (gameState.numPlayers === 2) gameState.format = '1v1';
        else if (gameState.numPlayers === 3) gameState.format = '3p';

        gameState.currentPlayerIndex = Math.floor(Math.random() * gameState.numPlayers);
        gameState.gameStarted = true;

        rooms.set(roomId, gameState);
        saveRoomToFile(roomId, gameState);

        io.to(roomId).emit('game-start', gameState);
        console.log(`Игра принудительно запущена в комнате ${roomId} с ${gameState.numPlayers} игроками`);
    });

    // Обработка хода игрока
    socket.on('make-move', (moveData) => {
        const { roomId, moveType, handCard, tableCards } = moveData;

        if (!rooms.has(roomId)) {
            // Пытаемся загрузить комнату из файла
            const gameState = loadRoomFromFile(roomId);
            if (gameState) {
                rooms.set(roomId, gameState);
            } else {
                socket.emit('error', { message: 'Комната не найдена' });
                return;
            }
        }

        const gameState = rooms.get(roomId);
        const playerIndex = gameState.players.findIndex(p => p.id === socket.id);

        // Проверяем, что сейчас ход этого игрока
        if (playerIndex !== gameState.currentPlayerIndex) {
            socket.emit('error', { message: 'Сейчас не ваш ход' });
            return;
        }

        const player = gameState.players[playerIndex];

        // Обрабатываем ход
        if (moveType === 'take') {
            // Взятие карт
            takeCards(gameState, player, handCard, tableCards);
        } else if (moveType === 'discard') {
            // Сброс карты
            discardCard(gameState, player, handCard);
        }

        // Проверяем, нужно ли раздать новые карты
        checkAndDealNewCards(gameState);

        // Проверяем, закончилась ли игра
        if (checkGameEnd(gameState)) {
            endGame(gameState);
        } else {
            // Передаем ход другому игроку
            gameState.currentPlayerIndex = (gameState.currentPlayerIndex + 1) % (gameState.numPlayers || 2);
        }

        // Обновляем состояние комнаты
        rooms.set(roomId, gameState);
        saveRoomToFile(roomId, gameState); // Сохраняем состояние после каждого хода

        // Отправляем обновленное состояние обоим игрокам
        io.to(roomId).emit('game-update', gameState);
    });

    // Эмоция игрока — релей остальным в комнате
    socket.on('player-emoji', (data) => {
        if (data && data.roomId && data.emoji) {
            socket.to(data.roomId).emit('player-emoji', {
                playerIndex: data.playerIndex,
                emoji: String(data.emoji).slice(0, 40) // эмодзи или короткая фраза
            });
        }
    });

    // ====== Приглашение друзей в онлайн-игру (1 на 1, 3 игрока, 2 на 2) ======
    // Снять все висящие приглашения, ведущие в комнату (при отмене/удалении)
    function cancelInvitesForRoom(roomId) {
        for (const [id, inv] of invites) {
            if (inv.roomId === roomId) { clearTimeout(inv.timer); invites.delete(id); }
        }
    }

    // Общий помощник: создать комнату нужного формата с хостом и разослать приглашения
    function startInvites(format, targetScore, friendIds) {
        const numPlayers = format === '2v2' ? 4 : format === '3p' ? 3 : 2;
        const multi = numPlayers > 2;

        console.log(`[invite] запрос от userId=${socket.userId}, format=${format}, friendIds=${JSON.stringify(friendIds)}`);

        // нормализуем список: числа, не я, уникальные, не больше чем нужно слотов
        let ids = (Array.isArray(friendIds) ? friendIds : [friendIds]).map(x => parseInt(x, 10));
        ids = [...new Set(ids)].filter(id => id && id !== socket.userId).slice(0, numPlayers - 1);
        if (!ids.length) { console.log('[invite] отбой: bad (пустой список после нормализации)'); socket.emit('invite-failed', { reason: 'bad' }); return; }

        // онлайн — зовём через сокет; офлайн, но с привязанным Telegram — зовём DM-сообщением
        // с кнопками «Открыть игру»/«Пока не могу» (вместо мгновенного и молчаливого фейла).
        const targets = ids.map(id => {
            const sockets = auth.getUserSockets(id);
            if (sockets.length) return { id, sockets, viaTelegram: false };
            const u = auth.userById(id);
            if (u && u.telegram_id) return { id, sockets: [], viaTelegram: true, telegramId: u.telegram_id };
            console.log(`[invite] userId=${id} недостижим: офлайн и ${u ? 'без telegram_id' : 'не найден в БД'}`);
            return null; // офлайн и без Telegram — реально недостижим
        }).filter(Boolean);
        console.log(`[invite] targets: ${JSON.stringify(targets.map(t => ({ id: t.id, viaTelegram: t.viaTelegram, sockets: t.sockets.length })))}`);
        if (!targets.length) { console.log('[invite] отбой: offline (никто не достижим)'); socket.emit('invite-failed', { reason: 'offline' }); return; }

        // комната, хост — приглашающий (слот 0)
        const roomId = generateUniqueRoomId();
        const gameState = initializeGame(numPlayers, format);
        gameState.targetScore = targetScore;
        gameState.players[0].id = socket.id;
        gameState.players[0].name = socket.userName || 'Игрок 1';
        gameState.players[0].connected = true;
        gameState.players[0].userId = socket.userId;
        gameState.players[0].avatar = auth.userAvatarUrl(socket.userId);
        rooms.set(roomId, gameState);
        saveRoomToFile(roomId, gameState);
        socket.join(roomId);
        socket.roomId = roomId;

        targets.forEach(t => {
            const u = auth.userById(t.id);
            const toName = u ? ([u.first_name, u.last_name].filter(Boolean).join(' ').trim() || 'Игрок') : 'Игрок';
            const inviteId = uuidv4();
            const fromName = socket.userName || 'Игрок';
            // Живому в сокете игроку не до размышлений — 60с. Офлайн-DM ждёт, пока человек
            // увидит пуш в Telegram и откроет приложение — даём 15 минут.
            const ttlMs = t.viaTelegram ? 15 * 60 * 1000 : 60 * 1000;
            const timer = setTimeout(() => {
                if (!invites.has(inviteId)) return;
                invites.delete(inviteId);
                t.sockets.forEach(sid => io.to(sid).emit('invite-expired', { inviteId }));
                // Офлайн-DM живёт до 15 минут — за это время у хоста мог смениться socket.id
                // (переподключение), поэтому бьём по актуальным сокетам его аккаунта, а не
                // по сокету из момента создания инвайта.
                auth.getUserSockets(socket.userId).forEach(sid => io.to(sid).emit('invite-expired', { multi, name: toName }));
                // 1 на 1: никто не принял — убираем пустую комнату
                if (!multi && rooms.has(roomId)) {
                    const gs = rooms.get(roomId);
                    if (!gs.players[1].connected) { rooms.delete(roomId); deleteRoomFile(roomId); }
                }
            }, ttlMs);
            invites.set(inviteId, { roomId, fromUserId: socket.userId, toUserId: t.id, timer, multi, toName, fromName, format, targetScore });

            if (!t.viaTelegram) {
                t.sockets.forEach(sid => io.to(sid).emit('game-invite', {
                    inviteId, roomId, fromName, format, targetScore, multi
                }));
            } else {
                const lenLabel = targetScore === 11 ? 'до 11 очков' : 'до 21 очка';
                const fmtLabel = format === '2v2' ? '2 на 2' : format === '3p' ? '3 игрока' : '1 на 1';
                sendTelegramInvite(t.telegramId, inviteId,
                    `🎴 ${fromName} зовёт вас в игру «Панти» (${fmtLabel}, ${lenLabel})!`);
            }
        });

        socket.emit('invite-sent', {
            roomId, playerId: socket.id, playerIndex: 0, targetScore,
            multi, format, numPlayers, invited: targets.length, gameState
        });
        console.log(`Приглашение(${format}): ${socket.userId} → [${targets.map(t => t.id)}], комната ${roomId}`);
    }

    // 1 на 1 (одиночное приглашение — кнопка «Позвать» у друга)
    socket.on('invite-friend', (data) => {
        if (!socket.userId) { console.log('[invite] invite-friend без userId (не авторизован)'); socket.emit('invite-failed', { reason: 'auth' }); return; }
        const targetScore = (data && parseInt(data.targetScore, 10) === 11) ? 11 : 21;
        startInvites('1v1', targetScore, data && data.friendId);
    });

    // Несколько друзей сразу (3 игрока / 2 на 2 / либо 1 на 1)
    socket.on('invite-friends', (data) => {
        if (!socket.userId) { console.log('[invite] invite-friends без userId (не авторизован)'); socket.emit('invite-failed', { reason: 'auth' }); return; }
        const format = (data && data.format === '2v2') ? '2v2' : (data && data.format === '3p') ? '3p' : '1v1';
        const targetScore = (data && parseInt(data.targetScore, 10) === 11) ? 11 : 21;
        startInvites(format, targetScore, data && data.friendIds);
    });

    socket.on('invite-response', (data) => {
        const inviteId = data && data.inviteId;
        const accept = data && data.accept;
        const inv = inviteId && invites.get(inviteId);
        if (!inv) { socket.emit('error', { message: 'Приглашение больше не активно' }); return; }
        if (socket.userId !== inv.toUserId) return; // отвечать может только приглашённый

        clearTimeout(inv.timer);
        invites.delete(inviteId);
        const gameState = rooms.get(inv.roomId);
        const fromSockets = auth.getUserSockets(inv.fromUserId);

        if (!accept) {
            fromSockets.forEach(sid => io.to(sid).emit('invite-declined', {
                byName: socket.userName || inv.toName || 'Игрок', multi: !!inv.multi
            }));
            // 1 на 1: играть больше не с кем — удаляем комнату. Мульти: хост ждёт остальных в лобби.
            if (gameState && !inv.multi) { rooms.delete(inv.roomId); deleteRoomFile(inv.roomId); }
            return;
        }

        if (!gameState) { socket.emit('invite-expired', {}); return; }

        // Занимаем первый свободный слот
        let slot = gameState.players.findIndex(p => !p.id);
        if (slot === -1) slot = gameState.players.findIndex(p => p.id && !p.connected);
        if (slot === -1) { socket.emit('error', { message: 'Комната уже заполнена' }); return; }

        gameState.players[slot].id = socket.id;
        gameState.players[slot].name = socket.userName || `Игрок ${slot + 1}`;
        gameState.players[slot].connected = true;
        gameState.players[slot].userId = socket.userId;
        gameState.players[slot].avatar = auth.userAvatarUrl(socket.userId);
        socket.join(inv.roomId);
        socket.roomId = inv.roomId;

        const numPlayers = gameState.numPlayers || 2;
        const connectedCount = gameState.players.filter(p => p.connected).length;

        if (connectedCount >= numPlayers && !gameState.gameStarted) {
            // Все в сборе — старт. Снимаем оставшиеся приглашения в эту комнату.
            cancelInvitesForRoom(inv.roomId);
            gameState.currentPlayerIndex = Math.floor(Math.random() * numPlayers);
            gameState.gameStarted = true;
            rooms.set(inv.roomId, gameState);
            saveRoomToFile(inv.roomId, gameState);
            socket.emit('room-joined', { roomId: inv.roomId, gameState, playerId: socket.id, playerIndex: slot });
            io.to(inv.roomId).emit('game-start', gameState);
            console.log(`Приглашение ${inviteId} принято — комната ${inv.roomId} заполнена, старт`);
        } else {
            // Ждём остальных — приглашённый попадает в лобби, хост видит обновление списка
            rooms.set(inv.roomId, gameState);
            saveRoomToFile(inv.roomId, gameState);
            socket.emit('room-joined', { roomId: inv.roomId, gameState, playerId: socket.id, playerIndex: slot });
            socket.to(inv.roomId).emit('player-joined', {
                gameState, joinedPlayerIndex: slot, waitingFor: numPlayers - connectedCount
            });
            console.log(`Приглашение ${inviteId} принято — слот ${slot}, ждём ещё ${numPlayers - connectedCount}`);
        }
    });

    // Добровольный выход из игры
    socket.on('leave-game', () => {
        console.log('Игрок покидает игру:', socket.id);

        if (socket.roomId && rooms.has(socket.roomId)) {
            const gameState = rooms.get(socket.roomId);
            const playerIndex = gameState.players.findIndex(p => p.id === socket.id);

            if (playerIndex !== -1) {
                const playerName = gameState.players[playerIndex].name;
                gameState.players[playerIndex].connected = false;

                // Хост отменяет лобби до старта — снимаем висящие приглашения в эту комнату
                if (playerIndex === 0 && !gameState.gameStarted) {
                    cancelInvitesForRoom(socket.roomId);
                }

                // Уведомляем всех остальных игроков
                socket.to(socket.roomId).emit('opponent-left', {
                    playerName: playerName,
                    playerIndex: playerIndex
                });

                // В 1v1 — удаляем комнату сразу; либо если хост отменил ещё не начатую мульти-комнату
                if (gameState.format === '1v1' || gameState.players.length === 2 ||
                    (playerIndex === 0 && !gameState.gameStarted)) {
                    rooms.delete(socket.roomId);
                    deleteRoomFile(socket.roomId);
                    console.log(`Комната ${socket.roomId} удалена — игрок вышел`);
                } else {
                    saveRoomToFile(socket.roomId, gameState);
                }

                socket.leave(socket.roomId);
                socket.roomId = null;
            }
        }
    });

    // Обработка отключения игрока
    socket.on('disconnect', () => {
        console.log('Отключение:', socket.id);

        // Снимаем присутствие онлайн; если ушёл совсем — оповещаем всех
        if (socket.userId) {
            const becameOffline = auth.setUserOffline(socket.userId, socket.id);
            if (becameOffline) io.emit('presence', { userId: socket.userId, online: false });
        }

        if (socket.roomId && rooms.has(socket.roomId)) {
            const gameState = rooms.get(socket.roomId);

            // Помечаем игрока как отключенного
            const playerIndex = gameState.players.findIndex(p => p.id === socket.id);
            if (playerIndex !== -1) {
                gameState.players[playerIndex].connected = false;

                // Сохраняем обновленное состояние в файл
                saveRoomToFile(socket.roomId, gameState);

                // Отправляем обновление другому игроку
                io.to(socket.roomId).emit('player-disconnected', {
                    gameState,
                    disconnectedPlayerIndex: playerIndex
                });

                // Грейс-период: комната живёт, пока хотя бы один игрок на связи.
                // Если ВСЕ отключились — удаляем через 3 минуты (окно на возврат).
                const roomIdAtDisconnect = socket.roomId;
                setTimeout(() => {
                    if (rooms.has(roomIdAtDisconnect)) {
                        const currentState = rooms.get(roomIdAtDisconnect);
                        if (currentState.players.every(p => !p.connected)) {
                            rooms.delete(roomIdAtDisconnect);
                            deleteRoomFile(roomIdAtDisconnect);
                            console.log(`Комната удалена после грейс-периода: ${roomIdAtDisconnect}`);
                        }
                    }
                }, 3 * 60 * 1000); // 3 минуты
            }
        }
    });

    // Добавляем новый обработчик для проверки состояния комнаты
    socket.on('check-room', (roomId) => {
        // Проверяем существование комнаты в памяти
        if (rooms.has(roomId)) {
            socket.emit('room-exists', { exists: true });
            return;
        }

        // Проверяем существование комнаты в файловой системе
        const gameState = loadRoomFromFile(roomId);
        if (gameState) {
            rooms.set(roomId, gameState); // Загружаем в память
            socket.emit('room-exists', { exists: true });
        } else {
            socket.emit('room-exists', { exists: false });
        }
    });

    // Добавляем новый обработчик для восстановления сессии
    socket.on('reconnect-to-game', (data) => {
        const { roomId, playerId } = data;

        let gameState;
        if (rooms.has(roomId)) {
            gameState = rooms.get(roomId);
        } else {
            gameState = loadRoomFromFile(roomId);
            if (gameState) {
                rooms.set(roomId, gameState);
            } else {
                socket.emit('error', { message: 'Игра не найдена' });
                return;
            }
        }

        // Находим индекс игрока в игре
        const playerIndex = gameState.players.findIndex(p =>
            p.id === playerId || p.id === socket.id
        );

        if (playerIndex === -1) {
            socket.emit('error', { message: 'Игрок не найден в этой игре' });
            return;
        }

        // Обновляем ID сокета и статус подключения
        gameState.players[playerIndex].id = socket.id;
        gameState.players[playerIndex].connected = true;

        // Присоединяем к комнате
        socket.join(roomId);
        socket.roomId = roomId;

        // Сохраняем обновленное состояние
        rooms.set(roomId, gameState);
        saveRoomToFile(roomId, gameState);

        // Отправляем сообщение о восстановлении
        socket.emit('game-session-restored', {
            roomId,
            gameState,
            playerId: socket.id,
            playerIndex
        });

        // Уведомляем другого игрока о повторном подключении
        socket.to(roomId).emit('player-reconnected', {
            gameState,
            reconnectedPlayerIndex: playerIndex
        });

        console.log(`Игрок ${socket.id} восстановил сессию в комнате ${roomId}`);
    });

    socket.on('check-game-status', (roomId) => {
      if (rooms.has(roomId)) {
        const gameState = rooms.get(roomId);
        const playerIndex = gameState.players.findIndex(p => p.id === socket.id);

        if (playerIndex !== -1) {
          // Если игра уже началась, отправляем состояние игры
          if (gameState.gameStarted) {
            socket.emit('game-start', gameState);
          }
        }
      } else {
        // Пробуем загрузить из файла
        const loadedGameState = loadRoomFromFile(roomId);
        if (loadedGameState) {
          rooms.set(roomId, loadedGameState);
          const playerIndex = loadedGameState.players.findIndex(p => p.id === socket.id);

          if (playerIndex !== -1 && loadedGameState.gameStarted) {
            socket.emit('game-start', loadedGameState);
          }
        }
      }
    });

    socket.on('force-check-game-status', (data) => {
        const { roomId, playerId, playerIndex } = data;
        console.log(`Принудительная проверка статуса игры для комнаты: ${roomId}, игрок: ${playerId}`);

        if (rooms.has(roomId)) {
            const gameState = rooms.get(roomId);

            // Проверяем, является ли этот игрок участником игры
            let foundPlayerIndex = -1;
            gameState.players.forEach((player, idx) => {
                if (player.id === playerId || (idx === playerIndex && !player.connected)) {
                    foundPlayerIndex = idx;
                }
            });

            if (foundPlayerIndex !== -1) {
                // Обновляем ID сокета
                gameState.players[foundPlayerIndex].id = socket.id;
                gameState.players[foundPlayerIndex].connected = true;

                // Присоединяем к комнате
                socket.join(roomId);
                socket.roomId = roomId;

                // Сохраняем обновление
                rooms.set(roomId, gameState);
                saveRoomToFile(roomId, gameState);

                console.log(`Переподключение игрока ${socket.id} к комнате ${roomId}`);

                // Уведомляем соперников, что игрок вернулся (снимаем их баннер ожидания)
                socket.to(roomId).emit('player-reconnected', {
                    gameState,
                    reconnectedPlayerIndex: foundPlayerIndex
                });

                // Если игра началась, отправляем статус игры
                if (gameState.gameStarted) {
                    socket.emit('game-start', gameState);
                } else {
                    // Если игра еще не началась, отправляем данные о комнате
                    socket.emit('room-created', {
                        roomId,
                        gameState,
                        playerId: socket.id,
                        playerIndex: foundPlayerIndex
                    });
                }
            } else {
                socket.emit('error', { message: 'Игрок не найден в этой комнате' });
            }
        } else {
            // Пробуем загрузить из файла
            const loadedGameState = loadRoomFromFile(roomId);
            if (loadedGameState) {
                rooms.set(roomId, loadedGameState);

                // Аналогичная проверка и для загруженной игры
                let foundPlayerIndex = -1;
                loadedGameState.players.forEach((player, idx) => {
                    if (player.id === playerId || (idx === playerIndex && !player.connected)) {
                        foundPlayerIndex = idx;
                    }
                });

                if (foundPlayerIndex !== -1) {
                    // Обновляем данные и отправляем статус
                    loadedGameState.players[foundPlayerIndex].id = socket.id;
                    loadedGameState.players[foundPlayerIndex].connected = true;

                    socket.join(roomId);
                    socket.roomId = roomId;

                    rooms.set(roomId, loadedGameState);
                    saveRoomToFile(roomId, loadedGameState);

                    socket.to(roomId).emit('player-reconnected', {
                        gameState: loadedGameState,
                        reconnectedPlayerIndex: foundPlayerIndex
                    });

                    if (loadedGameState.gameStarted) {
                        socket.emit('game-start', loadedGameState);
                    } else {
                        socket.emit('room-created', {
                            roomId,
                            gameState: loadedGameState,
                            playerId: socket.id,
                            playerIndex: foundPlayerIndex
                        });
                    }
                } else {
                    socket.emit('error', { message: 'Игрок не найден в этой игре' });
                }
            } else {
                socket.emit('error', { message: 'Комната не найдена' });
            }
        }
    });

    // Обработчик завершения текущего раунда
    socket.on('finish-round', (roomId) => {
        if (!rooms.has(roomId)) {
            // Пробуем загрузить из файла
            const gameState = loadRoomFromFile(roomId);
            if (gameState) {
                rooms.set(roomId, gameState);
            } else {
                socket.emit('error', { message: 'Комната не найдена' });
                return;
            }
        }

        const gameState = rooms.get(roomId);

        // Проверяем, есть ли карты на столе, и если да, передаем их последнему игроку, взявшему карты
        if (gameState.tableCards.length > 0) {
            const lpIdx = resolveLastTakerIndex(gameState);
            console.log(`Передаем ${gameState.tableCards.length} оставшихся карт игроку ${gameState.players[lpIdx].name}`);
            gameState.players[lpIdx].collected.push(...gameState.tableCards);
            gameState.tableCards = [];

            // Сохраняем обновленное состояние комнаты
            rooms.set(roomId, gameState);
            saveRoomToFile(roomId, gameState);

            // Отправляем обновление всем игрокам в комнате
            io.to(roomId).emit('game-update', gameState);
        }
    });
});

// Определяет индекс игрока, последним взявшего карты (надёжно после загрузки из файла).
// Приоритет: сохранённый индекс → поиск по ссылке (на случай старых комнат) → случайный.
function resolveLastTakerIndex(gameState) {
    let idx = (typeof gameState.lastPlayerWhoTookIndex === 'number') ? gameState.lastPlayerWhoTookIndex : -1;
    if (idx < 0 || idx >= gameState.players.length) {
        idx = gameState.lastPlayerWhoTook ? gameState.players.findIndex(p => p === gameState.lastPlayerWhoTook) : -1;
    }
    if (idx < 0 || idx >= gameState.players.length) {
        idx = Math.floor(Math.random() * gameState.players.length);
    }
    return idx;
}

// Вспомогательные функции для игровой логики
function takeCards(gameState, player, handCard, tableCards) {
    // Удаляем карту из руки игрока
    player.hand = player.hand.filter(card =>
        !(card.suit === handCard.suit && card.value === handCard.value));

    // Удаляем карты со стола
    const removedTableCards = [];
    for (const card of tableCards) {
        gameState.tableCards = gameState.tableCards.filter(c => {
            const match = c.suit === card.suit && c.value === card.value;
            if (match) removedTableCards.push(c);
            return !match;
        });
    }

    // Добавляем карты в собранную стопку игрока
    player.collected.push(handCard, ...removedTableCards);
    gameState.lastPlayerWhoTook = player;
    // Индекс надёжнее ссылки на объект: переживает сохранение/загрузку из файла
    gameState.lastPlayerWhoTookIndex = gameState.players.indexOf(player);

    // Обновляем информацию о последней взятке
    gameState.lastTakenCards = [handCard, ...removedTableCards];
    gameState.lastTakenBy = player.name;
}

function discardCard(gameState, player, card) {
    // Удаляем карту из руки игрока
    player.hand = player.hand.filter(c =>
        !(c.suit === card.suit && c.value === card.value));

    // Добавляем карту на стол
    gameState.tableCards.push(card);
}

function checkAndDealNewCards(gameState) {
    // Если у обоих игроков пустые руки и в колоде есть карты, раздаем новые
    if (gameState.players.every(p => p.hand.length === 0) && gameState.deck.length > 0) {
        for (const player of gameState.players) {
            const cardsToDeal = Math.min(4, gameState.deck.length);
            if (cardsToDeal > 0) {
                player.hand = drawCards(gameState.deck, cardsToDeal);
            }
        }
        return true;
    }
    return false;
}

function checkGameEnd(gameState) {
    // Игра заканчивается, если колода пуста и у игроков нет карт
    return gameState.deck.length === 0 && gameState.players.every(p => p.hand.length === 0);
}

function endGame(gameState) {
    gameState.gameEnded = true;
    const numPlayers = gameState.numPlayers || 2;

    if (gameState.tableCards.length > 0) {
        const lpIdx = resolveLastTakerIndex(gameState);
        gameState.players[lpIdx].collected.push(...gameState.tableCards);
        gameState.tableCards = [];
    }

    calculateScores(gameState);

    // Ensure totalScores has right length
    if (!gameState.totalScores || gameState.totalScores.length !== numPlayers) {
        gameState.totalScores = new Array(numPlayers).fill(0);
    }

    gameState.players.forEach((p, i) => {
        gameState.totalScores[i] = (gameState.totalScores[i] || 0) + p.score;
    });

    gameState.matchWinner = null;
    let maxTotal = -1;
    gameState.players.forEach((p, i) => {
        if (gameState.totalScores[i] >= gameState.targetScore && gameState.totalScores[i] > maxTotal) {
            maxTotal = gameState.totalScores[i];
            gameState.matchWinner = i;
        }
    });

    // Запись статистики онлайн-матча (один раз, когда определился победитель матча)
    if (gameState.matchWinner !== null && !gameState.statsRecorded) {
        gameState.statsRecorded = true;
        try {
            const participantIds = gameState.players.map(p => p.userId).filter(Boolean);
            // Победители: в 2v2 — вся команда победителя, иначе — один игрок
            let winnerIdxs;
            if ((gameState.format === '2v2') && numPlayers === 4) {
                winnerIdxs = [0, 2].includes(gameState.matchWinner) ? [0, 2] : [1, 3];
            } else {
                winnerIdxs = [gameState.matchWinner];
            }
            const winnerIds = winnerIdxs.map(i => gameState.players[i] && gameState.players[i].userId).filter(Boolean);
            if (participantIds.length) recordOnlineMatch(participantIds, winnerIds);
        } catch (e) { console.error('Ошибка записи статистики матча:', e.message); }
    }
}

function calculateScores(gameState) {
    const numPlayers = gameState.numPlayers || 2;
    const format = gameState.format || '1v1';

    gameState.players.forEach(player => {
        player.score = 0;
        player.bonusPoints = 0;
    });

    if (format === '2v2' && numPlayers === 4) {
        // Team A: players 0,2 — Team B: players 1,3
        const teamA = [...gameState.players[0].collected, ...gameState.players[2].collected];
        const teamB = [...gameState.players[1].collected, ...gameState.players[3].collected];

        if (teamA.length > teamB.length) {
            [0, 2].forEach(i => { gameState.players[i].score += 2; gameState.players[i].bonusPoints += 2; });
        } else if (teamB.length > teamA.length) {
            [1, 3].forEach(i => { gameState.players[i].score += 2; gameState.players[i].bonusPoints += 2; });
        }

        const teamAClubs = teamA.filter(c => c.suit === 'clubs').length;
        const teamBClubs = teamB.filter(c => c.suit === 'clubs').length;
        if (teamAClubs > teamBClubs) {
            [0, 2].forEach(i => { gameState.players[i].score += 1; gameState.players[i].bonusPoints += 1; });
        } else if (teamBClubs > teamAClubs) {
            [1, 3].forEach(i => { gameState.players[i].score += 1; gameState.players[i].bonusPoints += 1; });
        }
    } else {
        // Individual scoring (1v1 and 3p)
        const cardCounts = gameState.players.map(p => p.collected.length);
        const maxCards = Math.max(...cardCounts);
        const maxCardPlayers = gameState.players.filter(p => p.collected.length === maxCards);
        if (maxCardPlayers.length === 1) {
            maxCardPlayers[0].score += 2;
            maxCardPlayers[0].bonusPoints += 2;
        }

        const clubCounts = gameState.players.map(p => p.collected.filter(c => c.suit === 'clubs').length);
        const maxClubs = Math.max(...clubCounts);
        const maxClubPlayers = gameState.players.filter(p =>
            p.collected.filter(c => c.suit === 'clubs').length === maxClubs
        );
        if (maxClubPlayers.length === 1) {
            maxClubPlayers[0].score += 1;
            maxClubPlayers[0].bonusPoints += 1;
        }
    }

    // Special cards for each player individually
    gameState.players.forEach(player => {
        player.hasClub2 = player.collected.some(c => c.suit === 'clubs' && c.value === '2');
        player.hasDiamond10 = player.collected.some(c => c.suit === 'diamonds' && c.value === '10');
        if (player.hasClub2) { player.score += 1; player.bonusPoints += 1; }
        if (player.hasDiamond10) { player.score += 1; player.bonusPoints += 1; }
    });
}

// Добавляем обработчик для корневого маршрута
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Добавляем обработчик для маршрута с параметром комнаты (для поддержки прямых ссылок)
app.get('/game', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Добавляем поддержку автоматического удаления старых комнат
// Запускаем очистку старых комнат раз в день
setInterval(() => {
    console.log("Запущена плановая очистка старых комнат");
    cleanupOldRooms();
}, 24 * 60 * 60 * 1000);

function cleanupOldRooms() {
    try {
        const files = fs.readdirSync(ROOMS_STORAGE_PATH);
        const now = Date.now();

        files.forEach(file => {
            if (file.endsWith('.json')) {
                const filePath = path.join(ROOMS_STORAGE_PATH, file);
                const stats = fs.statSync(filePath);

                // Если файл старше 3 дней, удаляем его
                                const fileAge = now - stats.mtimeMs;
                                if (fileAge > 3 * 24 * 60 * 60 * 1000) {
                                    fs.unlinkSync(filePath);
                                    const roomId = file.replace('.json', '');
                                    if (rooms.has(roomId)) {
                                        rooms.delete(roomId);
                                    }
                                    console.log(`Удалена старая комната: ${roomId}`);
                                }
                            }
                        });
                    } catch (error) {
                        console.error("Ошибка при очистке старых комнат:", error);
                    }
                }

                // getUpdates и webhook несовместимы одновременно — сначала снимаем вебхук
                // (оставшийся от предыдущей попытки), потом запускаем polling.
                if (process.env.TELEGRAM_BOT_TOKEN) {
                    telegramApi('deleteWebhook', {}).then(() => {
                        console.log('[invite] Telegram polling запущен');
                        pollTelegramUpdates();
                    });
                }

                // Запуск сервера
                const PORT = process.env.PORT || 8084;
                server.listen(PORT, () => {
                    console.log(`Сервер запущен на порту ${PORT}`);
                });