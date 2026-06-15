/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';

interface ConfettiCoinsProps {
  active: boolean;
  type: 'coins' | 'sparkles' | 'none';
  onComplete?: () => void;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  rotationSpeed: number;
  bounceCount: number;
  opacity: number;
  type: 'coin' | 'shimmer';
}

export const ConfettiCoins: React.FC<ConfettiCoinsProps> = ({ active, type, onComplete }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationRef = useRef<number | null>(null);
  
  // Use a ref for the onComplete callback to avoid triggering effect runs when parent re-renders
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (!active || type === 'none') {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      // Clean up and clear the canvas
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions to viewport
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Seed particles
    const particles: Particle[] = [];
    const colors = type === 'coins' 
      ? ['#FBBF24', '#F59E0B', '#D97706', '#FFF3B0', '#FCD34D'] // Shiny golds
      : ['#A78BFA', '#818CF8', '#34D399', '#60A5FA', '#F472B6', '#F43F5E']; // Neon branding hues

    const spawnParticle = () => {
      const spawnX = canvas.width / 2;
      const spawnY = canvas.height * 0.45;
      const angle = (Math.random() * Math.PI * 2);
      const speed = 4 + Math.random() * 12;

      return {
        x: spawnX,
        y: spawnY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - (3 + Math.random() * 6), // bias upward blast
        size: type === 'coins' ? 10 + Math.random() * 12 : 3 + Math.random() * 6,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.4,
        bounceCount: 0,
        opacity: 1,
        type: type === 'coins' ? 'coin' : 'shimmer'
      } as Particle;
    };

    // Seed immediate initial burst
    const initialCount = type === 'coins' ? 70 : 60;
    for (let i = 0; i < initialCount; i++) {
      particles.push(spawnParticle());
    }

    particlesRef.current = particles;
    const gravity = 0.25;
    const friction = 0.98;
    const floor = canvas.height;
    
    const startTime = performance.now();

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const now = performance.now();
      const elapsed = now - startTime;

      // Continuously spawn coins during the payout window of 2 seconds
      if (elapsed < 2000) {
        const spawnRate = type === 'coins' ? 2 : 3;
        for (let i = 0; i < spawnRate; i++) {
          particlesRef.current.push(spawnParticle());
        }
      }

      const currentParticles = particlesRef.current;

      currentParticles.forEach((p, idx) => {
        // Apply physics
        p.vx *= friction;
        p.vy += gravity;
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotationSpeed;

        // Bounce off bottom floor
        if (p.y > floor - p.size) {
          p.y = floor - p.size;
          p.vy = -p.vy * 0.5; // lose energy
          p.vx *= 0.7;
          p.bounceCount++;
        }

        // Fade out when bounced or after payout over
        if (p.bounceCount > 1 || elapsed > 2000) {
          p.opacity -= 0.015;
        }

        if (p.opacity <= 0) return;

        ctx.save();
        ctx.globalAlpha = p.opacity;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);

        if (p.type === 'coin') {
          // Draw a beautiful golden 3D coin
          // Base rim
          ctx.beginPath();
          ctx.ellipse(0, 0, p.size, p.size * 0.5, 0, 0, Math.PI * 2);
          ctx.fillStyle = '#B45309'; // Shadow gold edge
          ctx.fill();

          // Face
          ctx.beginPath();
          ctx.ellipse(0, -2, p.size * 0.9, p.size * 0.45, 0, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.fill();

          // Embossed dollar sign or star
          ctx.font = `bold ${p.size * 0.8}px Outfit`;
          ctx.fillStyle = '#D97706';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('$', 0, -2);
        } else {
          // Draw sparkle star/diamond
          ctx.beginPath();
          ctx.moveTo(0, -p.size);
          ctx.lineTo(p.size * 0.4, -p.size * 0.4);
          ctx.lineTo(p.size, 0);
          ctx.lineTo(p.size * 0.4, p.size * 0.4);
          ctx.lineTo(0, p.size);
          ctx.lineTo(-p.size * 0.4, p.size * 0.4);
          ctx.lineTo(-p.size, 0);
          ctx.lineTo(-p.size * 0.4, -p.size * 0.4);
          ctx.closePath();
          ctx.fillStyle = p.color;
          ctx.shadowBlur = 10;
          ctx.shadowColor = p.color;
          ctx.fill();
        }

        ctx.restore();
      });

      // Filter out dead particles
      particlesRef.current = currentParticles.filter(p => p.opacity > 0);

      // Finish cleanly after 2.8s max duration OR if empty after 2.0s
      if (particlesRef.current.length > 0 && elapsed < 2800) {
        animationRef.current = requestAnimationFrame(render);
      } else {
        if (onCompleteRef.current) onCompleteRef.current();
      }
    };

    render();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [active, type]);

  return (
    <canvas
      ref={canvasRef}
      id="confetti-canvas"
      className="fixed inset-0 w-[100vw] h-[100vh] pointer-events-none z-[100]"
    />
  );
};
