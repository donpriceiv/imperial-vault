/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Prize, WinLog } from './types';
import { PrizeWheel } from './components/PrizeWheel';
import { AdminPanel } from './components/AdminPanel';
import { ConfettiCoins } from './components/ConfettiCoins';
import { synther } from './utils/audio';
import { 
  loadPrizes, savePrizes, loadWinLogs, saveWinLogs, 
  loadCoinBalance, saveCoinBalance, generateClaimCode 
} from './utils/prizeDb';
import { 
  Plus, Settings, LogOut, Award, Coins, Wine, Sparkles, 
  Copy, Check, ShieldAlert, CheckCircle2, Ticket, History, Info, Lock, Play
} from 'lucide-react';

export default function App() {
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [winLogs, setWinLogs] = useState<WinLog[]>([]);
  const [userCoins, setUserCoins] = useState(100);
  const [isSpinning, setIsSpinning] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPass, setAdminPass] = useState('');
  const [showPassModal, setShowPassModal] = useState(false);
  const [claimedCopy, setClaimedCopy] = useState<string | null>(null);

  const [adminPasscode, setAdminPasscode] = useState<string>(() => {
    return localStorage.getItem('prize_spinner_admin_code') || '1234';
  });

  const handleUpdateAdminPasscode = (newCode: string) => {
    setAdminPasscode(newCode);
    localStorage.setItem('prize_spinner_admin_code', newCode);
  };

  // Celebration states
  const [currentWin, setCurrentWin] = useState<Prize | null>(null);
  const [confettiActive, setConfettiActive] = useState(false);
  const [confettiType, setConfettiType] = useState<'coins' | 'sparkles' | 'none'>('none');

  const [lastClaimTime, setLastClaimTime] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Load initial persistent storage
  useEffect(() => {
    setPrizes(loadPrizes());
    setWinLogs(loadWinLogs());
    setUserCoins(loadCoinBalance());
    const storedClaim = localStorage.getItem('prize_spinner_last_claim_time');
    if (storedClaim) {
      setLastClaimTime(Number(storedClaim));
    }
  }, []);

  useEffect(() => {
    let intervalId: any;
    if (lastClaimTime > 0) {
      intervalId = setInterval(() => {
        setCurrentTime(Date.now());
      }, 1000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [lastClaimTime]);

  const COOLDOWN_DURATION = 24 * 60 * 60 * 1000; // 24 hours
  const timeSinceLastClaim = currentTime - lastClaimTime;
  const isCooldownActive = lastClaimTime > 0 && timeSinceLastClaim < COOLDOWN_DURATION;

  const getRemainingTimeStr = () => {
    const remainingMs = COOLDOWN_DURATION - timeSinceLastClaim;
    if (remainingMs <= 0) return '';
    const hours = Math.floor(remainingMs / (60 * 60 * 1000));
    const minutes = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
    const seconds = Math.floor((remainingMs % (60 * 1000)) / 1000);
    return `${hours}h ${minutes}m ${seconds}s`;
  };

  const handleUpdatePrizes = (newPrizes: Prize[]) => {
    setPrizes(newPrizes);
    savePrizes(newPrizes);
  };

  const handleUpdateLogs = (newLogs: WinLog[]) => {
    setWinLogs(newLogs);
    saveWinLogs(newLogs);
  };

  const handleClearLogs = () => {
    setWinLogs([]);
    saveWinLogs([]);
  };

  // Trigger spin operations
  const handleSpinStart = () => {
    setIsSpinning(true);
    // Deduct entry fee
    const nextBalance = userCoins - 20;
    setUserCoins(nextBalance);
    saveCoinBalance(nextBalance);
  };

  // Resolve outcome of the spin
  const handleSpinComplete = (wonPrize: Prize) => {
    setIsSpinning(false);
    setCurrentWin(wonPrize);

    // Save state transaction
    let updatedBalance = userCoins;
    
    if (wonPrize.type === 'coin') {
      updatedBalance += wonPrize.value;
      setUserCoins(updatedBalance);
      saveCoinBalance(updatedBalance);
      
      // Trigger gold coin shower sound + particles
      synther.playCoinsWin();
      setConfettiType('coins');
    } else {
      // Alcohol bottle won
      // 1. Decrement inventory stock level
      const updatedPrizes = prizes.map(p => 
        p.id === wonPrize.id ? { ...p, inStock: Math.max(0, p.inStock - 1) } : p
      );
      setPrizes(updatedPrizes);
      savePrizes(updatedPrizes);

      // Play grand brass fanfares + premium color sparkles
      synther.playBottleWin();
      setConfettiType('sparkles');
    }

    setConfettiActive(true);

    // 2. Append to win transactions logs database
    const claimCode = generateClaimCode();
    const newLog: WinLog = {
      id: `win-${Date.now()}-${Math.random()}`,
      prizeId: wonPrize.id,
      prizeName: wonPrize.name,
      prizeType: wonPrize.type,
      prizeValue: wonPrize.type === 'coin' ? wonPrize.value : undefined,
      rarity: wonPrize.rarity,
      timestamp: new Date().toISOString(),
      claimCode,
      claimed: wonPrize.type === 'coin'
    };

    const nextLogs = [newLog, ...winLogs];
    setWinLogs(nextLogs);
    saveWinLogs(nextLogs);
  };

  // Cheat code or free coin claim to prevent dry blocks
  const handleClaimFreeCoins = () => {
    if (isCooldownActive) {
      alert(`⏱️ Cooldown active! You can claim again in ${getRemainingTimeStr()}.`);
      return;
    }
    synther.playCoinsWin();
    const nextBalance = userCoins + 100;
    setUserCoins(nextBalance);
    saveCoinBalance(nextBalance);
    
    const now = Date.now();
    setLastClaimTime(now);
    setCurrentTime(now);
    localStorage.setItem('prize_spinner_last_claim_time', String(now));
  };

  // Clipboard copy helper for claim codes
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setClaimedCopy(text);
    synther.playTick();
    setTimeout(() => setClaimedCopy(null), 1800);
  };

  const attemptAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    synther.playClick();
    if (adminPass.trim() === adminPasscode) {
      setIsAdmin(true);
      setShowPassModal(false);
      setAdminPass('');
    } else {
      alert('🔒 Access Denied: Incorrect passcode.');
    }
  };

  return (
    <div className="min-h-screen bg-[#070b13] text-slate-100 flex flex-col font-sans relative overflow-x-hidden antialiased selection:bg-amber-500/30 selection:text-amber-200">
      
      {/* Absolute Canvas for winning effects */}
      <ConfettiCoins 
        active={confettiActive} 
        type={confettiType} 
        onComplete={() => {
          setConfettiActive(false);
          setConfettiType('none');
        }} 
      />

      {/* Decorative ambient glowing backdrops */}
      <span className="absolute top-[-250px] left-1/2 -translate-x-1/2 w-[600px] h-[500px] bg-amber-500/5 blur-[160px] rounded-full pointer-events-none z-0" />
      <span className="absolute bottom-[-150px] right-[10%] w-[400px] h-[400px] bg-purple-500/5 blur-[160px] rounded-full pointer-events-none z-0" />

      {/* Primary Top Header bar */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40 px-4 py-3.5">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          
          {/* Logo Brand Brand */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-400 p-0.5 flex items-center justify-center shadow-lg shadow-amber-500/10">
              <div className="w-full h-full bg-[#070b13] rounded-[10px] flex items-center justify-center">
                <Wine className="w-4 h-4 text-amber-400" />
              </div>
            </div>
            <div>
              <h1 className="text-base font-extrabold tracking-tight bg-gradient-to-r from-slate-100 to-slate-300 bg-clip-text text-transparent flex items-center gap-1.5 leading-none">
                Imperial Vaults <span className="text-xs text-amber-500 font-black tracking-normal">SPIN</span>
              </h1>
              <p className="text-[10px] text-slate-400 leading-none mt-1">
                Aged Spirits & Gold Coins drawing console
              </p>
            </div>
          </div>

          {/* Balance Tracker & System Toggle */}
          <div className="flex items-center gap-3">
            
            {/* Player coin stash widget */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 flex items-center gap-2 shadow-inner">
              <span className="flex items-center justify-center p-1 bg-amber-500/20 text-amber-400 rounded-full animate-bounce-slow">
                <Coins className="w-3.5 h-3.5" />
              </span>
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-400 leading-none">Your Gold</span>
                <span className="font-mono text-sm font-bold text-yellow-400 leading-none mt-0.5">
                  {userCoins}
                </span>
              </div>
            </div>

            {/* Admin Switch lock toggler */}
            {isAdmin ? (
              <button
                onClick={() => { synther.playClick(); setIsAdmin(false); }}
                className="bg-slate-900 hover:bg-slate-800 text-rose-400 border border-slate-850 px-3 py-2 rounded-lg font-bold text-xs uppercase flex items-center gap-1.5 tracking-wider transition-all cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                Player Mode
              </button>
            ) : (
              <button
                onClick={() => { synther.playClick(); setShowPassModal(true); }}
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold px-3 py-2 rounded-lg text-xs uppercase flex items-center gap-1.5 tracking-wider transition-all shadow-lg shadow-amber-500/10 cursor-pointer"
              >
                <Settings className="w-4 h-4 animate-spin-slow" />
                Administrator Gate
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Stage */}
      <main className="flex-1 max-w-6xl mx-auto w-full p-4 md:p-6 z-10 grid grid-cols-1 gap-6">

        {/* Informative Tip Baner when in App */}
        {!isAdmin && (
          <div className="bg-slate-950/40 border border-slate-850 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <h4 className="text-slate-200 text-xs font-bold font-sans">
                  Welcome to the Branded Reward Draw Center!
                </h4>
                <p className="text-[11px] text-slate-400">
                  Each machine spin costs <span className="text-yellow-400 font-bold">20 coins</span>. High-tier branded alcohol bottles can be collected below along with unique <span className="font-bold">Claim Vouchers</span>. Open the Administrator Gate to adjust prize lines, view statistics, and review stock configuration.
                </p>
              </div>
            </div>
            
            <button
              onClick={handleClaimFreeCoins}
              disabled={isCooldownActive}
              className={`text-xs font-extrabold uppercase px-3 py-1.5 rounded-lg flex items-center gap-1.5 shrink-0 self-end md:self-auto transition-all ${
                isCooldownActive
                  ? 'bg-slate-800/60 text-slate-500 border border-slate-700/50 cursor-not-allowed'
                  : 'bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 cursor-pointer'
              }`}
            >
              {isCooldownActive ? (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  Claim Locked ({getRemainingTimeStr()})
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Claim 100 Free Coins
                </>
              )}
            </button>
          </div>
        )}

        {/* CONDITIONAL RENDER: PLAYER VIEWS OR ADMINISTRATOR HUB */}
        {isAdmin ? (
          <div className="animate-fade-in">
            <AdminPanel 
              prizes={prizes}
              onUpdatePrizes={handleUpdatePrizes}
              winLogs={winLogs}
              onClearLogs={handleClearLogs}
              onUpdateLogs={handleUpdateLogs}
              adminPasscode={adminPasscode}
              onUpdateAdminPasscode={handleUpdateAdminPasscode}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left Column: Mechanical Wheel Platform */}
            <div className="lg:col-span-7 flex flex-col items-center">
              <div className="bg-slate-950/40 border border-slate-900 rounded-3xl p-6 shadow-2xl w-full flex flex-col items-center justify-center relative overflow-hidden">
                <span className="absolute top-2 left-2 px-3 py-1 bg-slate-900 border border-slate-800 text-[10px] font-mono rounded-full text-slate-400 uppercase">
                  ⭐ Precision Wheel v4
                </span>

                <PrizeWheel 
                  prizes={prizes}
                  onSpinStart={handleSpinStart}
                  onSpinComplete={handleSpinComplete}
                  isSpinning={isSpinning}
                  userCoins={userCoins}
                />

                <div className="mt-4 text-center">
                  <p className="text-xs text-slate-400 italic">
                    Tap the center <span className="text-amber-400 font-bold">SPIN</span> button or outer wheel circle to draw!
                  </p>
                </div>
              </div>
            </div>

            {/* Right Column: User Winnings Collection Ledgers */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-slate-950/40 border border-[#1e293b]/70 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <History className="w-5 h-5 text-amber-500" />
                    <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-200">
                      Your Vault Collection
                    </h3>
                  </div>
                  <span className="text-xs bg-slate-900 px-2 py-0.5 rounded-full font-mono text-slate-400">
                     {winLogs.filter(w => w.prizeType === 'alcohol').length} bottles collected
                  </span>
                </div>

                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Below lies your collected inventory of premium spirits. Share the claim voucher codes with the organizer to clear the settlement.
                </p>

                {/* List of Won Bottles */}
                <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1 no-scrollbar">
                  {winLogs.filter(log => log.prizeType === 'alcohol').length === 0 ? (
                    <div className="py-12 text-center rounded-xl border border-dashed border-slate-800/80 text-slate-500 space-y-1">
                      <Wine className="w-8 h-8 mx-auto stroke-[1.2] text-slate-600 animate-pulse" />
                      <div className="text-xs font-medium">Vault collection currently pristine</div>
                      <div className="text-[10px]">Spin the machine to drawer branded bottles!</div>
                    </div>
                  ) : (
                    winLogs
                      .filter(log => log.prizeType === 'alcohol')
                      .map((log) => {
                        const matchedPrize = prizes.find(p => p.id === log.prizeId);
                        return (
                          <div 
                            key={log.id} 
                            className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 flex items-start gap-3 hover:border-slate-700 transition-all relative group"
                          >
                            <div className="p-2.5 bg-gradient-to-tr from-purple-500/10 to-indigo-500/5 text-purple-400 rounded-lg border border-purple-500/20 shrink-0">
                              <Wine className="w-5 h-5" />
                            </div>

                            <div className="flex-1 min-w-0 space-y-1">
                              <div className="flex items-center justify-between gap-1.5">
                                <h4 className="text-xs font-bold text-slate-200 truncate pr-4">
                                  {log.prizeName}
                                </h4>
                                <span className={`text-[9px] uppercase font-mono px-1.5 py-0.2 rounded border shrink-0 ${
                                  log.rarity === 'legendary' ? 'bg-red-500/10 border-red-500/25 text-rose-400' :
                                  log.rarity === 'epic' ? 'bg-purple-500/10 border-purple-500/25 text-purple-400' :
                                  log.rarity === 'rare' ? 'bg-blue-500/10 border-blue-500/25 text-blue-400' :
                                  'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
                                }`}>
                                  {log.rarity}
                                </span>
                              </div>

                              <p className="text-[10px] text-slate-400 leading-snug">
                                {matchedPrize?.description || 'Custom hand-defined premium collector spirit'}
                              </p>

                              {/* Clipboard copying voucher tools */}
                              <div className="pt-2 flex items-center justify-between border-t border-slate-850/80 mt-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[9px] text-slate-500 font-mono">CODE:</span>
                                  <code className="text-[11px] font-mono font-bold text-amber-500 tracking-wider">
                                    {log.claimCode}
                                  </code>
                                  <button
                                    onClick={() => copyToClipboard(log.claimCode)}
                                    className="p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded transition-all cursor-pointer"
                                    title="Copy claim voucher"
                                  >
                                    {claimedCopy === log.claimCode ? (
                                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                                    ) : (
                                      <Copy className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                </div>

                                {/* Claim state pill */}
                                <span className={`text-[9px] flex items-center gap-0.5 font-bold font-mono px-1.5 py-0.2 rounded-full ${
                                  log.claimed
                                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                                    : 'bg-amber-500/15 text-amber-400 border border-amber-500/20 animate-pulse'
                                }`}>
                                  {log.claimed ? 'Claimed ✔' : 'Voucher Unclaimed ⏱'}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })
                  )}
                </div>
              </div>
            </div>

          </div>
        )}
      </main>

      {/* FOOTER CODES */}
      <footer className="mt-12 border-t border-slate-900 bg-slate-950/40 p-6 text-center text-xs text-slate-500">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 font-mono">
          <span>© 2026 Imperial Prize Drawing Platform. All rights reserved.</span>
          <div className="flex items-center gap-4">
            <span>Powered by Web Audio + HTML5 Canvas</span>
            <span>•</span>
            <span className="text-slate-400">Offline-Persistent Sandbox State</span>
          </div>
        </div>
      </footer>

      {/* CELEBRATORY WIN WIN DIALOG MODAL */}
      {currentWin && (
        <div className="fixed inset-0 bg-slate-950/90 z-50 flex items-center justify-center p-4 backdrop-blur-md animate-fade-in">
          
          <div className="bg-[#0f172a] border border-slate-800 rounded-3xl p-6 md:p-8 max-w-sm w-full text-center relative overflow-hidden shadow-2xl space-y-6">
            
            {/* Ambient dynamic card halo background glow */}
            <span className={`absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-48 rounded-full blur-[60px] opacity-25 ${
              currentWin.rarity === 'legendary' ? 'bg-red-500' :
              currentWin.rarity === 'epic' ? 'bg-purple-500' :
              currentWin.rarity === 'rare' ? 'bg-blue-500' : 'bg-emerald-500'
            }`} />

            {/* Glowing sparkle particle elements */}
            <div className="relative mx-auto w-24 h-24 rounded-full bg-slate-900/80 border-4 border-amber-400/30 flex items-center justify-center shadow-lg">
              {currentWin.type === 'coin' ? (
                <Coins className="w-12 h-12 text-yellow-400 animate-bounce-slow" />
              ) : (
                <Wine className="w-12 h-12 text-purple-400 animate-pulse" />
              )}
              <span className="absolute inset-0 rounded-full border-2 border-dashed border-amber-400/40 animate-spin-slow" />
            </div>

            {/* Winning texts block */}
            <div className="space-y-1.5 relative z-10">
              <span className={`text-[10px] uppercase font-mono font-black tracking-widest px-2.5 py-0.5 rounded-full border ${
                currentWin.rarity === 'legendary' ? 'bg-red-500/15 border-red-500/30 text-rose-400' :
                currentWin.rarity === 'epic' ? 'bg-purple-500/15 border-purple-500/30 text-indigo-400' :
                currentWin.rarity === 'rare' ? 'bg-blue-500/15 border-blue-500/30 text-blue-400' :
                'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
              }`}>
                🎉 {currentWin.rarity} Win!
              </span>
              <h2 className="text-xl md:text-2xl font-black text-slate-100 tracking-tight pt-2">
                {currentWin.name}
              </h2>
              <p className="text-xs text-slate-400 leading-normal px-2">
                {currentWin.description}
              </p>
            </div>

            {/* Meta attributes (size volume or coin amounts summary) */}
            <div className="bg-slate-950/50 rounded-xl p-3 text-xs flex justify-around items-center border border-slate-850">
              {currentWin.type === 'coin' ? (
                <>
                  <span className="text-slate-400">Total Award:</span>
                  <span className="font-mono font-extrabold text-amber-400 text-sm">+{currentWin.value} Gold</span>
                </>
              ) : (
                <>
                  <div className="text-left">
                    <span className="text-slate-500 text-[10px] block leading-none">ESTATE/BRAND</span>
                    <span className="font-bold text-slate-305 mt-0.5 block">{currentWin.brand}</span>
                  </div>
                  <div className="w-px h-6 bg-slate-800" />
                  <div className="text-right">
                    <span className="text-slate-500 text-[10px] block leading-none">SIZE/VOLUME</span>
                    <span className="font-mono font-bold text-amber-500 mt-0.5 block">{currentWin.volume}</span>
                  </div>
                </>
              )}
            </div>

            {/* Accept / close button dismiss */}
            <button
              onClick={() => { synther.playClick(); setCurrentWin(null); }}
              className="w-full bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-600 hover:from-amber-500 hover:to-amber-700 text-slate-950 text-xs font-black uppercase py-3 rounded-xl tracking-wider shadow-lg shadow-amber-500/20 cursor-pointer text-center relative z-10 block transition-all"
            >
              Collect Rewards & Continue
            </button>
          </div>

        </div>
      )}

      {/* PASSCODE ENTRY GATE MODAL WINDOW */}
      {showPassModal && (
        <div className="fixed inset-0 bg-slate-950/85 z-50 flex items-center justify-center p-4 backdrop-blur-md animate-fade-in">
          <div className="bg-[#0f172a] border border-slate-800 rounded-3xl p-6 max-w-sm w-full space-y-4">
            
            <div className="text-center space-y-1">
              <div className="mx-auto w-10 h-10 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center border border-amber-500/20">
                <Lock className="w-5 h-5" />
              </div>
              <h3 className="text-slate-200 text-sm font-bold uppercase tracking-wider pt-2">
                Lockbox Security Verification
              </h3>
              <p className="text-[11px] text-slate-400 leading-normal">
                Enter the passcode to access Administrative Controls and modify prize inventories.
              </p>
            </div>

            <form onSubmit={attemptAdminLogin} className="space-y-4 pt-1">
              <input 
                type="password"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-center text-sm font-mono tracking-widest text-slate-100 focus:border-amber-500 focus:outline-none placeholder-slate-600"
                placeholder="••••"
                maxLength={8}
                value={adminPass}
                onChange={e => setAdminPass(e.target.value)}
                autoFocus
              />
              
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { synther.playClick(); setShowPassModal(false); }}
                  className="flex-1 bg-slate-950 hover:bg-slate-900 text-slate-400 text-xs font-bold py-2 rounded-lg text-center cursor-pointer transition-colors"
                >
                  Go Back
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black uppercase py-2 rounded-lg text-center tracking-wider transition-colors cursor-pointer"
                >
                  Verify Access
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
