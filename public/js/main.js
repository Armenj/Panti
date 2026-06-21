function checkWebsocketConnection() {
	// Проверяем доступность socket.io
	if (typeof io === 'undefined') {
		console.error('Socket.io не загружен. Возможно, сервер не запущен или недоступен.');
		showNotification('Не удалось подключиться к серверу игры. Мультиплеер недоступен.', 'error');

		// Отключаем мультиплеер элементы
		const multiplayerSection = document.getElementById('online-section');
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

				// Веер использует абсолютное позиционирование — marginLeft не нужен
				cards.forEach((card, index) => {
					card.addEventListener('touchstart', function(e) {
						const allCards = handArea.querySelectorAll('.card');
						allCards.forEach(c => {
							if (c !== this) {
								c.style.zIndex = String(parseInt(c.style.zIndex) || (index + 1));
							}
						});
						this.style.zIndex = "50";
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

	// Защита от случайного закрытия/обновления страницы во время игры
	window.addEventListener('beforeunload', function(e) {
		const gameInProgress = !gameSections.gameBoard.classList.contains('hidden');
		if (gameInProgress) {
			e.preventDefault();
			e.returnValue = '';
			return '';
		}
	});

	// Восстановление UI из бэкапа при обновлении страницы (пока идёт переподключение)
	try {
		const backup = localStorage.getItem('gameStateBackup');
		const session = localStorage.getItem('gameSession');
		if (backup && session) {
			const backupData = JSON.parse(backup);
			const sessionData = JSON.parse(session);
			// Если бэкап свежий (< 1 часа) и сессия валидна
			if (Date.now() - backupData.timestamp < 60 * 60 * 1000 && sessionData.roomId) {
				const savedState = backupData.gameState;
				if (savedState && savedState.players && savedState.players.length > 0 && !savedState.gameEnded) {
					// Восстанавливаем состояние для мгновенного отображения
					updateGameStateFromServer(savedState);
					gameState.isOnlineGame = true;
					gameState.playerIndex = sessionData.playerIndex;
					showSection(gameSections.gameBoard);
					updatePlayerNames();
					renderGameState();
					updateActivePlayerUI();
					if (elements.roomInfo) elements.roomInfo.classList.add('hidden');
					showNotification('Переподключение к игре...', 'info');
				}
			}
		}
	} catch (e) { /* ignore */ }

	// Восстановление локальной игры против компьютера после случайного обновления
	try {
		const localBackup = localStorage.getItem('localGameBackup');
		if (localBackup) {
			const backupData = JSON.parse(localBackup);
			// Если бэкап свежий (< 1 часа)
			if (Date.now() - backupData.timestamp < 60 * 60 * 1000) {
				const savedState = backupData.gameState;
				if (savedState && savedState.players && savedState.players.length > 0) {
					// Восстанавливаем состояние локальной игры
					for (const key in savedState) {
						if (key === 'players') {
							gameState.players = JSON.parse(JSON.stringify(savedState.players));
						} else {
							gameState[key] = savedState[key];
						}
					}
					gameState.isOnlineGame = false;
					gameState.selectedHandCard = null;
					gameState.selectedTableCards = [];
					showSection(gameSections.gameBoard);
					updatePlayerNames();
					renderGameState();
					updateActivePlayerUI();
					showNotification('Игра восстановлена', 'success');
					// Очищаем бэкап после успешного восстановления
					localStorage.removeItem('localGameBackup');
				}
			} else {
				localStorage.removeItem('localGameBackup');
			}
		}
	} catch (e) { localStorage.removeItem('localGameBackup'); }

	// Проверяем URL на наличие кода комнаты
	const urlParams = new URLSearchParams(window.location.search);
	const roomIdFromUrl = urlParams.get('room');

	if (roomIdFromUrl) {
		// Гость пришёл по ссылке-приглашению — показываем максимально простой экран:
		// только поле имени и кнопка «Подключиться», всё лишнее прячем.
		document.body.classList.add('invite-mode');

		// Включаем онлайн-режим
		const onlineRadio = document.querySelector('input[name="game-mode"][value="online"]');
		if (onlineRadio) {
			onlineRadio.checked = true;
			onlineRadio.dispatchEvent(new Event('change'));
		}

		// Прячем выбор режима, настройки компьютера, вкладки и панель создания
		const modeGroup = document.querySelector('input[name="game-mode"]');
		if (modeGroup && modeGroup.closest('.option-group')) {
			modeGroup.closest('.option-group').classList.add('hidden');
		}
		['computer-mode-options', 'online-action-tabs', 'create-panel', 'room-info']
			.forEach(id => { const el = document.getElementById(id); if (el) el.classList.add('hidden'); });
		const onlineSection = document.getElementById('online-section');
		if (onlineSection) onlineSection.classList.remove('hidden');

		// Показываем панель входа, но прячем поле кода — код берём из ссылки
		switchOnlineTab('join');
		const joinPanel = document.getElementById('join-panel');
		if (joinPanel) joinPanel.classList.remove('hidden');
		const roomIdInput = document.getElementById('room-id');
		if (roomIdInput) {
			roomIdInput.value = roomIdFromUrl;
			const grp = roomIdInput.closest('.input-group');
			if (grp) grp.classList.add('hidden');
		}

		// Дружелюбный заголовок и понятная кнопка
		const setupTitle = document.querySelector('#game-setup > h2');
		if (setupTitle) setupTitle.textContent = 'Вас пригласили в игру 🎴';
		const joinBtn = document.getElementById('join-game-btn');
		if (joinBtn) joinBtn.textContent = 'Подключиться';

		// Фокус на поле имени
		setTimeout(() => {
			const joinName = document.getElementById('join-name');
			if (joinName) joinName.focus();
		}, 100);
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
	difficulty: 'standard', // 'standard' или 'hard'
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
	opponentsContainer: document.getElementById('opponents-container'),
	playerArea: document.getElementById('player-area'),
	playerName: document.getElementById('player-name'),
	playerCards: document.getElementById('player-cards'),
	playerCollected: document.getElementById('player-collected'),
	tableCards: document.getElementById('table-cards'),
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

// Переключение вкладок онлайн-секции (create / join)
function switchOnlineTab(tab) {
	const createPanel = document.getElementById('create-panel');
	const joinPanel = document.getElementById('join-panel');
	const tabs = document.querySelectorAll('.online-tab');

	tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tab));

	if (tab === 'create') {
		createPanel.classList.remove('hidden');
		joinPanel.classList.add('hidden');
	} else {
		createPanel.classList.add('hidden');
		joinPanel.classList.remove('hidden');
	}
}

// Multiplayer functions
function setupMultiplayerListeners() {
	// Вкладки создать/войти
	document.querySelectorAll('.online-tab').forEach(tab => {
		tab.addEventListener('click', () => switchOnlineTab(tab.dataset.tab));
	});

	// Кнопки действий
	elements.createGameBtn.addEventListener('click', createRoom);
	elements.joinGameBtn.addEventListener('click', joinRoom);
	elements.copyLinkBtn.addEventListener('click', copyInviteLink);

	// Копирование кода комнаты
	const copyCodeBtn = document.getElementById('copy-code-btn');
	if (copyCodeBtn) {
		copyCodeBtn.addEventListener('click', () => {
			const code = document.getElementById('display-room-id').textContent;
			navigator.clipboard.writeText(code).then(() => {
				showNotification('Код скопирован!', 'success');
			}).catch(() => {
				// Фоллбек
				const tmp = document.createElement('input');
				tmp.value = code;
				document.body.appendChild(tmp);
				tmp.select();
				document.execCommand('copy');
				document.body.removeChild(tmp);
				showNotification('Код скопирован!', 'success');
			});
		});
	}

	// Настройка слушателей событий от сервера
	gameClient.onRoomCreated = handleRoomCreated;
	gameClient.onRoomJoined = handleRoomJoined;
	gameClient.onGameStart = handleGameStart;
	gameClient.onGameUpdate = handleGameUpdate;
	gameClient.onPlayerDisconnected = handlePlayerDisconnected;
	gameClient.onOpponentLeft = handleOpponentLeft;
	gameClient.onError = handleGameError;
	gameClient.onSessionRestored = handleGameStart;
	gameClient.onPlayerJoined = handlePlayerJoined;
	gameClient.onKicked = handleKicked;
	gameClient.onLobbyUpdated = handleLobbyUpdated;
	gameClient.onPlayerEmoji = handlePlayerEmoji;
	gameClient.onPlayerReconnected = handlePlayerReconnected;
}

function createRoom() {
	const playerName = elements.createNameInput.value.trim() || 'Игрок 1';
	const format = document.querySelector('input[name="online-format"]:checked');
	const formatValue = format ? format.value : '1v1';
	const targetInput = document.querySelector('input[name="online-target-score"]:checked');
	const targetScore = targetInput ? (parseInt(targetInput.value, 10) || 21) : 21;
	gameClient.createRoom(playerName, formatValue, targetScore);
	showNotification('Создание игры...', 'info');
}

function joinRoom() {
	const playerName = elements.joinNameInput.value.trim() || 'Игрок 2';
	const roomId = elements.roomIdInput.value.trim();

	if (!roomId) {
		showNotification('Введите код комнаты', 'error');
		return;
	}

	// Блокируем кнопку, чтобы избежать повторного нажатия
	if (elements.joinGameBtn) {
		elements.joinGameBtn.disabled = true;
		elements.joinGameBtn.textContent = 'Подключение...';
	}

	gameClient.joinRoom(roomId, playerName);
	showNotification('Подключение к игре...', 'info');
}

function handleRoomCreated(data) {
	gameState.isOnlineGame = true;
	gameState.roomId = data.roomId;
	gameState.playerIndex = data.playerIndex;

	// Сохраняем данные игры для отображения лобби
	if (data.gameState) {
		gameState.numPlayers = data.gameState.numPlayers || 2;
		gameState.format = data.gameState.format || '1v1';
	}

	// Скрываем вкладки и панели, показываем только room-info
	const tabs = document.getElementById('online-action-tabs');
	const createPanel = document.getElementById('create-panel');
	const joinPanel = document.getElementById('join-panel');
	if (tabs) tabs.classList.add('hidden');
	if (createPanel) createPanel.classList.add('hidden');
	if (joinPanel) joinPanel.classList.add('hidden');

	// Заполняем room-info
	elements.displayRoomId.textContent = data.roomId;
	const inviteLink = `${window.location.origin}${window.location.pathname}?room=${data.roomId}`;
	elements.inviteLinkInput.value = inviteLink;
	elements.roomInfo.classList.remove('hidden');

	// Обновляем список игроков в лобби
	updateLobbyPlayerList(data.gameState);

	showNotification('Игра создана! Ожидание игроков...', 'success');
}

function handlePlayerJoined(data) {
	// Обновляем список игроков в лобби
	updateLobbyPlayerList(data.gameState);
	const waitingFor = data.waitingFor || 0;
	if (waitingFor > 0) {
		showNotification(`Игрок подключился! Ожидаем ещё ${waitingFor}...`, 'info');
	} else {
		showNotification('Все игроки подключились!', 'success');
	}
}

function updateLobbyPlayerList(serverGameState) {
	if (!serverGameState || !serverGameState.players) return;
	const numPlayers = serverGameState.numPlayers || 2;

	// Создаём или обновляем список игроков в room-info
	let playerList = document.getElementById('lobby-player-list');
	if (!playerList) {
		playerList = document.createElement('div');
		playerList.id = 'lobby-player-list';
		playerList.className = 'lobby-player-list';
		const waitingMsg = elements.roomInfo.querySelector('.waiting-message');
		if (waitingMsg) {
			elements.roomInfo.insertBefore(playerList, waitingMsg);
		} else {
			elements.roomInfo.appendChild(playerList);
		}
	}

	const isCreator = gameState.playerIndex === 0;
	let html = '';
	for (let i = 0; i < numPlayers; i++) {
		const p = serverGameState.players[i];
		const isConnected = p && p.id && p.connected;
		const name = isConnected ? p.name : '...';
		const statusClass = isConnected ? 'lobby-player-connected' : 'lobby-player-waiting';
		const icon = isConnected ? '&#10003;' : '&#8987;';
		// Создатель может кикнуть подключённого игрока или удалить пустой слот (не себя)
		const kickBtn = (isCreator && i !== 0)
			? `<button class="lobby-kick-btn" data-index="${i}" title="${isConnected ? 'Исключить игрока' : 'Удалить слот'}">✕</button>`
			: '';
		html += `<div class="lobby-player ${statusClass}"><span class="lobby-player-icon">${icon}</span> ${name}${kickBtn}</div>`;
	}
	playerList.innerHTML = html;

	// Привязываем обработчики кика
	playerList.querySelectorAll('.lobby-kick-btn').forEach(btn => {
		btn.addEventListener('click', () => {
			const idx = parseInt(btn.dataset.index);
			const p = serverGameState.players[idx];
			const isConnected = p && p.id && p.connected;
			const msg = isConnected ? 'Исключить этого игрока?' : 'Удалить этот слот?';
			if (confirm(msg)) {
				gameClient.kickPlayer(idx);
			}
		});
	});

	// Обновляем сообщение ожидания
	const connectedCount = serverGameState.players.filter(p => p.id && p.connected).length;
	const waitingMsg = elements.roomInfo.querySelector('.waiting-message');
	if (waitingMsg) {
		if (connectedCount >= numPlayers) {
			waitingMsg.textContent = 'Все игроки подключились! Запуск...';
		} else {
			waitingMsg.textContent = `Ожидание игроков (${connectedCount}/${numPlayers})...`;
		}
	}

	// Кнопка «Начать игру» для создателя, если подключено >= 2 и ещё есть пустые слоты
	let startBtn = document.getElementById('lobby-force-start-btn');
	if (isCreator && connectedCount >= 2 && connectedCount < numPlayers) {
		if (!startBtn) {
			startBtn = document.createElement('button');
			startBtn.id = 'lobby-force-start-btn';
			startBtn.className = 'primary-btn';
			startBtn.style.marginTop = '10px';
			startBtn.textContent = `Начать игру (${connectedCount} игрока)`;
			const waitingMsgEl = elements.roomInfo.querySelector('.waiting-message');
			if (waitingMsgEl) {
				waitingMsgEl.after(startBtn);
			} else {
				elements.roomInfo.appendChild(startBtn);
			}
		} else {
			startBtn.textContent = `Начать игру (${connectedCount} игрока)`;
		}
		// Перепривязываем обработчик
		startBtn.onclick = () => {
			if (confirm(`Начать игру с ${connectedCount} игроками?`)) {
				gameClient.forceStartGame();
			}
		};
	} else if (startBtn) {
		startBtn.remove();
	}
}

function handleRoomJoined(data) {
	gameState.isOnlineGame = true;
	gameState.roomId = data.roomId;
	gameState.playerIndex = data.playerIndex;

	// Если игра ещё не началась (ожидаем остальных) — показываем лобби
	const numPlayers = data.gameState ? (data.gameState.numPlayers || 2) : 2;
	const connectedCount = data.gameState ? data.gameState.players.filter(p => p.id && p.connected).length : 0;

	if (connectedCount < numPlayers) {
		gameState.numPlayers = numPlayers;
		gameState.format = data.gameState ? (data.gameState.format || '1v1') : '1v1';

		// Скрываем вкладки и панели, показываем room-info (лобби)
		const tabs = document.getElementById('online-action-tabs');
		const createPanel = document.getElementById('create-panel');
		const joinPanel = document.getElementById('join-panel');
		if (tabs) tabs.classList.add('hidden');
		if (createPanel) createPanel.classList.add('hidden');
		if (joinPanel) joinPanel.classList.add('hidden');

		// Заполняем room-info для присоединившегося игрока
		elements.displayRoomId.textContent = data.roomId;
		const inviteLink = `${window.location.origin}${window.location.pathname}?room=${data.roomId}`;
		elements.inviteLinkInput.value = inviteLink;
		elements.roomInfo.classList.remove('hidden');

		// Обновляем список игроков в лобби
		updateLobbyPlayerList(data.gameState);

		showNotification('Вы присоединились! Ожидание остальных игроков...', 'success');
	} else {
		showNotification('Вы присоединились к игре', 'success');
	}
}

function handleGameStart(newGameState) {
	console.log("Получено событие game-start", newGameState);
	hideOpponentWaiting();

	// Реконнект на экран результатов: если раунд уже завершён — показываем результаты,
	// а не игровое поле (иначе после возврата висела бы доска вместо итогов раунда).
	if (newGameState && newGameState.gameEnded) {
		updateGameStateFromServer(newGameState);
		displayResults();
		showSection(gameSections.gameResults);
		return;
	}

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
	// Любое обновление = игра активна, баннер ожидания соперника убираем
	hideOpponentWaiting();

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

	// Сохраняем полное состояние игры для восстановления после обновления страницы
	if (gameState.isOnlineGame) {
		try {
			localStorage.setItem('gameStateBackup', JSON.stringify({
				gameState: {
					players: gameState.players,
					tableCards: gameState.tableCards,
					deck: gameState.deck,
					currentPlayerIndex: gameState.currentPlayerIndex,
					dealerIndex: gameState.dealerIndex,
					lastPlayerWhoTook: gameState.lastPlayerWhoTook,
					isOnlineGame: gameState.isOnlineGame,
					roomId: gameState.roomId,
					playerIndex: gameState.playerIndex,
					totalScores: gameState.totalScores,
					roundNumber: gameState.roundNumber,
					targetScore: gameState.targetScore,
					format: gameState.format,
					gameEnded: gameState.gameEnded,
					lastTakenCards: gameState.lastTakenCards,
					lastTakenBy: gameState.lastTakenBy
				},
				timestamp: Date.now()
			}));
		} catch (e) { /* ignore storage errors */ }
	}
}

let opponentWaitTimer = null;

// Баннер «ждём возвращения соперника» (создаётся лениво)
function showOpponentWaiting(text) {
	let el = document.getElementById('opponent-waiting-overlay');
	if (!el) {
		el = document.createElement('div');
		el.id = 'opponent-waiting-overlay';
		el.innerHTML = '<div class="ow-box"><div class="ow-spinner"></div><div class="ow-text"></div>'
			+ '<button id="ow-leave-btn" class="secondary-btn">Выйти в меню</button></div>';
		document.body.appendChild(el);
		el.querySelector('#ow-leave-btn').addEventListener('click', () => {
			hideOpponentWaiting();
			performReset(); // в 1v1 это удалит комнату на сервере
		});
	}
	el.querySelector('.ow-text').textContent = text;
	el.classList.add('show');
}
function hideOpponentWaiting() {
	const el = document.getElementById('opponent-waiting-overlay');
	if (el) el.classList.remove('show');
	if (opponentWaitTimer) { clearTimeout(opponentWaitTimer); opponentWaitTimer = null; }
}

function handlePlayerDisconnected(data) {
	const disconnectedPlayerIndex = data.disconnectedPlayerIndex;
	const playerName = (gameState.players[disconnectedPlayerIndex] || {}).name || 'Соперник';

	// Обновляем состояние игры (но НЕ выходим — ждём возвращения соперника)
	updateGameStateFromServer(data.gameState);

	// Баннер «ждём соперника» нужен ТОЛЬКО во время активной партии. Если мы уже в
	// кабинете/на результатах или матч завершён — игнорируем (иначе оверлей висит зря).
	const boardVisible = !gameSections.gameBoard.classList.contains('hidden');
	const matchOver = gameState.gameEnded || (gameState.matchWinner !== null && gameState.matchWinner !== undefined);
	if (!boardVisible || matchOver) {
		hideOpponentWaiting();
		return;
	}

	// Если игра уже на доске — показываем баннер ожидания, держим стол
	showOpponentWaiting(`${playerName} отключился. Ждём возвращения…`);

	// Через 3 минуты, если не вернулся — предлагаем выйти в кабинет
	if (opponentWaitTimer) clearTimeout(opponentWaitTimer);
	opponentWaitTimer = setTimeout(() => {
		showOpponentWaiting(`${playerName} не вернулся.`);
		showNotification('Соперник не вернулся в игру', 'error');
		setTimeout(() => { hideOpponentWaiting(); performReset(); }, 4000);
	}, 3 * 60 * 1000);
}

function handlePlayerReconnected(data) {
	hideOpponentWaiting();
	updateGameStateFromServer(data.gameState);
	// Перерисовываем доску из актуального состояния
	if (!gameSections.gameBoard.classList.contains('hidden')) {
		renderGameState();
		updateActivePlayerUI();
	}
	const idx = data.reconnectedPlayerIndex;
	const name = (gameState.players[idx] || {}).name || 'Соперник';
	showNotification(`${name} вернулся в игру`, 'success');
}

function handleOpponentLeft(data) {
	showNotification(`Игрок ${data.playerName} вышел из игры`, 'error');

	if (gameClient) {
		gameClient.clearSession();
	}

	setTimeout(() => {
		performReset();
	}, 3000);
}

function handleGameError(error) {
	showNotification(error.message, 'error');
	// Разблокируем кнопку входа при ошибке
	if (elements.joinGameBtn) {
		elements.joinGameBtn.disabled = false;
		elements.joinGameBtn.textContent = 'Войти в игру';
	}
}

function handleKicked(data) {
	showNotification(data.message || 'Вы были исключены из комнаты', 'error');
	localStorage.removeItem('gameStateBackup');
	resetGame();
}

function handleLobbyUpdated(data) {
	// Обновляем playerIndex — после удаления слота индексы сдвигаются
	if (data.gameState && data.gameState.players) {
		const mySocketId = gameClient.socket.id;
		const newIndex = data.gameState.players.findIndex(p => p.id === mySocketId);
		if (newIndex !== -1) {
			gameState.playerIndex = newIndex;
			gameClient.playerIndex = newIndex;
		}
	}
	gameState.numPlayers = data.gameState.numPlayers;
	gameState.format = data.gameState.format;
	updateLobbyPlayerList(data.gameState);
	showNotification('Лобби обновлено', 'info');
}

function copyInviteLink() {
	const inviteLink = elements.inviteLinkInput;
	inviteLink.select();
	document.execCommand('copy');

	showNotification('Ссылка скопирована в буфер обмена', 'success');
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
	const selfAvatarEl = document.querySelector('#player-self .player-self-avatar');
	let selfAvatarUrl = null;
	if (gameState.isOnlineGame) {
		const myIndex = gameState.playerIndex != null ? gameState.playerIndex : 0;
		const myPlayer = gameState.players[myIndex];
		if (myPlayer && elements.playerName) {
			elements.playerName.textContent = `${myPlayer.name} (Вы)`;
		}
		if (myPlayer) selfAvatarUrl = myPlayer.avatar || null;
		// Opponent names are shown in their squares, rendered by renderOpponents()
	} else {
		if (elements.playerName) elements.playerName.textContent = 'Вы';
		// В игре против компьютера показываем аватар залогиненного игрока (если есть)
		const u = (window.PantiAuth && PantiAuth.getUser) ? PantiAuth.getUser() : null;
		selfAvatarUrl = u ? u.avatarUrl : null;
	}
	setPlateAvatar(selfAvatarEl, selfAvatarUrl, '🙂');
}

// Ставит на плашку игрока аватар-фото (если есть) либо эмодзи-заглушку
function setPlateAvatar(el, url, emoji) {
	if (!el) return;
	if (url) {
		if (el.dataset.avatarUrl !== url) {
			el.dataset.avatarUrl = url;
			el.innerHTML = `<img class="plate-avatar" src="${url}" alt="">`;
		}
	} else {
		if (el.dataset.avatarUrl) delete el.dataset.avatarUrl;
		el.textContent = emoji;
	}
}

// Определение эмодзи для противника
function getOpponentEmoji(opp) {
    // Компьютер (локальная игра)
    if (!gameState.isOnlineGame) return '🖥️';
    // Онлайн — определяем пол по имени
    const name = (opp.name || '').trim().toLowerCase();
    const femaleEndings = ['а', 'я', 'ка', 'на', 'ша', 'ия'];
    const femaleNames = ['ольга', 'анна', 'мария', 'елена', 'наталья', 'татьяна', 'ирина', 'светлана', 'юлия', 'екатерина', 'дарья', 'алина', 'полина', 'кристина', 'марина', 'вера', 'надежда', 'любовь', 'валентина', 'галина', 'лиза', 'нина', 'лена', 'таня', 'катя', 'маша', 'даша', 'настя', 'оля', 'юля', 'ира', 'света', 'наташа', 'аня', 'женя', 'саша'];
    const maleNames = ['александр', 'дмитрий', 'максим', 'иван', 'артём', 'андрей', 'сергей', 'алексей', 'никита', 'михаил', 'егор', 'роман', 'владимир', 'денис', 'кирилл', 'павел', 'олег', 'виктор', 'антон', 'игорь', 'дима', 'макс', 'ваня', 'серёжа', 'лёша', 'коля', 'петя', 'вова', 'миша', 'рома'];
    if (femaleNames.includes(name)) return '👩';
    if (maleNames.includes(name)) return '👨';
    // Эвристика по окончанию
    if (femaleEndings.some(e => name.endsWith(e)) && !name.endsWith('ша') || name.endsWith('а') || name.endsWith('я')) {
        // Но имена на согласную — мужские
        if (/[бвгджзклмнпрстфхцчшщ]$/.test(name)) return '👨';
        return '👩';
    }
    return '👨';
}

// Отрисовка плашек противников в верхней части экрана
function renderOpponents() {
    const container = elements.opponentsContainer;
    if (!container) return;

    let opponents = [];

    if (gameState.isOnlineGame) {
        const myIndex = gameState.playerIndex != null ? gameState.playerIndex : 0;
        opponents = gameState.players
            .map((p, i) => ({ ...p, playerIndex: i }))
            .filter((_, i) => i !== myIndex);
    } else {
        // Локальная игра: только компьютер
        if (gameState.players.length > 1) {
            opponents = [{ ...gameState.players[1], playerIndex: 1 }];
        }
    }

    // Set CSS class for opponent count to control sizing
    container.className = 'opponents-container';
    if (opponents.length === 1) container.classList.add('opp-count-1');
    else if (opponents.length === 2) container.classList.add('opp-count-2');
    else if (opponents.length >= 3) container.classList.add('opp-count-3');

    // Пересоздаём только если количество изменилось
    const wrappers = container.querySelectorAll('.opponent-wrapper');
    if (wrappers.length !== opponents.length) {
        container.innerHTML = '';
        opponents.forEach(opp => {
            container.appendChild(buildOpponentSquare(opp));
        });
    } else {
        // Обновляем существующие
        opponents.forEach((opp, idx) => {
            updateOpponentSquare(wrappers[idx], opp);
        });
    }
}

function buildOpponentSquare(opp) {
    const wrapper = document.createElement('div');
    wrapper.className = 'opponent-wrapper';
    wrapper.id = `opp-sq-${opp.playerIndex}`;

    const div = document.createElement('div');
    div.className = 'opponent-square';

    const isActive = gameState.currentPlayerIndex === opp.playerIndex;
    if (isActive) div.classList.add('active-turn');

    // Team indicator for 2v2
    if ((gameState.format || '') === '2v2' && gameState.playerIndex != null) {
        const sameTeam = (gameState.playerIndex % 2) === (opp.playerIndex % 2);
        div.classList.add(sameTeam ? 'same-team' : 'enemy-team');
    }

    const handCount = opp.hand ? opp.hand.length : 0;
    const collectedCount = opp.collected ? opp.collected.length : 0;
    // В локальной игре компьютер не имеет id/connected, но это не "ожидание"
    const isWaiting = gameState.isOnlineGame ? (!opp.id || !opp.connected) : false;

    // Collected count badge in top-right corner
    const collectedBadge = document.createElement('span');
    collectedBadge.className = 'opp-collected-badge';
    collectedBadge.title = 'Собрано карт';
    collectedBadge.textContent = collectedCount;
    div.appendChild(collectedBadge);

    // Emoji avatar
    const emojiEl = document.createElement('span');
    emojiEl.className = 'opp-emoji';
    setPlateAvatar(emojiEl, opp.avatar, getOpponentEmoji(opp));
    div.appendChild(emojiEl);

    // Name at the bottom of the square
    const name = document.createElement('span');
    name.className = 'opponent-sq-name';
    if (isWaiting) {
        name.textContent = 'Ожидание...';
        name.classList.add('waiting');
    } else {
        name.textContent = opp.name || `Игрок ${opp.playerIndex + 1}`;
    }
    div.appendChild(name);

    wrapper.appendChild(div);

    // Fan of card backs BELOW the square (reversed direction)
    const fan = document.createElement('div');
    fan.className = 'opp-card-fan';
    const numCards = isWaiting ? 0 : handCount;
    for (let i = 0; i < numCards; i++) {
        const c = document.createElement('div');
        c.className = 'opp-fan-card';
        // Calculate fan spread — reversed (negated angle)
        const t = numCards > 1 ? i / (numCards - 1) : 0.5;
        const angle = numCards > 1 ? -((t - 0.5) * 2 * Math.min(20, numCards * 5)) : 0;
        const offset = numCards > 1 ? (i - (numCards - 1) / 2) * 12 : 0;
        c.style.transform = `translateX(${offset}px) rotate(${angle}deg)`;
        c.style.zIndex = i + 1;
        fan.appendChild(c);
    }
    wrapper.appendChild(fan);

    return wrapper;
}

function updateOpponentSquare(wrapperEl, opp) {
    if (!wrapperEl) return;
    wrapperEl.id = `opp-sq-${opp.playerIndex}`;

    const sq = wrapperEl.querySelector('.opponent-square');
    if (sq) {
        sq.classList.toggle('active-turn', gameState.currentPlayerIndex === opp.playerIndex);
    }

    const handCount = opp.hand ? opp.hand.length : 0;
    const collectedCount = opp.collected ? opp.collected.length : 0;
    const isWaiting = gameState.isOnlineGame ? (!opp.id || !opp.connected) : false;

    // Update collected badge
    const collectedBadge = wrapperEl.querySelector('.opp-collected-badge');
    if (collectedBadge) collectedBadge.textContent = collectedCount;

    // Update avatar/emoji
    const emojiEl = wrapperEl.querySelector('.opp-emoji');
    if (emojiEl) setPlateAvatar(emojiEl, opp.avatar, getOpponentEmoji(opp));

    // Update name
    const nameEl = wrapperEl.querySelector('.opponent-sq-name');
    if (nameEl) {
        if (isWaiting) {
            nameEl.textContent = 'Ожидание...';
            nameEl.classList.add('waiting');
        } else {
            nameEl.textContent = opp.name || `Игрок ${opp.playerIndex + 1}`;
            nameEl.classList.remove('waiting');
        }
    }

    // Rebuild fan of cards
    const fan = wrapperEl.querySelector('.opp-card-fan');
    if (fan) {
        const numCards = isWaiting ? 0 : handCount;
        const currentCards = fan.querySelectorAll('.opp-fan-card').length;
        if (currentCards !== numCards) {
            fan.innerHTML = '';
            for (let i = 0; i < numCards; i++) {
                const c = document.createElement('div');
                c.className = 'opp-fan-card';
                const t = numCards > 1 ? i / (numCards - 1) : 0.5;
                const angle = numCards > 1 ? -((t - 0.5) * 2 * Math.min(20, numCards * 5)) : 0;
                const offset = numCards > 1 ? (i - (numCards - 1) / 2) * 12 : 0;
                c.style.transform = `translateX(${offset}px) rotate(${angle}deg)`;
                c.style.zIndex = i + 1;
                fan.appendChild(c);
            }
        }
    }
}

// Функция для рендеринга всего игрового состояния
function renderGameState() {
    if (gameState.isOnlineGame) {
        const myPlayerIndex = gameState.playerIndex != null ? gameState.playerIndex : 0;
        renderPlayerHand(gameState.players[myPlayerIndex], elements.playerCards, true);
    } else {
        renderPlayerHand(gameState.players[0], elements.playerCards, true);
    }

    renderOpponents();
    renderTableCards();
    updateCollectedCount();
    updateDeckCount();

    if (gameState.lastTakenCards && gameState.lastTakenCards.length > 0) {
        updateLastTakenInfo();
    }

    updateRoundAndScoreInfo();

    // Сохраняем бэкап для локальной игры (для защиты от случайного обновления)
    if (!gameState.isOnlineGame && gameState.players.length > 0 && !gameState.gameEnded) {
        try {
            localStorage.setItem('localGameBackup', JSON.stringify({
                gameState: {
                    players: gameState.players,
                    tableCards: gameState.tableCards,
                    deck: gameState.deck,
                    currentPlayerIndex: gameState.currentPlayerIndex,
                    dealerIndex: gameState.dealerIndex,
                    lastPlayerWhoTook: gameState.lastPlayerWhoTook,
                    totalScores: gameState.totalScores,
                    roundNumber: gameState.roundNumber,
                    targetScore: gameState.targetScore,
                    gameMode: gameState.gameMode,
                    difficulty: gameState.difficulty,
                    lastTakenCards: gameState.lastTakenCards,
                    lastTakenBy: gameState.lastTakenBy
                },
                timestamp: Date.now()
            }));
        } catch (e) { /* ignore */ }
    }
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
	roundIndicator.textContent = `R ${gameState.roundNumber}`;

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
                <span class="score-name">Вы:</span><span class="score-pts" id="player-total-score-display">0</span>
            </div>
        `;

		// Добавляем в хедер (game-info)
		const gameInfo = document.querySelector('header .game-info');
		if (gameInfo) {
			gameInfo.insertBefore(scoreDisplay, gameInfo.firstChild);
		}
	}

	// Обновляем значения общего счета
	if (gameState.totalScores && gameState.players) {
		const myIndex = gameState.isOnlineGame ? (gameState.playerIndex || 0) : 0;
		const playerScoreElement = document.getElementById('player-total-score-display');
		if (playerScoreElement) {
			playerScoreElement.textContent = gameState.totalScores[myIndex] || 0;
		}

		// Update score display content for all opponents
		const scoreValue = scoreDisplay.querySelector('.score-value');
		if (scoreValue) {
			let html = `<span class="score-name">Вы:</span><span class="score-pts">${gameState.totalScores[myIndex] || 0}</span>`;
			gameState.players.forEach((p, i) => {
				if (i !== myIndex) {
					const name = p.name || `Игрок ${i + 1}`;
					html += `<span class="score-name">${name}:</span><span class="score-pts">${gameState.totalScores[i] || 0}</span>`;
				}
			});
			scoreValue.innerHTML = html;
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
    // Update my collected count
    const myBadge = elements.playerCollected ? elements.playerCollected.querySelector('.collected-count') : null;
    if (myBadge) {
        if (gameState.isOnlineGame) {
            const myIndex = gameState.playerIndex != null ? gameState.playerIndex : 0;
            myBadge.textContent = gameState.players[myIndex] ? gameState.players[myIndex].collected.length : 0;
        } else {
            myBadge.textContent = gameState.players[0] ? gameState.players[0].collected.length : 0;
        }
    }

    // Update opponent wrappers
    document.querySelectorAll('.opponent-wrapper').forEach(wrapper => {
        const idx = parseInt(wrapper.id.replace('opp-sq-', ''));
        if (!isNaN(idx) && gameState.players[idx]) {
            const collectedBadge = wrapper.querySelector('.opp-collected-badge');
            if (collectedBadge) {
                const collectedCount = gameState.players[idx].collected ? gameState.players[idx].collected.length : 0;
                collectedBadge.textContent = collectedCount;
            }
        }
    });
}

// Функция обновления счетчика колоды
function updateDeckCount() {
	elements.deckCount.textContent = gameState.deck.length;
}

// Функции выбора карт
function selectHandCard(cardElement, card) {
	// Если игра закончена или не ход игрока, ничего не делаем
	if (gameState.gameEnded ||
		(gameState.isOnlineGame && !gameClient.isMyTurn()) ||
		(!gameState.isOnlineGame && gameState.currentPlayerIndex !== 0)) {
		return;
	}

	// Очищаем только предыдущий выбор карты руки. Выбор карт на столе сохраняем —
	// игрок мог сначала ткнуть карты на столе, а потом свою (обратный порядок).
	clearHandCardSelection();

	// Выбрать эту карту
	cardElement.classList.add('selected');
	gameState.selectedHandCard = card;

	// Валет: сбрасываем выбор стола и автоматически выбираем все доступные карты
	if (card.value === 'J' && gameState.tableCards.length > 0) {
		clearTableCardSelection();
		const validTableCards = gameState.tableCards.filter(c => !['Q', 'K'].includes(c.value));
		if (validTableCards.length > 0) {
			// Выделяем карты визуально
			const tableCardElements = elements.tableCards.querySelectorAll('.card');
			tableCardElements.forEach(el => {
				// Определяем карту по её содержимому
				const cardValue = el.dataset.value;
				const cardSuit = el.classList.contains('hearts') ? 'hearts' :
					el.classList.contains('diamonds') ? 'diamonds' :
					el.classList.contains('clubs') ? 'clubs' : 'spades';
				const matchingCard = validTableCards.find(c => c.value === cardValue && c.suit === cardSuit);
				if (matchingCard) {
					el.classList.add('selected');
				}
			});
			gameState.selectedTableCards = [...validTableCards];
			if (elements.confirmSelectionBtn) elements.confirmSelectionBtn.disabled = false;
			if (elements.gameMessage) elements.gameMessage.textContent = 'Подтвердите взятие карт';
			return;
		}
	}

	// Если карты на столе уже выбраны (игрок начал с них) — проверяем комбинацию,
	// иначе подсказываем, можно ли этой картой что-то взять.
	if (gameState.selectedTableCards.length > 0) {
		checkIfValidSelection();
	} else {
		checkIfCanTake();
	}
}

function selectTableCard(cardElement, card) {
	// Если игра закончена или не ход игрока, ничего не делаем.
	// Карту руки заранее НЕ требуем — игрок может начать выбор со стола.
	if (gameState.gameEnded ||
		(gameState.isOnlineGame && !gameClient.isMyTurn()) ||
		(!gameState.isOnlineGame && gameState.currentPlayerIndex !== 0)) {
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

	// Если карта руки уже выбрана — проверяем комбинацию, иначе ждём её выбора
	if (gameState.selectedHandCard) {
		checkIfValidSelection();
	} else {
		if (elements.confirmSelectionBtn) elements.confirmSelectionBtn.disabled = true;
		if (elements.gameMessage) elements.gameMessage.textContent = 'Теперь выберите свою карту';
	}
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

	// Анимация: взятые карты улетают к тому, кто взял (пока DOM ещё не перерисован)
	flyCardsToCollector([handCard, ...removedTableCards], player);

	// Обновить информацию о последней взятке
	gameState.lastTakenCards = [handCard, ...removedTableCards];
	gameState.lastTakenBy = player.name;
	updateLastTakenInfo();

	updateDeckCount();
}

// Клонирует взятые карты и пускает их лететь к стопке взявшего игрока.
// Вызывать ДО перерисовки доски — пока исходные элементы карт ещё на экране.
function flyCardsToCollector(cards, taker) {
	try {
		const takerIndex = gameState.players.indexOf(taker);
		if (takerIndex < 0) return;
		const myIndex = gameState.isOnlineGame ? (gameState.playerIndex || 0) : 0;

		// Куда летят: бейдж собранных карт взявшего
		let destEl;
		if (takerIndex === myIndex) {
			destEl = document.getElementById('player-collected');
		} else {
			const sq = document.getElementById(`opp-sq-${takerIndex}`);
			destEl = sq ? sq.querySelector('.opp-collected-badge') : null;
		}
		if (!destEl) return;
		const dr = destEl.getBoundingClientRect();
		const destX = dr.left + dr.width / 2;
		const destY = dr.top + dr.height / 2;

		// Ищем исходные элементы карт (на столе и в руке игрока), без повторов
		const pool = [
			...document.querySelectorAll('#table-cards .card'),
			...document.querySelectorAll('#player-cards .card')
		];
		const used = new Set();
		const sources = [];
		cards.forEach(card => {
			const el = pool.find(e => !used.has(e) &&
				e.dataset && e.dataset.value === card.value && e.dataset.suit === card.suit);
			if (el) { used.add(el); sources.push(el); }
		});
		if (!sources.length) return;

		sources.forEach((el, i) => {
			const r = el.getBoundingClientRect();
			if (!r.width) return;
			const clone = el.cloneNode(true);
			clone.classList.remove('selected');
			clone.style.cssText =
				`position:fixed; left:${r.left}px; top:${r.top}px; width:${r.width}px; height:${r.height}px;` +
				`margin:0; z-index:9990; pointer-events:none; will-change:transform,opacity;` +
				`box-shadow:0 6px 14px rgba(0,0,0,0.35); border-radius:6px;` +
				`transition:transform 0.6s cubic-bezier(.45,0,.25,1), opacity 0.6s ease;`;
			document.body.appendChild(clone);
			const dx = destX - (r.left + r.width / 2);
			const dy = destY - (r.top + r.height / 2);
			// небольшая задержка-каскад, чтобы карты летели «стайкой»
			requestAnimationFrame(() => {
				clone.style.transitionDelay = `${i * 45}ms`;
				clone.style.transform = `translate(${dx}px, ${dy}px) scale(0.18) rotate(${(i - 1) * 16}deg)`;
				clone.style.opacity = '0.15';
			});
			setTimeout(() => { if (clone.parentNode) clone.remove(); }, 700 + i * 45);
		});
	} catch (e) {
		console.warn('flyCardsToCollector error', e);
	}
}

let lastTakenHideTimer = null;

function updateLastTakenInfo() {
	// Сбрасываем предыдущий таймер скрытия и состояние затухания
	if (lastTakenHideTimer) { clearTimeout(lastTakenHideTimer); lastTakenHideTimer = null; }
	elements.lastTaken.classList.remove('lt-fade');

	if (!gameState.lastTakenCards || gameState.lastTakenCards.length === 0) {
		elements.lastTaken.classList.add('hidden');
		return;
	}

	// Обновление UI. Подпись в две строки: «Взял:» и имя ниже.
	elements.lastTakenCards.innerHTML = '';
	const safeName = String(gameState.lastTakenBy || '')
		.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
	elements.lastTakenBy.innerHTML = `<span class="lt-label">Взял:</span><span class="lt-name">${safeName}</span>`;

	// Порядок выкладки: сначала карты, взятые со стола (лежат снизу стопки),
	// сверху — карта, которой взяли (полностью видна, перекрывает на 70%).
	const handCard = gameState.lastTakenCards[0];
	const fromTable = gameState.lastTakenCards.slice(1);
	const ordered = [...fromTable, handCard];
	const n = ordered.length;
	const spread = Math.min(n * 4, 14); // общий размах веера в градусах

	ordered.forEach((card, i) => {
		const cardElement = createCardElement(card, false);
		const angle = n > 1 ? (-spread / 2 + (spread * i) / (n - 1)) : 0;
		cardElement.style.transform = `rotate(${angle.toFixed(1)}deg)`;
		cardElement.style.zIndex = String(i + 1);
		elements.lastTakenCards.appendChild(cardElement);
	});

	elements.lastTaken.classList.remove('hidden');

	// Показываем 5 секунд, затем плавно гасим (overlay невидим, но в потоке не мешает)
	lastTakenHideTimer = setTimeout(() => {
		elements.lastTaken.classList.add('lt-fade');
		lastTakenHideTimer = null;
	}, 5000);
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
		const isMyTurn = gameState.currentPlayerIndex === 0;
		elements.gameMessage.textContent = isMyTurn ? "Ваш ход" : `Ход: ${gameState.players[gameState.currentPlayerIndex].name}`;
	}, 2000);
}

// Проверяем, нужно ли раздать новые карты
function checkAndDealNewCards() {
	// Проверяем, все ли игроки использовали все карты в руке
	const allPlayersHandEmpty = gameState.players.every(player => player.hand.length === 0);

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

	// Проверяем, что игроки и их руки инициализированы
	if (!gameState.players || gameState.players.length < 2) {
		return;
	}

	// Проверка целостности колоды
	let totalCards = gameState.deck.length + gameState.tableCards.length;
	for (const p of gameState.players) {
		totalCards += p.hand.length + p.collected.length;
	}

	if (totalCards !== 52) {
		console.error("ОШИБКА: Количество карт в игре не равно 52! Найдено:", totalCards);
	}

	// Проверка зависания - если текущий игрок (компьютер) не может ходить
	if (gameState.currentPlayerIndex === 1 && gameState.players[1].hand.length === 0) {
		// Попытка восстановления
		if (checkAndDealNewCards()) {
			console.log("Розданы новые карты (восстановление)");
		} else {
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
    const isMyTurn = gameState.isOnlineGame
        ? gameClient.isMyTurn()
        : gameState.currentPlayerIndex === 0;

    if (elements.playerArea) elements.playerArea.classList.toggle('active', isMyTurn);
    // Подсветка своего блока, когда твой ход (как у соперников — #player-self
    // имеет класс opponent-square, так что та же анимация active-turn применится)
    const selfBlock = document.getElementById('player-self');
    if (selfBlock) selfBlock.classList.toggle('active-turn', isMyTurn);
    if (elements.discardCardBtn) elements.discardCardBtn.disabled = !isMyTurn;
    if (elements.confirmSelectionBtn) elements.confirmSelectionBtn.disabled = true;

    if (elements.gameMessage) {
        if (isMyTurn) {
            elements.gameMessage.textContent = 'Ваш ход';
        } else {
            const activePlayer = gameState.players[gameState.currentPlayerIndex];
            const name = activePlayer ? activePlayer.name : 'Соперник';
            elements.gameMessage.textContent = `Ход: ${name}`;
        }
    }

    // Update active state on opponent squares
    document.querySelectorAll('.opponent-wrapper').forEach(wrapper => {
        const idx = parseInt(wrapper.id.replace('opp-sq-', ''));
        const sq = wrapper.querySelector('.opponent-square');
        if (!isNaN(idx) && sq) {
            sq.classList.toggle('active-turn', idx === gameState.currentPlayerIndex);
        }
    });
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
		// Проверяем, можно ли раздать карты
		const allHandsEmpty = gameState.players.every(p => p.hand.length === 0);
		if (allHandsEmpty && gameState.deck.length > 0) {
			dealNewHands();
		} else if (allHandsEmpty && gameState.deck.length === 0) {
			endGame();
			return;
		}
	}

	// Обновить UI для текущего игрока
	updateActivePlayerUI();

	// Если следующий игрок - компьютер, сделать ход компьютера
	if (gameState.gameMode === 'player-vs-computer' && gameState.currentPlayerIndex === 1) {
		setTimeout(() => {
			try {
				if (gameState.difficulty === 'hard') {
					computerMoveHard();
				} else {
					computerMove();
				}
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
		renderGameState();

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

// ──────────────────────────────────────────────────────────────
// СЛОЖНЫЙ ИИ (Hard difficulty)
// ──────────────────────────────────────────────────────────────

// Базовый приоритетный вес одной карты (для оценки "добычи")
//
// Логика весов:
//   +2 очка за "больше карт" = самый ценный бонус раунда → высокая база
//   +1 очко за "больше крестей" → крести ценнее обычных карт
//   ♣2 и ♦10 по +1 очку каждая → важны, но НЕ важнее набора 4+ обычных карт
//
function cardPriorityScore(card) {
	let score = 25; // высокая база: количество карт — главный приоритет
	if (card.suit === 'clubs' && card.value === '2') score += 100; // ♣2: +1 гарантированное очко
	if (card.suit === 'diamonds' && card.value === '10') score += 100; // ♦10: +1 гарантированное очко
	if (card.suit === 'clubs') score += 30; // крести: вдвойне ценны (кол-во + масть)
	return score;
}

// Оцениваем целый ход (какой картой из руки + какие карты со стола взять)
// Возвращает итоговый счёт хода
function scoreMoveHard(handCard, tableCards) {
	if (tableCards.length === 0) return -1;

	let score = tableCards.reduce((s, c) => s + cardPriorityScore(c), 0);

	// Сильный бонус за количество (+35 за каждую карту сверх первой):
	// взять 4 обычных карты (205 очков) выгоднее, чем взять только ♣2 (155 очков)
	// взять 3 обычных карты (145 очков) ≈ ♣2 — примерно одинаково
	score += (tableCards.length - 1) * 35;

	// Штраф за "транжирство" Валета: если J берёт только 1 карту,
	// предпочитаем другую карту руки (если она тоже может взять эту карту)
	if (handCard.value === 'J' && tableCards.length === 1) {
		score -= 10;
	}

	return score;
}

// Находит лучший ход для конкретной карты из руки
function findBestMoveHard(handCard, tableCards) {
	let bestCards = [];
	let bestScore = -Infinity;

	if (handCard.value === 'J') {
		const validCards = tableCards.filter(card => !['Q', 'K'].includes(card.value));
		if (validCards.length > 0) {
			const score = scoreMoveHard(handCard, validCards);
			if (score > bestScore) {
				bestScore = score;
				bestCards = validCards;
			}
		}
	} else if (handCard.value === 'Q') {
		const queens = tableCards.filter(card => card.value === 'Q');
		if (queens.length > 0) {
			const score = scoreMoveHard(handCard, [queens[0]]);
			if (score > bestScore) {
				bestScore = score;
				bestCards = [queens[0]];
			}
		}
	} else if (handCard.value === 'K') {
		const kings = tableCards.filter(card => card.value === 'K');
		if (kings.length > 0) {
			const score = scoreMoveHard(handCard, [kings[0]]);
			if (score > bestScore) {
				bestScore = score;
				bestCards = [kings[0]];
			}
		}
	} else {
		// Для A и числовых карт: перебираем ВСЕ комбинации с суммой 11,
		// выбираем ту, что даёт максимальный счёт (больше карт + крести + артефакты)
		const validTable = handCard.value === 'A'
			? tableCards.filter(c => !['Q', 'K'].includes(c.value))
			: tableCards;

		for (let i = 1; i <= validTable.length; i++) {
			const combinations = getCombinations(validTable, i);
			for (const combo of combinations) {
				const sum = combo.reduce((s, c) => s + c.numericValue, 0);
				if (sum + handCard.numericValue === 11) {
					const score = scoreMoveHard(handCard, combo);
					if (score > bestScore) {
						bestScore = score;
						bestCards = combo;
					}
				}
			}
		}
	}

	if (bestScore === -Infinity || bestCards.length === 0) return null;
	return { cards: bestCards, score: bestScore };
}

// Выбор карты для сброса в сложном режиме
// Приоритет сохранения: ♣2 > ♦10 > J (любой) > крести > K/Q > остальные
function selectCardToDiscardHard(hand) {
	// 1. Сначала сбрасываем не-крестовые числовые (не J, Q, K, не ♣2, не ♦10)
	const tier1 = hand.filter(card =>
		!['J', 'Q', 'K'].includes(card.value) &&
		card.suit !== 'clubs' &&
		!(card.suit === 'diamonds' && card.value === '10')
	);
	if (tier1.length > 0) {
		// Среди них предпочтительно сбрасываем с большим numericValue
		// (чтобы оставить маленькие — они лучше комбинируются)
		return tier1.reduce((worst, card) => card.numericValue > worst.numericValue ? card : worst);
	}

	// 2. Дамы и Короли не-крестовые (ограниченная польза: берут только аналог)
	const tier2 = hand.filter(card =>
		['Q', 'K'].includes(card.value) && card.suit !== 'clubs'
	);
	if (tier2.length > 0) return tier2[0];

	// 3. Крестовые числовые (не ♣2)
	const tier3 = hand.filter(card =>
		card.suit === 'clubs' && card.value !== '2' && !['J', 'Q', 'K'].includes(card.value)
	);
	if (tier3.length > 0) {
		return tier3.reduce((worst, card) => card.numericValue > worst.numericValue ? card : worst);
	}

	// 4. Валеты (J) любой масти — очень ценны, сбрасываем в крайнем случае
	const tier4 = hand.filter(card => card.value === 'J');
	if (tier4.length > 0) {
		// Сначала не-крестовый J
		const nonClubJ = tier4.find(c => c.suit !== 'clubs');
		return nonClubJ || tier4[0];
	}

	// 5. Крестовые Q/K
	const tier5 = hand.filter(card => ['Q', 'K'].includes(card.value) && card.suit === 'clubs');
	if (tier5.length > 0) return tier5[0];

	// 6. ♦10 — только если совсем нет других вариантов
	const diamond10 = hand.find(card => card.suit === 'diamonds' && card.value === '10');
	if (diamond10 && hand.length > 1) return diamond10;

	// 7. ♣2 — абсолютный последний вариант
	return hand[0];
}

// Ход компьютера в сложном режиме
function computerMoveHard() {
	console.log("Ход компьютера (сложный режим)");
	const computer = gameState.players[1];

	if (!computer.hand || computer.hand.length === 0) {
		if (gameState.players[0].hand.length === 0 && gameState.deck.length > 0) {
			dealNewHands();
		} else {
			gameState.currentPlayerIndex = 0;
			updateActivePlayerUI();
		}
		return;
	}

	let madeMove = false;

	try {
		// Находим глобально лучший ход среди всех карт в руке
		let bestMove = null;
		let bestScore = -Infinity;

		for (const handCard of computer.hand) {
			const move = findBestMoveHard(handCard, gameState.tableCards);
			if (move && move.score > bestScore) {
				bestScore = move.score;
				bestMove = { handCard, tableCards: move.cards };
			}
		}

		if (bestMove && bestMove.tableCards.length > 0) {
			takeCards(computer, bestMove.handCard, bestMove.tableCards);
			madeMove = true;
		}

		// Если взять нечего — сбрасываем умно
		if (!madeMove) {
			const cardToDiscard = selectCardToDiscardHard(computer.hand);
			discardCard(computer, cardToDiscard);
			madeMove = true;
		}

		renderGameState();

		checkAndDealNewCards();

		setTimeout(() => {
			nextTurn();
		}, 500);

	} catch (error) {
		console.error("Ошибка в ходе компьютера (сложный):", error);
		gameState.currentPlayerIndex = 0;
		updateActivePlayerUI();
	}
}

// ──────────────────────────────────────────────────────────────

function checkGameEnd() {
	// Проверить, пуста ли колода и у игроков нет карт
	return gameState.deck.length === 0 &&
		gameState.players.every(player => player.hand.length === 0);
}

function endGame() {
	gameState.gameEnded = true;
	localStorage.removeItem('localGameBackup');
	localStorage.removeItem('gameStateBackup');

	// Если это онлайн-игра, ждем обновления от сервера
	if (gameState.isOnlineGame) {
		return;
	}

	// Сначала проверяем, готовы ли необходимые элементы DOM
	const gameResultsSection = document.getElementById('game-results');
	if (!gameResultsSection) {
		console.error("Не найден элемент game-results");
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
	gameState.players.forEach((p, i) => {
		if (!gameState.totalScores[i]) gameState.totalScores[i] = 0;
		gameState.totalScores[i] += p.score;
	});

	// Запись статистики игры против компьютера (один раз, когда матч завершён)
	if (!gameState._compStatRecorded) {
		const playerWon = gameState.totalScores[0] >= gameState.targetScore;
		const compWon = gameState.totalScores[1] >= gameState.targetScore;
		if (playerWon || compWon) {
			gameState._compStatRecorded = true;
			if (window.PantiAuth && typeof window.PantiAuth.reportComputerResult === 'function') {
				window.PantiAuth.reportComputerResult(playerWon);
			}
		}
	}

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

// Функция для отображения результатов и изменения текста кнопки
function displayResults() {
    const numPlayers = gameState.players ? gameState.players.length : 2;
    const myIndex = gameState.isOnlineGame ? (gameState.playerIndex || 0) : 0;
    const container = document.getElementById('results-dynamic');
    if (!container) return;

    // Sort players by score descending for display
    const sorted = gameState.players
        .map((p, i) => ({ ...p, originalIndex: i }))
        .sort((a, b) => b.score - a.score);

    const maxScore = sorted[0] ? sorted[0].score : 0;

    let html = `<table class="results-table">
        <thead>
            <tr>
                <th>#</th>
                <th>Игрок</th>
                <th>Карт</th>
                <th>♣</th>
                <th>♣2</th>
                <th>♦10</th>
                <th>Бонус</th>
                <th>Очки</th>
                <th>Всего</th>
            </tr>
        </thead>
        <tbody>`;

    sorted.forEach((player, rank) => {
        const isWinner = player.score === maxScore && maxScore > 0;
        const isMe = player.originalIndex === myIndex;
        const clubsCount = player.collected ? player.collected.filter(c => c.suit === 'clubs').length : 0;
        const cardCount = player.collected ? player.collected.length : 0;
        const totalScore = gameState.totalScores ? (gameState.totalScores[player.originalIndex] || 0) : player.score;

        let rowClass = '';
        if (isWinner) rowClass += ' results-winner';
        if (isMe) rowClass += ' results-you';

        html += `<tr class="${rowClass}">
            <td>${rank + 1}</td>
            <td>${player.name}${isMe ? ' <em>(Вы)</em>' : ''}</td>
            <td>${cardCount}</td>
            <td>${clubsCount}</td>
            <td>${player.hasClub2 ? '<span class="yes-badge">+1</span>' : '<span class="no-badge">—</span>'}</td>
            <td>${player.hasDiamond10 ? '<span class="yes-badge">+1</span>' : '<span class="no-badge">—</span>'}</td>
            <td>+${player.bonusPoints || 0}</td>
            <td><strong>${player.score || 0}</strong></td>
            <td>${totalScore}</td>
        </tr>`;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;

    // Winner message
    const winnerEl = document.getElementById('game-winner');
    if (winnerEl) {
        const winner = sorted[0];
        if (gameState.matchWinner !== null && gameState.matchWinner !== undefined) {
            const matchWinnerPlayer = gameState.players[gameState.matchWinner];
            winnerEl.textContent = `🏆 ${matchWinnerPlayer ? matchWinnerPlayer.name : ''} победил в матче!`;
        } else if (winner && maxScore > 0) {
            const tie = sorted.filter(p => p.score === maxScore).length > 1;
            winnerEl.textContent = tie ? '🤝 Ничья в раунде!' : `🏆 ${winner.name} выигрывает раунд!`;
        } else {
            winnerEl.textContent = '';
        }
    }

    // Update new game button text
    const newGameBtn = document.getElementById('new-game-btn');
    if (newGameBtn) {
        if (gameState.matchWinner !== null && gameState.matchWinner !== undefined) {
            newGameBtn.textContent = 'Новый матч';
        } else {
            newGameBtn.textContent = `Раунд ${(gameState.roundNumber || 1) + 1} →`;
        }
    }

    // Show fireworks/celebration if I won
    const myPlayer = gameState.players[myIndex];
    const myScore = myPlayer ? myPlayer.score : 0;
    if (myScore === maxScore && maxScore > 0) {
        createFireworks();
    }
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

	// Если это онлайн-игра, отправляем запрос на сервер
	if (gameState.isOnlineGame) {
		gameClient.startNewRound();
		return;
	}

	// Сначала проверим, что элементы DOM готовы
	const gameBoard = document.getElementById('game-board');
	if (!gameBoard) {
		console.error("Не найден элемент game-board");
		// В случае проблемы сбрасываем и начинаем заново
		resetGame();
		return;
	}

	// проверка - убедимся, что стол очищен
	if (gameState.tableCards.length > 0) {
		console.warn("Перед началом нового раунда на столе остались карты. Принудительная очистка...");
		if (gameState.lastPlayerWhoTook) {
			gameState.lastPlayerWhoTook.collected.push(...gameState.tableCards);
		} else {
			const randomPlayerIndex = Math.floor(Math.random() * gameState.players.length);
			gameState.players[randomPlayerIndex].collected.push(...gameState.tableCards);
		}
		gameState.tableCards = [];
	}

	// Увеличиваем номер раунда
	gameState.roundNumber++;

	// Сохраняем общий счет
	const totalScores = [...gameState.totalScores];
	const roundNumber = gameState.roundNumber;

	// Инициализируем игру заново
	initializeGame();

	// Восстанавливаем общий счет и номер раунда
	gameState.totalScores = totalScores;
	gameState.roundNumber = roundNumber;

	// Запускаем игровой процесс
	startGameplay();
}

// Функции настройки игры
function startGame() {
	// Читаем сложность из UI (выбирается до начала игры)
	const difficultyInputs = document.querySelectorAll('input[name="difficulty"]');
	for (const input of difficultyInputs) {
		if (input.checked) {
			gameState.difficulty = input.value;
			break;
		}
	}

	// Читаем длину игры (целевые очки): по умолчанию 21, короткая — 11
	let target = 21;
	const targetInputs = document.querySelectorAll('input[name="target-score"]');
	for (const input of targetInputs) {
		if (input.checked) { target = parseInt(input.value, 10) || 21; break; }
	}
	gameState.targetScore = target;

	// Режим всегда player-vs-computer для этой кнопки
	gameState.gameMode = 'player-vs-computer';

	// Сбрасываем флаг онлайн-игры для локального режима
	gameState.isOnlineGame = false;

	// Сбрасываем счет и номер раунда
	gameState.totalScores = [0, 0];
	gameState.roundNumber = 1;
	gameState._compStatRecorded = false;

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
			if (gameState.difficulty === 'hard') {
				computerMoveHard();
			} else {
				computerMove();
			}
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
	if (!gameState.gameEnded && (gameState.isOnlineGame || (gameState.players[0] && gameState.players[0].hand.length > 0) || (gameState.players[1] && gameState.players[1].hand.length > 0))) {
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
	hideOpponentWaiting();

	// Уведомить сервер о выходе (если онлайн-игра)
	if (gameState.isOnlineGame && gameClient) {
		gameClient.leaveGame();
	}

	// Очистить анимацию победы
	if (fireworksIntervalId) {
		clearInterval(fireworksIntervalId);
		fireworksIntervalId = null;
	}

	// Убрать полноэкранный фейерверк
	const fullscreenFireworks = document.getElementById('fullscreen-fireworks');
	if (fullscreenFireworks) fullscreenFireworks.remove();

	// Сбросить игровое состояние и UI
	showSection(gameSections.setup);

	// Очистить весь динамический контент
	elements.playerCards.innerHTML = '';
	if (elements.opponentsContainer) elements.opponentsContainer.innerHTML = '';
	elements.tableCards.innerHTML = '';
	elements.gameMessage.textContent = '';
	elements.lastTakenCards.innerHTML = '';
	elements.lastTakenBy.textContent = '';
	elements.lastTaken.classList.add('hidden');

	// Сбросить счетчик собранных карт игрока
	const playerCollectedCount = elements.playerCollected ? elements.playerCollected.querySelector('.collected-count') : null;
	if (playerCollectedCount) playerCollectedCount.textContent = '0';

	// Сбросить счетчик колоды
	elements.deckCount.textContent = '52';

	// Сбросить флаги онлайн-игры
	gameState.isOnlineGame = false;
	gameState.roomId = null;
	gameState.playerIndex = null;

	// Очищаем бэкапы состояния
	localStorage.removeItem('gameStateBackup');
	localStorage.removeItem('localGameBackup');

	// Сбросить счет и номер раунда при полном выходе из игры
	gameState.totalScores = [0, 0];
	gameState.roundNumber = 1;

	// Восстанавливаем вкладки онлайн-секции
	const onlineTabs = document.getElementById('online-action-tabs');
	const createPanel = document.getElementById('create-panel');
	const joinPanel = document.getElementById('join-panel');
	if (onlineTabs) onlineTabs.classList.remove('hidden');
	if (createPanel) createPanel.classList.remove('hidden');
	if (joinPanel) joinPanel.classList.add('hidden');
	// Активируем вкладку "Создать"
	document.querySelectorAll('.online-tab').forEach(t =>
		t.classList.toggle('active', t.dataset.tab === 'create')
	);

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
	const hasMatchWinner = gameState.totalScores.some(s => s >= gameState.targetScore);

	if (hasMatchWinner) {
		// Если есть победитель матча, полностью сбрасываем игру
		resetGame();
	} else {
		try {
			// Сначала явно завершаем текущий раунд, чтобы обработать оставшиеся карты
			finishCurrentRound();

			// Затем начинаем новый раунд с небольшой задержкой
			setTimeout(() => {
				startNewRound();
			}, 500); // Небольшая задержка для применения изменений на сервере
		} catch (error) {
			console.error("Ошибка при начале нового раунда:", error);
			// В случае ошибки сбрасываем игру полностью
			resetGame();
		}
	}
}

// Функция для явного завершения текущего раунда
function finishCurrentRound() {
	console.log("Явное завершение текущего раунда перед началом нового");

	// Проверяем, есть ли карты на столе, и если да, отдаем их последнему игроку, взявшему карты
	if (gameState.tableCards.length > 0) {
		if (gameState.lastPlayerWhoTook) {
			console.log(`Передаем ${gameState.tableCards.length} оставшихся карт игроку ${gameState.lastPlayerWhoTook.name}`);
			// Добавляем карты со стола в собранные карты этого игрока
			gameState.lastPlayerWhoTook.collected.push(...gameState.tableCards);
			// Очищаем стол
			gameState.tableCards = [];
		} else {
			console.warn("На столе остались карты, но нет последнего игрока, взявшего карты");
			// В этом случае распределяем карты случайным образом между игроками
			const randomPlayerIndex = Math.floor(Math.random() * gameState.players.length);
			console.log(`Случайно распределяем карты игроку ${gameState.players[randomPlayerIndex].name}`);
			gameState.players[randomPlayerIndex].collected.push(...gameState.tableCards);
			gameState.tableCards = [];
		}
	}

	// Сохраняем состояние, если это онлайн-игра
	if (gameState.isOnlineGame) {
		// В онлайн-игре отправляем серверу запрос на завершение раунда
		gameClient.finishRound();
	}
}

// Функция для отмены выбора всех карт при клике на пустое место
// Функция для отмены выбора всех карт при клике на пустое место
function setupCancelSelectionOnEmptyClick() {
	console.log("Настройка отмены выбора карт при клике на пустое место...");

	// Находим игровой стол
	const gameTable = document.querySelector('.game-table');
	if (!gameTable) {
		console.error("Игровой стол не найден!");
		return;
	}

	// Добавляем обработчик клика
	gameTable.addEventListener('click', function(event) {
		console.log("Клик на игровом столе", event.target);

		// Проверяем, был ли клик на самом игровом столе или на области table-cards
		// но не на конкретной карте
		if (event.target === gameTable ||
			(event.target.classList.contains('table-cards') &&
				!event.target.classList.contains('card'))) {

			console.log("Отмена выбора карт");

			// Снимаем выделение с карт в руке
			const handCards = document.querySelectorAll('#player-cards .card');
			handCards.forEach(card => card.classList.remove('selected'));

			// Снимаем выделение с карт на столе
			const tableCards = document.querySelectorAll('#table-cards .card');
			tableCards.forEach(card => card.classList.remove('selected'));

			// Сбрасываем выбор в состоянии игры
			if (typeof gameState !== 'undefined') {
				gameState.selectedHandCard = null;
				gameState.selectedTableCards = [];
			}

			// Отключаем кнопку подтверждения
			const confirmBtn = document.getElementById('confirm-selection-btn');
			if (confirmBtn) {
				confirmBtn.disabled = true;
			}

			// Обновляем сообщение для игрока
			const gameMessage = document.getElementById('game-message');
			if (gameMessage) {
				gameMessage.textContent = "Выбор отменен. Выберите карту из руки.";

				// Через небольшую паузу возвращаем стандартное сообщение
				setTimeout(() => {
					if (typeof gameState !== 'undefined') {
						if (gameState.isOnlineGame) {
							if (typeof gameClient !== 'undefined' && gameClient.isMyTurn) {
								gameMessage.textContent = gameClient.isMyTurn() ? "Ваш ход" : "Ход соперника";
							}
						} else {
							gameMessage.textContent = gameState.currentPlayerIndex === 0 ? "Ваш ход" : "Ход соперника";
						}
					}
				}, 1500);
			}
		}
	});

	// Дополнительно добавляем обработчик на пустую область карт стола
	const tableCards = document.querySelector('#table-cards');
	if (tableCards) {
		tableCards.addEventListener('click', function(event) {
			// Проверяем, был ли клик непосредственно на контейнере, а не на карте
			if (event.target === tableCards) {
				console.log("Клик на пустой области карт стола");

				// Снимаем выделение с карт в руке
				const handCards = document.querySelectorAll('#player-cards .card');
				handCards.forEach(card => card.classList.remove('selected'));

				// Снимаем выделение с карт на столе
				const tableCards = document.querySelectorAll('#table-cards .card');
				tableCards.forEach(card => card.classList.remove('selected'));

				// Сбрасываем выбор в состоянии игры
				if (typeof gameState !== 'undefined') {
					gameState.selectedHandCard = null;
					gameState.selectedTableCards = [];
				}

				// Отключаем кнопку подтверждения
				const confirmBtn = document.getElementById('confirm-selection-btn');
				if (confirmBtn) {
					confirmBtn.disabled = true;
				}

				// Обновляем сообщение для игрока
				const gameMessage = document.getElementById('game-message');
				if (gameMessage) {
					gameMessage.textContent = "Выбор отменен. Выберите карту из руки.";

					// Через небольшую паузу возвращаем стандартное сообщение
					setTimeout(() => {
						if (typeof gameState !== 'undefined') {
							if (gameState.isOnlineGame) {
								if (typeof gameClient !== 'undefined' && gameClient.isMyTurn) {
									gameMessage.textContent = gameClient.isMyTurn() ? "Ваш ход" : "Ход соперника";
								}
							} else {
								gameMessage.textContent = gameState.currentPlayerIndex === 0 ? "Ваш ход" : "Ход соперника";
							}
						}
					}, 1500);
				}

				// Предотвращаем всплытие события, чтобы не сработал обработчик на gameTable
				event.stopPropagation();
			}
		});
	}

	console.log("Настройка отмены выбора карт завершена");
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

	// Эмоции игрока (свой блок между кнопками)
	setupEmojiFeature();

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
	const exitToMenuBtn = document.getElementById('exit-to-menu-btn');
	if (exitToMenuBtn) {
		// Явный выход в главное меню с экрана результатов (без подтверждения — раунд уже сыгран)
		exitToMenuBtn.addEventListener('click', () => { hideOpponentWaiting(); performReset(); });
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
	setupCancelSelectionOnEmptyClick();

	// Переключение между режимами: компьютер / онлайн
	const gameModeRadios = document.querySelectorAll('input[name="game-mode"]');
	const computerModeOptions = document.getElementById('computer-mode-options');
	const onlineSection = document.getElementById('online-section');

	function updateModeVisibility() {
		const selectedMode = document.querySelector('input[name="game-mode"]:checked');
		if (!selectedMode) return;
		if (selectedMode.value === 'online') {
			if (computerModeOptions) computerModeOptions.classList.add('hidden');
			if (onlineSection) onlineSection.classList.remove('hidden');
		} else {
			if (computerModeOptions) computerModeOptions.classList.remove('hidden');
			if (onlineSection) onlineSection.classList.add('hidden');
		}
	}

	gameModeRadios.forEach(radio => {
		radio.addEventListener('change', updateModeVisibility);
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

// Маппинг значений карт к именам файлов
const VALUE_TO_FILENAME = {
	'A': 'ace', 'J': 'jack', 'Q': 'queen', 'K': 'king'
};

function getCardImagePath(card) {
	const valueName = VALUE_TO_FILENAME[card.value] || card.value;
	return `/images/cards/${valueName}_of_${card.suit}.png`;
}

// Тихо предзагружаем все картинки карт, чтобы они не «проявлялись» при первом показе.
// Запускается один раз после загрузки страницы; браузер/SW кладут их в кэш.
let cardsPreloaded = false;
function preloadCardImages() {
	if (cardsPreloaded) return;
	cardsPreloaded = true;
	const values = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
	const suits = ['hearts','diamonds','clubs','spades'];
	const paths = ['/images/cards/card_back.png'];
	for (const v of values) {
		for (const s of suits) paths.push(getCardImagePath({ value: v, suit: s }));
	}
	paths.forEach(src => { const im = new Image(); im.src = src; });
}
// Предзагрузку карт (~1.2 МБ) запускаем в простое после загрузки страницы,
// чтобы НЕ конкурировать с критичными CSS/JS при первом открытии.
function schedulePreloadCards() {
	if (typeof requestIdleCallback === 'function') {
		requestIdleCallback(preloadCardImages, { timeout: 4000 });
	} else {
		setTimeout(preloadCardImages, 1500);
	}
}
if (document.readyState === 'complete') {
	schedulePreloadCards();
} else {
	window.addEventListener('load', schedulePreloadCards);
}

// Функции отображения карт
function createCardElement(card, isPlayerCard = false) {
	const cardElement = document.createElement('div');
	cardElement.className = `card ${card.suit}`;
	cardElement.dataset.value = card.value;
	cardElement.dataset.suit = card.suit;

	const img = document.createElement('img');
	img.src = getCardImagePath(card);
	img.alt = `${card.value} ${SUIT_SYMBOLS[card.suit]}`;
	img.className = 'card-img';
	img.draggable = false;
	cardElement.appendChild(img);

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
	const img = document.createElement('img');
	img.src = '/images/cards/card_back.png';
	img.alt = 'Card back';
	img.className = 'card-img';
	img.draggable = false;
	cardBack.appendChild(img);
	return cardBack;
}

function renderPlayerHand(player, containerElement, isVisible = true) {
	containerElement.innerHTML = '';
	const totalCards = player.hand.length;
	if (totalCards === 0) return;

	// Получаем базовую ширину карты из CSS-переменной
	const baseCardWidth = parseFloat(
		getComputedStyle(document.documentElement).getPropertyValue('--card-width')
	) || 85;

	// Масштаб: игрок — 1.4375×, противник — 0.45×
	const cardW = isVisible
		? baseCardWidth * 1.4375
		: baseCardWidth * 0.45;

	// Шаг: 52% ширины карты → ~48% каждой карты перекрыто предыдущей
	const step = cardW * 0.52;

	// Угол веера (немного меньше при большом размере карт)
	const maxHalfAngle = isVisible
		? Math.min(22, totalCards * 3.5)
		: Math.min(25, totalCards * 4);

	player.hand.forEach((card, index) => {
		const cardElement = isVisible
			? createCardElement(card, true)
			: displayCardBack();

		if (isVisible) {
			cardElement.classList.add('own-card');
		} else {
			cardElement.classList.add('opponent-card');
		}

		const t = totalCards > 1 ? index / (totalCards - 1) : 0.5;
		const angle = totalCards > 1 ? (t - 0.5) * 2 * maxHalfAngle : 0;
		// Расположение с перекрытием: каждая карта сдвинута на step от предыдущей
		const offset = totalCards > 1 ? (index - (totalCards - 1) / 2) * step : 0;

		cardElement.style.setProperty('--fan-angle', `${angle}deg`);
		cardElement.style.setProperty('--fan-offset', `${offset}px`);
		cardElement.style.zIndex = index + 1;

		containerElement.appendChild(cardElement);
	});
}

// ===== Эмоции игрока =====
const EMOJI_LIST = [
	'😀','😂','😅','😎','😍','😘',
	'🤣','😜','🤔','😐','😴','🥱',
	'😡','😭','😱','🤯','🥳','😏',
	'👍','👎','👏','🙏','🔥','🎉',
	'❤️','💩','🤝','🙈'
];

// Готовые фразы-подколки (шлются тем же каналом, что и эмодзи)
const PHRASE_LIST = [
	'Ходи уже!',
	'Думай быстрее ⏳',
	'Да как так?! 😤',
	'Красава! 👏',
	'Мне сегодня везёт 😎'
];

function setupEmojiFeature() {
	const block = document.getElementById('player-self');
	const picker = document.getElementById('emoji-picker');
	if (!block || !picker) return;

	// Один раз строим: сначала фразы (на всю ширину), потом сетку эмодзи
	if (!picker.dataset.built) {
		PHRASE_LIST.forEach(p => {
			const b = document.createElement('button');
			b.type = 'button';
			b.className = 'emoji-phrase';
			b.textContent = p;
			b.addEventListener('click', (ev) => { ev.stopPropagation(); pickEmoji(p); });
			picker.appendChild(b);
		});
		EMOJI_LIST.forEach(e => {
			const b = document.createElement('button');
			b.type = 'button';
			b.textContent = e;
			b.addEventListener('click', (ev) => {
				ev.stopPropagation();
				pickEmoji(e);
			});
			picker.appendChild(b);
		});
		picker.dataset.built = '1';
	}

	// Тап по своему блоку — показать/скрыть сетку
	block.addEventListener('click', (ev) => {
		ev.stopPropagation();
		picker.classList.toggle('hidden');
	});

	// Клик вне сетки — закрыть
	document.addEventListener('click', (ev) => {
		if (picker.classList.contains('hidden')) return;
		if (!picker.contains(ev.target) && !block.contains(ev.target)) {
			picker.classList.add('hidden');
		}
	});
}

function pickEmoji(emoji) {
	const picker = document.getElementById('emoji-picker');
	if (picker) picker.classList.add('hidden');
	// Фразы (с буквами) — крупной всплывашкой по центру (на маленькой плашке текст не виден);
	// эмодзи — крупно на плашке игрока.
	if (/[A-Za-zА-Яа-я]/.test(emoji)) {
		showPhraseToast(selfDisplayName(), emoji, true);
	} else {
		showEmoteOn(document.getElementById('player-self'), emoji);
	}
	if (gameState.isOnlineGame && gameClient && typeof gameClient.sendEmoji === 'function') {
		gameClient.sendEmoji(emoji);
	}
}

function selfDisplayName() {
	if (gameState.isOnlineGame) {
		const i = gameState.playerIndex != null ? gameState.playerIndex : 0;
		return (gameState.players[i] || {}).name || 'Вы';
	}
	return 'Вы';
}

// Всплывающее сообщение-фраза по центру сверху (видно всегда, в отличие от пузыря на плашке)
function showPhraseToast(name, text, mine) {
	let t = document.getElementById('phrase-toast');
	if (!t) {
		t = document.createElement('div');
		t.id = 'phrase-toast';
		document.body.appendChild(t);
	}
	t.className = mine ? 'mine' : '';
	t.innerHTML = '<span class="pt-name"></span><span class="pt-text"></span>';
	t.querySelector('.pt-name').textContent = name + ': ';
	t.querySelector('.pt-text').textContent = text;
	t.classList.remove('show');
	void t.offsetWidth;
	t.classList.add('show');
	clearTimeout(t._hideT);
	t._hideT = setTimeout(() => t.classList.remove('show'), 4000);
}

// Показать эмоцию крупно на блоке игрока (своём или сопернике) на ~4 сек
function showEmoteOn(targetEl, emoji) {
	if (!targetEl) return;
	let ov = targetEl.querySelector('.emote-overlay');
	if (!ov) {
		ov = document.createElement('span');
		ov.className = 'emote-overlay';
		targetEl.appendChild(ov);
	}
	ov.textContent = emoji;
	// Фраза (есть буквы) показывается как речевой пузырь над плашкой; эмодзи — крупно в плашке
	const isPhrase = /[A-Za-zА-Яа-я]/.test(emoji);
	ov.classList.toggle('phrase', isPhrase);
	ov.classList.remove('show');
	void ov.offsetWidth; // перезапуск анимации
	ov.classList.add('show');
	clearTimeout(ov._hideT);
	ov._hideT = setTimeout(() => ov.classList.remove('show'), 4000);
}

// Эмоция пришла от другого игрока — фраза всплывашкой, эмодзи на его плашке
function handlePlayerEmoji(data) {
	if (!data || data.playerIndex == null || !data.emoji) return;
	if (/[A-Za-zА-Яа-я]/.test(data.emoji)) {
		const name = (gameState.players[data.playerIndex] || {}).name || 'Соперник';
		showPhraseToast(name, data.emoji, false);
	} else {
		const sq = document.querySelector('#opp-sq-' + data.playerIndex + ' .opponent-square');
		showEmoteOn(sq, data.emoji);
	}
}

// Полноэкранный фейерверк — настоящий салют
let fireworksIntervalId = null;

function createFireworks() {
	// Убираем старый
	const old = document.getElementById('fullscreen-fireworks');
	if (old) old.remove();

	// Стили анимации
	if (!document.getElementById('win-pulse-style')) {
		const style = document.createElement('style');
		style.id = 'win-pulse-style';
		style.textContent = `
			@keyframes win-pulse {
				0%, 100% { transform: translateX(-50%) scale(1); opacity: 1; }
				50% { transform: translateX(-50%) scale(1.1); opacity: 0.9; }
			}
			@keyframes win-fade-in {
				from { opacity: 0; transform: translateX(-50%) scale(0.5); }
				to { opacity: 1; transform: translateX(-50%) scale(1); }
			}
		`;
		document.head.appendChild(style);
	}

	// Контейнер
	const overlay = document.createElement('div');
	overlay.id = 'fullscreen-fireworks';
	overlay.style.cssText = 'position:fixed;inset:0;z-index:9998;overflow:hidden;background:radial-gradient(ellipse at 50% 130%, #241a4d 0%, #0d0a28 55%, #04030f 100%);';
	document.body.appendChild(overlay);

	// Canvas (под надписью)
	const canvas = document.createElement('canvas');
	canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;';
	overlay.appendChild(canvas);

	// Надпись поверх canvas
	const label = document.createElement('div');
	label.textContent = 'Вы выиграли!';
	label.style.cssText = `
		position:absolute; top:18%; left:50%; transform:translateX(-50%);
		font-size:clamp(2.2rem, 9vw, 5rem); font-weight:900;
		color:#fff; text-align:center; z-index:10; white-space:nowrap;
		text-shadow: 0 0 30px #ffa502, 0 0 60px #ff4757, 0 0 100px #ff6348, 0 4px 10px rgba(0,0,0,0.7);
		animation: win-fade-in 0.8s ease-out forwards, win-pulse 1.5s ease-in-out 0.8s infinite;
		font-family:'Roboto',sans-serif; letter-spacing:3px;
		pointer-events:none;
	`;
	overlay.appendChild(label);

	const ctx = canvas.getContext('2d');
	const dpr = Math.min(window.devicePixelRatio || 1, 2);
	let W, H;
	function resize() {
		W = window.innerWidth;
		H = window.innerHeight;
		canvas.width = Math.floor(W * dpr);
		canvas.height = Math.floor(H * dpr);
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	}
	resize();
	window.addEventListener('resize', resize);

	// Гармоничные палитры — каждый залп берёт одну
	const palettes = [
		['#ff4d6d', '#ff8fa3', '#ffd6e0'],   // роза
		['#ffd23f', '#ff9505', '#ff6b00'],   // золото-огонь
		['#48cae4', '#90e0ef', '#caf0f8'],   // лёд
		['#b388ff', '#e0aaff', '#f4d9ff'],   // фиалка
		['#80ffdb', '#64dfdf', '#caffbf'],   // мята
		['#ffffff', '#fff3b0', '#ffd6a5'],   // тёплый свет
		['#ff5cc6', '#ff8fd0', '#7afcff']    // неон
	];

	const rand = (a, b) => a + Math.random() * (b - a);
	const pick = arr => arr[Math.floor(Math.random() * arr.length)];

	const particles = [];
	const rockets = [];
	let animId = null;

	class Particle {
		constructor(x, y, vx, vy, color, o = {}) {
			this.x = x; this.y = y; this.px = x; this.py = y;
			this.vx = vx; this.vy = vy; this.color = color;
			this.gravity = o.gravity != null ? o.gravity : 0.045;
			this.drag = o.drag != null ? o.drag : 0.972;
			this.size = o.size != null ? o.size : rand(1.4, 2.6);
			this.life = o.life != null ? o.life : rand(55, 95);
			this.maxLife = this.life;
			this.twinkle = o.twinkle != null ? o.twinkle : (Math.random() < 0.4);
		}
		update() {
			this.px = this.x; this.py = this.y;
			this.vx *= this.drag;
			this.vy = this.vy * this.drag + this.gravity;
			this.x += this.vx;
			this.y += this.vy;
			this.life--;
		}
		draw() {
			const a = this.life / this.maxLife;
			let alpha = a < 0 ? 0 : a;
			if (this.twinkle && this.life < this.maxLife * 0.55) {
				alpha *= 0.35 + 0.65 * Math.abs(Math.sin(this.life * 0.7));
			}
			ctx.globalAlpha = alpha;
			ctx.fillStyle = this.color;
			ctx.strokeStyle = this.color;
			const dx = this.x - this.px, dy = this.y - this.py;
			if (dx * dx + dy * dy < 0.7) {
				ctx.beginPath();
				ctx.arc(this.x, this.y, this.size * 0.65, 0, Math.PI * 2);
				ctx.fill();
			} else {
				ctx.lineWidth = this.size;
				ctx.lineCap = 'round';
				ctx.beginPath();
				ctx.moveTo(this.px, this.py);
				ctx.lineTo(this.x, this.y);
				ctx.stroke();
			}
		}
	}

	// Разрыв снаряда — разные формы цветка
	function burst(x, y) {
		const palette = pick(palettes);
		// Яркая центральная вспышка
		particles.push(new Particle(x, y, 0, 0, '#ffffff',
			{ gravity: 0, drag: 0.7, size: 16, life: 9, twinkle: false }));

		const t = Math.random();
		if (t < 0.22) {
			// Кольцо
			const count = 72, sp = rand(4.5, 6), col = pick(palette);
			for (let i = 0; i < count; i++) {
				const ang = (Math.PI * 2 * i) / count;
				particles.push(new Particle(x, y, Math.cos(ang) * sp, Math.sin(ang) * sp, col,
					{ life: rand(60, 82), size: rand(1.6, 2.4) }));
			}
		} else if (t < 0.44) {
			// Ива — золотые ниспадающие нити
			const count = 120, golds = ['#ffd23f', '#ffb703', '#ffe08a', '#fff3b0'];
			for (let i = 0; i < count; i++) {
				const ang = rand(0, Math.PI * 2), sp = rand(1.5, 5);
				particles.push(new Particle(x, y, Math.cos(ang) * sp, Math.sin(ang) * sp - 1.2, pick(golds),
					{ gravity: 0.085, drag: 0.987, life: rand(115, 155), size: rand(1.6, 2.8), twinkle: true }));
			}
		} else if (t < 0.64) {
			// Двойное кольцо разных цветов
			const c1 = palette[0], c2 = palette[1];
			[[3.2, c1], [6, c2]].forEach(([r, c]) => {
				const count = 62;
				for (let i = 0; i < count; i++) {
					const ang = (Math.PI * 2 * i) / count;
					particles.push(new Particle(x, y, Math.cos(ang) * r, Math.sin(ang) * r, c,
						{ life: rand(55, 80), size: rand(1.5, 2.3) }));
				}
			});
		} else {
			// Хризантема — плотный двухцветный шар
			const count = 150, c1 = pick(palette), c2 = pick(palette);
			for (let i = 0; i < count; i++) {
				const ang = rand(0, Math.PI * 2);
				const sp = rand(1, 7.5) * (0.55 + 0.45 * Math.random());
				particles.push(new Particle(x, y, Math.cos(ang) * sp, Math.sin(ang) * sp,
					Math.random() < 0.5 ? c1 : c2,
					{ life: rand(55, 98), size: rand(1.5, 2.9), twinkle: true }));
			}
		}
		// Белые искры-блёстки поверх любого разрыва
		for (let i = 0; i < 30; i++) {
			const a = rand(0, Math.PI * 2), s = rand(0.5, 3.2);
			particles.push(new Particle(x, y, Math.cos(a) * s, Math.sin(a) * s, '#ffffff',
				{ life: rand(18, 40), size: rand(0.8, 1.7), gravity: 0.03, twinkle: true }));
		}
	}

	class Rocket {
		constructor() {
			this.x = rand(W * 0.12, W * 0.88);
			this.targetY = rand(H * 0.1, H * 0.45);
			this.y = H + 8;
			this.vy = -rand(9.5, 13);
			this.color = '#fff7d6';
		}
		update() {
			this.y += this.vy;
			this.vy += 0.1; // притормаживает к вершине
			// Сверкающий хвост
			particles.push(new Particle(this.x + rand(-1, 1), this.y,
				rand(-0.4, 0.4), rand(0.4, 1.6), pick(['#ffd98a', '#ffedb0', '#fff']),
				{ gravity: 0.02, drag: 0.95, life: rand(10, 24), size: rand(1, 2), twinkle: false }));
			if (this.y <= this.targetY || this.vy >= -1.5) {
				burst(this.x, this.y);
				return true;
			}
			return false;
		}
		draw() {
			ctx.globalAlpha = 1;
			ctx.fillStyle = this.color;
			ctx.beginPath();
			ctx.arc(this.x, this.y, 2.3, 0, Math.PI * 2);
			ctx.fill();
		}
	}

	function frame() {
		// overlay убрали (выход из игры) — гасим цикл
		if (!overlay.isConnected) {
			window.removeEventListener('resize', resize);
			return;
		}
		// Лёгкое затемнение поверх — даёт светящиеся шлейфы
		ctx.globalCompositeOperation = 'source-over';
		ctx.globalAlpha = 1;
		ctx.fillStyle = 'rgba(8,6,26,0.22)';
		ctx.fillRect(0, 0, W, H);

		// Аддитивное свечение
		ctx.globalCompositeOperation = 'lighter';
		for (let i = rockets.length - 1; i >= 0; i--) {
			if (rockets[i].update()) { rockets.splice(i, 1); }
			else { rockets[i].draw(); }
		}
		for (let i = particles.length - 1; i >= 0; i--) {
			const p = particles[i];
			p.update();
			if (p.life <= 0) { particles.splice(i, 1); }
			else { p.draw(); }
		}
		ctx.globalAlpha = 1;
		animId = requestAnimationFrame(frame);
	}

	// Стартовый залп + непрерывная канонада
	rockets.push(new Rocket(), new Rocket());
	fireworksIntervalId = setInterval(() => {
		const n = 1 + Math.floor(Math.random() * 2);
		for (let i = 0; i < n; i++) rockets.push(new Rocket());
	}, 430);

	// Финальный мощный залп
	setTimeout(() => {
		for (let i = 0; i < 7; i++) setTimeout(() => rockets.push(new Rocket()), i * 110);
	}, 6300);

	// Прекращаем запуск новых
	setTimeout(() => {
		if (fireworksIntervalId) { clearInterval(fireworksIntervalId); fireworksIntervalId = null; }
	}, 7400);

	frame();

	// Плавно гасим и убираем
	setTimeout(() => {
		overlay.style.transition = 'opacity 1.6s';
		overlay.style.opacity = '0';
		setTimeout(() => {
			if (animId) cancelAnimationFrame(animId);
			window.removeEventListener('resize', resize);
			if (overlay.parentNode) overlay.remove();
		}, 1600);
	}, 9200);
}
