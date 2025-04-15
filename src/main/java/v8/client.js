// Клиентская часть для работы с Socket.io

class GameClient {
    constructor() {
        this.socket = io();
        this.roomId = null;
        this.playerId = null;
        this.playerIndex = null;
        this.gameState = null;
        this.setupSocketListeners();
        this.restoreSession(); // Добавляем восстановление сессии при инициализации
    }

    setupSocketListeners() {
        // Обработка создания комнаты
        this.socket.on('room-created', (data) => {
            this.roomId = data.roomId;
            this.playerId = data.playerId;
            this.playerIndex = data.playerIndex;
            this.gameState = data.gameState;

            // Сохраняем сессию в localStorage
            this.saveSession();

            // Вызываем обработчик события
            if (typeof this.onRoomCreated === 'function') {
                this.onRoomCreated(data);
            }
        });

        // Обработка присоединения к комнате
        this.socket.on('room-joined', (data) => {
            this.roomId = data.roomId;
            this.playerId = data.playerId;
            this.playerIndex = data.playerIndex;
            this.gameState = data.gameState;

            // Сохраняем сессию в localStorage
            this.saveSession();

            if (typeof this.onRoomJoined === 'function') {
                this.onRoomJoined(data);
            }
        });

        // Обработка начала игры
        this.socket.on('game-start', (gameState) => {
            this.gameState = gameState;

            // Сохраняем сессию при начале игры
            this.saveSession();

            if (typeof this.onGameStart === 'function') {
                console.log("Вызываем обработчик onGameStart");
                this.onGameStart(gameState);
            }
        });

        // Обработка обновления игры
        this.socket.on('game-update', (gameState) => {
            this.gameState = gameState;

            // Сохраняем сессию при каждом обновлении
            this.saveSession();

            if (typeof this.onGameUpdate === 'function') {
                this.onGameUpdate(gameState);
            }
        });

        // Обработка отключения игрока
        this.socket.on('player-disconnected', (data) => {
            this.gameState = data.gameState;

            if (typeof this.onPlayerDisconnected === 'function') {
                this.onPlayerDisconnected(data);
            }
        });

        // Новый обработчик для восстановления сессии
        this.socket.on('game-session-restored', (data) => {
            this.roomId = data.roomId;
            this.playerId = data.playerId;
            this.playerIndex = data.playerIndex;
            this.gameState = data.gameState;

            // Сохраняем обновленную сессию
            this.saveSession();

            if (typeof this.onSessionRestored === 'function') {
                this.onSessionRestored(data);
            }
        });

        // Новый обработчик для повторного подключения игрока
        this.socket.on('player-reconnected', (data) => {
            this.gameState = data.gameState;

            if (typeof this.onPlayerReconnected === 'function') {
                this.onPlayerReconnected(data);
            }
        });

        // Обработчик для проверки существования комнаты
        this.socket.on('room-exists', (data) => {
            if (typeof this.onRoomChecked === 'function') {
                this.onRoomChecked(data);
            }
        });

        // Обработка начала нового раунда
        this.socket.on('new-round-started', (gameState) => {
            this.gameState = gameState;

            if (typeof this.onNewRoundStarted === 'function') {
                this.onNewRoundStarted(gameState);
            }
        });

        // Обработка ошибок
        this.socket.on('error', (error) => {
            if (typeof this.onError === 'function') {
                this.onError(error);
            }
        });
    }

    // Методы для взаимодействия с сервером
    createRoom(playerName) {
        this.socket.emit('create-room', playerName);
    }

    joinRoom(roomId, playerName) {
        this.socket.emit('join-room', { roomId, playerName });
    }

    makeMove(moveType, handCard, tableCards = []) {
        this.socket.emit('make-move', {
            roomId: this.roomId,
            moveType,
            handCard,
            tableCards
        });
    }

    // Новый метод для начала нового раунда
    startNewRound() {
        if (this.roomId) {
            this.socket.emit('start-new-round', this.roomId);
        } else {
            console.error('Невозможно начать новый раунд без активной комнаты');
        }
    }

    // Методы для сохранения и восстановления сессии
    saveSession() {
        if (this.roomId && this.playerId) {
            const sessionData = {
                roomId: this.roomId,
                playerId: this.playerId,
                playerIndex: this.playerIndex,
                timestamp: Date.now()
            };

            try {
                localStorage.setItem('gameSession', JSON.stringify(sessionData));
                console.log('Сессия сохранена в localStorage');
            } catch (e) {
                console.error('Ошибка при сохранении сессии:', e);
            }
        }
    }

    restoreSession() {
        try {
            const sessionData = localStorage.getItem('gameSession');
            if (sessionData) {
                const session = JSON.parse(sessionData);

                // Проверяем, не устарела ли сессия (3 дня)
                const now = Date.now();
                const sessionAge = now - session.timestamp;
                const maxAge = 3 * 24 * 60 * 60 * 1000; // 3 дня в миллисекундах

                if (sessionAge > maxAge) {
                    console.log('Сессия устарела, удаляем');
                    localStorage.removeItem('gameSession');
                    return;
                }

                // Пытаемся восстановить сессию
                this.roomId = session.roomId;
                this.playerId = session.playerId;
                this.playerIndex = session.playerIndex;

                // Проверяем существование комнаты
                this.checkRoom(session.roomId, (exists) => {
                    if (exists) {
                        this.reconnectToGame(session.roomId, session.playerId);
                    } else {
                        // Если комната не существует, очищаем данные сессии
                        this.clearSession();
                    }
                });

                console.log('Сессия восстановлена из localStorage');
            }
        } catch (e) {
            console.error('Ошибка при восстановлении сессии:', e);
            this.clearSession();
        }
    }

    clearSession() {
        this.roomId = null;
        this.playerId = null;
        this.playerIndex = null;
        this.gameState = null;
        try {
            localStorage.removeItem('gameSession');
        } catch (e) {
            console.error('Ошибка при очистке сессии:', e);
        }
    }

    // Новые методы для работы с сессией
    reconnectToGame(roomId, playerId) {
        this.socket.emit('reconnect-to-game', { roomId, playerId });
    }

    checkRoom(roomId, callback) {
        this.onRoomChecked = (data) => {
            if (callback) callback(data.exists);
        };
        this.socket.emit('check-room', roomId);
    }

    // Новый метод для проверки соединения и переподключения
    checkConnectionAndReconnect() {
        console.log("Проверка состояния подключения...");
        // Проверяем состояние сокета
        if (!this.socket.connected) {
            console.log("Соединение прервано, переподключаемся...");
            // Если сокет не подключен, пытаемся переподключиться
            this.socket.connect();
        }

        // Если у нас есть данные о комнате, запрашиваем актуальный статус
        if (this.roomId) {
            console.log("Запрашиваем актуальный статус игры для комнаты:", this.roomId);
            this.socket.emit('force-check-game-status', {
                roomId: this.roomId,
                playerId: this.playerId,
                playerIndex: this.playerIndex
            });
        }
    }

    // Вспомогательные методы
    isMyTurn() {
        return this.gameState && this.gameState.currentPlayerIndex === this.playerIndex;
    }

    getMyPlayer() {
        return this.gameState && this.gameState.players[this.playerIndex];
    }

    getOpponentPlayer() {
        const opponentIndex = this.playerIndex === 0 ? 1 : 0;
        return this.gameState && this.gameState.players[opponentIndex];
    }
}

// Создаем глобальный экземпляр клиента
const gameClient = new GameClient();