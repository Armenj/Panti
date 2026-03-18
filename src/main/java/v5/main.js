// Функция для обработки адаптивности на мобильных устройствах
function setupResponsiveLayout() {
    // Решение проблемы с масштабированием на мобильных устройствах
    document.addEventListener('touchmove', function(event) {
        if (event.scale !== 1) {
            event.preventDefault();
        }
    }, { passive: false });

    // Функция для адаптации размера карт в зависимости от размера экрана
    function adjustCardSize() {
        const screenWidth = window.innerWidth;
        const root = document.documentElement;

        // Динамическое изменение размера карт в зависимости от ширины экрана
        if (screenWidth < 400) {
            root.style.setProperty('--card-width', '55px');
            root.style.setProperty('--card-height', '80px');
        } else if (screenWidth < 480) {
            root.style.setProperty('--card-width', '60px');
            root.style.setProperty('--card-height', '85px');
        } else if (screenWidth < 768) {
            root.style.setProperty('--card-width', '70px');
            root.style.setProperty('--card-height', '100px');
        } else if (screenWidth < 992) {
            root.style.setProperty('--card-width', '80px');
            root.style.setProperty('--card-height', '110px');
        } else {
            root.style.setProperty('--card-width', '90px');
            root.style.setProperty('--card-height', '125px');
        }
    }

    // Функция для фиксированного размера игрового стола
    function maintainTableSize() {
        const gameTable = document.querySelector('.game-table');
        if (gameTable) {
            // Убедимся, что у игрового стола всегда будет минимальная высота
            const screenHeight = window.innerHeight;
            const minHeight = Math.min(Math.max(220, screenHeight * 0.3), 300);
            gameTable.style.minHeight = `${minHeight}px`;
            gameTable.style.height = `${minHeight}px`;
        }
    }

    // Для улучшения работы с кнопками на мобильных устройствах
    function improveMobileButtons() {
        const buttons = document.querySelectorAll('button');
        if (window.innerWidth <= 768) {
            buttons.forEach(button => {
                // Увеличиваем размер нажимаемой области на мобильных устройствах
                button.addEventListener('touchstart', function() {
                    this.style.transform = 'scale(0.95)';
                });

                button.addEventListener('touchend', function() {
                    this.style.transform = '';
                });
            });
        }
    }

    // Функция для улучшения управления картами на мобильных устройствах
    function improveMobileCardHandling() {
        // Для решения проблемы с перекрытием карт на мобильных устройствах
        const handAreas = document.querySelectorAll('.hand');

        if (window.innerWidth <= 768) {
            handAreas.forEach(handArea => {
                const cards = handArea.querySelectorAll('.card');

                // Карты на руке имеют небольшое перекрытие на мобильных устройствах для экономии места
                cards.forEach((card, index) => {
                    card.style.marginLeft = index > 0 ? '-10px' : '0';

                    // Добавляем обработчик для выделения карты
                    card.addEventListener('touchstart', function(e) {
                        const allCards = handArea.querySelectorAll('.card');

                        // Устанавливаем z-index для всех карт на основное значение
                        allCards.forEach(c => {
                            if (c !== this) {
                                c.style.zIndex = "1";
                            }
                        });

                        // Увеличиваем z-index для активной карты
                        this.style.zIndex = "10";
                    });
                });
            });
        }
    }

    // Функция для проверки и установки мобильных стилей
    function checkAndSetMobileStyles() {
        const isMobile = window.innerWidth <= 768;
        const gameSection = document.querySelector('.game-section');

        if (gameSection) {
            if (isMobile) {
                gameSection.classList.add('mobile-view');
            } else {
                gameSection.classList.remove('mobile-view');
            }
        }

        // Адаптируем размер карт и другие элементы
        adjustCardSize();
        maintainTableSize();
        improveMobileButtons();
        improveMobileCardHandling();
    }

    // Запуск при загрузке страницы
    checkAndSetMobileStyles();

    // Обработка изменения размера окна
    window.addEventListener('resize', checkAndSetMobileStyles);

    // Обработка изменения ориентации экрана на мобильных устройствах
    window.addEventListener('orientationchange', checkAndSetMobileStyles);
}

// Добавление анимации для карт
function addCardAnimations() {
    // Анимация при добавлении новой карты
    function animateNewCard(cardElement) {
        cardElement.classList.add('card-deal-animation');
        setTimeout(() => {
            cardElement.classList.remove('card-deal-animation');
        }, 300);
    }

    // Функция для наблюдения за изменениями в DOM для добавления анимаций
    const observeCardAddition = () => {
        const tableCards = document.getElementById('table-cards');
        const playerCards = document.getElementById('player-cards');

        if (tableCards && playerCards) {
            // Наблюдаем за добавлением карт на стол
            const tableObserver = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.addedNodes.length) {
                        mutation.addedNodes.forEach((node) => {
                            if (node.classList && node.classList.contains('card')) {
                                animateNewCard(node);
                            }
                        });
                    }
                });
            });

            // Наблюдаем за добавлением карт в руку игрока
            const playerObserver = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.addedNodes.length) {
                        mutation.addedNodes.forEach((node) => {
                            if (node.classList && node.classList.contains('card')) {
                                animateNewCard(node);
                            }
                        });
                    }
                });
            });

            tableObserver.observe(tableCards, { childList: true });
            playerObserver.observe(playerCards, { childList: true });
        }
    };

    // Запускаем наблюдение после полной загрузки игры
    setTimeout(observeCardAddition, 1000);
}

// Initialize the game
document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
    setupGameStateMonitoring();
    setupMultiplayerListeners();

    // Проверяем URL на наличие кода комнаты
    const urlParams = new URLSearchParams(window.location.search);
    const roomIdFromUrl = urlParams.get('room');

    if (roomIdFromUrl) {
        // Если в URL есть код комнаты, автоматически открываем форму подключения
        document.getElementById('room-id').value = roomIdFromUrl;
        showMultiplayerJoinForm();
    }
});

// Game Constants and Global Variables
const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
const VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUIT_SYMBOLS = {
    'hearts': '♥',
    'diamonds': '♦',
    'clubs': '♣',
    'spades': '♠'
}

let gameState = {
    deck: [],
    tableCards: [],
    players: [],
    currentPlayerIndex: 0,
    dealerIndex: null,
    gameMode: 'player-vs-computer',
    lastPlayerWhoTook: null,
    selectedHandCard: null,
    selectedTableCards: [],
    gameEnded: false,
    cardDistributionComplete: false, // Флаг для отслеживания раздачи карт
    lastTakenCards: [], // Массив для хранения последних взятых карт
    lastTakenBy: null, // Имя игрока, который взял последние карты
    isOnlineGame: false, // Флаг, указывающий на то, что игра онлайн
    roomId: null, // ID комнаты для онлайн-игры
    playerIndex: null // Индекс текущего игрока в онлайн-игре
};

// DOM Elements
const gameSections = {
    setup: document.getElementById('game-setup'),
    gameBoard: document.getElementById('game-board'),
    gameResults: document.getElementById('game-results')
};

const elements = {
    deckCount: document.getElementById('deck-count'),
    rulesBtn: document.getElementById('rules-btn'),
    restartBtn: document.getElementById('restart-btn'),
    startGameBtn: document.getElementById('start-game-btn'),
    opponentArea: document.getElementById('opponent-area'),
    opponentName: document.getElementById('opponent-name'),
    opponentCards: document.getElementById('opponent-cards'),
    opponentCollected: document.getElementById('opponent-collected'),
    playerArea: document.getElementById('player-area'),
    playerName: document.getElementById('player-name'),
    playerCards: document.getElementById('player-cards'),
    playerCollected: document.getElementById('player-collected'),
    tableCards: document.getElementById('table-cards'),
    deck: document.getElementById('deck'),
    takeBtn: document.getElementById('take-btn'),
    discardCardBtn: document.getElementById('discard-card-btn'),
    confirmSelectionBtn: document.getElementById('confirm-selection-btn'),
    gameMessage: document.getElementById('game-message'),
    newGameBtn: document.getElementById('new-game-btn'),
    modal: document.getElementById('rules-modal'),
    closeModal: document.querySelector('.close'),
    lastTaken: document.getElementById('last-taken'),
    lastTakenCards: document.querySelector('.last-taken-cards'),
    lastTakenBy: document.querySelector('.last-taken-by'),
    // Мультиплеер элементы
    createGameBtn: document.getElementById('create-game-btn'),
    joinGameBtn: document.getElementById('join-game-btn'),
    createNameInput: document.getElementById('create-name'),
    joinNameInput: document.getElementById('join-name'),
    roomIdInput: document.getElementById('room-id'),
    roomInfo: document.getElementById('room-info'),
    displayRoomId: document.getElementById('display-room-id'),
    inviteLinkInput: document.getElementById('invite-link'),
    copyLinkBtn: document.getElementById('copy-link-btn'),
    notification: document.getElementById('notification')
};

// Multiplayer functions
function setupMultiplayerListeners() {
    // Настройка обработчиков для кнопок мультиплеера
    elements.createGameBtn.addEventListener('click', createRoom);
    elements.joinGameBtn.addEventListener('click', joinRoom);
    elements.copyLinkBtn.addEventListener('click', copyInviteLink);

    // Настройка слушателей событий от сервера
    gameClient.onRoomCreated = handleRoomCreated;
    gameClient.onRoomJoined = handleRoomJoined;
    gameClient.onGameStart = handleGameStart;
    gameClient.onGameUpdate = handleGameUpdate;
    gameClient.onPlayerDisconnected = handlePlayerDisconnected;
    gameClient.onError = handleGameError;
}

function createRoom() {
    const playerName = elements.createNameInput.value.trim() || 'Игрок 1';
    gameClient.createRoom(playerName);
    showNotification('Создание игры...', 'info');
}

function joinRoom() {
    const playerName = elements.joinNameInput.value.trim() || 'Игрок 2';
    const roomId = elements.roomIdInput.value.trim().toUpperCase();

    if (!roomId) {
        showNotification('Введите код комнаты', 'error');
        return;
    }

    gameClient.joinRoom(roomId, playerName);
    showNotification('Подключение к игре...', 'info');
}

function handleRoomCreated(data) {
    gameState.isOnlineGame = true;
    gameState.roomId = data.roomId;
    gameState.playerIndex = data.playerIndex;

    // Обновляем UI
    elements.displayRoomId.textContent = data.roomId;
    const inviteLink = `${window.location.origin}${window.location.pathname}?room=${data.roomId}`;
    elements.inviteLinkInput.value = inviteLink;

    // Показываем информацию о комнате
    elements.roomInfo.classList.remove('hidden');

    showNotification('Игра создана! Ожидание второго игрока...', 'success');
}

function handleRoomJoined(data) {
    gameState.isOnlineGame = true;
    gameState.roomId = data.roomId;
    gameState.playerIndex = data.playerIndex;

    showNotification('Вы присоединились к игре', 'success');
}

function handleGameStart(newGameState) {
    // Обновляем локальное состояние игры
    updateGameStateFromServer(newGameState);

    // Скрываем экран настройки и показываем игровое поле
    showSection(gameSections.gameBoard);

    // Обновляем имена игроков
    updatePlayerNames();

    // Инициализируем UI
    renderGameState();

    // Инициализация игрового процесса
    updateActivePlayerUI();

    // Скрываем информацию о комнате, если она отображается
    elements.roomInfo.classList.add('hidden');

    showNotification('Игра началась!', 'success');
}

function handleGameUpdate(newGameState) {
    // Обновляем локальное состояние игры
    updateGameStateFromServer(newGameState);

    // Если игра закончилась, показываем результаты
    if (gameState.gameEnded) {
        displayResults();
        showSection(gameSections.gameResults);
        return;
    }

    // Обновляем UI
    renderGameState();
    updateActivePlayerUI();

    if (gameState.lastTakenCards.length > 0) {
        elements.lastTaken.classList.remove('hidden');
    }
}

function updateGameStateFromServer(newState) {
    // Копируем все свойства нового состояния в локальное состояние
    for (const key in newState) {
        if (key === 'players') {
            // Глубокое копирование игроков
            gameState.players = JSON.parse(JSON.stringify(newState.players));
        } else {
            gameState[key] = newState[key];
        }
    }

    // Сбрасываем выбранные карты
    gameState.selectedHandCard = null;
    gameState.selectedTableCards = [];
}

function handlePlayerDisconnected(data) {
    const disconnectedPlayerIndex = data.disconnectedPlayerIndex;
    const playerName = gameState.players[disconnectedPlayerIndex].name;

    showNotification(`Игрок ${playerName} отключился от игры`, 'error');

    // Обновляем состояние игры
    updateGameStateFromServer(data.gameState);

    // Возвращаемся к экрану настройки
    setTimeout(() => {
        resetGame();
    }, 3000);
}

function handleGameError(error) {
    showNotification(error.message, 'error');
}

function copyInviteLink() {
    const inviteLink = elements.inviteLinkInput;
    inviteLink.select();
    document.execCommand('copy');

    showNotification('Ссылка скопирована в буфер обмена', 'success');
}

function showMultiplayerJoinForm() {
    // Функция для автоматического выбора вкладки "Присоединиться к игре"
    elements.joinNameInput.focus();
}

function showNotification(message, type = 'info') {
    const notification = elements.notification;
    notification.textContent = message;
    notification.className = 'notification'; // Сброс классов

    if (type === 'error') {
        notification.classList.add('error');
    } else if (type === 'success') {
        notification.classList.add('success');
    }

    // Показываем уведомление
    notification.classList.remove('hidden');

    // Скрываем через 3 секунды
    setTimeout(() => {
        notification.classList.add('hidden');
    }, 3000);
}

function updatePlayerNames() {
    if (gameState.isOnlineGame) {
        const myPlayer = gameClient.getMyPlayer();
        const opponent = gameClient.getOpponentPlayer();

        if (myPlayer) {
            elements.playerName.textContent = `${myPlayer.name} (Вы)`;
            document.getElementById('player-result-name').textContent = `${myPlayer.name} (Вы)`;
        }

        if (opponent) {
            elements.opponentName.textContent = opponent.name;
            document.getElementById('opponent-result-name').textContent = opponent.name;
        }
    } else {
        // В локальной игре используем стандартные имена
        elements.playerName.textContent = 'Вы';
        elements.opponentName.textContent = 'Компьютер';
        document.getElementById('player-result-name').textContent = 'Вы';
        document.getElementById('opponent-result-name').textContent = 'Компьютер';
    }
}

// Функция для рендеринга всего игрового состояния
function renderGameState() {
    // Рендерим руки игроков и карты на столе
    if (gameState.isOnlineGame) {
        // В онлайн-игре нам нужно показать карты текущего игрока и скрыть карты оппонента
        const myPlayerIndex = gameState.playerIndex;
        const opponentIndex = myPlayerIndex === 0 ? 1 : 0;

        renderPlayerHand(gameState.players[myPlayerIndex], elements.playerCards, true);
        renderPlayerHand(gameState.players[opponentIndex], elements.opponentCards, false);
    } else {
        // В локальной игре всегда показываем карты первого игрока
        renderPlayerHand(gameState.players[0], elements.playerCards, true);
        renderPlayerHand(gameState.players[1], elements.opponentCards, false);
    }

    renderTableCards();
    updateCollectedCount();
    updateDeckCount();

    // Обновляем информацию о последней взятке, если есть
    if (gameState.lastTakenCards.length > 0) {
        updateLastTakenInfo();
    }
}

// Функция для отображения карт на столе
function renderTableCards() {
    elements.tableCards.innerHTML = '';
    gameState.tableCards.forEach(card => {
        const cardElement = createCardElement(card);
        elements.tableCards.appendChild(cardElement);
    });
}

// Функция обновления счетчика собранных карт
function updateCollectedCount() {
    const playerCollectedCount = elements.playerCollected.querySelector('.collected-count');
    const opponentCollectedCount = elements.opponentCollected.querySelector('.collected-count');

    if (gameState.isOnlineGame) {
        const myPlayerIndex = gameState.playerIndex;
        const opponentIndex = myPlayerIndex === 0 ? 1 : 0;

        playerCollectedCount.textContent = gameState.players[myPlayerIndex].collected.length;
        opponentCollectedCount.textContent = gameState.players[opponentIndex].collected.length;
    } else {
        playerCollectedCount.textContent = gameState.players[0].collected.length;
        opponentCollectedCount.textContent = gameState.players[1].collected.length;
    }
}

// Функция обновления счетчика колоды
function updateDeckCount() {
    elements.deckCount.textContent = `Колода: ${gameState.deck.length}`;
}

// Функции выбора карт
function selectHandCard(cardElement, card) {
    // Если игра закончена или не ход игрока, ничего не делаем
    if (gameState.gameEnded ||
        (gameState.isOnlineGame && !gameClient.isMyTurn()) ||
        (!gameState.isOnlineGame && gameState.currentPlayerIndex !== 0)) {
        return;
    }

    // Очистить предыдущие выборы
    clearHandCardSelection();

    // Выбрать эту карту
    cardElement.classList.add('selected');
    gameState.selectedHandCard = card;

    // Проверить, может ли эта карта взять любые карты на столе
    checkIfCanTake();
}

function selectTableCard(cardElement, card) {
    // Если игра закончена, не ход игрока или не выбрана карта руки, ничего не делаем
    if (gameState.gameEnded ||
        (gameState.isOnlineGame && !gameClient.isMyTurn()) ||
        (!gameState.isOnlineGame && gameState.currentPlayerIndex !== 0) ||
        !gameState.selectedHandCard) {
        return;
    }

    // Переключить выбор
    if (cardElement.classList.contains('selected')) {
        cardElement.classList.remove('selected');
        gameState.selectedTableCards = gameState.selectedTableCards.filter(c =>
            !(c.suit === card.suit && c.value === card.value));
    } else {
        cardElement.classList.add('selected');
        gameState.selectedTableCards.push(card);
    }

    // Проверить, является ли текущий выбор действительным
    checkIfValidSelection();
}

function clearHandCardSelection() {
    const handCards = elements.playerCards.querySelectorAll('.card');
    handCards.forEach(card => card.classList.remove('selected'));
    gameState.selectedHandCard = null;
    elements.takeBtn.disabled = true;
}

function clearTableCardSelection() {
    const tableCards = elements.tableCards.querySelectorAll('.card');
    tableCards.forEach(card => card.classList.remove('selected'));
    gameState.selectedTableCards = [];
    elements.confirmSelectionBtn.disabled = true;
}

function checkIfCanTake() {
    if (!gameState.selectedHandCard || gameState.tableCards.length === 0) {
        elements.takeBtn.disabled = true;
        return;
    }

    // Проверить, может ли игрок взять любые карты выбранной картой руки
    const canTake = canTakeAnyCards(gameState.selectedHandCard, gameState.tableCards);

    elements.takeBtn.disabled = !canTake;
    if (!canTake) {
        elements.gameMessage.textContent = "Этой картой нельзя взять карты со стола";
    } else {
        elements.gameMessage.textContent = "Выберите карты, которые хотите взять";
    }
}

function checkIfValidSelection() {
    if (!gameState.selectedHandCard || gameState.selectedTableCards.length === 0) {
        elements.confirmSelectionBtn.disabled = true;
        return;
    }

    // Проверить, является ли выбор действительным согласно правилам игры
    const isValid = isValidCardSelection(gameState.selectedHandCard, gameState.selectedTableCards);

    elements.confirmSelectionBtn.disabled = !isValid;
    if (!isValid) {
        elements.gameMessage.textContent = "Недопустимая комбинация карт";
    } else {
        elements.gameMessage.textContent = "Подтвердите свой выбор";
    }
}

// Функции игровой логики
function canTakeAnyCards(handCard, tableCards) {
    // Валет может взять любую карту, кроме Q и K
    if (handCard.value === 'J') {
        return tableCards.some(card => !['Q', 'K'].includes(card.value));
    }

    // Дама может взять только другую Даму
    if (handCard.value === 'Q') {
        return tableCards.some(card => card.value === 'Q');
    }

    // Король может взять только другого Короля
    if (handCard.value === 'K') {
        return tableCards.some(card => card.value === 'K');
    }

    // Туз не может брать Даму или Короля
    if (handCard.value === 'A') {
        // Исключаем комбинации, где туз пытается взять даму или короля
        const validTableCards = tableCards.filter(card => !['Q', 'K'].includes(card.value));
        return canFormSumEleven(handCard, validTableCards);
    }

    // Для других карт, проверяем, могут ли они образовать сумму 11
    return canFormSumEleven(handCard, tableCards);
}

function canFormSumEleven(handCard, tableCards) {
    // Проверка всех возможных комбинаций карт на столе
    for (let i = 1; i <= tableCards.length; i++) {
        const combinations = getCombinations(tableCards, i);
        for (const combo of combinations) {
            const sum = combo.reduce((acc, card) => acc + card.numericValue, 0);
            if (sum + handCard.numericValue === 11) {
                return true;
            }
        }
    }
    return false;
}

function getCombinations(array, size) {
    function backtrack(start, current) {
        if (current.length === size) {
            result.push([...current]);
            return;
        }

        for (let i = start; i < array.length; i++) {
            current.push(array[i]);
            backtrack(i + 1, current);
            current.pop();
        }
    }

    const result = [];
    backtrack(0, []);
    return result;
}

function isValidCardSelection(handCard, selectedTableCards) {
    // Валет может взять любую карту кроме Q и K
    if (handCard.value === 'J') {
        return selectedTableCards.every(card => !['Q', 'K'].includes(card.value));
    }

    // Дама может взять только другую Даму
    if (handCard.value === 'Q') {
        return selectedTableCards.length === 1 && selectedTableCards[0].value === 'Q';
    }

    // Король может взять только другого Короля
    if (handCard.value === 'K') {
        return selectedTableCards.length === 1 && selectedTableCards[0].value === 'K';
    }

    // Туз не может брать Даму или Короля
    if (handCard.value === 'A') {
        if (selectedTableCards.some(card => ['Q', 'K'].includes(card.value))) {
            return false;
        }
    }

    // Для других карт, проверить, образуют ли они сумму 11
    const tableSum = selectedTableCards.reduce((acc, card) => acc + card.numericValue, 0);
    return tableSum + handCard.numericValue === 11;
}

// Упрощенная функция takeCards, без добавления одной карты
function takeCards(player, handCard, tableCards) {
    console.log(`${player.name} берет карты`);

    // В режиме онлайн-игры отправляем ход на сервер
    if (gameState.isOnlineGame) {
        gameClient.makeMove('take', handCard, tableCards);
        return;
    }

    // Удалить карту руки из руки игрока
    player.hand = player.hand.filter(card =>
        !(card.suit === handCard.suit && card.value === handCard.value));

    // Удалить карты стола из стола
    const removedTableCards = [];
    for (const card of tableCards) {
        gameState.tableCards = gameState.tableCards.filter(c => {
            const match = c.suit === card.suit && c.value === card.value;
            if (match) removedTableCards.push(c);
            return !match;
        });
    }

    // Добавить все карты в собранную стопку игрока
    player.collected.push(handCard, ...removedTableCards);

    // Установить этого игрока как последнего, кто взял карты
    gameState.lastPlayerWhoTook = player;

    // Обновить информацию о последней взятке
    gameState.lastTakenCards = [handCard, ...removedTableCards];
    gameState.lastTakenBy = player.name;
    updateLastTakenInfo();

    updateDeckCount();
}

function updateLastTakenInfo() {
    if (!gameState.lastTakenCards || gameState.lastTakenCards.length === 0) {
        elements.lastTaken.classList.add('hidden');
        return;
    }

    // Обновление UI
    elements.lastTakenCards.innerHTML = '';
    elements.lastTakenBy.textContent = `Взял(а): ${gameState.lastTakenBy}`;

    gameState.lastTakenCards.forEach(card => {
        const cardElement = createCardElement(card, false);
        cardElement.style.transform = 'scale(0.7)'; // Уменьшаем размер карт в блоке последней взятки
        elements.lastTakenCards.appendChild(cardElement);
    });

    elements.lastTaken.classList.remove('hidden');
}

// Функция для раздачи по 4 новых карты каждому игроку
function dealNewHands() {
    console.log("Раздаем по 4 новые карты всем игрокам!");

    // Раздать по 4 новых карты каждому игроку
    for (const player of gameState.players) {
        const cardsToTake = Math.min(4, gameState.deck.length);
        if (cardsToTake > 0) {
            player.hand = drawCards(gameState.deck, cardsToTake);
            console.log(`Раздано ${cardsToTake} карт игроку ${player.name}`);
        }
    }

    // Обновляем UI
    renderGameState();

    // Показываем сообщение о новой раздаче
    elements.gameMessage.textContent = "Новые карты розданы!";
    setTimeout(() => {
        elements.gameMessage.textContent = gameState.currentPlayerIndex === 0 ? "Ваш ход" : "Ход соперника";
    }, 2000);
}

// Проверяем, нужно ли раздать новые карты
function checkAndDealNewCards() {
    console.log("Проверка раздачи карт...");
    console.log("Руки игроков:", gameState.players[0].hand.length, gameState.players[1].hand.length);

    // Проверяем, все ли игроки использовали все карты в руке
    const allPlayersHandEmpty = gameState.players.every(player => player.hand.length === 0);

    console.log("Все руки пусты?", allPlayersHandEmpty);
    console.log("Карт в колоде:", gameState.deck.length);

    // Если все руки пусты и в колоде есть карты, раздаем новые карты всем игрокам
    if (allPlayersHandEmpty && gameState.deck.length > 0) {
        // В онлайн-режиме раздача карт происходит на сервере
        if (!gameState.isOnlineGame) {
            dealNewHands();
            return true; // Карты были розданы
        }
    }

    return false; // Карты не были розданы
}

// Упрощенная функция discardCard, без добавления одной карты
function discardCard(player, card) {
    console.log(`${player.name} сбрасывает карту:`, card.value, card.suit);

    // В режиме онлайн-игры отправляем ход на сервер
    if (gameState.isOnlineGame) {
        gameClient.makeMove('discard', card);
        return;
    }

    // Удалить карту из руки игрока
    player.hand = player.hand.filter(c =>
        !(c.suit === card.suit && c.value === card.value));

    // Добавить карту на стол
    gameState.tableCards.push(card);

    updateDeckCount();
}

// Игровые действия
function handleTakeAction() {
    elements.gameMessage.textContent = "Выберите карты, которые хотите взять со стола";
    elements.takeBtn.disabled = true;
    elements.discardCardBtn.disabled = true;
    elements.confirmSelectionBtn.disabled = false;
}

function handleDiscardAction() {
    if (!gameState.selectedHandCard) {
        elements.gameMessage.textContent = "Сначала выберите карту из руки";
        return;
    }

    // Определяем текущего игрока
    const currentPlayerIndex = gameState.isOnlineGame ? gameState.playerIndex : gameState.currentPlayerIndex;
    const player = gameState.players[currentPlayerIndex];

    discardCard(player, gameState.selectedHandCard);

    // Очистить выборы
    clearHandCardSelection();
    clearTableCardSelection();

    // Обновить UI
    if (!gameState.isOnlineGame) {
        renderPlayerHand(player, elements.playerCards);
        renderTableCards();

        // Ход следующего игрока
        nextTurn();
    }
}

function confirmSelection() {
    if (!gameState.selectedHandCard || gameState.selectedTableCards.length === 0) {
        elements.gameMessage.textContent = "Выберите карты";
        return;
    }

    // Определяем текущего игрока
    const currentPlayerIndex = gameState.isOnlineGame ? gameState.playerIndex : gameState.currentPlayerIndex;
    const player = gameState.players[currentPlayerIndex];

    takeCards(player, gameState.selectedHandCard, gameState.selectedTableCards);

    // Очистить выборы
    clearHandCardSelection();
    clearTableCardSelection();

    // В локальном режиме обновляем UI и переключаем ход
    if (!gameState.isOnlineGame) {
        renderPlayerHand(player, elements.playerCards);
        renderTableCards();
        updateCollectedCount();

        // Ход следующего игрока
        nextTurn();
    }
}

// Функция проверки состояния игры и восстановления при проблемах
function checkGameState() {
    // Проверяем состояние только для локальной игры
    if (gameState.isOnlineGame || gameState.gameEnded) {
        return;
    }

    console.log("Проверка состояния игры...");
    console.log("Текущий игрок:", gameState.currentPlayerIndex);
    console.log("Карты в руке игрока:", gameState.players[0].hand.length);
    console.log("Карты в руке компьютера:", gameState.players[1].hand.length);
    console.log("Карты на столе:", gameState.tableCards.length);
    console.log("Карты в колоде:", gameState.deck.length);

    // Проверка целостности колоды
    const totalCards = gameState.deck.length +
                      gameState.tableCards.length +
                      gameState.players[0].hand.length +
                      gameState.players[1].hand.length +
                      gameState.players[0].collected.length +
                      gameState.players[1].collected.length;

    console.log("Всего карт в игре:", totalCards);

    if (totalCards !== 52) {
        console.error("ОШИБКА: Количество карт в игре не равно 52!");
    }

    // Проверка зависания - если текущий игрок не может ходить
    if (gameState.currentPlayerIndex === 1 && gameState.players[1].hand.length === 0) {
        console.warn("Компьютер не может ходить - нет карт в руке!");

        // Попытка восстановления
        if (checkAndDealNewCards()) {
            console.log("Розданы новые карты");
        } else {
            console.warn("Передаем ход игроку");
            gameState.currentPlayerIndex = 0;
            updateActivePlayerUI();
        }
    }
}

// Добавляем таймер для периодической проверки состояния игры
function setupGameStateMonitoring() {
    // Проверяем каждые 5 секунд, только для локальной игры
    setInterval(() => {
        if (!gameState.isOnlineGame) {
            checkGameState();
        }
    }, 5000);
}

function updateActivePlayerUI() {
    // В онлайн-режиме отображение активного игрока зависит от playerIndex
    if (gameState.isOnlineGame) {
        const isMyTurn = gameClient.isMyTurn();
        elements.playerArea.classList.toggle('active', isMyTurn);
        elements.opponentArea.classList.toggle('active', !isMyTurn);

        // Включить/отключить кнопки
        elements.takeBtn.disabled = !isMyTurn;
        elements.discardCardBtn.disabled = !isMyTurn;
        elements.confirmSelectionBtn.disabled = true; // По умолчанию отключена до выбора карт

        // Обновить сообщение
        elements.gameMessage.textContent = isMyTurn ? "Ваш ход" : "Ход соперника";
    } else {
        // В локальной игре
        elements.playerArea.classList.toggle('active', gameState.currentPlayerIndex === 0);
        elements.opponentArea.classList.toggle('active', gameState.currentPlayerIndex === 1);

        // Включить/отключить кнопки
        const isPlayerTurn = gameState.currentPlayerIndex === 0;
        elements.takeBtn.disabled = !isPlayerTurn;
        elements.discardCardBtn.disabled = !isPlayerTurn;
        elements.confirmSelectionBtn.disabled = true; // По умолчанию отключена

        // Очистить сообщение
        elements.gameMessage.textContent = isPlayerTurn ? "Ваш ход" : "Ход соперника";
    }
}

// Исправленная функция nextTurn
function nextTurn() {
    console.log("Переход хода");

    // В онлайн-режиме ходы обрабатываются сервером
    if (gameState.isOnlineGame) {
        return;
    }

    // Сначала проверяем, если обе руки пусты, раздаем новые карты
    if (checkAndDealNewCards()) {
        // Если раздали новые карты, просто продолжаем игру с тем же игроком
        updateActivePlayerUI();
        return;
    }

    // Проверить, должна ли игра закончиться
    if (checkGameEnd()) {
        console.log("Игра заканчивается");
        endGame();
        return;
    }

    // Переключиться на следующего игрока
    gameState.currentPlayerIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;
    console.log("Текущий игрок:", gameState.currentPlayerIndex);

    // Проверить, что у текущего игрока есть карты
    if (gameState.players[gameState.currentPlayerIndex].hand.length === 0) {
        console.warn("У текущего игрока нет карт в руке!");

        // Проверяем, можно ли раздать карты
        if (gameState.deck.length > 0) {
            console.log("Пытаемся раздать карты...");

            // Если у обоих игроков нет карт, раздаем по 4
            if (gameState.players[0].hand.length === 0 && gameState.players[1].hand.length === 0) {
                dealNewHands();
            }
        } else if (gameState.deck.length === 0) {
            console.log("Колода пуста, проверяем окончание игры");

            // Если колода пуста и у обоих игроков нет карт, игра заканчивается
            if (gameState.players[0].hand.length === 0 && gameState.players[1].hand.length === 0) {
                endGame();
                return;
            }
        }
    }

    // Обновить UI для текущего игрока
    updateActivePlayerUI();

    // Если следующий игрок - компьютер, сделать ход компьютера
    if (gameState.gameMode === 'player-vs-computer' && gameState.currentPlayerIndex === 1) {
        setTimeout(() => {
            try {
                computerMove();
            } catch (error) {
                console.error("Ошибка в ходе компьютера:", error);
                // В случае ошибки передаем ход игроку
                gameState.currentPlayerIndex = 0;
                updateActivePlayerUI();
            }
        }, 1000);
    }
}

function computerMove() {
    console.log("Ход компьютера");
    const computer = gameState.players[1];

    // Защита от ошибок - проверяем, есть ли карты у компьютера
    if (!computer.hand || computer.hand.length === 0) {
        console.error("У компьютера нет карт в руке!");

        // Пробуем раздать новые карты, если у обоих игроков пусто
        if (gameState.players[0].hand.length === 0 && gameState.deck.length > 0) {
            console.log("Пробуем раздать новые карты...");
            dealNewHands();
        } else {
            console.error("Непредвиденная ситуация: у компьютера нет карт, но новые раздать нельзя");
            // Принудительно переключаем ход на игрока
            gameState.currentPlayerIndex = 0;
            updateActivePlayerUI();
        }
        return;
    }

    // Сначала попытаться взять карты
    let madeMove = false;

    try {
        // Перебираем все карты в руке компьютера
        for (const handCard of computer.hand) {
            // Сначала проверить специальные карты
            if (handCard.value === 'J') {
                // Найти все не-Q, не-K карты
                const validCards = gameState.tableCards.filter(card => !['Q', 'K'].includes(card.value));
                if (validCards.length > 0) {
                    takeCards(computer, handCard, validCards);
                    madeMove = true;
                    break;
                }
            } else if (handCard.value === 'Q') {
                // Найти другую Q
                const queens = gameState.tableCards.filter(card => card.value === 'Q');
                if (queens.length > 0) {
                    takeCards(computer, handCard, [queens[0]]);
                    madeMove = true;
                    break;
                }
            } else if (handCard.value === 'K') {
                // Найти другого K
                const kings = gameState.tableCards.filter(card => card.value === 'K');
                if (kings.length > 0) {
                    takeCards(computer, handCard, [kings[0]]);
                    madeMove = true;
                    break;
                }
            } else {
                // Попытаться найти комбинации, сумма которых равна 11
                // Туз не должен забирать даму или короля
                for (let i = 1; i <= gameState.tableCards.length; i++) {
                    const combinations = getCombinations(gameState.tableCards, i);
                    for (const combo of combinations) {
                        // Проверка, что туз не пытается забрать даму или короля
                        if (handCard.value === 'A' && combo.some(card => ['K', 'Q'].includes(card.value))) {
                            continue;
                        }

                        const sum = combo.reduce((acc, card) => acc + card.numericValue, 0);
                        if (sum + handCard.numericValue === 11) {
                            takeCards(computer, handCard, combo);
                            madeMove = true;
                            break;
                        }
                    }
                    if (madeMove) break;
                }
            }

            if (madeMove) break;
        }

        // Если не может взять, сбросить
        if (!madeMove) {
            // Проверяем, что есть хотя бы одна карта для сброса
            if (computer.hand.length === 0) {
                console.error("У компьютера нет карт для сброса!");
                gameState.currentPlayerIndex = 0; // Переключаем на игрока
                updateActivePlayerUI();
                return;
            }

            // Выбрать случайную карту для сброса
            const randomIndex = Math.floor(Math.random() * computer.hand.length);
            const cardToDiscard = computer.hand[randomIndex];

            if (!cardToDiscard) {
                console.error("Не удалось выбрать карту для сброса!");
                gameState.currentPlayerIndex = 0; // Переключаем на игрока
                updateActivePlayerUI();
                return;
            }

            discardCard(computer, cardToDiscard);
        }

        // Обновить UI
        renderPlayerHand(computer, elements.opponentCards, false);
        renderTableCards();
        updateCollectedCount();

        // Проверяем необходимость раздачи новых карт
        checkAndDealNewCards();

        // Следующий ход
        setTimeout(() => {
            nextTurn();
        }, 500); // Небольшая задержка для анимации
    } catch (error) {
        console.error("Ошибка в ходе компьютера:", error);
        // В случае ошибки передаем ход игроку
        gameState.currentPlayerIndex = 0;
        updateActivePlayerUI();
    }
}

function checkGameEnd() {
    // Проверить, пуста ли колода и у игроков нет карт
    return gameState.deck.length === 0 &&
           gameState.players.every(player => player.hand.length === 0);
}

function endGame() {
    gameState.gameEnded = true;

    // Если это онлайн-игра, ждем обновления от сервера
    if (gameState.isOnlineGame) {
        return;
    }

    // Последний игрок, взявший карты, забирает оставшиеся карты стола
    if (gameState.lastPlayerWhoTook && gameState.tableCards.length > 0) {
        gameState.lastPlayerWhoTook.collected.push(...gameState.tableCards);
        gameState.tableCards = [];
    }

    // Подсчитать очки
    calculateScores();

    // Отобразить результаты
    displayResults();

    // Показать раздел результатов
    showSection(gameSections.gameResults);
}

function calculateScores() {
    // Сбросить очки
    gameState.players.forEach(player => {
        player.score = 0;
        player.bonusPoints = 0;
    });

    // Найти игрока с наибольшим количеством карт
    const cardCounts = gameState.players.map(player => player.collected.length);

    // Проверяем, что сумма собранных карт равна 52
    const totalCards = cardCounts.reduce((sum, count) => sum + count, 0);
    if (totalCards !== 52) {
        console.error(`Ошибка: общее количество собранных карт (${totalCards}) не равно 52`);
    }

    // Если у игроков разное количество карт, присудить 2 очка игроку с большим количеством
    if (cardCounts[0] > cardCounts[1]) {
        gameState.players[0].score += 2;
        gameState.players[0].bonusPoints += 2;
    } else if (cardCounts[1] > cardCounts[0]) {
        gameState.players[1].score += 2;
        gameState.players[1].bonusPoints += 2;
    }
    // Если равное количество, никто не получает очки

    // Подсчитать крести для каждого игрока
    const clubsCounts = gameState.players.map(player =>
        player.collected.filter(card => card.suit === 'clubs').length
    );

    // Проверяем, что сумма крестовых карт равна 13
    const totalClubs = clubsCounts.reduce((sum, count) => sum + count, 0);
    if (totalClubs !== 13) {
        console.error(`Ошибка: общее количество собранных крестовых карт (${totalClubs}) не равно 13`);
    }

    // Если у игроков разное количество крестей, присудить 1 очко игроку с большим количеством
    if (clubsCounts[0] > clubsCounts[1]) {
        gameState.players[0].score += 1;
        gameState.players[0].bonusPoints += 1;
    } else if (clubsCounts[1] > clubsCounts[0]) {
        gameState.players[1].score += 1;
        gameState.players[1].bonusPoints += 1;
    }
    // Если равное количество, никто не получает очки (что невозможно для 13 крестей)

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

function displayResults() {
    // Определяем индексы игроков в зависимости от типа игры
    let playerIndex = 0;
    let opponentIndex = 1;

    if (gameState.isOnlineGame) {
        playerIndex = gameState.playerIndex;
        opponentIndex = playerIndex === 0 ? 1 : 0;
    }

    // Результаты игрока
    document.getElementById('player-card-count').textContent = gameState.players[playerIndex].collected.length;
    document.getElementById('player-clubs-count').textContent = gameState.players[playerIndex].collected.filter(card => card.suit === 'clubs').length;
    document.getElementById('player-club2').textContent = gameState.players[playerIndex].hasClub2 ? "Да (+1)" : "Нет";
    document.getElementById('player-diamond10').textContent = gameState.players[playerIndex].hasDiamond10 ? "Да (+1)" : "Нет";
    document.getElementById('player-bonus').textContent = gameState.players[playerIndex].bonusPoints;
    document.getElementById('player-total-score').textContent = gameState.players[playerIndex].score;

    // Результаты противника
    document.getElementById('opponent-card-count').textContent = gameState.players[opponentIndex].collected.length;
    document.getElementById('opponent-clubs-count').textContent = gameState.players[opponentIndex].collected.filter(card => card.suit === 'clubs').length;
    document.getElementById('opponent-club2').textContent = gameState.players[opponentIndex].hasClub2 ? "Да (+1)" : "Нет";
    document.getElementById('opponent-diamond10').textContent = gameState.players[opponentIndex].hasDiamond10 ? "Да (+1)" : "Нет";
    document.getElementById('opponent-bonus').textContent = gameState.players[opponentIndex].bonusPoints;
    document.getElementById('opponent-total-score').textContent = gameState.players[opponentIndex].score;

    // Победитель
    const winnerMessage = document.getElementById('game-winner');

    if (gameState.isOnlineGame) {
        const myPlayer = gameState.players[playerIndex];
        const opponent = gameState.players[opponentIndex];

        if (myPlayer.score > opponent.score) {
            winnerMessage.textContent = "Вы победили! 🎉";
        } else if (opponent.score > myPlayer.score) {
            winnerMessage.textContent = `${opponent.name} победил!`;
        } else {
            winnerMessage.textContent = "Ничья!";
        }
    } else {
        if (gameState.players[0].score > gameState.players[1].score) {
            winnerMessage.textContent = "Вы победили! 🎉";
        } else if (gameState.players[1].score > gameState.players[0].score) {
            winnerMessage.textContent = "Компьютер победил!";
        } else {
            winnerMessage.textContent = "Ничья!";
        }
    }
}

// Функции настройки игры
function startGame() {
    // Получить выбранный режим игры
    const gameModeInputs = document.querySelectorAll('input[name="game-mode"]');
    for (const input of gameModeInputs) {
        if (input.checked) {
            gameState.gameMode = input.value;
            break;
        }
    }

    // Пока что реализуем только режим игрок против компьютера
    if (gameState.gameMode !== 'player-vs-computer') {
        alert('В данный момент доступен только режим "1 на 1 (против компьютера)". Другие режимы будут добавлены позже.');
        gameState.gameMode = 'player-vs-computer';
    }

    // Сбрасываем флаг онлайн-игры для локального режима
    gameState.isOnlineGame = false;

    // Инициализировать игру напрямую
    initializeGame();
    startGameplay();
}

function initializeGame() {
    // В режиме онлайн-игры инициализация происходит на сервере
    if (gameState.isOnlineGame) {
        return;
    }

    // Создать и перемешать колоду
    gameState.deck = createDeck();
    shuffleDeck(gameState.deck);

    // Создать игроков
    gameState.players = [
        { name: 'Вы', hand: [], collected: [], score: 0, bonusPoints: 0 },
        { name: 'Компьютер', hand: [], collected: [], score: 0, bonusPoints: 0 }
    ];

    // Раздать 4 карты каждому игроку
    for (const player of gameState.players) {
        player.hand = drawCards(gameState.deck, 4);
    }

    // Выложить 4 карты на стол
    gameState.tableCards = drawCards(gameState.deck, 4);

    // Установить первого игрока случайным образом
    gameState.currentPlayerIndex = Math.floor(Math.random() * 2);

    // Сбросить игровое состояние
    gameState.lastPlayerWhoTook = null;
    gameState.selectedHandCard = null;
    gameState.selectedTableCards = [];
    gameState.gameEnded = false;
    gameState.lastTakenCards = [];
    gameState.lastTakenBy = null;

    // Обновить счетчик колоды
    updateDeckCount();

    // Скрыть блок последней взятки вначале игры
    elements.lastTaken.classList.add('hidden');
}

function startGameplay() {
    // Показать игровое поле
    showSection(gameSections.gameBoard);

    // Отрендерить начальное состояние
    renderGameState();

    // Обновить имена игроков
    updatePlayerNames();

    // Обновить UI для текущего игрока
    updateActivePlayerUI();

    // Если первым ходит компьютер в локальной игре, сделать ход компьютера
    if (!gameState.isOnlineGame && gameState.currentPlayerIndex === 1) {
        setTimeout(() => {
            computerMove();
        }, 1000);
    }
}

// Вспомогательные функции UI
function showSection(section) {
    // Скрыть все разделы
    Object.values(gameSections).forEach(s => s.classList.add('hidden'));

    // Показать запрошенный раздел
    section.classList.remove('hidden');
}

function showRules() {
    elements.modal.style.display = 'block';
}

function closeRules() {
    elements.modal.style.display = 'none';
}

function resetGame() {
    // Сбросить игровое состояние и UI
    showSection(gameSections.setup);

    // Очистить весь динамический контент
    elements.playerCards.innerHTML = '';
    elements.opponentCards.innerHTML = '';
    elements.tableCards.innerHTML = '';
    elements.gameMessage.textContent = '';
    elements.lastTakenCards.innerHTML = '';
    elements.lastTakenBy.textContent = '';
    elements.lastTaken.classList.add('hidden');

    // Сбросить счетчики собранных карт
    const playerCollectedCount = elements.playerCollected.querySelector('.collected-count');
    const opponentCollectedCount = elements.opponentCollected.querySelector('.collected-count');
    playerCollectedCount.textContent = '0';
    opponentCollectedCount.textContent = '0';

    // Сбросить счетчик колоды
    elements.deckCount.textContent = 'Колода: 52';

    // Сбросить флаги онлайн-игры
    gameState.isOnlineGame = false;
    gameState.roomId = null;
    gameState.playerIndex = null;

    // Скрыть информацию о комнате, если она отображается
    elements.roomInfo.classList.add('hidden');
}

// Настройка слушателей событий
function setupEventListeners() {
    // Настройка игры
    elements.startGameBtn.addEventListener('click', startGame);

    // Игровые элементы управления
    elements.takeBtn.addEventListener('click', handleTakeAction);
    elements.discardCardBtn.addEventListener('click', handleDiscardAction);
    elements.confirmSelectionBtn.addEventListener('click', confirmSelection);

    // UI элементы управления
    elements.rulesBtn.addEventListener('click', showRules);
    elements.closeModal.addEventListener('click', closeRules);
    elements.restartBtn.addEventListener('click', resetGame);
    elements.newGameBtn.addEventListener('click', resetGame);

    // Щелчок вне модального окна
    window.addEventListener('click', (event) => {
        if (event.target === elements.modal) {
            closeRules();
        }
    });
}

// Функции создания карт и колоды
function createDeck() {
    const deck = [];
    for (const suit of SUITS) {
        for (const value of VALUES) {
            deck.push({
                suit,
                value,
                numericValue: getNumericValue(value)
            });
        }
    }
    return deck;
}

function getNumericValue(value) {
    if (value === 'A') return 1;
    if (['J', 'Q', 'K'].includes(value)) return 10;
    return parseInt(value);
}

function shuffleDeck(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

function drawCard(deck) {
    if (deck.length === 0) return null;
    return deck.pop();
}

function drawCards(deck, count) {
    const cards = [];
    for (let i = 0; i < count && deck.length > 0; i++) {
        const card = drawCard(deck);
        if (card) cards.push(card);
    }
    return cards;
}

// Функции отображения карт
function createCardElement(card, isPlayerCard = false) {
    const cardElement = document.createElement('div');
    cardElement.className = `card ${card.suit}`;

    const topElement = document.createElement('div');
    topElement.className = 'card-top';

    const valueTop = document.createElement('div');
    valueTop.className = 'card-value';
    valueTop.textContent = card.value;

    const suitTop = document.createElement('div');
    suitTop.className = 'card-suit';
    suitTop.textContent = SUIT_SYMBOLS[card.suit];

    topElement.appendChild(valueTop);
    topElement.appendChild(suitTop);

    const centerElement = document.createElement('div');
    centerElement.className = 'card-center';
    centerElement.textContent = SUIT_SYMBOLS[card.suit];

    const bottomElement = document.createElement('div');
    bottomElement.className = 'card-bottom';

    const valueBottom = document.createElement('div');
    valueBottom.className = 'card-value';
    valueBottom.textContent = card.value;

    const suitBottom = document.createElement('div');
    suitBottom.className = 'card-suit';
    suitBottom.textContent = SUIT_SYMBOLS[card.suit];

    bottomElement.appendChild(valueBottom);
    bottomElement.appendChild(suitBottom);

    cardElement.appendChild(topElement);
    cardElement.appendChild(centerElement);
    cardElement.appendChild(bottomElement);

    if (isPlayerCard) {
        cardElement.addEventListener('click', () => selectHandCard(cardElement, card));
    } else {
        cardElement.addEventListener('click', () => selectTableCard(cardElement, card));
    }

    return cardElement;
}

function displayCardBack() {
    const cardBack = document.createElement('div');
    cardBack.className = 'card back';
    return cardBack;
}

function renderPlayerHand(player, containerElement, isVisible = true) {
    containerElement.innerHTML = '';
    player.hand.forEach(card => {
        if (isVisible) {
            const cardElement = createCardElement(card, true);
            containerElement.appendChild(cardElement);
        } else {
            containerElement.appendChild(displayCardBack());
        }
    });
}