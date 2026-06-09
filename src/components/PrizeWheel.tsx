/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState, useEffect } from 'react';
import { Prize } from '../types';
import { synther } from '../utils/audio';

interface PrizeWheelProps {
  prizes: Prize[];
  onSpinStart: () => void;
  onSpinComplete: (prize: Prize) => void;
  isSpinning: boolean;
  userCoins: number;
}

export const PrizeWheel: React.FC<PrizeWheelProps> = ({
  prizes,
  onSpinStart,
  onSpinComplete,
  isSpinning: propIsSpinning,
  userCoins,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [internalSpinning, setInternalSpinning] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Physics states kept in refs to avoid React re-render lag
  const angleRef = useRef(0);
  const velocityRef = useRef(0);
  const targetAngleRef = useRef(0);
  const isAnimatingRef = useRef(false);
  const lastSectorRef = useRef<number>(-1);
  const animationRef = useRef<number | null>(null);

  // Cleanup anim on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  const numItems = prizes.length;
  const arcSize = (2 * Math.PI) / numItems;

  // Sync propIsSpinning if it changes from outside (e.g. admin simulation)
  useEffect(() => {
    if (propIsSpinning && !isAnimatingRef.current) {
      triggerSpin();
    }
  }, [propIsSpinning]);

  // Handle high-dpi displays and canvas rendering
  useEffect(() => {
    drawWheel();
  }, [prizes, angleRef.current]);

  const drawWheel = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(centerX, centerY) - 15;

    ctx.clearRect(0, 0, width, height);

    // 1. Draw outer neon physical rim
    const outerGrad = ctx.createRadialGradient(centerX, centerY, radius - 10, centerX, centerY, radius + 8);
    outerGrad.addColorStop(0, '#1E293B'); // slate-800
    outerGrad.addColorStop(0.5, '#475569'); // slate-600
    outerGrad.addColorStop(0.9, '#F59E0B'); // amber-500
    outerGrad.addColorStop(1, '#78350F'); // amber-900

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius + 6, 0, 2 * Math.PI);
    ctx.lineWidth = 12;
    ctx.strokeStyle = outerGrad;
    ctx.shadowBlur = 15;
    ctx.shadowColor = 'rgba(245, 158, 11, 0.4)';
    ctx.stroke();
    ctx.shadowBlur = 0; // reset shadow

    // 2. Draw outer boundary gold bulbs/nodes for arcade feel
    for (let i = 0; i < 24; i++) {
      const bulbAngle = (i * 2 * Math.PI) / 24;
      const bx = centerX + (radius + 2) * Math.cos(bulbAngle);
      const by = centerY + (radius + 2) * Math.sin(bulbAngle);
      ctx.beginPath();
      ctx.arc(bx, by, 4, 0, 2 * Math.PI);
      ctx.fillStyle = i % 2 === 0 ? '#FBBF24' : '#FFFbeb'; // blink-like shift
      ctx.fill();
    }

    // 3. Draw wedges/pie sectors
    prizes.forEach((prize, i) => {
      const startAngle = angleRef.current + i * arcSize;
      const endAngle = startAngle + arcSize;

      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, startAngle, endAngle);
      ctx.closePath();

      // Alternating themes matching rarities
      let wedgeGrad = ctx.createRadialGradient(centerX, centerY, 30, centerX, centerY, radius);
      if (prize.rarity === 'legendary') {
        wedgeGrad.addColorStop(0, '#7F1D1D'); // red-900
        wedgeGrad.addColorStop(1, '#450A0A'); // deep red-950
      } else if (prize.rarity === 'epic') {
        wedgeGrad.addColorStop(0, '#581C87'); // purple-900
        wedgeGrad.addColorStop(1, '#3B0764'); // deep purple-950
      } else if (prize.rarity === 'rare') {
        wedgeGrad.addColorStop(0, '#1E3A8A'); // blue-900
        wedgeGrad.addColorStop(1, '#172554'); // blue-950
      } else {
        // common
        wedgeGrad.addColorStop(0, '#022C22'); // emerald-950
        wedgeGrad.addColorStop(1, '#021B15'); // even deeper
      }

      ctx.fillStyle = wedgeGrad;
      ctx.fill();

      // Divider lines
      ctx.strokeStyle = 'rgba(251, 223, 74, 0.25)'; // bright gold line
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // 4. Render prize text and icon-label details along the circle
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(startAngle + arcSize / 2);

      // Label Alignment
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';

      // Pick text color based on rarity
      let textColor = '#E2E8F0'; // gray-200
      let strokeColor = '#000000';
      if (prize.rarity === 'legendary') textColor = '#F87171';
      else if (prize.rarity === 'epic') textColor = '#C084FC';
      else if (prize.rarity === 'rare') textColor = '#60A5FA';

      ctx.shadowBlur = 4;
      ctx.shadowColor = strokeColor;

      // Draw prize volume/type badge if alcohol bottle
      if (prize.type === 'alcohol') {
        ctx.font = 'bold 9px "JetBrains Mono"';
        ctx.fillStyle = 'rgba(251, 191, 36, 0.8)'; // gold hue
        ctx.fillText(`🍸 ${prize.volume || 'Bottle'}`, radius - 15, -12);

        // Core name
        ctx.font = 'bold 12px "Outfit"';
        ctx.fillStyle = textColor;
        let truncateName = prize.name.length > 18 ? prize.name.substring(0, 16) + '..' : prize.name;
        ctx.fillText(truncateName, radius - 15, 6);
      } else {
        // Coins reward
        ctx.font = 'bold 10px "JetBrains Mono"';
        ctx.fillStyle = '#F59E0B';
        ctx.fillText('💰 COINS', radius - 15, -10);

        ctx.font = 'bold 13px "Outfit"';
        ctx.fillStyle = '#FBBF24';
        ctx.fillText(`+${prize.value}`, radius - 15, 5);
      }

      ctx.restore();
    });

    // 5. Center Golden Hub
    ctx.beginPath();
    ctx.arc(centerX, centerY, 35, 0, 2 * Math.PI);
    const hubGrad = ctx.createLinearGradient(centerX - 35, centerY - 35, centerX + 35, centerY + 35);
    hubGrad.addColorStop(0, '#FFE082');
    hubGrad.addColorStop(0.5, '#E5B206');
    hubGrad.addColorStop(1, '#9B6505');
    ctx.fillStyle = hubGrad;
    ctx.shadowBlur = 10;
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.fill();
    ctx.shadowBlur = 0;

    // Small interior center core
    ctx.beginPath();
    ctx.arc(centerX, centerY, 28, 0, 2 * Math.PI);
    ctx.fillStyle = '#0F172A'; // dark slate
    ctx.fill();

    // Text "SPIN" inside center cap
    ctx.font = '900 13px "Outfit"';
    ctx.fillStyle = '#FBBF24';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('WIN', centerX, centerY - 4);
    ctx.font = '800 9px "JetBrains Mono"';
    ctx.fillStyle = '#E2E8F0';
    ctx.fillText('20 💰', centerX, centerY + 10);
  };

  const triggerSpin = () => {
    if (isAnimatingRef.current) return;
    setErrorMsg('');

    if (userCoins < 20) {
      setErrorMsg('Not enough gold coins! Tap "Claim Free Coins" below.');
      synther.playClick();
      return;
    }

    synther.playClick();
    onSpinStart();

    // Start with picking the winner prize
    // Weighted randomization
    const available = prizes.filter(p => p.inStock > 0);
    if (available.length === 0) {
      setErrorMsg('Inventory fully empty! Set more stock in admin controls.');
      return;
    }

    // Pick winner prize
    const totalWeight = available.reduce((sum, p) => sum + p.probability, 0);
    const randomPoint = Math.random() * totalWeight;
    let runningSum = 0;
    let winner = available[available.length - 1];

    for (const p of available) {
      runningSum += p.probability;
      if (randomPoint <= runningSum) {
        winner = p;
        break;
      }
    }

    // Calculate index of winner in current prizes
    const winnerIdx = prizes.findIndex(p => p.id === winner.id);

    // Goal: Spin wheel so winnerIdx stops perfectly at the top (needle point is at angle 3 * Math.PI / 2, which is 270 degrees)
    // In Canvas space, angle 0 is RIGHT (3 o'clock). Top needle is at angle -Math.PI / 2 (or 3/2 * Math.PI).
    // The visual wedge i occupies angle [i * arc, (i + 1) * arc].
    // Center point of wedge of selected item is (winnerIdx + 0.5) * arc.
    // To make this wedge align at the TOP (3/2 * Math.PI), we must add/subtract.
    // Specifically: Canvas draw is: startAngle + i * arcSize.
    // So if the wheel rotates by angle, item i starts at angle + i * arcSize.
    // Midpoint of item i in absolute space is angle + (i + 0.5) * arcSize.
    // We want: [angle + (winnerIdx + 0.5) * arcSize] % 2PI = 3/2 * Math.PI.
    // Thus: angle = (3/2 * Math.PI) - (winnerIdx + 0.5) * arcSize.
    // To make sure it rotates clockwise, we subtract and add many full spins!
    
    const targetEndAngle = (3 * Math.PI / 2) - ((winnerIdx + 0.5) * arcSize);
    
    // Normalize target angle
    const targetNormalized = ((targetEndAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);

    // Set physical motion variables
    const spins = 6 + Math.floor(Math.random() * 4); // 6 to 10 solid physical turns
    const startingAngle = angleRef.current % (2 * Math.PI);
    angleRef.current = startingAngle; // snap to short domain for linear transitions
    
    targetAngleRef.current = startingAngle + (spins * 2 * Math.PI) + targetNormalized;
    
    // Physics parameters
    velocityRef.current = 0.28; // high speed spin velocity
    isAnimatingRef.current = true;
    setInternalSpinning(true);

    let startTime = performance.now();
    const duration = 5200; // 5.2 seconds suspense duration

    const animateWheel = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      
      if (elapsed >= duration) {
        // Complete spin
        angleRef.current = targetAngleRef.current;
        isAnimatingRef.current = false;
        setInternalSpinning(false);
        drawWheel();
        onSpinComplete(winner);
        return;
      }

      // Smooth Ease-Out Deceleration Cubic curve: cubic-bezier(0.15, 0.85, 0.35, 1)
      const t = elapsed / duration;
      const easeValue = 1 - Math.pow(1 - t, 3.8); // exponential decay
      const currentAngle = startingAngle + (targetAngleRef.current - startingAngle) * easeValue;
      angleRef.current = currentAngle;

      // Clicky trigger ticking effect
      // Calculate sector under boundary
      // Need needle to trigger sound when passing sector separators
      // Arc boundary of sector in degrees = index * (360/N)
      const normalizedAngleDeg = (currentAngle * 180 / Math.PI) % 360;
      // Needle is at 270 degrees. What wedge index is passing 270?
      // (270 - normalizedAngleDeg) gives segment count
      const activeSector = Math.floor(((270 - normalizedAngleDeg + 360) % 360) / (360 / numItems)) % numItems;

      if (activeSector !== lastSectorRef.current) {
        // Avoid double click on start snap
        if (elapsed > 40) {
          synther.playTick();
        }
        lastSectorRef.current = activeSector;
      }

      drawWheel();
      animationRef.current = requestAnimationFrame(animateWheel);
    };

    animationRef.current = requestAnimationFrame(animateWheel);
  };

  return (
    <div className="relative flex flex-col items-center justify-center p-2 select-none">
      {/* Dynamic Needle Pin pointing downwards */}
      <div className="absolute top-[8px] z-20 flex flex-col items-center">
        {/* Ticker representation */}
        <div className="w-5 h-8 bg-gradient-to-b from-yellow-300 via-amber-400 to-amber-600 rounded-b-full shadow-lg border-2 border-slate-900" 
             style={{ 
               transformOrigin: 'top center',
               transform: internalSpinning ? 'rotate(5deg)' : 'none',
               transition: 'transform 0.1s ease'
             }} 
        />
        {/* Needle glow bulb */}
        <span className="absolute top-0 w-3 h-3 bg-red-500 rounded-full animate-ping opacity-75" />
      </div>

      {/* Main Wheel Canvas */}
      <div className="relative p-7 rounded-full bg-slate-950/80 border-4 border-slate-900 shadow-2xl flex items-center justify-center scale-95 md:scale-100">
        <canvas
          ref={canvasRef}
          width={360}
          height={360}
          className="rounded-full cursor-pointer bg-slate-900 block"
          onClick={triggerSpin}
        />

        {/* Center SPIN Button Over Wheel Hub */}
        <button
          id="wheel-center-button"
          onClick={triggerSpin}
          disabled={internalSpinning}
          className={`absolute w-20 h-20 rounded-full cursor-pointer flex flex-col items-center justify-center outline-none transition-transform active:scale-95 ${
            internalSpinning
              ? 'bg-slate-800 border-2 border-slate-700 cursor-not-allowed text-slate-500'
              : 'hover:scale-105 hover:gold-glow bg-gradient-to-b from-amber-400 via-yellow-500 to-amber-600 text-slate-950 border-4 border-slate-900'
          }`}
          style={{
            zIndex: 30,
            boxShadow: '0 8px 16px rgba(0,0,0,0.6), inset 0 2px 4px rgba(255,255,255,0.4)',
          }}
        >
          <span className="text-[14px] font-black tracking-wider leading-none">SPIN</span>
          <span className="text-[9px] font-mono font-bold mt-1 inline-flex items-center text-slate-900/90 gap-0.5">
            20 <span className="text-amber-950 text-xs text-bold">¢</span>
          </span>
        </button>
      </div>

      {/* Notification error message if coins <= 0 */}
      {errorMsg && (
        <span className="mt-2 text-rose-400 font-medium text-xs font-mono bg-rose-950/50 py-1 px-3 rounded-full border border-rose-900/60 animate-shake">
          ⚠️ {errorMsg}
        </span>
      )}
    </div>
  );
};
