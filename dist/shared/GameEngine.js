"use strict";
// ============================================================
// GAME ENGINE — вся игровая логика (без UI и без сети)
// Используется и на сервере, и на клиенте (для локальной игры)
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.cardValue = cardValue;
exports.createShuffledDeck = createShuffledDeck;
exports.createPlayer = createPlayer;
exports.getValidTakeCombinations = getValidTakeCombinations;
exports.canTake = canTake;
exports.isValidTake = isValidTake;
exports.dealCards = dealCards;
exports.needsDeal = needsDeal;
exports.applyTake = applyTake;
exports.applyDiscard = applyDiscard;
exports.calculateRoundResult = calculateRoundResult;
exports.startNewRound = startNewRound;
exports.deepClone = deepClone;
exports.generateRoomId = generateRoomId;
const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
// Числовое значение карты для правила «сумма = 11»
function cardValue(rank) {
    if (rank === 'A')
        return 1;
    if (rank === 'J' || rank === 'Q' || rank === 'K')
        return 11;
    return parseInt(rank, 10);
}
// Создать и перемешать колоду
function createShuffledDeck() {
    const deck = [];
    for (const suit of SUITS) {
        for (const rank of RANKS) {
            deck.push({ id: `${suit}-${rank}`, suit, rank, value: cardValue(rank) });
        }
    }
    // Fisher-Yates shuffle
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}
// Создать нового игрока
function createPlayer(id, name, teamId) {
    return { id, name, hand: [], collected: [], score: 0, totalScore: 0, teamId, isConnected: true };
}
// ---- Правила взятия карт ----
/**
 * Возвращает все подмножества карт стола, которые можно взять картой из руки.
 * Возвращает массив вариантов (каждый вариант — массив карт со стола).
 */
function getValidTakeCombinations(handCard, tableCards) {
    const results = [];
    if (handCard.rank === 'Q') {
        // Дама берёт только другую Даму
        const queens = tableCards.filter(c => c.rank === 'Q');
        if (queens.length > 0)
            results.push([queens[0]]);
        return results;
    }
    if (handCard.rank === 'K') {
        // Король берёт только другого Короля
        const kings = tableCards.filter(c => c.rank === 'K');
        if (kings.length > 0)
            results.push([kings[0]]);
        return results;
    }
    if (handCard.rank === 'J') {
        // Валет берёт любые карты кроме Дам и Королей (любое непустое подмножество)
        const eligible = tableCards.filter(c => c.rank !== 'Q' && c.rank !== 'K');
        if (eligible.length === 0)
            return results;
        // Все непустые подмножества
        const count = eligible.length;
        for (let mask = 1; mask < (1 << count); mask++) {
            const combo = [];
            for (let i = 0; i < count; i++) {
                if (mask & (1 << i))
                    combo.push(eligible[i]);
            }
            results.push(combo);
        }
        return results;
    }
    // Обычная карта (включая Туза как 1): подмножества стола с суммой = 11
    // Исключаем Дам и Королей из кандидатов
    const eligible = tableCards.filter(c => c.rank !== 'Q' && c.rank !== 'K');
    const count = eligible.length;
    for (let mask = 1; mask < (1 << count); mask++) {
        const combo = [];
        let sum = 0;
        for (let i = 0; i < count; i++) {
            if (mask & (1 << i)) {
                combo.push(eligible[i]);
                sum += eligible[i].value;
            }
        }
        if (sum === 11)
            results.push(combo);
    }
    return results;
}
/**
 * Проверяет, может ли игрок взять карту (есть хотя бы одна валидная комбинация)
 */
function canTake(handCard, tableCards) {
    return getValidTakeCombinations(handCard, tableCards).length > 0;
}
/**
 * Проверяет, является ли конкретный набор карт стола валидным взятием
 */
function isValidTake(handCard, tableCards, selectedTable) {
    if (selectedTable.length === 0)
        return false;
    const valid = getValidTakeCombinations(handCard, tableCards);
    const selectedIds = new Set(selectedTable.map(c => c.id));
    return valid.some(combo => {
        if (combo.length !== selectedTable.length)
            return false;
        return combo.every(c => selectedIds.has(c.id));
    });
}
// ---- Раздача карт ----
/**
 * Раздать карты игрокам (по 4 каждому), а затем 4 на стол.
 * Возвращает обновлённую колоду.
 */
function dealCards(state) {
    const s = deepClone(state);
    const cardsPerPlayer = 4;
    const tableCards = 4;
    const totalNeeded = s.players.length * cardsPerPlayer + tableCards;
    if (s.deck.length < totalNeeded)
        return s; // не хватает карт — раунд закончен
    for (const player of s.players) {
        player.hand = s.deck.splice(0, cardsPerPlayer);
    }
    s.table = s.deck.splice(0, tableCards);
    s.phase = 'playing';
    return s;
}
/**
 * Проверить, нужна ли повторная раздача (у всех игроков пустые руки)
 */
function needsDeal(state) {
    return state.players.every(p => p.hand.length === 0) && state.deck.length > 0;
}
// ---- Применение хода ----
/**
 * Применить ход «взять карты» и вернуть новое состояние
 */
function applyTake(state, playerId, handCard, tableCards) {
    const s = deepClone(state);
    const player = s.players.find(p => p.id === playerId);
    if (!player)
        return s;
    // Убираем карту из руки
    player.hand = player.hand.filter(c => c.id !== handCard.id);
    // Убираем взятые карты со стола
    const takenIds = new Set(tableCards.map(c => c.id));
    s.table = s.table.filter(c => !takenIds.has(c.id));
    // Добавляем в собранные
    player.collected.push(handCard, ...tableCards);
    s.lastTaken = [handCard, ...tableCards];
    s.lastTakenByIndex = s.players.indexOf(player);
    s.currentPlayerIndex = nextPlayerIndex(s);
    return s;
}
/**
 * Применить ход «сбросить карту» и вернуть новое состояние
 */
function applyDiscard(state, playerId, handCard) {
    const s = deepClone(state);
    const player = s.players.find(p => p.id === playerId);
    if (!player)
        return s;
    player.hand = player.hand.filter(c => c.id !== handCard.id);
    s.table.push(handCard);
    s.currentPlayerIndex = nextPlayerIndex(s);
    return s;
}
function nextPlayerIndex(state) {
    return (state.currentPlayerIndex + 1) % state.players.length;
}
// ---- Конец раунда ----
/**
 * Вычислить результаты раунда и начислить очки.
 * Возвращает результат и обновлённое состояние.
 */
function calculateRoundResult(state) {
    const s = deepClone(state);
    // Подсчёт карт у игроков (и команд в 2v2)
    const collectedCount = s.players.map(p => p.collected.length);
    const maxCards = Math.max(...collectedCount);
    const mostCardsPlayers = s.players
        .filter((_, i) => collectedCount[i] === maxCards)
        .map(p => p.id);
    // Подсчёт треф
    const clubsCount = s.players.map(p => p.collected.filter(c => c.suit === 'clubs').length);
    const maxClubs = Math.max(...clubsCount);
    const mostClubsPlayers = s.players
        .filter((_, i) => clubsCount[i] === maxClubs)
        .map(p => p.id);
    // Специальные карты
    const hasClub2 = s.players.find(p => p.collected.some(c => c.suit === 'clubs' && c.rank === '2'))?.id ?? null;
    const hasDiamond10 = s.players.find(p => p.collected.some(c => c.suit === 'diamonds' && c.rank === '10'))?.id ?? null;
    // Начисление очков
    for (const player of s.players) {
        let roundScore = 0;
        if (mostCardsPlayers.includes(player.id) && mostCardsPlayers.length === 1)
            roundScore += 2;
        if (mostClubsPlayers.includes(player.id) && mostClubsPlayers.length === 1)
            roundScore += 1;
        if (hasClub2 === player.id)
            roundScore += 1;
        if (hasDiamond10 === player.id)
            roundScore += 1;
        player.score = roundScore;
        player.totalScore += roundScore;
    }
    // Победитель матча (21+ очков)
    const MATCH_WIN_SCORE = 21;
    const matchWinner = s.players.find(p => p.totalScore >= MATCH_WIN_SCORE) ?? null;
    s.phase = matchWinner ? 'match-end' : 'round-end';
    s.winner = matchWinner?.name ?? null;
    const result = {
        playerScores: s.players.map(p => ({
            playerId: p.id,
            name: p.name,
            roundScore: p.score,
            totalScore: p.totalScore,
        })),
        mostCards: mostCardsPlayers,
        mostClubs: mostClubsPlayers,
        hasClub2,
        hasDiamond10,
        winner: s.winner,
    };
    return { result, newState: s };
}
/**
 * Подготовить новый раунд (сохранить totalScore, сбросить остальное)
 */
function startNewRound(state) {
    const s = deepClone(state);
    const deck = createShuffledDeck();
    for (const player of s.players) {
        player.hand = [];
        player.collected = [];
        player.score = 0;
    }
    s.deck = deck;
    s.table = [];
    s.lastTaken = [];
    s.roundNumber += 1;
    s.dealerIndex = (s.dealerIndex + 1) % s.players.length;
    s.currentPlayerIndex = (s.dealerIndex + 1) % s.players.length;
    s.phase = 'dealing';
    s.winner = null;
    return s;
}
// ---- Утилиты ----
function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}
function generateRoomId() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let id = '';
    for (let i = 0; i < 6; i++)
        id += chars[Math.floor(Math.random() * chars.length)];
    return id;
}
