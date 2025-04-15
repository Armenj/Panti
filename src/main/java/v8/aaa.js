function checkWebsocketConnection() {
	// Проверяем доступность socket.io
	if (typeof io === 'undefined') {
		console.error('Socket.io не загружен. Возможно, сервер не запущен или недоступен.');
		showNotification('Не удалось подключиться к серверу игры. Мультиплеер недоступен.', 'error');

		// Отключаем мультиплеер элементы
		const multiplayerSection = document.querySelector('.multiplayer-section');
		if (multiplayerSection) {
			multiplayerSection.style.opacity = '0.5';
			multiplayerSection.style.pointerEvents = 'none';

			const disabledMessage = document.createElement('div');
			disabledMessage.textContent = 'Мультиплеер временно недоступен';
			disabledMessage.style.textAlign = 'center';
			disabledMessage.style.color = 'red';
			disabledMessage.style.fontWeight = 'bold';
			disabledMessage.style.margin = '15px 0';

			multiplayerSection.insertBefore(disabledMessage, multiplayerSection.firstChild);
		}

		// Создаем фиктивный gameClient, если он не существует
		if (typeof gameClient === 'undefined') {
			console.warn('Создаем фиктивный gameClient');
			window.gameClient = {
				onRoomCreated: function() {},
				onRoomJoined: function() {},
				onGameStart: function() {},
				onGameUpdate: function() {},
				onPlayerDisconnected: function() {},
				onError: function() {},
				isMyTurn: function() {
					return false;
				}
			};
		}
	}
}

// Добавляем в начало файла main.js
function forceFixedTableSize() {
	const gameTable = document.querySelector('.game-table');
	const tableCards = document.querySelector('.table-cards');

	if (gameTable && tableCards) {
		// Устанавливаем фиксированные размеры стола
		gameTable.style.height = '300px';
		gameTable.style.minHeight = '300px';

		// Наблюдаем за изменениями в контейнере карт на столе
		const observer = new MutationObserver(function() {
			// При любых изменениях в контейнере карт, перезадаем фиксированные размеры
			gameTable.style.height = '300px';
			gameTable.style.minHeight = '300px';

			// Форсируем минимальную высоту контейнера карт
			if (tableCards.childElementCount === 0 || tableCards.childElementCount === 1) {
				tableCards.style.minHeight = '200px';
			}
		});

		// Следим за добавлением и удалением дочерних элементов
		observer.observe(tableCards, {
			childList: true,
			subtree: false
		});
	}
}

// Функция для обработки адаптивности на мобильных устройствах
function setupResponsiveLayout() {
	// Решение проблемы с масштабированием на мобильных устройствах
	document.addEventListener('touchmove', function(event) {
		if (event.scale !== 1) {
			event.preventDefault();
		}
	}, {
		passive: false
	});

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

			tableObserver.observe(tableCards, {
				childList: true
			});
			playerObserver.observe(playerCards, {
				childList: true
			});
		}
	};

	// Запускаем наблюдение после полной загрузки игры
	setTimeout(observeCardAddition, 1000);
}

// Initialize the game
document.addEventListener('DOMContentLoaded', function() {
	checkWebsocketConnection(); // <-- Добавьте эту строку
	setupEventListeners();
	setupGameStateMonitoring();
	setupMultiplayerListeners();
	forceFixedTableSize(); // Добавьте эту строку

	// Также добавьте обработчик изменения размера окна
	window.addEventListener('resize', forceFixedTableSize);

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
	playerIndex: null, // Индекс текущего игрока в онлайн-игре
	// Добавляем новые поля для поддержки игры до 21 очка
	totalScores: [0, 0], // Общий счет [игрок, компьютер]
	targetScore: 21, // Целевое количество очков для победы
	roundNumber: 1 // Номер текущего раунда
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
	// Удален takeBtn, так как его нет в HTML
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
    console.log("Получено событие game-start", newGameState);

    // Обновляем локальное состояние игры
    updateGameStateFromServer(newGameState);

    // Важная проверка - если мы уже на игровом поле, не выполняем повторную инициализацию
    if (gameSections.gameBoard && !gameSections.gameBoard.classList.contains('hidden')) {
        console.log("Мы уже на игровом поле, обновляем только состояние");
        renderGameState();
        updateActivePlayerUI();
        return;
    }

    // Скрываем экран настройки и показываем игровое поле
    showSection(gameSections.gameBoard);

    // Обновляем имена игроков
    updatePlayerNames();

    // Инициализируем UI
    renderGameState();

    // Инициализация игрового процесса
    updateActivePlayerUI();

    // Скрываем информацию о комнате, если она отображается
    if (elements.roomInfo) {
        elements.roomInfo.classList.add('hidden');
    }

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

    // Обновляем информацию о раунде и общем счете
    updateRoundAndScoreInfo();
}

// Новая функция для отображения информации о раунде и счете
function updateRoundAndScoreInfo() {
    // Проверяем, существует ли элемент для отображения раунда
    let roundIndicator = document.querySelector('.round-indicator');
    if (!roundIndicator) {
        // Если элемента нет, создаем его
        roundIndicator = document.createElement('div');
        roundIndicator.className = 'round-indicator';

        // Добавляем его в игровой стол
        const gameTable = document.querySelector('.game-table');
        if (gameTable) {
            gameTable.appendChild(roundIndicator);
        }
    }

    // Обновляем текст индикатора раунда
    roundIndicator.textContent = `Раунд ${gameState.roundNumber}`;

    // Проверяем, существует ли элемент для отображения счета
    let scoreDisplay = document.querySelector('.game-score-display');
    if (!scoreDisplay) {
        // Если элемента нет, создаем его
        scoreDisplay = document.createElement('div');
        scoreDisplay.className = 'game-score-display';

        // Создаем структуру для отображения счета
        scoreDisplay.innerHTML = `
            <div class="score-title">Общий счёт:</div>
            <div class="score-value">
                <span>Вы: <strong id="player-total-score-display">0</strong></span>
                <span>Компьютер: <strong id="opponent-total-score-display">0</strong></span>
            </div>
        `;

        // Добавляем его в игровой стол
        const gameTable = document.querySelector('.game-table');
        if (gameTable) {
            gameTable.appendChild(scoreDisplay);
        }
    }

    // Обновляем значения общего счета
    const playerScoreElement = document.getElementById('player-total-score-display');
    const opponentScoreElement = document.getElementById('opponent-total-score-display');

    if (playerScoreElement && opponentScoreElement) {
        if (gameState.isOnlineGame) {
            const myPlayerIndex = gameState.playerIndex;
            const opponentIndex = myPlayerIndex === 0 ? 1 : 0;

            playerScoreElement.textContent = gameState.totalScores[myPlayerIndex];
            opponentScoreElement.textContent = gameState.totalScores[opponentIndex];
        } else {
            playerScoreElement.textContent = gameState.totalScores[0];
            opponentScoreElement.textContent = gameState.totalScores[1];
        }
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
	// Было: elements.takeBtn.disabled = true;
	// Теперь нет такого элемента, поэтому:
	if (elements.confirmSelectionBtn) elements.confirmSelectionBtn.disabled = true;
}

function clearTableCardSelection() {
	const tableCards = elements.tableCards.querySelectorAll('.card');
	tableCards.forEach(card => card.classList.remove('selected'));
	gameState.selectedTableCards = [];
	elements.confirmSelectionBtn.disabled = true;
}

function checkIfCanTake() {
	if (!gameState.selectedHandCard || gameState.tableCards.length === 0) {
		// Раньше здесь было: elements.takeBtn.disabled = true;
		// Вместо этого обновляем статус кнопки подтверждения:
		if (elements.confirmSelectionBtn) elements.confirmSelectionBtn.disabled = true;
		return;
	}

	// Проверить, может ли игрок взять любые карты выбранной картой руки
	const canTake = canTakeAnyCards(gameState.selectedHandCard, gameState.tableCards);

	// Раньше было: elements.takeBtn.disabled = !canTake;
	// Теперь используем:
	if (elements.gameMessage) {
		if (!canTake) {
			elements.gameMessage.textContent = "Этой картой нельзя взять карты со стола";
		} else {
			elements.gameMessage.textContent = "Выберите карты, которые хотите взять";
		}
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
	if (elements.gameMessage) elements.gameMessage.textContent = "Выберите карты, которые хотите взять со стола";
	if (elements.discardCardBtn) elements.discardCardBtn.disabled = true;
	if (elements.confirmSelectionBtn) elements.confirmSelectionBtn.disabled = false;
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
		if (elements.playerArea) elements.playerArea.classList.toggle('active', isMyTurn);
		if (elements.opponentArea) elements.opponentArea.classList.toggle('active', !isMyTurn);

		// Включить/отключить кнопки
		if (elements.discardCardBtn) elements.discardCardBtn.disabled = !isMyTurn;
		if (elements.confirmSelectionBtn) elements.confirmSelectionBtn.disabled = true; // По умолчанию отключена до выбора карт

		// Обновить сообщение
		if (elements.gameMessage) elements.gameMessage.textContent = isMyTurn ? "Ваш ход" : "Ход соперника";
	} else {
		// В локальной игре
		if (elements.playerArea) elements.playerArea.classList.toggle('active', gameState.currentPlayerIndex === 0);
		if (elements.opponentArea) elements.opponentArea.classList.toggle('active', gameState.currentPlayerIndex === 1);

		// Включить/отключить кнопки
		const isPlayerTurn = gameState.currentPlayerIndex === 0;
		if (elements.discardCardBtn) elements.discardCardBtn.disabled = !isPlayerTurn;
		if (elements.confirmSelectionBtn) elements.confirmSelectionBtn.disabled = true; // По умолчанию отключена

		// Очистить сообщение
		if (elements.gameMessage) elements.gameMessage.textContent = isPlayerTurn ? "Ваш ход" : "Ход соперника";
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

// Улучшенная функция для хода компьютера, с приоритетами выбора карт
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

    // Флаг, указывающий на то, что ход сделан
    let madeMove = false;

    try {
        // 1. Проверка наличия счастливых карт на столе (двойка крести и десятка бубны)
        const luckyCards = gameState.tableCards.filter(card =>
            (card.suit === 'clubs' && card.value === '2') ||
            (card.suit === 'diamonds' && card.value === '10')
        );

        if (luckyCards.length > 0) {
            console.log("На столе есть счастливые карты, пытаемся взять их");

            // Перебираем карты в руке компьютера
            for (const handCard of computer.hand) {
                for (const luckyCard of luckyCards) {
                    // Проверяем возможность взять счастливую карту
                    const otherCards = findCardsToComplete(handCard, [luckyCard], gameState.tableCards);

                    if (otherCards.length > 0) {
                        // Можем взять счастливую карту вместе с другими
                        takeCards(computer, handCard, [luckyCard, ...otherCards]);
                        madeMove = true;
                        break;
                    } else if (canTakeCards(handCard, [luckyCard])) {
                        // Можем взять только счастливую карту
                        takeCards(computer, handCard, [luckyCard]);
                        madeMove = true;
                        break;
                    }
                }
                if (madeMove) break;
            }
        }

        // 2. Если не взяли счастливые карты, пытаемся эффективно использовать валета
        if (!madeMove) {
            const jacks = computer.hand.filter(card => card.value === 'J');
            if (jacks.length > 0) {
                console.log("У компьютера есть валет, проверяем возможность взять несколько карт");

                // Найти все карты, которые может взять валет
                const validCards = gameState.tableCards.filter(card => !['Q', 'K'].includes(card.value));

                if (validCards.length > 1) {
                    // Если валет может взять несколько карт, используем его
                    takeCards(computer, jacks[0], validCards);
                    madeMove = true;
                } else if (validCards.length === 1) {
                    // Если валет может взять только одну карту, проверяем,
                    // есть ли другие возможности для взятия
                    const otherOptions = computer.hand.filter(card => card.value !== 'J').some(card =>
                        canTakeAnyCards(card, gameState.tableCards)
                    );

                    if (!otherOptions) {
                        // Если других возможностей нет, используем валета
                        takeCards(computer, jacks[0], validCards);
                        madeMove = true;
                    }
                }
            }
        }

        // 3. Стандартная логика для других карт
        if (!madeMove) {
            // Сначала проверяем, может ли компьютер взять карты со стола
            for (const handCard of computer.hand) {
                // Проверка специальных карт (K, Q)
                if (handCard.value === 'Q') {
                    const queens = gameState.tableCards.filter(card => card.value === 'Q');
                    if (queens.length > 0) {
                        takeCards(computer, handCard, [queens[0]]);
                        madeMove = true;
                        break;
                    }
                } else if (handCard.value === 'K') {
                    const kings = gameState.tableCards.filter(card => card.value === 'K');
                    if (kings.length > 0) {
                        takeCards(computer, handCard, [kings[0]]);
                        madeMove = true;
                        break;
                    }
                } else if (handCard.value !== 'J') { // Валетов мы уже проверили
                    // Ищем комбинации для взятия
                    const bestCombination = findBestCombination(handCard, gameState.tableCards);
                    if (bestCombination.length > 0) {
                        takeCards(computer, handCard, bestCombination);
                        madeMove = true;
                        break;
                    }
                }
            }
        }

        // 4. Если невозможно взять карты, сбрасываем карту
        if (!madeMove) {
            console.log("Компьютер не может взять карты, сбрасывает карту");

            // Выбираем "наименее полезную" карту для сброса
            let cardToDiscard = selectCardToDiscard(computer.hand);

            discardCard(computer, cardToDiscard);
            madeMove = true;
        }

        // Обновляем UI
        renderPlayerHand(computer, elements.opponentCards, false);
        renderTableCards();
        updateCollectedCount();

        // Проверяем необходимость раздачи новых карт
        checkAndDealNewCards();

        // Следующий ход
        setTimeout(() => {
            nextTurn();
        }, 500);

    } catch (error) {
        console.error("Ошибка в ходе компьютера:", error);
        gameState.currentPlayerIndex = 0;
        updateActivePlayerUI();
    }
}

// Вспомогательная функция для поиска дополнительных карт, которые нужно взять для завершения комбинации
function findCardsToComplete(handCard, mustIncludeCards, tableCards) {
    // Исключаем карты, которые мы уже должны взять
    const remainingTableCards = tableCards.filter(card =>
        !mustIncludeCards.some(c => c.suit === card.suit && c.value === card.value)
    );

    // Если у нас валет, мы можем взять все карты (кроме Q и K)
    if (handCard.value === 'J') {
        return remainingTableCards.filter(card => !['Q', 'K'].includes(card.value));
    }

    // Находим, сколько нам нужно добрать для суммы 11
    const initialSum = mustIncludeCards.reduce((sum, card) => sum + card.numericValue, 0) + handCard.numericValue;
    const targetSum = 11;
    const neededSum = targetSum - initialSum;

    // Если нам не нужно добирать (например, у нас уже сумма 11), возвращаем пустой массив
    if (neededSum <= 0) return [];

    // Ищем комбинации карт, которые дадут нам нужную сумму
    for (let i = 1; i <= remainingTableCards.length; i++) {
        const combinations = getCombinations(remainingTableCards, i);
        for (const combo of combinations) {
            const sum = combo.reduce((s, card) => s + card.numericValue, 0);
            if (sum === neededSum) {
                return combo;
            }
        }
    }

    return []; // Не нашли подходящую комбинацию
}

// Функция для определения, может ли карта взять выбранные карты со стола
function canTakeCards(handCard, tableCards) {
    // Валет может взять любую карту, кроме Q и K
    if (handCard.value === 'J') {
        return tableCards.every(card => !['Q', 'K'].includes(card.value));
    }

    // Дама может взять только другую Даму
    if (handCard.value === 'Q') {
        return tableCards.length === 1 && tableCards[0].value === 'Q';
    }

    // Король может взять только другого Короля
    if (handCard.value === 'K') {
        return tableCards.length === 1 && tableCards[0].value === 'K';
    }

    // Проверяем сумму
    const tableSum = tableCards.reduce((acc, card) => acc + card.numericValue, 0);
    return tableSum + handCard.numericValue === 11;
}

// Функция для поиска лучшей комбинации карт для взятия
function findBestCombination(handCard, tableCards) {
    // Если это валет, Q, K - проверяем по специальным правилам
    if (handCard.value === 'J') {
        const validCards = tableCards.filter(card => !['Q', 'K'].includes(card.value));
        return validCards;
    }

    if (handCard.value === 'Q') {
        const queens = tableCards.filter(card => card.value === 'Q');
        return queens.length > 0 ? [queens[0]] : [];
    }

    if (handCard.value === 'K') {
        const kings = tableCards.filter(card => card.value === 'K');
        return kings.length > 0 ? [kings[0]] : [];
    }

    // Для остальных карт ищем комбинации, дающие сумму 11
        let bestCombination = [];
        let maxLuckyCards = -1; // Счетчик счастливых карт в комбинации

        // Проверяем комбинации разной длины
        for (let i = 1; i <= tableCards.length; i++) {
            const combinations = getCombinations(tableCards, i);
            for (const combo of combinations) {
                // Если туз, исключаем комбинации с Q и K
                if (handCard.value === 'A' && combo.some(card => ['Q', 'K'].includes(card.value))) {
                    continue;
                }

                // Проверяем, дает ли комбинация сумму 11
                const sum = combo.reduce((acc, card) => acc + card.numericValue, 0);
                if (sum + handCard.numericValue === 11) {
                    // Считаем счастливые карты в комбинации
                    const luckyCardsCount = combo.filter(card =>
                        (card.suit === 'clubs' && card.value === '2') ||
                        (card.suit === 'diamonds' && card.value === '10')
                    ).length;

                    // Обновляем лучшую комбинацию, если она содержит больше счастливых карт
                    // или это первая найденная комбинация
                    if (luckyCardsCount > maxLuckyCards || bestCombination.length === 0) {
                        bestCombination = combo;
                        maxLuckyCards = luckyCardsCount;
                    } else if (luckyCardsCount === maxLuckyCards && combo.length > bestCombination.length) {
                        // Если одинаковое количество счастливых карт, берем комбинацию с большим количеством карт
                        bestCombination = combo;
                    }
                }
            }
        }

        return bestCombination;
    }

    // Функция для выбора карты для сброса
    function selectCardToDiscard(hand) {
        // Приоритеты сброса (от наименее к наиболее ценным):
        // 1. Обычные карты (не J, Q, K, не счастливые)
        // 2. J, Q, K (сохраняем их, если возможно)
        // 3. Счастливые карты (2 крести, 10 бубны - самые ценные)

        // Ищем обычную карту для сброса
        for (const card of hand) {
            if (!['J', 'Q', 'K'].includes(card.value) &&
                !(card.suit === 'clubs' && card.value === '2') &&
                !(card.suit === 'diamonds' && card.value === '10')) {
                return card;
            }
        }

        // Если обычных карт нет, сбрасываем специальную карту
        for (const card of hand) {
            if (['J', 'Q', 'K'].includes(card.value)) {
                return card;
            }
        }

        // В крайнем случае, сбрасываем любую карту
        return hand[0];
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

        // Обновляем общий счет игры
        gameState.totalScores[0] += gameState.players[0].score;
        gameState.totalScores[1] += gameState.players[1].score;

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

    	// Отображаем информацию о текущем раунде и общем счете
        displayTotalScoreInfo();

    	// Победитель в раунде
    	const winnerMessage = document.getElementById('game-winner');

    	if (gameState.isOnlineGame) {
    		const myPlayer = gameState.players[playerIndex];
    		const opponent = gameState.players[opponentIndex];

    		if (myPlayer.score > opponent.score) {
    			winnerMessage.textContent = "Вы победили в этом раунде! 🎉";
    		} else if (opponent.score > myPlayer.score) {
    			winnerMessage.textContent = `${opponent.name} победил в этом раунде!`;
    		} else {
    			winnerMessage.textContent = "Ничья в этом раунде!";
    		}
    	} else {
    		if (gameState.players[0].score > gameState.players[1].score) {
    			winnerMessage.textContent = "Вы победили в этом раунде! 🎉";
    		} else if (gameState.players[1].score > gameState.players[0].score) {
    			winnerMessage.textContent = "Компьютер победил в этом раунде!";
    		} else {
    			winnerMessage.textContent = "Ничья в этом раунде!";
    		}
    	}

        // Проверяем, есть ли победитель по общему счету (достиг 21 очка)
        checkMatchWinner();

    	createFireworks();
    }

    // Функция для отображения общего счета и информации о матче
    function displayTotalScoreInfo() {
        // Проверяем, существует ли уже блок информации о счете
        let totalScoreInfo = document.querySelector('.total-score-info');
        if (!totalScoreInfo) {
            // Создаем блок для отображения общего счета
            totalScoreInfo = document.createElement('div');
            totalScoreInfo.className = 'total-score-info';

            // Добавляем его в результаты
            const resultsSection = document.getElementById('game-results');
            resultsSection.insertBefore(totalScoreInfo, document.getElementById('new-game-btn'));
        }

        // Определяем имена игроков в зависимости от типа игры
        let playerName = 'Вы';
        let opponentName = 'Компьютер';

        if (gameState.isOnlineGame) {
            const myPlayerIndex = gameState.playerIndex;
            const opponentIndex = myPlayerIndex === 0 ? 1 : 0;

            playerName = gameState.players[myPlayerIndex].name;
            opponentName = gameState.players[opponentIndex].name;
        }

        // Обновляем содержимое блока
        totalScoreInfo.innerHTML = `
            <h3>Общий счёт матча</h3>
            <div class="score-row">
                <span>${playerName}: ${gameState.totalScores[0]}</span>
                <span>${opponentName}: ${gameState.totalScores[1]}</span>
            </div>
            <div class="score-target">Игра ведётся до ${gameState.targetScore} очков</div>
        `;
    }

    // Функция для проверки победителя в матче
    function checkMatchWinner() {
        // Проверяем, достиг ли кто-то 21 очка
        let matchWinner = null;

        if (gameState.totalScores[0] >= gameState.targetScore) {
            matchWinner = "player";
        } else if (gameState.totalScores[1] >= gameState.targetScore) {
            matchWinner = "opponent";
        }

        if (matchWinner) {
            // Создаем элемент для отображения победителя матча
            const matchWinnerElement = document.createElement('div');
            matchWinnerElement.className = 'match-winner';

            if (matchWinner === "player") {
                matchWinnerElement.textContent = "Поздравляем! Вы победили в матче!";
            } else {
                matchWinnerElement.textContent = gameState.isOnlineGame ?
                    `${gameState.players[gameState.playerIndex === 0 ? 1 : 0].name} победил в матче!` :
                    "Компьютер победил в матче!";
            }

            // Находим информацию о счете и добавляем после нее
            const totalScoreInfo = document.querySelector('.total-score-info');
            if (totalScoreInfo) {
                totalScoreInfo.appendChild(matchWinnerElement);
            }

            // Изменяем текст кнопки на "Новый матч"
            const newGameBtn = document.getElementById('new-game-btn');
            if (newGameBtn) {
                newGameBtn.textContent = "Новый матч";
            }
        }
    }

    // Функция для начала нового раунда
    function startNewRound() {
        console.log("Начинаем новый раунд");

        // Увеличиваем номер раунда
        gameState.roundNumber++;

        // Сохраняем общий счет
        const totalScores = [...gameState.totalScores];

        // Инициализируем игру заново
        initializeGame();

        // Восстанавливаем общий счет
        gameState.totalScores = totalScores;
        gameState.roundNumber = gameState.roundNumber;

        // Запускаем игровой процесс
        startGameplay();
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

        // Сбрасываем счет и номер раунда
        gameState.totalScores = [0, 0];
        gameState.roundNumber = 1;

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
    	gameState.players = [{
    			name: 'Вы',
    			hand: [],
    			collected: [],
    			score: 0,
    			bonusPoints: 0
    		},
    		{
    			name: 'Компьютер',
    			hand: [],
    			collected: [],
    			score: 0,
    			bonusPoints: 0
    		}
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

    // Функция для сброса игры и перехода к экрану настройки
    // Добавляем функционал диалога подтверждения
    function resetGame() {
        // Проверяем, идет ли игра и нужно ли показывать диалог подтверждения
        if (!gameState.gameEnded && (gameState.isOnlineGame || gameState.players[0].hand.length > 0 || gameState.players[1].hand.length > 0)) {
            showConfirmDialog(
                "Вы действительно хотите выйти из игры?",
                "Текущая игра будет завершена, и все прогресс будет потерян.",
                performReset,
                () => {} // Функция при отмене - ничего не делаем
            );
        } else {
            performReset();
        }
    }

    // Функция для фактического сброса игры
    function performReset() {
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

        // Сбросить счет и номер раунда при полном выходе из игры
        gameState.totalScores = [0, 0];
        gameState.roundNumber = 1;

    	// Скрыть информацию о комнате, если она отображается
    	elements.roomInfo.classList.add('hidden');

        // Удаляем дополнительные элементы UI, если они есть
        const roundIndicator = document.querySelector('.round-indicator');
        if (roundIndicator) roundIndicator.remove();

        const scoreDisplay = document.querySelector('.game-score-display');
        if (scoreDisplay) scoreDisplay.remove();
    }

    // Функция для отображения диалога подтверждения
    function showConfirmDialog(title, message, onConfirm, onCancel) {
        // Создаем элементы диалога
        const overlay = document.createElement('div');
        overlay.className = 'dialog-overlay';

        const dialog = document.createElement('div');
        dialog.className = 'dialog-box';

        dialog.innerHTML = `
            <div class="dialog-content">
                <h3>${title}</h3>
                <p>${message}</p>
                <div class="dialog-buttons">
                    <button class="dialog-btn confirm-btn">Да</button>
                    <button class="dialog-btn cancel-btn">Остаться</button>
                </div>
            </div>
        `;

        // Добавляем диалог в DOM
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        // Добавляем обработчики событий
        const confirmBtn = dialog.querySelector('.confirm-btn');
        const cancelBtn = dialog.querySelector('.cancel-btn');

        confirmBtn.addEventListener('click', () => {
            document.body.removeChild(overlay);
            if (typeof onConfirm === 'function') onConfirm();
        });

        cancelBtn.addEventListener('click', () => {
            document.body.removeChild(overlay);
            if (typeof onCancel === 'function') onCancel();
        });
    }

    // Обработчик кнопки "Новая игра" в экране результатов
    function handleNewGameClick() {
        // Проверяем, есть ли победитель матча (кто-то набрал >= 21 очка)
        const hasMatchWinner = gameState.totalScores[0] >= gameState.targetScore ||
                            gameState.totalScores[1] >= gameState.targetScore;

        if (hasMatchWinner) {
            // Если есть победитель матча, полностью сбрасываем игру
            resetGame();
        } else {
            // Иначе начинаем новый раунд
            startNewRound();
        }
    }

    // Настройка слушателей событий
    function setupEventListeners() {
    	// Настройка игры
    	if (elements.startGameBtn) {
    		elements.startGameBtn.addEventListener('click', startGame);
    	}

    	// Игровые элементы управления
    	// Важное исправление: в HTML нет элемента с id="take-btn"
    	// Этот элемент упоминается в коде, но не существует в HTML
    	// Поэтому мы добавляем проверку перед установкой обработчика
    	if (elements.discardCardBtn) {
    		elements.discardCardBtn.addEventListener('click', handleDiscardAction);
    	}
    	if (elements.confirmSelectionBtn) {
    		elements.confirmSelectionBtn.addEventListener('click', confirmSelection);
    	}

    	// UI элементы управления
    	if (elements.rulesBtn) {
    		elements.rulesBtn.addEventListener('click', showRules);
    	}
    	if (elements.closeModal) {
    		elements.closeModal.addEventListener('click', closeRules);
    	}
    	if (elements.restartBtn) {
    		elements.restartBtn.addEventListener('click', resetGame);
    	}
    	if (elements.newGameBtn) {
    		// Заменяем обработчик на новую функцию
    		elements.newGameBtn.addEventListener('click', handleNewGameClick);
    	}

    	// Щелчок вне модального окна
    	window.addEventListener('click', (event) => {
    		if (elements.modal && event.target === elements.modal) {
    			closeRules();
    		}
    	});
    	// Добавьте следующий код в конец функции setupEventListeners() в main.js
    	// для обработки восстановления активности страницы

    	document.addEventListener('visibilitychange', function() {
            if (document.visibilityState === 'visible') {
                console.log("Страница снова активна, проверяем состояние соединения");

                // Используем новый метод для проверки соединения
                if (gameClient) {
                    setTimeout(() => {
                        gameClient.checkConnectionAndReconnect();
                    }, 500); // Даем небольшую задержку для стабилизации соединения
                }
            }
        });

    	// Кнопка обновления статуса игры
    	const refreshStatusBtn = document.getElementById('refresh-status-btn');
        if (refreshStatusBtn) {
            refreshStatusBtn.addEventListener('click', function() {
                showNotification('Обновление статуса игры...', 'info');
                if (gameClient) {
                    gameClient.checkConnectionAndReconnect();
                }
            });
        }
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

    // Функция для создания анимации фейерверка
    function createFireworks() {
    	// Получаем div с сообщением о победителе
    	const winnerElement = document.getElementById('game-winner');
    	if (!winnerElement) return;

    	// Добавляем класс для контейнера
    	winnerElement.className = 'winner-container';
    	winnerElement.id = 'winner-container';

    	// Сохраняем текущий текст
    	const originalText = winnerElement.textContent;

    	// Заменяем содержимое на новую структуру с эмодзи
    	winnerElement.innerHTML = `
            <div class="winner-text">
                ${originalText.replace('🎉', '')}
                <span class="winner-emoji"><i class="fas fa-trophy"></i></span>
                <span class="winner-emoji" style="animation-delay: 0.2s"><i class="fas fa-party-horn"></i></span>
                <span class="winner-emoji" style="animation-delay: 0.4s"><i class="fas fa-sparkles"></i></span>
            </div>
        `;

    	// Создаем 20 элементов фейерверка
    	for (let i = 0; i < 20; i++) {
    		setTimeout(() => {
    			const firework = document.createElement('div');
    			firework.classList.add('firework');

    			// Случайные позиции и цвета
    			const x = Math.random() * 100 - 50;
    			const y = Math.random() * 100 - 50;

    			firework.style.setProperty('--x', `${x}px`);
    			firework.style.setProperty('--y', `${y}px`);

    			// Случайный цвет
    			const hue = Math.floor(Math.random() * 360);
    			firework.style.backgroundColor = `hsl(${hue}, 100%, 60%)`;

    			// Случайная позиция начала
    			firework.style.left = `${Math.random() * 100}%`;
    			firework.style.top = `${Math.random() * 100}%`;

    			winnerElement.appendChild(firework);

    			// Удаляем элемент после завершения анимации
    			setTimeout(() => {
    				firework.remove();
    			}, 1000);
    		}, i * 200); // Запускаем с интервалом для создания эффекта
    	}

    	// Повторяем анимацию каждые 3 секунды
    	setInterval(() => {
    		for (let i = 0; i < 15; i++) {
    			setTimeout(() => {
    				const firework = document.createElement('div');
    				firework.classList.add('firework');

    				const x = Math.random() * 100 - 50;
    				const y = Math.random() * 100 - 50;

    				firework.style.setProperty('--x', `${x}px`);
    				firework.style.setProperty('--y', `${y}px`);

    				const hue = Math.floor(Math.random() * 360);
    				firework.style.backgroundColor = `hsl(${hue}, 100%, 60%)`;

    				firework.style.left = `${Math.random() * 100}%`;
    				firework.style.top = `${Math.random() * 100}%`;

    				winnerElement.appendChild(firework);

    				setTimeout(() => {
    					firework.remove();
    				}, 1000);
    			}, i * 150);
    		}
    	}, 3000);
    }
