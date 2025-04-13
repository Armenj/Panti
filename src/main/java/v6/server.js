const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Включение CORS
app.use(cors());

// Обслуживание статических файлов
app.use(express.static(path.join(__dirname, 'public')));

// Хранение активных игровых комнат
const rooms = new Map();

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
function initializeGame() {
    const gameState = {
        deck: createDeck(),
        tableCards: [],
        players: [
            { id: null, name: 'Игрок 1', hand: [], collected: [], score: 0, bonusPoints: 0, connected: false },
            { id: null, name: 'Игрок 2', hand: [], collected: [], score: 0, bonusPoints: 0, connected: false }
        ],
        currentPlayerIndex: 0,
        lastPlayerWhoTook: null,
        gameStarted: false,
        gameEnded: false,
        lastTakenCards: [],
        lastTakenBy: null
    };

    // Раздаем начальные карты
    for (const player of gameState.players) {
        player.hand = drawCards(gameState.deck, 4);
    }

    // Выкладываем 4 карты на стол
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

    // Создание новой игровой комнаты
    socket.on('create-room', (playerName) => {
        const roomId = uuidv4().substring(0, 6).toUpperCase(); // Короткий ID комнаты
        const gameState = initializeGame();

        // Назначаем первого игрока
        gameState.players[0].id = socket.id;
        gameState.players[0].name = playerName || 'Игрок 1';
        gameState.players[0].connected = true;

        rooms.set(roomId, gameState);

        // Присоединяем сокет к комнате
        socket.join(roomId);
        socket.roomId = roomId;

        // Отправляем инфо о комнате
        socket.emit('room-created', {
            roomId,
            gameState,
            playerId: socket.id,
            playerIndex: 0
        });

        console.log(`Создана комната: ${roomId}`);
    });

    // Присоединение к существующей комнате
    socket.on('join-room', (data) => {
        const { roomId, playerName } = data;

        if (!rooms.has(roomId)) {
            socket.emit('error', { message: 'Комната не найдена' });
            return;
        }

        const gameState = rooms.get(roomId);

        if (gameState.players[1].connected) {
            socket.emit('error', { message: 'Комната уже заполнена' });
            return;
        }

        // Назначаем второго игрока
        gameState.players[1].id = socket.id;
        gameState.players[1].name = playerName || 'Игрок 2';
        gameState.players[1].connected = true;

        // Присоединяем к комнате
        socket.join(roomId);
        socket.roomId = roomId;

        // Выбираем случайно, кто ходит первым
        gameState.currentPlayerIndex = Math.floor(Math.random() * 2);
        gameState.gameStarted = true;

        // Обновляем состояние комнаты
        rooms.set(roomId, gameState);

        // Оповещаем присоединившегося игрока
        socket.emit('room-joined', {
            roomId,
            gameState,
            playerId: socket.id,
            playerIndex: 1
        });

        // Оповещаем обоих игроков о начале игры
        io.to(roomId).emit('game-start', gameState);

        console.log(`Игрок присоединился к комнате: ${roomId}`);
    });

    // Обработка хода игрока
    socket.on('make-move', (moveData) => {
        const { roomId, moveType, handCard, tableCards } = moveData;

        if (!rooms.has(roomId)) {
            socket.emit('error', { message: 'Комната не найдена' });
            return;
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
            gameState.currentPlayerIndex = (gameState.currentPlayerIndex + 1) % 2;
        }

        // Обновляем состояние комнаты
        rooms.set(roomId, gameState);

        // Отправляем обновленное состояние обоим игрокам
        io.to(roomId).emit('game-update', gameState);
    });

    // Обработка отключения игрока
    socket.on('disconnect', () => {
        console.log('Отключение:', socket.id);

        if (socket.roomId && rooms.has(socket.roomId)) {
            const gameState = rooms.get(socket.roomId);

            // Помечаем игрока как отключенного
            const playerIndex = gameState.players.findIndex(p => p.id === socket.id);
            if (playerIndex !== -1) {
                gameState.players[playerIndex].connected = false;

                // Отправляем обновление другому игроку
                io.to(socket.roomId).emit('player-disconnected', {
                    gameState,
                    disconnectedPlayerIndex: playerIndex
                });

                // Если оба игрока отключились, удаляем комнату
                if (gameState.players.every(p => !p.connected)) {
                    rooms.delete(socket.roomId);
                    console.log(`Комната удалена: ${socket.roomId}`);
                } else {
                    // Иначе обновляем состояние комнаты
                    rooms.set(socket.roomId, gameState);
                }
            }
        }
    });
});

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

    // Последний игрок, взявший карты, забирает оставшиеся карты стола
    if (gameState.lastPlayerWhoTook && gameState.tableCards.length > 0) {
        const playerIndex = gameState.players.findIndex(p => p === gameState.lastPlayerWhoTook);
        if (playerIndex !== -1) {
            gameState.players[playerIndex].collected.push(...gameState.tableCards);
            gameState.tableCards = [];
        }
    }

    // Подсчет очков
    calculateScores(gameState);
}

function calculateScores(gameState) {
    // Сбросить очки
    gameState.players.forEach(player => {
        player.score = 0;
        player.bonusPoints = 0;
    });

    // Найти игрока с наибольшим количеством карт
    const cardCounts = gameState.players.map(player => player.collected.length);

    // Если у игроков разное количество карт, присудить 2 очка игроку с большим количеством
    if (cardCounts[0] > cardCounts[1]) {
        gameState.players[0].score += 2;
        gameState.players[0].bonusPoints += 2;
    } else if (cardCounts[1] > cardCounts[0]) {
        gameState.players[1].score += 2;
        gameState.players[1].bonusPoints += 2;
    }

    // Подсчитать крести для каждого игрока
    const clubsCounts = gameState.players.map(player =>
        player.collected.filter(card => card.suit === 'clubs').length
    );

    // Если у игроков разное количество крестей, присудить 1 очко игроку с большим количеством
    if (clubsCounts[0] > clubsCounts[1]) {
        gameState.players[0].score += 1;
        gameState.players[0].bonusPoints += 1;
    } else if (clubsCounts[1] > clubsCounts[0]) {
        gameState.players[1].score += 1;
        gameState.players[1].bonusPoints += 1;
    }

    // Проверить специальные карты
    gameState.players.forEach(player => {
        // Проверить наличие двойки крестей
        if (player.collected.some(card => card.suit === 'clubs' && card.value === '2')) {
            player.score += 1;
            player.bonusPoints += 1;
            player.hasClub2 = true;
        } else {
            player.hasClub2 = false;
        }

        // Проверить наличие десятки бубен
        if (player.collected.some(card => card.suit === 'diamonds' && card.value === '10')) {
            player.score += 1;
            player.bonusPoints += 1;
            player.hasDiamond10 = true;
        } else {
            player.hasDiamond10 = false;
        }
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

// Запуск сервера
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});
