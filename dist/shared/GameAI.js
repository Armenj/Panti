"use strict";
// ============================================================
// GAME AI — стратегия компьютерного игрока
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeAIMove = computeAIMove;
const GameEngine_1 = require("./GameEngine");
/**
 * Выбирает лучший ход для компьютера.
 * Приоритеты:
 * 1. Взять ♣2 или ♦10 (ценные карты)
 * 2. Взять максимальное количество карт Валетом
 * 3. Взять любую доступную комбинацию (предпочитая больше трефей)
 * 4. Сбросить наименее ценную карту (не ♣2, не ♦10, не Туза)
 */
function computeAIMove(state, aiPlayer) {
    const tableCards = state.table;
    const hand = aiPlayer.hand;
    const options = [];
    for (const handCard of hand) {
        const combos = (0, GameEngine_1.getValidTakeCombinations)(handCard, tableCards);
        for (const combo of combos) {
            const allCards = [handCard, ...combo];
            let priority = 0;
            // Ценные карты в захвате
            if (allCards.some(c => c.suit === 'clubs' && c.rank === '2'))
                priority += 100;
            if (allCards.some(c => c.suit === 'diamonds' && c.rank === '10'))
                priority += 80;
            // Количество взятых карт (больше = лучше для «больше всех карт»)
            priority += combo.length * 5;
            // Количество трефей (для «больше всех трефей»)
            const clubs = allCards.filter(c => c.suit === 'clubs').length;
            priority += clubs * 10;
            // Дама/Король на столе — хорошо их взять
            if (combo.some(c => c.rank === 'Q' || c.rank === 'K'))
                priority += 15;
            options.push({ handCard, tableCards: combo, priority });
        }
    }
    if (options.length > 0) {
        // Берём ход с наивысшим приоритетом
        options.sort((a, b) => b.priority - a.priority);
        const best = options[0];
        return { type: 'take', handCard: best.handCard, tableCards: best.tableCards };
    }
    // Нет доступных взятий — сбрасываем
    const discardCard = chooseBestDiscard(hand);
    return { type: 'discard', handCard: discardCard, tableCards: [] };
}
/**
 * Выбрать карту для сброса.
 * Избегаем сбрасывать ценные карты.
 */
function chooseBestDiscard(hand) {
    // Приоритет сброса (чем ниже — тем лучше кандидат на сброс):
    // 1. Не сбрасываем ♣2, ♦10
    // 2. Не сбрасываем Тузов (они ценны для комбинаций)
    // 3. Сбрасываем числовые карты с наименьшим значением
    const sortedByWaste = [...hand].sort((a, b) => {
        const keepScore = (c) => {
            let score = 0;
            if (c.suit === 'clubs' && c.rank === '2')
                score += 1000;
            if (c.suit === 'diamonds' && c.rank === '10')
                score += 800;
            if (c.suit === 'clubs')
                score += 20; // трефи ценны
            if (c.rank === 'A')
                score += 50;
            if (c.rank === 'Q' || c.rank === 'K')
                score += 30;
            score += c.value;
            return score;
        };
        return keepScore(a) - keepScore(b); // меньший keepScore — кандидат на сброс
    });
    return sortedByWaste[0];
}
