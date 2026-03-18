// Initialize the game
document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
});

// Game Constants and Global Variables
const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
const VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUIT_SYMBOLS = {
    'hearts': '♥',
    'diamonds': '♦',
    'clubs': '♣',
    'spades': '♠'
};

// Special cards
const SPECIAL_CARDS = {
    club2: { suit: 'clubs', value: '2' },
    diamond10: { suit: 'diamonds', value: '10' }
};

// Элементы UI
const gameSections = {
    setup: document.getElementById('game-setup'),
    gameBoard: document.getElementById('game-board'),
    gameResults: document.getElementById('game-results')
};

const elements = {
    // Game info
    deckCount: document.getElementById('deck-count'),
    rulesBtn: document.getElementById('rules-btn'),
    restartBtn: document.getElementById('restart-btn'),

    // Game setup
    startGameBtn: document.getElementById('start-game-btn'),

    // Player areas
    playerArea: document.getElementById('player-area'),
    playerName: document.getElementById('player-name'),
    playerCards: document.getElementById('player-cards'),
    playerCollected: document.getElementById('player-collected'),

    opponentArea: document.getElementById('opponent-area'),
    opponentName: document.getElementById('opponent-name'),
    opponentCards: document.getElementById('opponent-cards'),
    opponentCollected: document.getElementById('opponent-collected'),

    leftPlayerArea: document.getElementById('left-player-area'),
    leftPlayerName: document.getElementById('left-player-name'),
    leftPlayerCards: document.getElementById('left-player-cards'),
    leftPlayerCollected: document.getElementById('left-player-collected'),

    rightPlayerArea: document.getElementById('right-player-area'),
    rightPlayerName: document.getElementById('right-player-name'),
    rightPlayerCards: document.getElementById('right-player-cards'),
    rightPlayerCollected: document.getElementById('right-player-collected'),

    // Game table
    tableCards: document.getElementById('table-cards'),
    deck: document.getElementById('deck'),
    lastTaken: document.getElementById('last-taken'),
    lastTakenCards: document.querySelector('.last-taken-cards'),
    lastTakenBy: document.querySelector('.last-taken-by'),

    // Game controls
    takeBtn: document.getElementById('take-btn'),
    discardCardBtn: document.getElementById('discard-card-btn'),
    confirmSelectionBtn: document.getElementById('confirm-selection-btn'),
    gameMessage: document.getElementById('game-message'),

    // Results
    newGameBtn: document.getElementById('new-game-btn'),
    modal: document.getElementById('rules-modal'),
    closeModal: document.querySelector('.close')
};

// Состояние игры
let gameState = {
    deck: [],
    tableCards: [],
    players: [],
    currentPlayerIndex: 0,
    gameMode: 'player-vs-computer',
    lastPlayerWhoTook: null,
    selectedHandCard: null,
    selectedTableCards: [],
    gameEnded: false,
    lastTakenCards: null,
    lastTakenBy: null
};

// Event Listeners Setup
function setupEventListeners() {
    // Game setup
    elements.startGameBtn.addEventListener('click', startGame);

    // Game controls
    elements.takeBtn.addEventListener('click', handleTakeAction);
    elements.discardCardBtn.addEventListener('click', handleDiscardAction);
    elements.confirmSelectionBtn.addEventListener('click', confirmSelection);

    // UI controls
    elements.rulesBtn.addEventListener('click', showRules);
    elements.closeModal.addEventListener('click', closeRules);
    elements.restartBtn.addEventListener('click', resetGame);
    elements.newGameBtn.addEventListener('click', resetGame);

    // Modal click outside
    window.addEventListener('click', (event) => {
        if (event.target === elements.modal) {
            closeRules();
        }
    });
}

// Render Functions
function renderTableCards() {
    elements.tableCards.innerHTML = '';
    gameState.tableCards.forEach(card => {
        const cardElement = createCardElement(card);
        elements.tableCards.appendChild(cardElement);
    });
}

function updateCollectedCount() {
    // Обновление счетчиков собранных карт для всех игроков
    for (let i = 0; i < gameState.players.length; i++) {
        let collectedElement;

        switch(i) {
            case 0:
                collectedElement = elements.playerCollected.querySelector('.collected-count');
                break;
            case 1:
                collectedElement = elements.opponentCollected.querySelector('.collected-count');
                break;
            case 2:
                if (elements.leftPlayerCollected) {
                    collectedElement = elements.leftPlayerCollected.querySelector('.collected-count');
                }
                break;
            case 3:
                if (elements.rightPlayerCollected) {
                    collectedElement = elements.rightPlayerCollected.querySelector('.collected-count');
                }
                break;
        }

        if (collectedElement && gameState.players[i]) {
            collectedElement.textContent = gameState.players[i].collected.length;
        }
    }
}

function updateDeckCount() {
    elements.deckCount.textContent = `Колода: ${gameState.deck.length}`;
}

function showLastTaken(player, handCard, tableCards) {
    // Отображаем последнюю взятку
    elements.lastTaken.classList.remove('hidden');
    elements.lastTakenCards.innerHTML = '';

    // Добавляем карту из руки
    elements.lastTakenCards.appendChild(createCardElement(handCard, false, false));

    // Добавляем взятые карты со стола
    tableCards.forEach(card => {
        elements.lastTakenCards.appendChild(createCardElement(card, false, false));
    });

    // Указываем, кто взял
    elements.lastTakenBy.textContent = `Взял: ${player.name}`;

    // Сохраняем в состоянии игры
    gameState.lastTakenCards = [handCard, ...tableCards];
    gameState.lastTakenBy = player;
}

// Selection Functions
function selectHandCard(cardElement, card) {
    // Если игра окончена или не ход игрока, ничего не делаем
    if (gameState.gameEnded || gameState.currentPlayerIndex !== 0) return;

    // Убираем предыдущие выделения
    clearHandCardSelection();
    clearTableCardSelection();

    // Выделяем эту карту
    cardElement.classList.add('selected');
    gameState.selectedHandCard = card;

    // Проверяем, может ли эта карта взять какие-либо карты на столе
    checkIfCanTake();
}

function selectTableCard(cardElement, card) {
    // Если игра окончена, не ход игрока, или не выбрана карта из руки, ничего не делаем
    if (gameState.gameEnded || gameState.currentPlayerIndex !== 0 || !gameState.selectedHandCard) return;

    // Переключаем выделение
    if (cardElement.classList.contains('selected')) {
        cardElement.classList.remove('selected');
        gameState.selectedTableCards = gameState.selectedTableCards.filter(c =>
            !(c.suit === card.suit && c.value === card.value));
    } else {
        cardElement.classList.add('selected');
        gameState.selectedTableCards.push(card);
    }

    // Проверяем, валидно ли текущее выделение
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

    // Проверяем, может ли игрок взять какие-либо карты выбранной картой из руки
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

    // Проверяем, валидно ли выделение согласно правилам игры
    const isValid = isValidCardSelection(gameState.selectedHandCard, gameState.selectedTableCards);

    elements.confirmSelectionBtn.disabled = !isValid;
    if (!isValid) {
        elements.gameMessage.textContent = "Недопустимая комбинация карт";
    } else {
        elements.gameMessage.textContent = "Подтвердите свой выбор";
    }

    console.log("Выбранная карта из руки:", gameState.selectedHandCard);
    console.log("Выбранные карты со стола:", gameState.selectedTableCards);
    console.log("Валидная комбинация:", isValid);
}

// Game Logic Functions
function canTakeAnyCards(handCard, tableCards) {
    // Валет может взять любую карту, кроме дам и королей
    if (handCard.value === 'J') {
        return tableCards.some(card => !['Q', 'K'].includes(card.value));
    }

    // Дама может взять только другую даму
    if (handCard.value === 'Q') {
        return tableCards.some(card => card.value === 'Q');
    }

    // Король может взять только другого короля
    if (handCard.value === 'K') {
        return tableCards.some(card => card.value === 'K');
    }

    // Для остальных карт проверяем возможность формирования суммы 11
    return canFormSumEleven(handCard, tableCards);
}

function canFormSumEleven(handCard, tableCards) {
    // Проверяем все возможные комбинации карт на столе
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
    // Валет может взять любую карту, кроме дам и королей
    if (handCard.value === 'J') {
        return selectedTableCards.every(card => !['Q', 'K'].includes(card.value));
    }

    // Дама может взять только другую даму
    if (handCard.value === 'Q') {
        return selectedTableCards.length === 1 && selectedTableCards[0].value === 'Q';
    }

    // Король может взять только другого короля
    if (handCard.value === 'K') {
        return selectedTableCards.length === 1 && selectedTableCards[0].value === 'K';
    }

    // Для остальных карт проверяем, формируется ли сумма 11
    const tableSum = selectedTableCards.reduce((acc, card) => acc + card.numericValue, 0);
    return tableSum + handCard.numericValue === 11;
}

function takeCards(player, handCard, tableCards) {
    // Удаляем карту из руки игрока
    player.hand = player.hand.filter(card =>
        !(card.suit === handCard.suit && card.value === handCard.value));

    // Удаляем карты со стола
    for (const card of tableCards) {
        gameState.tableCards = gameState.tableCards.filter(c =>
            !(c.suit === card.suit && c.value === card.value));
    }

    // Добавляем все карты в собранные игроком
    player.collected.push(handCard, ...tableCards);

    // Устанавливаем этого игрока как последнего, кто взял карты
    gameState.lastPlayerWhoTook = player;

    // Показываем последнюю взятку
    showLastTaken(player, handCard, tableCards);

    // Берем новую карту, если колода не пуста
    if (gameState.deck.length > 0) {
        const newCard = drawCard(gameState.deck);
        if (newCard) player.hand.push(newCard);
    }

    updateDeckCount();
}

function discardCard(player, card) {
    // Удаляем карту из руки игрока
    player.hand = player.hand.filter(c =>
        !(c.suit === card.suit && c.value === card.value));

    // Добавляем карту на стол
    gameState.tableCards.push(card);

    // Берем новую карту, если колода не пуста
    if (gameState.deck.length > 0) {
        const newCard = drawCard(gameState.deck);
        if (newCard) player.hand.push(newCard);
    }

    updateDeckCount();
}

// Game Actions
function handleTakeAction() {
    if (!gameState.selectedHandCard) {
        elements.gameMessage.textContent = "Сначала выберите карту из руки";
        return;
    }

    elements.gameMessage.textContent = "Выберите карты, которые хотите взять со стола";
    elements.discardCardBtn.disabled = true;
    elements.confirmSelectionBtn.disabled = false;
}

function handleDiscardAction() {
    if (!gameState.selectedHandCard) {
        elements.gameMessage.textContent = "Сначала выберите карту из руки";
        return;
    }

    const player = gameState.players[gameState.currentPlayerIndex];
    discardCard(player, gameState.selectedHandCard);

    // Очищаем выделения
    clearHandCardSelection();
    clearTableCardSelection();

    // Обновляем UI
    renderPlayerHand(player, elements.playerCards, true);
    renderTableCards();

    // Ход следующего игрока
    nextTurn();
}

function confirmSelection() {
    if (!gameState.selectedHandCard || gameState.selectedTableCards.length === 0) {
        elements.gameMessage.textContent = "Выберите карты";
        return;
    }

    const player = gameState.players[gameState.currentPlayerIndex];
    takeCards(player, gameState.selectedHandCard, gameState.selectedTableCards);

    // Очищаем выделения
    clearHandCardSelection();
    clearTableCardSelection();

    // Обновляем UI
    renderPlayerHand(player, elements.playerCards, true);
    renderTableCards();
    updateCollectedCount();

    // Ход следующего игрока
    nextTurn();
}

function nextTurn() {
    // Проверяем, должна ли игра закончиться
    if (checkGameEnd()) {
        endGame();
        return;
    }

    // Переключаемся на следующего игрока
    gameState.currentPlayerIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;

    // Обновляем UI для отображения текущего игрока
    updateActivePlayerUI();

    // Если следующий игрок - компьютер, делаем ход компьютера
    if (gameState.gameMode === 'player-vs-computer' && gameState.currentPlayerIndex === 1) {
        setTimeout(() => {
            computerMove();
        }, 1000);
    }
}

function updateActivePlayerUI() {
    // Сначала сбрасываем активность у всех игроков
    const playerAreas = [elements.playerArea, elements.opponentArea, elements.leftPlayerArea, elements.rightPlayerArea];
    playerAreas.forEach(area => {
        if (area) area.classList.remove('active');
    });

    // Активируем текущего игрока
    switch(gameState.currentPlayerIndex) {
        case 0:
            elements.playerArea.classList.add('active');
            break;
        case 1:
            elements.opponentArea.classList.add('active');
            break;
        case 2:
            if (elements.leftPlayerArea) elements.leftPlayerArea.classList.add('active');
            break;
        case 3:
            if (elements.rightPlayerArea) elements.rightPlayerArea.classList.add('active');
            break;
    }

    // Включаем/отключаем кнопки
    const isPlayerTurn = gameState.currentPlayerIndex === 0;
    elements.takeBtn.disabled = !isPlayerTurn;
    elements.discardCardBtn.disabled = !isPlayerTurn;

    // Очищаем сообщение
    elements.gameMessage.textContent = isPlayerTurn ? "Ваш ход" : `Ход игрока: ${gameState.players[gameState.currentPlayerIndex].name}`;
}

function computerMove() {
    const computer = gameState.players[1];

    // Сначала пытаемся взять карты
    let madeMove = false;

    for (const handCard of computer.hand) {
        // Сначала проверяем специальные карты
        if (handCard.value === 'J') {
            // Ищем все карты кроме Q и K
            const validCards = gameState.tableCards.filter(card => !['Q', 'K'].includes(card.value));
            if (validCards.length > 0) {
                takeCards(computer, handCard, validCards);
                madeMove = true;
                break;
            }
        } else if (handCard.value === 'Q') {
            // Ищем другую Q
            const queens = gameState.tableCards.filter(card => card.value === 'Q');
            if (queens.length > 0) {
                takeCards(computer, handCard, [queens[0]]);
                madeMove = true;
                break;
            }
        } else if (handCard.value === 'K') {
            // Ищем другого K
            const kings = gameState.tableCards.filter(card => card.value === 'K');
            if (kings.length > 0) {
                takeCards(computer, handCard, [kings[0]]);
                madeMove = true;
                break;
            }
        } else {
            // Пытаемся найти комбинации, которые дают в сумме 11
            for (let i = 1; i <= gameState.tableCards.length; i++) {
                const combinations = getCombinations(gameState.tableCards, i);
                for (const combo of combinations) {
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

    // Если не можем взять - сбрасываем
    if (!madeMove) {
        // Выбираем случайную карту для сброса
        const randomIndex = Math.floor(Math.random() * computer.hand.length);
        const cardToDiscard = computer.hand[randomIndex];
        discardCard(computer, cardToDiscard);
    }

    // Обновляем UI
    renderPlayerHand(computer, elements.opponentCards, false);
    renderTableCards();
    updateCollectedCount();

    // Следующий ход
    nextTurn();
}

function checkGameEnd() {
    // Проверяем, пуста ли колода и у игроков 1 или 0 карт
    return gameState.deck.length === 0 &&
           gameState.players.every(player => player.hand.length <= 1);
}

function endGame() {
    gameState.gameEnded = true;

    // Последний игрок, который взял карты, забирает оставшиеся карты на столе
    if (gameState.lastPlayerWhoTook && gameState.tableCards.length > 0) {
        gameState.lastPlayerWhoTook.collected.push(...gameState.tableCards);
        gameState.tableCards = [];
    }

    // Подсчитываем очки
    calculateScores();

    // Отображаем результаты
    displayResults();

    // Показываем секцию результатов
    showSection(gameSections.gameResults);
}

function calculateScores() {
    // Сбрасываем очки
    gameState.players.forEach(player => {
        player.score = 0;
        player.bonusPoints = 0;
    });

    // Находим игрока с наибольшим количеством карт
    const cardCounts = gameState.players.map(player => player.collected.length);
    const maxCards = Math.max(...cardCounts);

    // Проверяем наличие ничьей
    const playersWithMaxCards = gameState.players.filter(player => player.collected.length === maxCards);

    if (playersWithMaxCards.length === 1) {
        // Если один игрок имеет больше всего карт
        const winnerIndex = gameState.players.findIndex(player => player.collected.length === maxCards);
        gameState.players[winnerIndex].score += 2;
        gameState.players[winnerIndex].bonusPoints += 2;
    }

    // Подсчет крестовых карт для каждого игрока
    const clubsCounts = gameState.players.map(player =>
        player.collected.filter(card => card.suit === 'clubs').length
    );

    const maxClubs = Math.max(...clubsCounts);
    const playersWithMaxClubs = gameState.players.filter((player, index) => clubsCounts[index] === maxClubs);

    if (playersWithMaxClubs.length === 1) {
        // Если один игрок имеет больше всего крестей
        const winnerIndex = gameState.players.findIndex((player, index) => clubsCounts[index] === maxClubs);
        gameState.players[winnerIndex].score += 1;
        gameState.players[winnerIndex].bonusPoints += 1;
    }

    // Проверяем наличие специальных карт
    gameState.players.forEach(player => {
        // Проверяем наличие крестовой двойки
        if (player.collected.some(card => card.suit === 'clubs' && card.value === '2')) {
            player.score += 1;
            player.bonusPoints += 1;
            player.hasClub2 = true;
        } else {
            player.hasClub2 = false;
        }

        // Проверяем наличие бубновой десятки
        if (player.collected.some(card => card.suit === 'diamonds' && card.value === '10')) {
            player.score += 1;
            player.bonusPoints += 1;
            player.hasDiamond10 = true;
        } else {
            player.hasDiamond10 = false;
        }
    });

    // Проверяем общее количество карт (должно быть 52)
    const totalCards = gameState.players.reduce((sum, player) => sum + player.collected.length, 0) +
                        gameState.tableCards.length +
                        gameState.players.reduce((sum, player) => sum + player.hand.length, 0) +
                        gameState.deck.length;

    console.log(`Всего карт в игре: ${totalCards}`);
}

function displayResults() {
    // Результаты игрока
    document.getElementById('player-card-count').textContent = gameState.players[0].collected.length;
    document.getElementById('player-clubs-count').textContent = gameState.players[0].collected.filter(card => card.suit === 'clubs').length;
    document.getElementById('player-club2').textContent = gameState.players[0].hasClub2 ? "Да (+1)" : "Нет";
    document.getElementById('player-diamond10').textContent = gameState.players[0].hasDiamond10 ? "Да (+1)" : "Нет";
    document.getElementById('player-bonus').textContent = gameState.players[0].bonusPoints;
    document.getElementById('player-total-score').textContent = gameState.players[0].score;

    // Результаты соперника
    document.getElementById('opponent-card-count').textContent = gameState.players[1].collected.length;
    document.getElementById('opponent-clubs-count').textContent = gameState.players[1].collected.filter(card => card.suit === 'clubs').length;
    document.getElementById('opponent-club2').textContent = gameState.players[1].hasClub2 ? "Да (+1)" : "Нет";
    document.getElementById('opponent-diamond10').textContent = gameState.players[1].hasDiamond10 ? "Да (+1)" : "Нет";
    document.getElementById('opponent-bonus').textContent = gameState.players[1].bonusPoints;
    document.getElementById('opponent-total-score').textContent = gameState.players[1].score;

    // Победитель
    const winnerMessage = document.getElementById('game-winner');
    if (gameState.players[0].score > gameState.players[1].score) {
        winnerMessage.textContent = "Вы победили! 🎉";
    } else if (gameState.players[1].score > gameState.players[0].score) {
        winnerMessage.textContent = "Компьютер победил!";
    } else {
        winnerMessage.textContent = "Ничья!";
    }
}

// Game Setup Functions
function startGame() {
    // Получаем выбранный режим игры
    const gameModeInputs = document.querySelectorAll('input[name="game-mode"]');
    for (const input of gameModeInputs) {
        if (input.checked) {
            gameState.gameMode = input.value;
            break;
        }
    }

    // Пока реализуем только игру против компьютера
    if (gameState.gameMode !== 'player-vs-computer') {
        alert('В данный момент доступен только режим "1 на 1 (против компьютера)". Другие режимы будут добавлены позже.');
        gameState.gameMode = 'player-vs-computer';
    }

    // Инициализируем игру
    initializeGame();

    // Переходим к игре
    showSection(gameSections.gameBoard);
}

function initializeGame() {
    // Создаем и перемешиваем колоду
    gameState.deck = createDeck();
    shuffleDeck(gameState.deck);

    // Создаем игроков
    gameState.players = [
        { name: 'Вы', hand: [], collected: [], score: 0, bonusPoints: 0 },
        { name: 'Компьютер', hand: [], collected: [], score: 0, bonusPoints: 0 }
    ];

    // Раздаем по 4 карты каждому игроку
    for (const player of gameState.players) {
        player.hand = drawCards(gameState.deck, 4);
    }

    // Выкладываем 4 карты на стол
    gameState.tableCards = drawCards(gameState.deck, 4);

    // Устанавливаем первого игрока (всегда человек)
    gameState.currentPlayerIndex = 0;

    // Сбрасываем состояние игры
    gameState.lastPlayerWhoTook = null;
    gameState.selectedHandCard = null;
    gameState.selectedTableCards = [];
    gameState.gameEnded = false;
    gameState.lastTakenCards = null;
    gameState.lastTakenBy = null;

    // Обновляем счетчик колоды
    updateDeckCount();

    // Начинаем игру
    startGameplay();
}

function startGameplay() {
    // Отображаем начальное состояние
    renderPlayerHand(gameState.players[0], elements.playerCards, true);
    renderPlayerHand(gameState.players[1], elements.opponentCards, false);
    renderTableCards();
    updateCollectedCount();

    // Обновляем UI для текущего игрока
    updateActivePlayerUI();
}

// UI Helpers
function showSection(section) {
    // Скрываем все секции
    Object.values(gameSections).forEach(s => s.classList.add('hidden'));

    // Показываем запрошенную секцию
    section.classList.remove('hidden');
}

function showRules() {
    elements.modal.style.display = 'block';
}

function closeRules() {
    elements.modal.style.display = 'none';
}

function resetGame() {
    // Сбрасываем состояние игры и UI
    showSection(gameSections.setup);

    // Очищаем весь динамический контент
    elements.playerCards.innerHTML = '';
    elements.opponentCards.innerHTML = '';
    elements.tableCards.innerHTML = '';
    elements.gameMessage.textContent = '';

    // Сбрасываем счетчики собранных карт
    const playerCollectedCount = elements.playerCollected.querySelector('.collected-count');
    const opponentCollectedCount = elements.opponentCollected.querySelector('.collected-count');
    playerCollectedCount.textContent = '0';
    opponentCollectedCount.textContent = '0';

    // Сбрасываем счетчик колоды
    elements.deckCount.textContent = 'Колода: 52';

    // Скрываем последнюю взятку
    elements.lastTaken.classList.add('hidden');
}

// Card Creation and Deck Functions
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

    // Проверяем, что колода содержит ровно 52 карты
    if (deck.length !== 52) {
        console.error(`Ошибка: в колоде ${deck.length} карт вместо 52!`);
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
    for (let i = 0; i < count; i++) {
        const card = drawCard(deck);
        if (card) cards.push(card);
    }
    return cards;
}

// Card Display Functions
function createCardElement(card, isPlayerCard = false, addEventListeners = true) {
    const cardElement = document.createElement('div');
    cardElement.className = `card ${card.suit}`;

    // Добавляем ID карты для отладки
    cardElement.dataset.cardId = `${card.suit}-${card.value}`;

    // Подсветка особых карт (только для карт игрока)
    if (isPlayerCard) {
        if (card.suit === SPECIAL_CARDS.club2.suit && card.value === SPECIAL_CARDS.club2.value) {
            cardElement.classList.add('club2-highlight');
        }
        if (card.suit === SPECIAL_CARDS.diamond10.suit && card.value === SPECIAL_CARDS.diamond10.value) {
            cardElement.classList.add('diamond10-highlight');
        }
    }

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

    if (addEventListeners) {
        if (isPlayerCard) {
            cardElement.addEventListener('click', () => selectHandCard(cardElement, card));
        } else {
            cardElement.addEventListener('click', () => selectTableCard(cardElement, card));
        }
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