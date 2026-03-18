// Клиентская часть для работы с Socket.io

class GameClient {
    constructor() {
        this.socket = io();
        this.roomId = null;
        this.playerId = null;
        this.playerIndex = null;
        this.gameState = null;
        this.setupSocketListeners();
    }

    setupSocketListeners() {
        // Обработка создания комнаты
        this.socket.on('room-created', (data) => {
            this.roomId = data.roomId;
            this.playerId = data.playerId;
            this.playerIndex = data.playerIndex;
            this.gameState = data.gameState;

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

            if (typeof this.onRoomJoined === 'function') {
                this.onRoomJoined(data);
            }
        });

        // Обработка начала игры
        this.socket.on('game-start', (gameState) => {
            this.gameState = gameState;

            if (typeof this.onGameStart === 'function') {
                this.onGameStart(gameState);
            }
        });

        // Обработка обновления игры
        this.socket.on('game-update', (gameState) => {
            this.gameState = gameState;

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