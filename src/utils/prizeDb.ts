/**
 * prizeDb.ts — optimized
 *
 * FIXES:
 * - selectPrizeSpin was duplicated verbatim in both PrizeWheel and AdminPanel.
 *   Now lives here as the single source of truth and is imported by both.
 * - STORAGE_KEYS object was defined mid-file but only partially used;
 *   expanded to cover every localStorage key for consistency.
 * - loadWinLogs / saveWinLogs silently swallowed errors; now log them.
 * - generateClaimCode used Math.random() which is not cryptographically
 *   strong; upgraded to crypto.getRandomValues() where available.
 */

import { Prize, WinLog, GameStats, RarityType } from '../types';

// ── storage keys ─────────────────────────────────────────────────────────────

export const STORAGE_KEYS = {
  PRIZES: 'prize_spinner_prizes',
  WIN_LOGS: 'prize_spinner_win_logs',
  BALANCE: 'prize_spinner_balance',
  ADMIN_CODE: 'prize_spinner_admin_code',
  LAST_CLAIM: 'prize_spinner_last_claim_time',
} as const;

// ── default prize catalogue ───────────────────────────────────────────────────

export const DEFAULT_PRIZES: Prize[] = [
  {
    id: 'coin-50',
    name: '50 Gold Coins',
    type: 'coin',
    value: 50,
    description: 'Instant pocketful of shimmering gold. Good for simple spins!',
    rarity: 'common',
    inStock: 9999,
    probability: 40,
    color: 'from-amber-400 to-yellow-500',
  },
  {
    id: 'coin-250',
    name: '250 Gold Coins Sack',
    type: 'coin',
    value: 250,
    description: 'A heavy canvas pouch containing a bulk of shiny gold coins.',
    rarity: 'rare',
    inStock: 500,
    probability: 20,
    color: 'from-yellow-500 to-amber-600',
  },
  {
    id: 'coin-1000',
    name: '1000 Gold Coins Chest',
    type: 'coin',
    value: 1000,
    description: 'An ancient cedar chest stacked to the brim with glittering royal gold!',
    rarity: 'epic',
    inStock: 150,
    probability: 8,
    color: 'from-amber-400 to-amber-600',
  },
  {
    id: 'coin-5000',
    name: '5000 Absolute Jackpot Vault',
    type: 'coin',
    value: 5000,
    description: 'The ultimate vault break! Immediate legendary multiplier of royal coins.',
    rarity: 'legendary',
    inStock: 10,
    probability: 1,
    color: 'from-red-500 to-rose-600 animate-pulse',
  },
  {
    id: 'alc-vanguard-whisky',
    name: 'Vanguard 18 Single Malt',
    type: 'alcohol',
    value: 750,
    brand: 'Vanguard Aged Cask',
    volume: '750ml',
    description:
      'Ultra-premium Scotch Whisky aged in toasted Oloroso Sherry casks. Intense notes of dark chocolate, dried plum, and soft peat smoke.',
    rarity: 'epic',
    inStock: 25,
    probability: 6,
    color: 'from-indigo-600 to-purple-800',
  },
  {
    id: 'alc-chateau-cognac',
    name: 'Château Royal Napoleon XO',
    type: 'alcohol',
    value: 700,
    brand: 'Château Royal',
    volume: '700ml',
    description:
      'Elegant French Cognac displaying rich floral aromas, dense candied fruit, and a velvety mahogany finish.',
    rarity: 'legendary',
    inStock: 8,
    probability: 2,
    color: 'from-rose-700 to-red-950',
  },
  {
    id: 'alc-sapphire-gin',
    name: 'Crown Sapphire Botanical Gin',
    type: 'alcohol',
    value: 1000,
    brand: 'Crown Distillers',
    volume: '1.0L',
    description:
      'Quadruple-distilled London Dry Gin infused with 12 precious arctic herbs and rare citrus peel.',
    rarity: 'common',
    inStock: 120,
    probability: 12,
    color: 'from-cyan-400 to-blue-600',
  },
  {
    id: 'alc-reserva-tequila',
    name: 'Aura Anejo Reserva Tequila',
    type: 'alcohol',
    value: 750,
    brand: 'Aura Agave Estate',
    volume: '750ml',
    description:
      '100% Blue Weber Agave Tequila matured for 24 months in toasted American white oak. Silky, vanilla-kissed wood tones.',
    rarity: 'epic',
    inStock: 15,
    probability: 5,
    color: 'from-emerald-500 to-teal-700',
  },
  {
    id: 'alc-emperor-rum',
    name: 'Solera Emperor Rum 15',
    type: 'alcohol',
    value: 750,
    brand: 'Solera Estates',
    volume: '750ml',
    description:
      'Robust Caribbean dark rum matured via the Solera system. Deep caramel, burnt orange essence, and a long wood-spice warmth.',
    rarity: 'rare',
    inStock: 45,
    probability: 10,
    color: 'from-amber-600 to-orange-850',
  },
];

// ── prize helpers ─────────────────────────────────────────────────────────────

export function loadPrizes(): Prize[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.PRIZES);
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.error('Failed reading prizes from localStorage:', e);
  }
  savePrizes(DEFAULT_PRIZES);
  return DEFAULT_PRIZES;
}

export function savePrizes(prizes: Prize[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.PRIZES, JSON.stringify(prizes));
  } catch (e) {
    console.error('Failed writing prizes to localStorage:', e);
  }
}

// ── win log helpers ───────────────────────────────────────────────────────────

export function loadWinLogs(): WinLog[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.WIN_LOGS);
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.error('Failed reading win logs from localStorage:', e);
  }
  return [];
}

export function saveWinLogs(logs: WinLog[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.WIN_LOGS, JSON.stringify(logs));
  } catch (e) {
    console.error('Failed writing win logs to localStorage:', e);
  }
}

// ── coin balance helpers ──────────────────────────────────────────────────────

export function loadCoinBalance(): number {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.BALANCE);
    if (saved !== null) return Number(saved);
  } catch (e) {
    console.error('Failed reading coin balance from localStorage:', e);
  }
  return 100;
}

export function saveCoinBalance(balance: number): void {
  try {
    localStorage.setItem(STORAGE_KEYS.BALANCE, String(balance));
  } catch (e) {
    console.error('Failed writing coin balance to localStorage:', e);
  }
}

// ── claim code generator ──────────────────────────────────────────────────────

/**
 * FIX: use crypto.getRandomValues() for higher entropy codes.
 * Falls back to Math.random() in environments without crypto.
 */
export function generateClaimCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = 'PRZ-';
  try {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    for (const byte of bytes) {
      code += chars[byte % chars.length];
    }
  } catch {
    for (let i = 0; i < 8; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
  }
  return code;
}

// ── FIX: prize picker extracted here as single source of truth ────────────────
// Was duplicated identically in PrizeWheel.triggerSpin() and
// AdminPanel.runBatchSimulation(). Both now import this.

export function selectPrizeSpin(prizes: Prize[]): Prize | null {
  const available = prizes.filter((p) => p.inStock > 0);
  if (available.length === 0) return null;

  const totalWeight = available.reduce((sum, p) => sum + p.probability, 0);
  if (totalWeight <= 0) {
    return available[Math.floor(Math.random() * available.length)];
  }

  const randomPoint = Math.random() * totalWeight;
  let runningSum = 0;

  for (const prize of available) {
    runningSum += prize.probability;
    if (randomPoint <= runningSum) return prize;
  }

  return available[available.length - 1];
}

// ── analytics ─────────────────────────────────────────────────────────────────

export function calculateStats(prizes: Prize[], logs: WinLog[]): GameStats {
  const stats: GameStats = {
    totalSpins: logs.length,
    totalCoinsWon: 0,
    totalBottlesWon: 0,
    byRarity: { common: 0, rare: 0, epic: 0, legendary: 0 },
  };

  for (const log of logs) {
    stats.byRarity[log.rarity as RarityType] =
      (stats.byRarity[log.rarity as RarityType] || 0) + 1;
    if (log.prizeType === 'coin' && log.prizeValue) {
      stats.totalCoinsWon += log.prizeValue;
    } else if (log.prizeType === 'alcohol') {
      stats.totalBottlesWon += 1;
    }
  }

  return stats;
}
