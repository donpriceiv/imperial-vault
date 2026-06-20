/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Prize, WinLog, RarityType, PrizeType } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { 
  Sliders, Plus, Trash2, CheckCircle, RefreshCw, BarChart2, FileText, 
  Settings, Award, Sparkles, TrendingUp, Key, Coins, Wine, AlertCircle, ShoppingBag,
  Lock
} from 'lucide-react';
import { synther } from '../utils/audio';
import { generateClaimCode, selectPrizeSpin } from '../utils/prizeDb';

interface AdminPanelProps {
  prizes: Prize[];
  onUpdatePrizes: (newPrizes: Prize[]) => void;
  winLogs: WinLog[];
  onClearLogs: () => void;
  onUpdateLogs: (newLogs: WinLog[]) => void;
  adminPasscode: string;
  onUpdateAdminPasscode: (newPasscode: string) => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  prizes,
  onUpdatePrizes,
  winLogs,
  onClearLogs,
  onUpdateLogs,
  adminPasscode,
  onUpdateAdminPasscode
}) => {
  const [activeTab, setActiveTab] = useState<'inventory' | 'claims' | 'analytics' | 'simulation' | 'security'>('inventory');
  
  // States for adding/editing a prize
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<PrizeType>('alcohol');
  const [formValue, setFormValue] = useState(50);
  const [formBrand, setFormBrand] = useState('');
  const [formVolume, setFormVolume] = useState('750ml');
  const [formDescription, setFormDescription] = useState('');
  const [formRarity, setFormRarity] = useState<RarityType>('common');
  const [formStock, setFormStock] = useState(10);
  const [formProbability, setFormProbability] = useState(10);

  // Claim code search
  const [claimSearch, setClaimSearch] = useState('');
  const [claimResult, setClaimResult] = useState<string | null>(null);

  // Simulation state
  const [simResults, setSimResults] = useState<{ prize: Prize; count: number }[]>([]);
  const [simulating, setSimulating] = useState(false);

  // Safe delete / reset confirmation states
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [confirmResetLogs, setConfirmResetLogs] = useState<boolean>(false);

  // Security & Passcode customizer states
  const [newPasscode, setNewPasscode] = useState('');
  const [confirmPasscode, setConfirmPasscode] = useState('');
  const [passwordStatus, setPasswordStatus] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const handleUpdatePassword = (e: React.FormEvent) => {
    e.preventDefault();
    synther.playClick();
    
    const trimmed = newPasscode.trim();
    if (!trimmed) {
      setPasswordStatus({ type: 'error', text: 'Passcode cannot be empty!' });
      return;
    }
    
    if (trimmed.length < 4) {
      setPasswordStatus({ type: 'error', text: 'Passcode must be at least 4 characters long.' });
      return;
    }
    
    if (trimmed !== confirmPasscode.trim()) {
      setPasswordStatus({ type: 'error', text: 'Confirmed passcode does not match!' });
      return;
    }

    onUpdateAdminPasscode(trimmed);
    setNewPasscode('');
    setConfirmPasscode('');
    setPasswordStatus({ type: 'success', text: '✅ Passcode successfully updated!' });
    setTimeout(() => {
      setPasswordStatus(null);
    }, 4000);
  };

  // Mathematical validations
  const totalProbability = useMemo(() => {
    return prizes.reduce((sum, p) => sum + p.probability, 0);
  }, [prizes]);

  // Handle auto-balancing/normalizing the probabilities
  const handleAutoBalance = () => {
    synther.playClick();
    if (prizes.length === 0) return;
    const share = Number((100 / prizes.length).toFixed(1));
    const rebalanced = prizes.map((p, idx) => ({
      ...p,
      probability: idx === prizes.length - 1 ? Number((100 - (share * (prizes.length - 1))).toFixed(1)) : share
    }));
    onUpdatePrizes(rebalanced);
  };

  // Add or Edit save click
  const handleSavePrize = (e: React.FormEvent) => {
    e.preventDefault();
    synther.playClick();

    if (!formName.trim()) {
      alert('Prize Name of item is required.');
      return;
    }

    const targetProbability = Number(formProbability);
    if (targetProbability <= 0) {
      alert('Probability percentage must be greater than 0%');
      return;
    }

    const prizeData: Prize = {
      id: isEditing || `prize-${Date.now()}`,
      name: formName,
      type: formType,
      value: Number(formValue),
      brand: formType === 'alcohol' ? formBrand : undefined,
      volume: formType === 'alcohol' ? formVolume : undefined,
      description: formDescription || `Custom administrator item`,
      rarity: formRarity,
      inStock: Number(formStock),
      probability: targetProbability,
      color: formType === 'coin' 
        ? (formRarity === 'legendary' ? 'from-red-500 to-rose-600 animate-pulse' : 'from-amber-400 to-yellow-500')
        : (formRarity === 'legendary' ? 'from-rose-700 to-red-950' : (formRarity === 'epic' ? 'from-indigo-600 to-purple-800' : 'from-emerald-500 to-teal-700'))
    };

    let updatedList: Prize[] = [];
    if (isEditing) {
      updatedList = prizes.map(p => p.id === isEditing ? prizeData : p);
    } else {
      updatedList = [...prizes, prizeData];
    }

    onUpdatePrizes(updatedList);
    resetForm();
  };

  const handleDeletePrize = (id: string) => {
    synther.playClick();
    if (confirm('Are you absolute sure you want to remove this prize from inventory?')) {
      const filtered = prizes.filter(p => p.id !== id);
      onUpdatePrizes(filtered);
    }
  };

  const handleEditClick = (prize: Prize) => {
    synther.playClick();
    setIsEditing(prize.id);
    setFormName(prize.name);
    setFormType(prize.type);
    setFormValue(prize.value);
    setFormBrand(prize.brand || '');
    setFormVolume(prize.volume || '750ml');
    setFormDescription(prize.description);
    setFormRarity(prize.rarity);
    setFormStock(prize.inStock);
    setFormProbability(prize.probability);

    // Smooth scroll the dynamic form container into focus
    setTimeout(() => {
      const container = document.getElementById('prize-form-container');
      if (container) {
        container.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 50);
  };

  const resetForm = () => {
    setIsEditing(null);
    setFormName('');
    setFormType('alcohol');
    setFormValue(50);
    setFormBrand('');
    setFormVolume('750ml');
    setFormDescription('');
    setFormRarity('common');
    setFormStock(10);
    setFormProbability(10);
  };

  // Adjust specific prize stock directly from table
  const handleDirectStockChange = (id: string, delta: number) => {
    synther.playTick();
    const updated = prizes.map(p => {
      if (p.id === id) {
        return { ...p, inStock: Math.max(0, p.inStock + delta) };
      }
      return p;
    });
    onUpdatePrizes(updated);
  };

  // Check user claim verification voucher code
  const handleVerifyClaimCode = (e: React.FormEvent) => {
    e.preventDefault();
    synther.playClick();
    const cleaned = claimSearch.trim().toUpperCase();
    if (!cleaned) return;

    const matchedLog = winLogs.find(log => log.claimCode === cleaned);
    if (!matchedLog) {
      setClaimResult('Voucher not found. Double check standard formatting.');
      return;
    }

    if (matchedLog.claimed) {
      setClaimResult(`Already Claimed: "${matchedLog.prizeName}" was previously settled and marked finished.`);
      return;
    }

    // Mark as claimed!
    const updatedLogs = winLogs.map(log => 
      log.claimCode === cleaned ? { ...log, claimed: true } : log
    );
    onUpdateLogs(updatedLogs);
    setClaimResult(`SUCCESS! Approved Claim Code: "${matchedLog.prizeName}" has now been settled and claimed.`);
  };

  // Quick simulation sandbox: Run 100 auto spins based on relative weightings
  const runBatchSimulation = () => {
    synther.playClick();
    setSimulating(true);
    
    // Pick available
    const available = prizes.filter(p => p.inStock > 0);
    if (available.length === 0) {
      alert('All items out of stock! Cannot simulate.');
      setSimulating(false);
      return;
    }

    // Initialize results count map
    const countsMap: Record<string, number> = {};
    prizes.forEach(p => { countsMap[p.id] = 0; });

    for (let i = 0; i < 100; i++) {
      const winner = selectPrizeSpin(prizes);
      if (winner) {
        countsMap[winner.id] = (countsMap[winner.id] || 0) + 1;
      }
    }

    const compiled = prizes.map(p => ({
      prize: p,
      count: countsMap[p.id] || 0
    }));

    // Simulate logs creation to keep analytics sync
    const newSimLogs: WinLog[] = [];
    prizes.forEach(p => {
      const wonN = countsMap[p.id] || 0;
      for (let j = 0; j < wonN; j++) {
        newSimLogs.push({
          id: `sim-${Date.now()}-${Math.random()}`,
          prizeId: p.id,
          prizeName: p.name,
          prizeType: p.type,
          prizeValue: p.value,
          rarity: p.rarity,
          timestamp: new Date().toISOString(),
          claimCode: generateClaimCode(),
          claimed: p.type === 'coin'
        });
      }
    });

    onUpdateLogs([...newSimLogs, ...winLogs]);

    setSimResults(compiled);
    setTimeout(() => {
      setSimulating(false);
      synther.playCoinsWin();
    }, 400);
  };

  // Prepare recharts statistics structures
  const barChartData = useMemo(() => {
    const counts: Record<string, number> = {};
    prizes.forEach(p => { counts[p.name] = 0; });
    winLogs.forEach(l => { counts[l.prizeName] = (counts[l.prizeName] || 0) + 1; });
    
    return Object.entries(counts).map(([name, value]) => ({
      name: name.length > 15 ? name.substring(0, 13) + '..' : name,
      wins: value,
    }));
  }, [prizes, winLogs]);

  const pieChartData = useMemo(() => {
    const counts = { common: 0, rare: 0, epic: 0, legendary: 0 };
    winLogs.forEach(l => {
      counts[l.rarity] = (counts[l.rarity] || 0) + 1;
    });

    return [
      { name: 'Common', value: counts.common, color: '#10B981' }, // green
      { name: 'Rare', value: counts.rare, color: '#3B82F6' }, // blue
      { name: 'Epic', value: counts.epic, color: '#8B5CF6' }, // purple
      { name: 'Legendary', value: counts.legendary, color: '#EF4444' } // red
    ].filter(item => item.value > 0);
  }, [winLogs]);

  // Stock list warnings
  const lowStockCount = useMemo(() => {
    return prizes.filter(p => p.inStock <= 2).length;
  }, [prizes]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-md">
      {/* Header Banner */}
      <div className="p-5 bg-gradient-to-r from-amber-500/10 via-slate-900 to-slate-900 border-b border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-500/20 text-amber-500 rounded-lg">
            <Settings className="w-6 h-6 animate-spin-slow" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              Administrator System Hub 
              <span className="text-xs bg-amber-500 text-amber-950 font-bold px-2 py-0.5 rounded-full font-mono uppercase">
                Staff Only
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Refining reward payouts, auditing claim codes, and simulation engines.
            </p>
          </div>
        </div>

        {/* Warning Badge for Admin */}
        {lowStockCount > 0 && (
          <div className="bg-rose-950/40 border border-rose-900/40 text-rose-300 text-xs px-3 py-1.5 rounded-lg flex items-center gap-2 font-mono">
            <AlertCircle className="w-4 h-4 text-rose-400" />
            <span>{lowStockCount} items critically low stock!</span>
          </div>
        )}
      </div>

      {/* Navigation tabs */}
      <div className="flex bg-slate-950/60 border-b border-slate-800 px-2 overflow-x-auto no-scrollbar">
        <button 
          onClick={() => { synther.playClick(); setActiveTab('inventory'); }}
          className={`px-4 py-3.5 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-colors border-b-2 shrink-0 ${
            activeTab === 'inventory' 
              ? 'text-amber-400 border-amber-500 bg-slate-900/50' 
              : 'text-slate-400 border-transparent hover:text-slate-200'
          }`}
        >
          <Sliders className="w-4 h-4" />
          Prize Matrix
        </button>
        <button 
          onClick={() => { synther.playClick(); setActiveTab('claims'); }}
          className={`px-4 py-3.5 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-colors border-b-2 shrink-0 ${
            activeTab === 'claims' 
              ? 'text-amber-400 border-amber-500 bg-slate-900/50' 
              : 'text-slate-400 border-transparent hover:text-slate-200'
          }`}
        >
          <Key className="w-4 h-4" />
          Voucher claim room
        </button>
        <button 
          onClick={() => { synther.playClick(); setActiveTab('analytics'); }}
          className={`px-4 py-3.5 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-colors border-b-2 shrink-0 ${
            activeTab === 'analytics' 
              ? 'text-amber-400 border-amber-500 bg-slate-900/50' 
              : 'text-slate-400 border-transparent hover:text-slate-200'
          }`}
        >
          <BarChart2 className="w-4 h-4" />
          Data charts
        </button>
        <button 
          onClick={() => { synther.playClick(); setActiveTab('simulation'); }}
          className={`px-4 py-3.5 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-colors border-b-2 shrink-0 ${
            activeTab === 'simulation' 
              ? 'text-amber-400 border-amber-500 bg-slate-900/50' 
              : 'text-slate-400 border-transparent hover:text-slate-200'
          }`}
        >
          <RefreshCw className="w-4 h-4" />
          100-Spin Sandbox
        </button>
        <button 
          onClick={() => { synther.playClick(); setActiveTab('security'); }}
          className={`px-4 py-3.5 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-colors border-b-2 shrink-0 ${
            activeTab === 'security' 
              ? 'text-amber-400 border-amber-500 bg-slate-900/50' 
              : 'text-slate-400 border-transparent hover:text-slate-200'
          }`}
        >
          <Lock className="w-4 h-4 text-rose-500" />
          Security Access PIN
        </button>
      </div>

      <div className="p-6">
        {/* TAB 1: INVENTORY MANAGER */}
        {activeTab === 'inventory' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Left Column: Form Editor */}
              <div 
                id="prize-form-container"
                className={`lg:col-span-5 bg-slate-950/40 border rounded-xl p-5 space-y-4 transition-all duration-300 ${
                  isEditing 
                    ? 'border-amber-400/80 ring-2 ring-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.15)] bg-slate-920/40' 
                    : 'border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    {isEditing ? (
                      <>
                        <span className="text-amber-400">✏️</span> Edit Prize Structure
                      </>
                    ) : (
                      <>
                        <span className="text-emerald-400">✨</span> Inject New Prize
                      </>
                    )}
                  </h3>
                  {isEditing && (
                    <button 
                      type="button"
                      onClick={resetForm} 
                      className="text-xs text-rose-400 hover:text-rose-300 hover:underline capitalize font-bold"
                    >
                      Clear / Cancel
                    </button>
                  )}
                </div>

                <form onSubmit={handleSavePrize} className="space-y-4">
                  {/* Name field */}
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">Prize Display Name</label>
                    <input 
                      type="text"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm focus:border-amber-500 focus:outline-none"
                      placeholder="e.g. Royal Crown Whisky 12"
                      value={formName}
                      onChange={e => setFormName(e.target.value)}
                    />
                  </div>

                  {/* Type toggles */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-1">Reward Type</label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => { synther.playTick(); setFormType('alcohol'); }}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-colors flex items-center justify-center gap-1 ${
                            formType === 'alcohol'
                              ? 'bg-amber-500/10 border-amber-500/50 text-amber-400'
                              : 'bg-slate-900 border-slate-800 text-slate-400'
                          }`}
                        >
                          <Wine className="w-3.5 h-3.5" />
                          Premium Bottle
                        </button>
                        <button
                          type="button"
                          onClick={() => { synther.playTick(); setFormType('coin'); }}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-colors flex items-center justify-center gap-1 ${
                            formType === 'coin'
                              ? 'bg-amber-500/10 border-amber-500/50 text-amber-400'
                              : 'bg-slate-900 border-slate-800 text-slate-400'
                          }`}
                        >
                          <Coins className="w-3.5 h-3.5" />
                          Virtual Coins
                        </button>
                      </div>
                    </div>

                    {/* Rarity */}
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-1">Tier Rarity</label>
                      <select 
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 text-xs focus:border-amber-500 focus:outline-none"
                        value={formRarity}
                        onChange={e => setFormRarity(e.target.value as RarityType)}
                      >
                        <option value="common">🟢 Common</option>
                        <option value="rare">🔵 Rare</option>
                        <option value="epic">🟣 Epic</option>
                        <option value="legendary">🔴 Legendary</option>
                      </select>
                    </div>
                  </div>

                  {/* Contextual parameters based on Type */}
                  {formType === 'alcohol' ? (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-400 mb-1">Brand Name / Estate</label>
                        <input 
                          type="text"
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 text-xs focus:border-amber-500 focus:outline-none"
                          placeholder="e.g. Macallan Distilleries"
                          value={formBrand}
                          onChange={e => setFormBrand(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-400 mb-1">Volume Specification</label>
                        <input 
                          type="text"
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 text-xs focus:border-amber-500 focus:outline-none"
                          placeholder="e.g. 750ml, 1.0L"
                          value={formVolume}
                          onChange={e => setFormVolume(e.target.value)}
                        />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-1">Coin Payout Quantity</label>
                      <input 
                        type="number"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 text-xs focus:border-amber-500 focus:outline-none"
                        value={formValue}
                        onChange={e => setFormValue(Number(e.target.value))}
                        min="1"
                      />
                    </div>
                  )}

                  {/* Probability and Stock */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-2 flex items-center justify-between">
                        <span>Win Percentage %</span>
                        <span className="text-[10px] text-amber-500 font-mono font-bold">Sum {totalProbability}%</span>
                      </label>
                      <input 
                        type="number"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 text-xs focus:border-amber-500 focus:outline-none"
                        step="0.1"
                        min="0.1"
                        max="100"
                        value={formProbability}
                        onChange={e => setFormProbability(Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-1">Stock Level (Count)</label>
                      <input 
                        type="number"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 text-xs focus:border-amber-500 focus:outline-none"
                        min="0"
                        value={formStock}
                        onChange={e => setFormStock(Number(e.target.value))}
                      />
                    </div>
                  </div>

                  {/* Description Box */}
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">Item Pitch / Description</label>
                    <textarea 
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 text-xs focus:border-amber-500 focus:outline-none h-16"
                      placeholder="Display summary describing bottle aging cask or coins values..."
                      value={formDescription}
                      onChange={e => setFormDescription(e.target.value)}
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-amber-500 hover:bg-amber-600 transition-colors text-slate-950 text-xs font-extrabold uppercase py-2.5 rounded-lg tracking-wider flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    {isEditing ? 'Confirm Changes' : 'Append to Spinner Wheel'}
                  </button>
                </form>
              </div>

              {/* Right Column: Active Prizes Table */}
              <div className="lg:col-span-7 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300">
                    Active Rewards Matrix ({prizes.length} rewards)
                  </h3>

                  <button 
                    type="button" 
                    onClick={handleAutoBalance}
                    className="text-xs bg-slate-800 text-slate-300 hover:bg-slate-700 px-3 py-1.5 border border-slate-700 rounded-lg flex items-center gap-1 transition-all"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Equally Distribute Payouts
                  </button>
                </div>

                {/* Probability warnings */}
                {totalProbability !== 100 && (
                  <div className="bg-amber-950/20 border border-amber-900/50 rounded-lg p-3 text-xs text-amber-300 flex items-start gap-2 animate-pulse">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Probability Sum mismatch: {totalProbability}% </span>
                      The system auto-normalizes payouts dynamically when spinning, but we recommended equalizing odds to total exactly 100%.
                    </div>
                  </div>
                )}

                <div className="bg-slate-950/30 border border-slate-800 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider">
                        <tr>
                          <th className="p-3.5">Prize Title</th>
                          <th className="p-3.5">Type & Rarity</th>
                          <th className="p-3.5 text-center">Probability %</th>
                          <th className="p-3.5 text-center">Stock Editor</th>
                          <th className="p-3.5 text-right font-normal">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 text-slate-300">
                        {prizes.map((prize) => (
                          <tr key={prize.id} className="hover:bg-slate-900/30 transition-colors">
                            <td className="p-3.5">
                              <div className="font-bold text-slate-200">{prize.name}</div>
                              <div className="text-[10px] text-slate-500 truncate max-w-[200px] mt-0.5">
                                {prize.type === 'alcohol' ? `🍸 ${prize.brand} ${prize.volume}` : `🪙 Virtual coin stack`}
                              </div>
                            </td>
                            <td className="p-3.5 uppercase font-mono text-[10px]">
                              <span className={`px-2 py-0.5 rounded-full border ${
                                prize.rarity === 'legendary' ? 'bg-red-500/10 border-red-500/30 text-rose-400' :
                                prize.rarity === 'epic' ? 'bg-purple-500/10 border-purple-500/30 text-indigo-400' :
                                prize.rarity === 'rare' ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' :
                                'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                              }`}>
                                {prize.rarity}
                              </span>
                            </td>
                            <td className="p-3.5 text-center font-mono font-bold text-slate-200">
                              {prize.probability}%
                            </td>
                            <td className="p-3.5">
                              <div className="flex items-center justify-center gap-2">
                                <button 
                                  onClick={() => handleDirectStockChange(prize.id, -1)}
                                  className="w-5 h-5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-black flex items-center justify-center cursor-pointer"
                                >
                                  -
                                </button>
                                <span className={`font-mono font-bold px-1.5 min-w-[20px] text-center ${
                                  prize.inStock === 0 ? 'text-red-500 animate-pulse' : 'text-slate-300'
                                }`}>
                                  {prize.inStock}
                                </span>
                                <button 
                                  onClick={() => handleDirectStockChange(prize.id, 5)}
                                  className="w-5 h-5 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded font-black flex items-center justify-center cursor-pointer"
                                    title="Add +5 to stock"
                                >
                                  +
                                </button>
                              </div>
                            </td>
                            <td className="p-3.5 text-right space-x-1 shrink-0">
                              {deleteConfirmId === prize.id ? (
                                <div className="inline-flex items-center gap-1.5 bg-slate-950/90 border border-slate-800 px-2 py-1 rounded-lg">
                                  <span className="text-[10px] text-rose-400 font-bold block">Confirm?</span>
                                  <button 
                                    type="button"
                                    onClick={() => {
                                      synther.playClick();
                                      const filtered = prizes.filter(p => p.id !== prize.id);
                                      onUpdatePrizes(filtered);
                                      setDeleteConfirmId(null);
                                    }}
                                    className="text-[10px] bg-red-650 hover:bg-red-650/90 hover:brightness-110 text-white font-extrabold px-2 py-0.5 rounded transition-transform active:scale-95 cursor-pointer uppercase tracking-wider"
                                  >
                                    Yes, Remove
                                  </button>
                                  <button 
                                    type="button"
                                    onClick={() => {
                                      synther.playClick();
                                      setDeleteConfirmId(null);
                                    }}
                                    className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-0.5 rounded transition-all cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <button 
                                    type="button"
                                    onClick={() => handleEditClick(prize)}
                                    className="text-xs bg-slate-800 hover:bg-slate-700 hover:text-amber-400 px-2 py-1 rounded transition-colors cursor-pointer"
                                  >
                                    Edit
                                  </button>
                                  <button 
                                    type="button"
                                    onClick={() => {
                                      synther.playClick();
                                      setDeleteConfirmId(prize.id);
                                    }}
                                    className="text-xs bg-rose-950/40 text-rose-300 hover:bg-rose-900 border border-rose-900/30 px-2 py-1 rounded transition-colors cursor-pointer"
                                  >
                                    Delete
                                  </button>
                                </>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: VOUCHER CLAIMS AUDITOR */}
        {activeTab === 'claims' && (
          <div className="space-y-6">
            <div className="max-w-2xl mx-auto bg-slate-950/40 border border-slate-800 rounded-xl p-6 shadow-xl text-center space-y-4">
              <Key className="w-10 h-10 text-amber-500 mx-auto" />
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300">
                  Client Physical Claim Room
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  When a winning client pulls a premium branded alcohol bottle reward, they receive a safe Claim Voucher code (like <code className="text-amber-400 font-mono font-bold">PRZ-AQZ8L29</code>). Input that code here to check inventory parameters and verify dispatch.
                </p>
              </div>

              <form onSubmit={handleVerifyClaimCode} className="flex gap-2 max-w-md mx-auto">
                <input 
                  type="text" 
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-sm text-slate-100 placeholder-slate-500 uppercase tracking-widest focus:border-amber-500 focus:outline-none"
                  placeholder="e.g. PRZ-K4X9B22"
                  value={claimSearch}
                  onChange={e => setClaimSearch(e.target.value)}
                />
                <button 
                  type="submit"
                  className="bg-amber-500 hover:bg-amber-600 px-5 py-2 rounded-lg font-bold text-xs uppercase text-slate-950 flex items-center gap-1 shrink-0"
                >
                  <CheckCircle className="w-4 h-4" />
                  Settle Voucher
                </button>
              </form>

              {claimResult && (
                <div className={`p-4 rounded-lg text-xs font-medium border text-left flex items-start gap-3 max-w-md mx-auto ${
                  claimResult.includes('SUCCESS') 
                    ? 'bg-emerald-950/30 border-emerald-900/60 text-emerald-300' 
                    : 'bg-rose-950/30 border-rose-900/60 text-rose-300'
                }`}>
                  <Award className={`w-5 h-5 ${claimResult.includes('SUCCESS') ? 'text-emerald-400' : 'text-rose-400'}`} />
                  <div>{claimResult}</div>
                </div>
              )}
            </div>

            {/* Wins History Ledger */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold uppercase text-slate-300 tracking-wider">
                  Winning Transactions Log
                </h4>
                {winLogs.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    {confirmResetLogs ? (
                      <div className="inline-flex items-center gap-1.5 bg-slate-950/80 border border-slate-800 px-2.5 py-1 rounded-lg">
                        <span className="text-[10px] text-rose-400 font-bold">Wipe Analytics Logs?</span>
                        <button 
                          type="button"
                          onClick={() => {
                            synther.playClick();
                            onClearLogs();
                            setConfirmResetLogs(false);
                          }}
                          className="text-[10px] bg-red-650 hover:bg-red-600 text-white font-extrabold px-2 py-0.5 rounded cursor-pointer uppercase tracking-wider"
                        >
                          Wipe
                        </button>
                        <button 
                          type="button"
                          onClick={() => {
                            synther.playClick();
                            setConfirmResetLogs(false);
                          }}
                          className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded cursor-pointer"
                        >
                          Keep Logs
                        </button>
                      </div>
                    ) : (
                      <button 
                        type="button"
                        onClick={() => {
                          synther.playClick();
                          setConfirmResetLogs(true);
                        }}
                        className="text-xs text-rose-404 hover:underline flex items-center gap-1 cursor-pointer text-rose-400"
                      >
                        <Trash2 className="w-3.5 h-3.5 animate-pulse" />
                        Reset Logs Ledger
                      </button>
                    )}
                  </div>
                )}
              </div>

              {winLogs.length === 0 ? (
                <div className="bg-slate-950/20 border border-slate-800 rounded-xl p-8 text-center text-slate-500 text-xs text-mono">
                  🛑 No winnings claims dispatched yet. Spin the wheel to test database entries!
                </div>
              ) : (
                <div className="bg-slate-950/20 border border-slate-800 rounded-xl overflow-hidden max-h-[380px] overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950/80 sticky top-0 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider">
                      <tr>
                        <th className="p-3">Winner Draw Time</th>
                        <th className="p-3">Claim Voucher</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Prize Allocated</th>
                        <th className="p-3 text-right">Rarity</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-slate-300 font-mono">
                      {winLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-900/10 transition-colors">
                          <td className="p-3 text-[11px] text-slate-400">
                            {new Date(log.timestamp).toLocaleString()}
                          </td>
                          <td className="p-3 text-amber-500 font-bold">
                            {log.claimCode}
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                              log.claimed
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25'
                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/25 animate-pulse'
                            }`}>
                              {log.claimed ? 'Settled ✔' : 'Pending Claim ⏱'}
                            </span>
                          </td>
                          <td className="p-3 text-slate-200">
                            {log.prizeType === 'alcohol' ? '🍸 ' : '💰 '}
                            {log.prizeName}
                          </td>
                          <td className="p-3 text-right">
                            <span className={`text-[10px] capitalize font-sans ${
                              log.rarity === 'legendary' ? 'text-red-400 font-bold' :
                              log.rarity === 'epic' ? 'text-purple-400 font-bold' :
                              log.rarity === 'rare' ? 'text-blue-400' : 'text-slate-400'
                            }`}>
                              {log.rarity}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: VISUAL CHARTS */}
        {activeTab === 'analytics' && (
          <div className="space-y-8">
            {winLogs.length === 0 ? (
              <div className="bg-slate-950/20 border border-slate-800 rounded-xl p-12 text-center text-slate-500 text-xs">
                📊 No charts data available. Run the Simulation tab or pull some spins to populate statistics charts.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Bar chart - total pulls count by product */}
                <div className="bg-slate-950/30 border border-slate-800 rounded-xl p-5 space-y-4">
                  <div>
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-widest flex items-center gap-1.5">
                      <TrendingUp className="w-4 h-4 text-emerald-400" />
                      Win Frequency by Prize Type
                    </h4>
                    <p className="text-[10px] text-slate-400">Total claimed stock quantities</p>
                  </div>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={barChartData}>
                        <XAxis dataKey="name" stroke="#64748B" fontSize={11} tickLine={false} />
                        <YAxis stroke="#64748B" fontSize={11} tickLine={false} allowDecimals={false} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#0F172A', borderColor: '#1E293B', borderRadius: 8 }}
                          labelStyle={{ color: '#F1F5F9', fontWeight: 'bold' }}
                        />
                        <Bar dataKey="wins" fill="#E5B206" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Pie Chart - Rarity ratio */}
                <div className="bg-slate-950/30 border border-slate-800 rounded-xl p-5 space-y-4">
                  <div>
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-widest flex items-center gap-1.5">
                      <Award className="w-4 h-4 text-purple-400" />
                      Winnings Shared Rarity Ratio
                    </h4>
                    <p className="text-[10px] text-slate-400">Mathematical tiers of items distributed</p>
                  </div>
                  <div className="h-64 flex flex-col md:flex-row items-center justify-around gap-4">
                    <div className="h-44 w-44">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={pieChartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={75}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {pieChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#0F172A', borderColor: '#1E293B', borderRadius: 8 }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="space-y-2">
                      {pieChartData.map((entry, idx) => (
                        <div key={idx} className="flex items-center gap-2.5 text-xs text-slate-300">
                          <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: entry.color }} />
                          <span className="font-bold">{entry.name}:</span>
                          <span className="font-mono text-slate-400">
                            {entry.value} win{entry.value > 1 ? 's' : ''} ({Math.round(entry.value / winLogs.length * 100)}%)
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: SIMULATION SANDBOX */}
        {activeTab === 'simulation' && (
          <div className="space-y-6">
            <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-6 text-center space-y-4 max-w-2xl mx-auto">
              <RefreshCw className="w-12 h-12 text-emerald-400 mx-auto animate-spin-slow" />
              <div>
                <h3 className="text-slate-200 text-base font-bold">100-Spin Simulation Sandbox Engine</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                  Click below to instantly perform 100 software spins against your configuration. This updates inventory levels and populates win ledgers to prove that standard probability distributions hold true.
                </p>
              </div>

              <button
                onClick={runBatchSimulation}
                disabled={simulating}
                className="bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-slate-950 font-extrabold uppercase px-6 py-3 rounded-lg text-xs tracking-widest transition-all cursor-pointer inline-flex items-center gap-2"
              >
                {simulating ? 'Firing Spins...' : '⚡ Trigger 100 Auto-Spins'}
              </button>
            </div>

            {simResults.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Simulation Outcome Spreadsheet (100 spins completed)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {simResults.map(({ prize, count }) => (
                    <div key={prize.id} className="bg-slate-950/30 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="text-xs font-bold text-slate-200">{prize.name}</div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          Cfg Prob: {prize.probability}% | Stock: {prize.inStock}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-xl font-mono font-black text-amber-400">
                          {count}
                        </div>
                        <div className="text-[9px] text-slate-400">Wins (out of 100)</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: SECURITY GATE SETTINGS */}
        {activeTab === 'security' && (
          <div className="max-w-md mx-auto bg-slate-950/40 border border-slate-800 rounded-2xl p-6 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-450 border border-rose-500/20 flex items-center justify-center">
                <Lock className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-200">
                  Update Administrator Passcode
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Secure access to your administrative prize console by customizing the unlock code.
                </p>
              </div>
            </div>

            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div className="space-y-4 rounded-xl bg-slate-900/60 p-4 border border-slate-850 format-mono">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[10px] text-slate-500 block leading-none">CURRENT PASSCODE</span>
                    <span className="font-mono text-sm text-slate-300 font-bold block mt-1.5 tracking-wider">
                      {adminPasscode ? '•'.repeat(adminPasscode.length) : 'None'}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 block leading-none">SECURITY LEVEL</span>
                    <span className="text-[11px] text-emerald-400 font-extrabold block mt-1.5 uppercase">
                      🔐 Production Shield
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">New PIN / Passcode</label>
                <input 
                  type="password"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm focus:border-amber-500 focus:outline-none placeholder-slate-600"
                  placeholder="Enter new administrator passcode"
                  value={newPasscode}
                  onChange={e => setNewPasscode(e.target.value)}
                  maxLength={12}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Confirm New Passcode</label>
                <input 
                  type="password"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm focus:border-amber-500 focus:outline-none placeholder-slate-600"
                  placeholder="Re-enter to confirm code"
                  value={confirmPasscode}
                  onChange={e => setConfirmPasscode(e.target.value)}
                  maxLength={12}
                />
              </div>

              {passwordStatus && (
                <div className={`p-3 rounded-lg text-xs leading-relaxed border transition-all ${
                  passwordStatus.type === 'success' 
                    ? 'bg-emerald-950/30 border-emerald-800 text-emerald-300' 
                    : 'bg-rose-950/30 border-rose-800 text-rose-300'
                }`}>
                  {passwordStatus.text}
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-rose-500 to-amber-600 hover:from-rose-600 hover:to-amber-700 text-slate-950 text-xs font-black uppercase py-2.5 rounded-lg tracking-wider transition-colors cursor-pointer text-center"
              >
                💾 Persist New Passcode
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
