"use strict";
// ============================================================
// SERVER — Node.js + Express + Socket.io
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const path_1 = __importDefault(require("path"));
const GameEngine_1 = require("../shared/GameEngine");
const rooms = new Map();
// ---- Инициализация приложения ----
const app = (0, express_1.default)();
const httpServer = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
});
// Раздаём статику клиента
const clientPublicDir = path_1.default.join(__dirname, '../client/public');
app.use(express_1.default.static(clientPublicDir));
app.get('*', (_req, res) => res.sendFile(path_1.default.join(clientPublicDir, 'index.html')));
// ---- Помощники ----
const MAX_PLAYERS = {
    'vs-computer': 2,
    'online-2p': 2,
    'online-3p': 3,
    'online-2v2': 4,
};
function broadcastState(roomId) {
    const room = rooms.get(roomId);
    if (!room)
        return;
    io.to(roomId).emit('game-update', { gameState: (0, GameEngine_1.deepClone)(room.gameState) });
}
function createInitialState(roomId, mode) {
    return {
        roomId,
        mode,
        players: [],
        deck: (0, GameEngine_1.createShuffledDeck)(),
        table: [],
        currentPlayerIndex: 0,
        dealerIndex: 0,
        phase: 'setup',
        roundNumber: 1,
        lastTaken: [],
        lastTakenByIndex: -1,
        winner: null,
    };
}
function tryDealIfNeeded(roomId) {
    const room = rooms.get(roomId);
    if (!room)
        return;
    if ((0, GameEngine_1.needsDeal)(room.gameState)) {
        room.gameState = (0, GameEngine_1.dealCards)(room.gameState);
        broadcastState(roomId);
    }
}
function checkRoundEnd(roomId) {
    const room = rooms.get(roomId);
    if (!room)
        return;
    const { gameState } = room;
    const allHandsEmpty = gameState.players.every(p => p.hand.length === 0);
    const deckEmpty = gameState.deck.length === 0;
    if (allHandsEmpty && deckEmpty) {
        const { result, newState } = (0, GameEngine_1.calculateRoundResult)(gameState);
        room.gameState = newState;
        io.to(roomId).emit('round-result', { result, gameState: (0, GameEngine_1.deepClone)(newState) });
    }
    else if ((0, GameEngine_1.needsDeal)(gameState)) {
        room.gameState = (0, GameEngine_1.dealCards)(gameState);
        broadcastState(roomId);
    }
}
// ---- Socket.io обработчики ----
io.on('connection', (socket) => {
    console.log(`[+] Socket connected: ${socket.id}`);
    // --- Создать комнату ---
    socket.on('create-room', ({ playerName, mode }) => {
        const roomId = (0, GameEngine_1.generateRoomId)();
        const player = (0, GameEngine_1.createPlayer)(socket.id, playerName);
        const gameState = createInitialState(roomId, mode);
        gameState.players.push(player);
        const session = {
            gameState,
            playerSockets: new Map([[player.id, socket.id]]),
            disconnectTimers: new Map(),
            lastActivity: Date.now(),
        };
        rooms.set(roomId, session);
        socket.join(roomId);
        socket.emit('room-created', {
            roomId,
            playerId: player.id,
            gameState: (0, GameEngine_1.deepClone)(gameState),
        });
        console.log(`[room] Created ${roomId} by ${playerName} (${mode})`);
    });
    // --- Присоединиться к комнате ---
    socket.on('join-room', ({ roomId, playerName }) => {
        const room = rooms.get(roomId);
        if (!room) {
            socket.emit('error', { message: 'Комната не найдена' });
            return;
        }
        const maxPlayers = MAX_PLAYERS[room.gameState.mode];
        const activePlayers = room.gameState.players.filter(p => p.isConnected);
        if (activePlayers.length >= maxPlayers) {
            socket.emit('error', { message: 'Комната заполнена' });
            return;
        }
        const player = (0, GameEngine_1.createPlayer)(socket.id, playerName);
        // В режиме 2v2 раздаём команды
        if (room.gameState.mode === 'online-2v2') {
            player.teamId = room.gameState.players.length % 2 === 0 ? 'team1' : 'team2';
        }
        room.gameState.players.push(player);
        room.playerSockets.set(player.id, socket.id);
        room.lastActivity = Date.now();
        socket.join(roomId);
        socket.emit('room-joined', { playerId: player.id, gameState: (0, GameEngine_1.deepClone)(room.gameState) });
        socket.to(roomId).emit('game-update', { gameState: (0, GameEngine_1.deepClone)(room.gameState) });
        // Запускаем игру, если набралось достаточно игроков
        if (room.gameState.players.length === maxPlayers) {
            room.gameState = (0, GameEngine_1.dealCards)(room.gameState);
            room.gameState.phase = 'playing';
            broadcastState(roomId);
        }
        console.log(`[room] ${playerName} joined ${roomId}`);
    });
    // --- Сделать ход ---
    socket.on('make-move', ({ moveType, handCard, tableCards }) => {
        const roomEntry = findRoomBySocket(socket.id);
        if (!roomEntry)
            return;
        const { roomId, room, playerId } = roomEntry;
        const { gameState } = room;
        const currentPlayer = gameState.players[gameState.currentPlayerIndex];
        if (currentPlayer.id !== playerId)
            return; // не твой ход
        if (moveType === 'take') {
            room.gameState = (0, GameEngine_1.applyTake)(gameState, playerId, handCard, tableCards);
        }
        else {
            room.gameState = (0, GameEngine_1.applyDiscard)(gameState, playerId, handCard);
        }
        room.lastActivity = Date.now();
        broadcastState(roomId);
        checkRoundEnd(roomId);
    });
    // --- Начать новый раунд ---
    socket.on('start-new-round', () => {
        const roomEntry = findRoomBySocket(socket.id);
        if (!roomEntry)
            return;
        const { roomId, room } = roomEntry;
        room.gameState = (0, GameEngine_1.startNewRound)(room.gameState);
        room.gameState = (0, GameEngine_1.dealCards)(room.gameState);
        room.lastActivity = Date.now();
        broadcastState(roomId);
    });
    // --- Восстановить сессию ---
    socket.on('reconnect-to-game', ({ roomId, playerId }) => {
        const room = rooms.get(roomId);
        if (!room) {
            socket.emit('error', { message: 'Комната не найдена или истекла' });
            return;
        }
        const player = room.gameState.players.find(p => p.id === playerId);
        if (!player) {
            socket.emit('error', { message: 'Игрок не найден в этой комнате' });
            return;
        }
        // Обновляем socket
        room.playerSockets.set(playerId, socket.id);
        player.isConnected = true;
        // Отменяем таймер отключения
        const timer = room.disconnectTimers.get(playerId);
        if (timer) {
            clearTimeout(timer);
            room.disconnectTimers.delete(playerId);
        }
        socket.join(roomId);
        socket.emit('session-restored', { playerId, gameState: (0, GameEngine_1.deepClone)(room.gameState) });
        socket.to(roomId).emit('player-reconnected', { playerId, playerName: player.name });
        console.log(`[reconnect] ${player.name} reconnected to ${roomId}`);
    });
    // --- Проверить комнату ---
    socket.on('check-room', ({ roomId }, callback) => {
        callback(rooms.has(roomId));
    });
    // --- Отключение ---
    socket.on('disconnect', () => {
        console.log(`[-] Socket disconnected: ${socket.id}`);
        const roomEntry = findRoomBySocket(socket.id);
        if (!roomEntry)
            return;
        const { roomId, room, playerId } = roomEntry;
        const player = room.gameState.players.find(p => p.id === playerId);
        if (!player)
            return;
        player.isConnected = false;
        io.to(roomId).emit('player-disconnected', { playerId, playerName: player.name });
        // Удаляем комнату через 30 минут если никто не вернулся
        const timer = setTimeout(() => {
            const stillDisconnected = room.gameState.players.every(p => !p.isConnected);
            if (stillDisconnected) {
                rooms.delete(roomId);
                console.log(`[room] Deleted abandoned room ${roomId}`);
            }
        }, 30 * 60 * 1000);
        room.disconnectTimers.set(playerId, timer);
    });
});
// ---- Поиск комнаты по socket.id ----
function findRoomBySocket(socketId) {
    for (const [roomId, room] of rooms.entries()) {
        for (const [playerId, sid] of room.playerSockets.entries()) {
            if (sid === socketId)
                return { roomId, room, playerId };
        }
    }
    return null;
}
// ---- Очистка старых комнат (раз в час) ----
setInterval(() => {
    const now = Date.now();
    const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;
    for (const [roomId, room] of rooms.entries()) {
        if (now - room.lastActivity > THREE_DAYS) {
            rooms.delete(roomId);
            console.log(`[cleanup] Removed stale room ${roomId}`);
        }
    }
}, 60 * 60 * 1000);
// ---- Запуск ----
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
httpServer.listen(PORT, () => {
    console.log(`🃏 Panti server running on port ${PORT}`);
});
