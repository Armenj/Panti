const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Включение CORS
app.use(cors());

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

            if (gameState.lastPlayerWhoTook) {
                const playerIndex = gameState.players.findIndex(p => p === gameState.lastPlayerWhoTook);
                if (playerIndex !== -1) {
                    console.log(`Передаем карты игроку ${gameState.players[playerIndex].name}`);
                    gameState.players[playerIndex].collected.push(...gameState.tableCards);
                } else {
                    console.warn(`Не найден игрок, соответствующий lastPlayerWhoTook`);
                    // Если игрок не найден, выбираем случайного
                    const randomPlayerIndex = Math.floor(Math.random() * gameState.players.length);
                    gameState.players[randomPlayerIndex].collected.push(...gameState.tableCards);
                }
            } else {
                console.warn(`В комнате ${roomId} нет игрока, последним взявшего карты`);
                // Если lastPlayerWhoTook не определен, выбираем случайного игрока
                const randomPlayerIndex = Math.floor(Math.random() * gameState.players.length);
                gameState.players[randomPlayerIndex].collected.push(...gameState.tableCards);
            }

            // Очищаем стол
            gameState.tableCards = [];

            // Сохраняем промежуточное состояние с распределенными картами
            rooms.set(roomId, gameState);
            saveRoomToFile(roomId, gameState);
        }

        // Увеличиваем номер раунда
        gameState.roundNumber++;

        // Сохраняем имена игроков и общий счет
        const numPlayers = gameState.numPlayers || 2;
        const format = gameState.format || '1v1';
        const playerInfo = gameState.players.map(p => ({ id: p.id, name: p.name, connected: p.connected }));
        const totalScores = [...(gameState.totalScores || new Array(numPlayers).fill(0))];
        const roundNumber = gameState.roundNumber;

        const newGameState = initializeGame(numPlayers, format);

        playerInfo.forEach((info, i) => {
            newGameState.players[i].id = info.id;
            newGameState.players[i].name = info.name;
            newGameState.players[i].connected = info.connected;
        });
        newGameState.totalScores = totalScores;
        newGameState.roundNumber = roundNumber;
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

    // Добровольный выход из игры
    socket.on('leave-game', () => {
        console.log('Игрок покидает игру:', socket.id);

        if (socket.roomId && rooms.has(socket.roomId)) {
            const gameState = rooms.get(socket.roomId);
            const playerIndex = gameState.players.findIndex(p => p.id === socket.id);

            if (playerIndex !== -1) {
                const playerName = gameState.players[playerIndex].name;
                gameState.players[playerIndex].connected = false;

                // Уведомляем всех остальных игроков
                socket.to(socket.roomId).emit('opponent-left', {
                    playerName: playerName,
                    playerIndex: playerIndex
                });

                // В 1v1 — удаляем комнату сразу
                if (gameState.format === '1v1' || gameState.players.length === 2) {
                    rooms.delete(socket.roomId);
                    deleteRoomFile(socket.roomId);
                    console.log(`Комната ${socket.roomId} удалена — игрок вышел из 1v1`);
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

                // Если оба игрока отключились через 30 минут, удаляем комнату
                setTimeout(() => {
                    if (rooms.has(socket.roomId)) {
                        const currentState = rooms.get(socket.roomId);
                        if (currentState.players.every(p => !p.connected)) {
                            rooms.delete(socket.roomId);
                            deleteRoomFile(socket.roomId);
                            console.log(`Комната удалена после таймаута: ${socket.roomId}`);
                        }
                    }
                }, 30 * 60 * 1000); // 30 минут
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
            if (gameState.lastPlayerWhoTook) {
                const playerIndex = gameState.players.findIndex(p => p === gameState.lastPlayerWhoTook);
                if (playerIndex !== -1) {
                    console.log(`Передаем ${gameState.tableCards.length} оставшихся карт игроку ${gameState.players[playerIndex].name}`);
                    gameState.players[playerIndex].collected.push(...gameState.tableCards);
                    gameState.tableCards = [];
                }
            } else {
                // Если нет последнего игрока, взявшего карты, распределяем карты случайным образом
                const randomPlayerIndex = Math.floor(Math.random() * gameState.players.length);
                console.log(`Случайно распределяем карты игроку ${gameState.players[randomPlayerIndex].name}`);
                gameState.players[randomPlayerIndex].collected.push(...gameState.tableCards);
                gameState.tableCards = [];
            }

            // Сохраняем обновленное состояние комнаты
            rooms.set(roomId, gameState);
            saveRoomToFile(roomId, gameState);

            // Отправляем обновление всем игрокам в комнате
            io.to(roomId).emit('game-update', gameState);
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
    const numPlayers = gameState.numPlayers || 2;

    if (gameState.lastPlayerWhoTook && gameState.tableCards.length > 0) {
        const playerIndex = gameState.players.findIndex(p => p === gameState.lastPlayerWhoTook);
        if (playerIndex !== -1) {
            gameState.players[playerIndex].collected.push(...gameState.tableCards);
            gameState.tableCards = [];
        }
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

                // Запуск сервера
                const PORT = process.env.PORT || 8084;
                server.listen(PORT, () => {
                    console.log(`Сервер запущен на порту ${PORT}`);
                });