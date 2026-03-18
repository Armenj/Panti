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
}

function renderTableCards() {
    elements.tableCards.innerHTML = '';
    gameState.tableCards.forEach(card => {
        const cardElement = createCardElement(card);
        elements.tableCards.appendChild(cardElement);
    });
}

function updateCollectedCount() {
    const playerCollectedCount = elements.playerCollected.querySelector('.collected-count');
    const opponentCollectedCount = elements.opponentCollected.querySelector('.collected-count');

    playerCollectedCount.textContent = gameState.players[0].collected.length;
    opponentCollectedCount.textContent = gameState.players[1].collected.length;
}

function updateDeckCount() {
    elements.deckCount.textContent = `Колода: ${gameState.deck.length}`;
}

// Selection Functions
function selectHandCard(cardElement, card) {
    // If game ended or not player's turn, do nothing
    if (gameState.gameEnded || gameState.currentPlayerIndex !== 0) return;

    // Clear previous selections
    clearHandCardSelection();

    // Select this card
    cardElement.classList.add('selected');
    gameState.selectedHandCard = card;

    // Check if this card can take any table cards
    checkIfCanTake();
}

function selectTableCard(cardElement, card) {
    // If game ended or not player's turn or no hand card selected, do nothing
    if (gameState.gameEnded || gameState.currentPlayerIndex !== 0 || !gameState.selectedHandCard) return;

    // Toggle selection
    if (cardElement.classList.contains('selected')) {
        cardElement.classList.remove('selected');
        gameState.selectedTableCards = gameState.selectedTableCards.filter(c =>
            !(c.suit === card.suit && c.value === card.value));
    } else {
        cardElement.classList.add('selected');
        gameState.selectedTableCards.push(card);
    }

    // Check if current selection is valid
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

    // Check if player can take any cards with selected hand card
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

    // Check if selection is valid according to game rules
    const isValid = isValidCardSelection(gameState.selectedHandCard, gameState.selectedTableCards);

    elements.confirmSelectionBtn.disabled = !isValid;
    if (!isValid) {
        elements.gameMessage.textContent = "Недопустимая комбинация карт";
    } else {
        elements.gameMessage.textContent = "Подтвердите свой выбор";
    }
}

// Game Logic Functions
function canTakeAnyCards(handCard, tableCards) {
    // Jack can take any card except Q and K
    if (handCard.value === 'J') {
        return tableCards.some(card => !['Q', 'K'].includes(card.value));
    }

    // Queen can only take another Queen
    if (handCard.value === 'Q') {
        return tableCards.some(card => card.value === 'Q');
    }

    // King can only take another King
    if (handCard.value === 'K') {
        return tableCards.some(card => card.value === 'K');
    }

    // For other cards, check if can form sum of 11
    return canFormSumEleven(handCard, tableCards);
}

function canFormSumEleven(handCard, tableCards) {
    // Check all possible combinations of table cards
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
    // Jack can take any card except Q and K
    if (handCard.value === 'J') {
        return selectedTableCards.every(card => !['Q', 'K'].includes(card.value));
    }

    // Queen can only take another Queen
    if (handCard.value === 'Q') {
        return selectedTableCards.length === 1 && selectedTableCards[0].value === 'Q';
    }

    // King can only take another King
    if (handCard.value === 'K') {
        return selectedTableCards.length === 1 && selectedTableCards[0].value === 'K';
    }

    // For other cards, check if forms sum of 11
    const tableSum = selectedTableCards.reduce((acc, card) => acc + card.numericValue, 0);
    return tableSum + handCard.numericValue === 11;
}

function takeCards(player, handCard, tableCards) {
    // Remove the hand card from player's hand
    player.hand = player.hand.filter(card =>
        !(card.suit === handCard.suit && card.value === handCard.value));

    // Remove the table cards from the table
    for (const card of tableCards) {
        gameState.tableCards = gameState.tableCards.filter(c =>
            !(c.suit === card.suit && c.value === card.value));
    }

    // Add all cards to player's collected pile
    player.collected.push(handCard, ...tableCards);

    // Set this player as the last who took cards
    gameState.lastPlayerWhoTook = player;

    // Draw a new card if deck is not empty
    if (gameState.deck.length > 0) {
        const newCard = drawCard(gameState.deck);
        if (newCard) player.hand.push(newCard);
    }

    updateDeckCount();
}

function discardCard(player, card) {
    // Remove the card from player's hand
    player.hand = player.hand.filter(c =>
        !(c.suit === card.suit && c.value === card.value));

    // Add the card to the table
    gameState.tableCards.push(card);

    // Draw a new card if deck is not empty
    if (gameState.deck.length > 0) {
        const newCard = drawCard(gameState.deck);
        if (newCard) player.hand.push(newCard);
    }

    updateDeckCount();
}

// Game Actions
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

    const player = gameState.players[gameState.currentPlayerIndex];
    discardCard(player, gameState.selectedHandCard);

    // Clear selections
    clearHandCardSelection();
    clearTableCardSelection();

    // Update UI
    renderPlayerHand(player, elements.playerCards);
    renderTableCards();

    // Next player's turn
    nextTurn();
}

function confirmSelection() {
    if (!gameState.selectedHandCard || gameState.selectedTableCards.length === 0) {
        elements.gameMessage.textContent = "Выберите карты";
        return;
    }

    const player = gameState.players[gameState.currentPlayerIndex];
    takeCards(player, gameState.selectedHandCard, gameState.selectedTableCards);

    // Clear selections
    clearHandCardSelection();
    clearTableCardSelection();

    // Update UI
    renderPlayerHand(player, elements.playerCards);
    renderTableCards();
    updateCollectedCount();

    // Next player's turn
    nextTurn();
}

function nextTurn() {
    // Check if game should end
    if (checkGameEnd()) {
        endGame();
        return;
    }

    // Switch to next player
    gameState.currentPlayerIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;

    // Update UI to show current player
    updateActivePlayerUI();

    // If next player is computer, make computer move
    if (gameState.gameMode === 'player-vs-computer' && gameState.currentPlayerIndex === 1) {
        setTimeout(() => {
            computerMove();
        }, 1000);
    }
}

function updateActivePlayerUI() {
    elements.playerArea.classList.toggle('active', gameState.currentPlayerIndex === 0);
    elements.opponentArea.classList.toggle('active', gameState.currentPlayerIndex === 1);

    // Enable/disable buttons
    const isPlayerTurn = gameState.currentPlayerIndex === 0;
    elements.takeBtn.disabled = !isPlayerTurn;
    elements.discardCardBtn.disabled = !isPlayerTurn;

    // Clear message
    elements.gameMessage.textContent = isPlayerTurn ? "Ваш ход" : "Ход соперника";
}

function computerMove() {
    const computer = gameState.players[1];

    // Try to take cards first
    let madeMove = false;

    for (const handCard of computer.hand) {
        // Check special cards first
        if (handCard.value === 'J') {
            // Find all non-Q, non-K cards
            const validCards = gameState.tableCards.filter(card => !['Q', 'K'].includes(card.value));
            if (validCards.length > 0) {
                takeCards(computer, handCard, validCards);
                madeMove = true;
                break;
            }
        } else if (handCard.value === 'Q') {
            // Find another Q
            const queens = gameState.tableCards.filter(card => card.value === 'Q');
            if (queens.length > 0) {
                takeCards(computer, handCard, [queens[0]]);
                madeMove = true;
                break;
            }
        } else if (handCard.value === 'K') {
            // Find another K
            const kings = gameState.tableCards.filter(card => card.value === 'K');
            if (kings.length > 0) {
                takeCards(computer, handCard, [kings[0]]);
                madeMove = true;
                break;
            }
        } else {
            // Try to find combinations that sum to 11
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

    // If can't take, discard
    if (!madeMove) {
        // Choose random card to discard
        const randomIndex = Math.floor(Math.random() * computer.hand.length);
        const cardToDiscard = computer.hand[randomIndex];
        discardCard(computer, cardToDiscard);
    }

    // Update UI
    renderPlayerHand(computer, elements.opponentCards, false);
    renderTableCards();
    updateCollectedCount();

    // Next turn
    nextTurn();
}

function checkGameEnd() {
    // Check if deck is empty and players have 1 or 0 cards
    return gameState.deck.length === 0 &&
           gameState.players.every(player => player.hand.length <= 1);
}

function endGame() {
    gameState.gameEnded = true;

    // Last player who took cards takes remaining table cards
    if (gameState.lastPlayerWhoTook && gameState.tableCards.length > 0) {
        gameState.lastPlayerWhoTook.collected.push(...gameState.tableCards);
        gameState.tableCards = [];
    }

    // Calculate scores
    calculateScores();

    // Display results
    displayResults();

    // Show results section
    showSection(gameSections.gameResults);
}

function calculateScores() {
    // Reset scores
    gameState.players.forEach(player => {
        player.score = 0;
        player.bonusPoints = 0;
    });

    // Find player with most cards
    const cardCounts = gameState.players.map(player => player.collected.length);
    const maxCards = Math.max(...cardCounts);

    if (cardCounts[0] > cardCounts[1]) {
        gameState.players[0].score += 2;
        gameState.players[0].bonusPoints += 2;
    } else if (cardCounts[1] > cardCounts[0]) {
        gameState.players[1].score += 2;
        gameState.players[1].bonusPoints += 2;
    }

    // Count clubs for each player
    const clubsCounts = gameState.players.map(player =>
        player.collected.filter(card => card.suit === 'clubs').length
    );

    if (clubsCounts[0] > clubsCounts[1]) {
        gameState.players[0].score += 1;
        gameState.players[0].bonusPoints += 1;
    } else if (clubsCounts[1] > clubsCounts[0]) {
        gameState.players[1].score += 1;
        gameState.players[1].bonusPoints += 1;
    }

    // Check for special cards
    gameState.players.forEach(player => {
        // Check for club 2
        if (player.collected.some(card => card.suit === 'clubs' && card.value === '2')) {
            player.score += 1;
            player.bonusPoints += 1;
            player.hasClub2 = true;
        } else {
            player.hasClub2 = false;
        }

        // Check for diamond 10
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
    // Player results
    document.getElementById('player-card-count').textContent = gameState.players[0].collected.length;
    document.getElementById('player-clubs-count').textContent = gameState.players[0].collected.filter(card => card.suit === 'clubs').length;
    document.getElementById('player-club2').textContent = gameState.players[0].hasClub2 ? "Да (+1)" : "Нет";
    document.getElementById('player-diamond10').textContent = gameState.players[0].hasDiamond10 ? "Да (+1)" : "Нет";
    document.getElementById('player-bonus').textContent = gameState.players[0].bonusPoints;
    document.getElementById('player-total-score').textContent = gameState.players[0].score;

    // Opponent results
    document.getElementById('opponent-card-count').textContent = gameState.players[1].collected.length;
    document.getElementById('opponent-clubs-count').textContent = gameState.players[1].collected.filter(card => card.suit === 'clubs').length;
    document.getElementById('opponent-club2').textContent = gameState.players[1].hasClub2 ? "Да (+1)" : "Нет";
    document.getElementById('opponent-diamond10').textContent = gameState.players[1].hasDiamond10 ? "Да (+1)" : "Нет";
    document.getElementById('opponent-bonus').textContent = gameState.players[1].bonusPoints;
    document.getElementById('opponent-total-score').textContent = gameState.players[1].score;

    // Winner
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
    // Get selected game mode
    const gameModeInputs = document.querySelectorAll('input[name="game-mode"]');
    for (const input of gameModeInputs) {
        if (input.checked) {
            gameState.gameMode = input.value;
            break;
        }
    }

    // For now, only implement player vs computer
    if (gameState.gameMode !== 'player-vs-computer') {
        alert('В данный момент доступен только режим "1 на 1 (против компьютера)". Другие режимы будут добавлены позже.');
        gameState.gameMode = 'player-vs-computer';
    }

    // Move to dealer selection
    showSection(gameSections.dealerSelection);
}

function drawDealerSelectionCards() {
    // Create a temporary deck for dealer selection
    const tempDeck = createDeck();
    shuffleDeck(tempDeck);

    // Draw one card for each player
    const playerCard = drawCard(tempDeck);
    const computerCard = drawCard(tempDeck);

    // Display the cards
    elements.dealerCards.innerHTML = '';
    elements.dealerCards.appendChild(createCardElement(playerCard));
    elements.dealerCards.appendChild(createCardElement(computerCard));

    // Determine dealer
    let dealerResult;
    if (playerCard.numericValue < computerCard.numericValue) {
        dealerResult = "Вы раздаёте!";
        gameState.dealerIndex = 0;
    } else if (computerCard.numericValue < playerCard.numericValue) {
        dealerResult = "Компьютер раздаёт!";
        gameState.dealerIndex = 1;
    } else {
        dealerResult = "Равные номиналы! Тянем снова.";
        gameState.dealerIndex = null;
    }

    elements.dealerResult.textContent = dealerResult;

    // If dealer determined, enable continue button
    if (gameState.dealerIndex !== null) {
        // Initialize full game
        initializeGame();

        // Move to initial deal question if player is dealer, otherwise skip to game board
        if (gameState.dealerIndex === 0) {
            setupInitialDealQuestion();
        } else {
            // Computer is dealer, automatically handle the deal
            computerInitialDeal();
        }
    }
}

function initializeGame() {
    // Create and shuffle deck
    gameState.deck = createDeck();
    shuffleDeck(gameState.deck);

    // Create players
    gameState.players = [
        { name: 'Вы', hand: [], collected: [], score: 0, bonusPoints: 0 },
        { name: 'Компьютер', hand: [], collected: [], score: 0, bonusPoints: 0 }
    ];

    // Deal 4 cards to each player
    for (const player of gameState.players) {
        player.hand = drawCards(gameState.deck, 4);
    }

    // Set first player (player to the left of dealer)
    gameState.currentPlayerIndex = (gameState.dealerIndex + 1) % 2;

    // Reset game state
    gameState.tableCards = [];
    gameState.lastPlayerWhoTook = null;
    gameState.selectedHandCard = null;
    gameState.selectedTableCards = [];
    gameState.gameEnded = false;

    // Update deck count
    updateDeckCount();
}

function setupInitialDealQuestion() {
    // Player is dealer, show initial deal question
    const initialCards = drawCards(gameState.deck, 4);

    // Display the cards
    elements.initialCards.innerHTML = '';
    initialCards.forEach(card => {
        elements.initialCards.appendChild(createCardElement(card));
    });

    // Store the cards temporarily
    gameState.initialCards = initialCards;

    // Show initial deal question section
    showSection(gameSections.initialDealQuestion);
}

function handleInitialDiscard() {
    // Place initial cards on table
    gameState.tableCards = [...gameState.initialCards];

    // Start the game
    startGameplay();
}

function handleInitialGive() {
    // Give cards to the player (always player 0)
    gameState.players[0].hand.push(...gameState.initialCards);

    // Draw 4 new cards for the table
    gameState.tableCards = drawCards(gameState.deck, 4);

    // Start the game
    startGameplay();
}

function computerInitialDeal() {
    // Computer is dealer
    const initialCards = drawCards(gameState.deck, 4);

    // Computer always discards (simple AI)
    gameState.tableCards = initialCards;

    // Start the game
    startGameplay();
}

function startGameplay() {
    // Show game board
    showSection(gameSections.gameBoard);

    // Render initial state
    renderPlayerHand(gameState.players[0], elements.playerCards);
    renderPlayerHand(gameState.players[1], elements.opponentCards, false);
    renderTableCards();
    updateCollectedCount();

    // Update UI for current player
    updateActivePlayerUI();

    // If computer goes first, make computer move
    if (gameState.currentPlayerIndex === 1) {
        setTimeout(() => {
            computerMove();
        }, 1000);
    }
}

// UI Helpers
function showSection(section) {
    // Hide all sections
    Object.values(gameSections).forEach(s => s.classList.add('hidden'));

    // Show the requested section
    section.classList.remove('hidden');
}

function showRules() {
    elements.modal.style.display = 'block';
}

function closeRules() {
    elements.modal.style.display = 'none';
}

function resetGame() {
    // Reset game state and UI
    showSection(gameSections.setup);

    // Clear all dynamic content
    elements.dealerCards.innerHTML = '';
    elements.dealerResult.textContent = '';
    elements.initialCards.innerHTML = '';
    elements.playerCards.innerHTML = '';
    elements.opponentCards.innerHTML = '';
    elements.tableCards.innerHTML = '';
    elements.gameMessage.textContent = '';

    // Reset collected counts
    const playerCollectedCount = elements.playerCollected.querySelector('.collected-count');
    const opponentCollectedCount = elements.opponentCollected.querySelector('.collected-count');
    playerCollectedCount.textContent = '0';
    opponentCollectedCount.textContent = '0';

    // Reset deck count
    elements.deckCount.textContent = 'Колода: 52';
};

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
    gameEnded: false
};

// DOM Elements
const gameSections = {
    setup: document.getElementById('game-setup'),
    dealerSelection: document.getElementById('dealer-selection'),
    initialDealQuestion: document.getElementById('initial-deal-question'),
    gameBoard: document.getElementById('game-board'),
    gameResults: document.getElementById('game-results')
};

const elements = {
    deckCount: document.getElementById('deck-count'),
    rulesBtn: document.getElementById('rules-btn'),
    restartBtn: document.getElementById('restart-btn'),
    startGameBtn: document.getElementById('start-game-btn'),
    drawCardsBtn: document.getElementById('draw-cards-btn'),
    dealerCards: document.querySelector('.dealer-cards'),
    dealerResult: document.getElementById('dealer-result'),
    initialCards: document.querySelector('.initial-cards'),
    discardBtn: document.getElementById('discard-btn'),
    giveBtn: document.getElementById('give-btn'),
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
    closeModal: document.querySelector('.close')
};

// Event Listeners Setup
function setupEventListeners() {
    // Game setup
    elements.startGameBtn.addEventListener('click', startGame);
    elements.drawCardsBtn.addEventListener('click', drawDealerSelectionCards);
    elements.discardBtn.addEventListener('click', handleInitialDiscard);
    elements.giveBtn.addEventListener('click', handleInitialGive);

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