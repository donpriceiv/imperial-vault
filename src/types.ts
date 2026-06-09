/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type RarityType = 'common' | 'rare' | 'epic' | 'legendary';
export type PrizeType = 'coin' | 'alcohol';

export interface Prize {
  id: string;
  name: string;
  type: PrizeType;
  value: number; // for coin quantity or volume index
  brand?: string; // e.g. "Château Cognac", "Macallan"
  volume?: string; // e.g. "750ml", "1L"
  description: string;
  rarity: RarityType;
  inStock: number;
  probability: number; // percentage value e.g. 15 for 15%
  color: string; // tailwind color class prefix or hex values
}

export interface WinLog {
  id: string;
  prizeId: string;
  prizeName: string;
  prizeType: PrizeType;
  prizeValue?: number;
  rarity: RarityType;
  timestamp: string;
  claimCode: string; // Random high-entropy reference for admin claims
  claimed: boolean;
}

export interface GameStats {
  totalSpins: number;
  totalCoinsWon: number;
  totalBottlesWon: number;
  byRarity: Record<RarityType, number>;
}
