// Клиентская часть для работы с Socket.io
class GameClient {
    constructor() {
        // Передаём токен авторизации в handshake — сервер свяжет игрока с аккаунтом
        // (для записи статистики онлайн-матчей).
        let authToken = null;
        try { authToken = localStorage.getItem('panti_auth') || null; } catch (e) {}
        this.socket = io({ auth: { token: authToken } });
        this.roomId = null;
        this.playerId = null;
        this.playerIndex = null;
        this.gameState = null;
        
        this.initViewportFix();
        this.setupSocketListeners();
        this.restoreSession();
    }

    // Фикс высоты для мобильных браузеров (защита от прыгающей адресной строки)
    initViewportFix() {
        const setVh = () => {
            let vh = window.innerHeight * 0.01;
            document.documentElement.style.setProperty('--vh', `${vh}px`);
        };
        window.addEventListener('resize', setVh);
        window.addEventListener('orientationchange', setVh);
        setVh();
    }

    setupSocketListeners() {
        // Автоматическое восстановление при переподключении сокета (свернули Mini App,
        // потеряли сеть и т.п.): как только связь вернулась — заново входим в свою комнату
        // и получаем актуальное состояние (например, начатый соперником новый раунд).
        this.socket.on('connect', () => {
            if (this._everConnected && this.roomId) {
                this.socket.emit('reconnect-to-game', { roomId: this.roomId, playerId: this.playerId });
            }
            this._everConnected = true;
        });

        // Токен сокета протух (аккаунт слит/удалён) — даём приложению переавторизоваться.
        // Флаг на случай, если событие пришло раньше, чем auth.js назначил обработчик.
        this.socket.on('auth-invalid', () => {
            this._authInvalid = true;
            if (typeof this.onAuthInvalid === 'function') this.onAuthInvalid();
        });

        // Создание комнаты
        this.socket.on('room-created', (data) => {
            this.updateLocalData(data);
            if (typeof this.onRoomCreated === 'function') this.onRoomCreated(data);
        });

        // Присоединение
        this.socket.on('room-joined', (data) => {
            this.updateLocalData(data);
            if (typeof this.onRoomJoined === 'function') this.onRoomJoined(data);
        });

        // Начало игры
        this.socket.on('game-start', (gameState) => {
            this.gameState = gameState;
            this.saveSession();
            if (typeof this.onGameStart === 'function') this.onGameStart(gameState);
        });

        // Обновление состояния
        this.socket.on('game-update', (gameState) => {
            this.gameState = gameState;
            this.saveSession();
            if (typeof this.onGameUpdate === 'function') this.onGameUpdate(gameState);
        });

        // Отключение игрока
        this.socket.on('player-disconnected', (data) => {
            this.gameState = data.gameState;
            if (typeof this.onPlayerDisconnected === 'function') this.onPlayerDisconnected(data);
        });

        // Противник добровольно вышел из игры
        this.socket.on('opponent-left', (data) => {
            if (typeof this.onOpponentLeft === 'function') this.onOpponentLeft(data);
        });

        // Восстановление сессии
        this.socket.on('game-session-restored', (data) => {
            this.updateLocalData(data);
            if (typeof this.onSessionRestored === 'function') this.onSessionRestored(data);
        });

        // Игрок присоединился (ожидание остальных)
        this.socket.on('player-joined', (data) => {
            this.gameState = data.gameState;
            if (typeof this.onPlayerJoined === 'function') this.onPlayerJoined(data);
        });

        // Переподключение
        this.socket.on('player-reconnected', (data) => {
            this.gameState = data.gameState;
            if (typeof this.onPlayerReconnected === 'function') this.onPlayerReconnected(data);
        });

        // Проверка комнаты
        this.socket.on('room-exists', (data) => {
            if (typeof this.onRoomChecked === 'function') this.onRoomChecked(data);
        });

        // Новый раунд
        this.socket.on('new-round-started', (gameState) => {
            this.gameState = gameState;
            if (typeof this.onNewRoundStarted === 'function') this.onNewRoundStarted(gameState);
        });

        // Кик из комнаты
        this.socket.on('kicked-from-room', (data) => {
            this.clearSession();
            if (typeof this.onKicked === 'function') this.onKicked(data);
        });

        // Обновление лобби (после кика/удаления слота)
        this.socket.on('lobby-updated', (data) => {
            this.gameState = data.gameState;
            if (typeof this.onLobbyUpdated === 'function') this.onLobbyUpdated(data);
        });

        // Ошибки
        this.socket.on('error', (error) => {
            if (typeof this.onError === 'function') this.onError(error);
        });

        // Эмоция от другого игрока
        this.socket.on('player-emoji', (data) => {
            if (typeof this.onPlayerEmoji === 'function') this.onPlayerEmoji(data);
        });

        // --- Приглашения в онлайн-игру ---
        this.socket.on('game-invite', (data) => {            // пришло приглашение
            if (typeof this.onGameInvite === 'function') this.onGameInvite(data);
        });
        this.socket.on('invite-sent', (data) => {            // моё приглашение ушло, ждём ответа
            this.roomId = data.roomId;
            this.playerId = data.playerId;
            this.playerIndex = data.playerIndex;
            if (typeof this.onInviteSent === 'function') this.onInviteSent(data);
        });
        this.socket.on('invite-declined', (data) => {
            if (typeof this.onInviteDeclined === 'function') this.onInviteDeclined(data);
        });
        this.socket.on('invite-expired', (data) => {
            if (typeof this.onInviteExpired === 'function') this.onInviteExpired(data);
        });
        this.socket.on('invite-failed', (data) => {
            if (typeof this.onInviteFailed === 'function') this.onInviteFailed(data);
        });

        // Презенс в реальном времени (кто-то зашёл/вышел)
        this.socket.on('presence', (data) => {
            if (typeof this.onPresence === 'function') this.onPresence(data);
        });
    }

    // Отправка эмоции остальным игрокам в комнате
    sendEmoji(emoji) {
        if (this.roomId) {
            this.socket.emit('player-emoji', {
                roomId: this.roomId,
                playerIndex: this.playerIndex,
                emoji
            });
        }
    }

    // Вспомогательный метод для записи данных
    updateLocalData(data) {
        this.roomId = data.roomId;
        this.playerId = data.playerId;
        this.playerIndex = data.playerIndex;
        this.gameState = data.gameState;
        this.saveSession();
    }

    // Методы отправки данных на сервер
    createRoom(playerName, format, targetScore) {
        this.socket.emit('create-room', { playerName, format: format || '1v1', targetScore: targetScore || 21 });
    }

    // Пригласить друга (онлайн) — сервер создаёт комнату и шлёт другу уведомление
    inviteFriend(friendId, targetScore) {
        this.socket.emit('invite-friend', { friendId, targetScore: targetScore || 21 });
    }

    // Пригласить нескольких друзей сразу (3 игрока / 2 на 2)
    inviteFriends(friendIds, format, targetScore) {
        this.socket.emit('invite-friends', {
            friendIds: friendIds || [],
            format: format || '1v1',
            targetScore: targetScore || 21
        });
    }

    // Ответ на приглашение (принять/отклонить)
    respondInvite(inviteId, accept) {
        this.socket.emit('invite-response', { inviteId, accept: !!accept });
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

    startNewRound() {
        if (this.roomId) {
            this.socket.emit('start-new-round', this.roomId);
        }
    }

    finishRound() {
        if (this.roomId) {
            this.socket.emit('finish-round', this.roomId);
        }
    }

    kickPlayer(playerIndex) {
        if (this.roomId) {
            this.socket.emit('kick-player', { roomId: this.roomId, playerIndex });
        }
    }

    forceStartGame() {
        if (this.roomId) {
            this.socket.emit('force-start-game', this.roomId);
        }
    }

    leaveGame() {
        if (this.roomId) {
            this.socket.emit('leave-game');
            this.clearSession();
        }
    }

    // Работа с localStorage
    saveSession() {
        if (this.roomId && this.playerId) {
            localStorage.setItem('gameSession', JSON.stringify({
                roomId: this.roomId,
                playerId: this.playerId,
                playerIndex: this.playerIndex,
                timestamp: Date.now()
            }));
        }
    }

    restoreSession() {
        try {
            const sessionData = localStorage.getItem('gameSession');
            if (sessionData) {
                const session = JSON.parse(sessionData);
                // Если сессии меньше 3 дней
                if (Date.now() - session.timestamp < 3 * 24 * 60 * 60 * 1000) {
                    this.roomId = session.roomId;
                    this.playerId = session.playerId;
                    this.playerIndex = session.playerIndex;
                    
                    this.checkRoom(session.roomId, (exists) => {
                        if (exists) {
                            this.socket.emit('reconnect-to-game', { 
                                roomId: session.roomId, 
                                playerId: session.playerId 
                            });
                        } else {
                            this.clearSession();
                        }
                    });
                }
            }
        } catch (e) {
            this.clearSession();
        }
    }

    clearSession() {
        this.roomId = null;
        this.playerId = null;
        localStorage.removeItem('gameSession');
    }

    checkRoom(roomId, callback) {
        this.onRoomChecked = (data) => {
            if (callback) callback(data.exists);
        };
        this.socket.emit('check-room', roomId);
    }

    isMyTurn() {
        return this.gameState && this.gameState.currentPlayerIndex === this.playerIndex;
    }

    getMyPlayer() {
        return this.gameState && this.gameState.players[this.playerIndex];
    }

    getOpponentPlayer() {
        if (!this.gameState) return null;
        const opponentIndex = this.playerIndex === 0 ? 1 : 0;
        return this.gameState.players[opponentIndex];
    }

    checkConnectionAndReconnect() {
        if (!this.roomId || !this.playerId) return;

        const sessionData = localStorage.getItem('gameSession');
        if (!sessionData) return;

        try {
            const session = JSON.parse(sessionData);
            this.socket.emit('force-check-game-status', {
                roomId: session.roomId,
                playerId: session.playerId,
                playerIndex: session.playerIndex || this.playerIndex
            });
        } catch (e) {
            console.warn('Ошибка при попытке переподключения:', e);
        }
    }
}

// Глобальный экземпляр
const gameClient = new GameClient();
