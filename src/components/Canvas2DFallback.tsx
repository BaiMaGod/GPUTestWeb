import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useTestStore } from '@/store/testStore';

function ParticleCanvas2D({ intensity }: { intensity: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<{ x: number; y: number; z: number; vx: number; vy: number; vz: number; color: string }[]>([]);
  const animationRef = useRef<number | null>(null);
  const frameCountRef = useRef(0);
  const lastFPSTimeRef = useRef(performance.now());
  const status = useTestStore((s) => s.status);
  const setCurrentFPS = useTestStore((s) => s.setCurrentFPS);
  const addFPSRecord = useTestStore((s) => s.addFPSRecord);
  const recordPhaseFPS = useTestStore((s) => s.recordPhaseFPS);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };

    resize();
    window.addEventListener('resize', resize);

    const colors = ['#3B82F6', '#8B5CF6', '#10B981', '#60A5FA'];
    const particleCount = 200;
    particlesRef.current = [];

    for (let i = 0; i < particleCount; i++) {
      particlesRef.current.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        z: Math.random() * 1000,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        vz: (Math.random() - 0.5) * 2,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }

    const animate = () => {
      if (!ctx || !canvas) return;

      ctx.fillStyle = 'rgba(11, 13, 21, 0.2)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const cx = canvas.width / 2;
      const cy = canvas.height / 2;

      particlesRef.current.forEach((p) => {
        p.x += p.vx * intensity;
        p.y += p.vy * intensity;
        p.z += p.vz * intensity;

        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;
        if (p.z < 1) p.z = 1000;
        if (p.z > 1000) p.z = 1;

        const scale = 500 / p.z;
        const x = cx + (p.x - cx) * scale;
        const y = cy + (p.y - cy) * scale;
        const size = Math.max(0.5, 3 * scale);
        const alpha = Math.min(1, 1 - p.z / 1000);

        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = alpha * 0.8;
        ctx.fill();
        ctx.globalAlpha = 1;
      });

      frameCountRef.current++;
      const now = performance.now();
      const elapsed = now - lastFPSTimeRef.current;
      if (elapsed >= 250) {
        const fps = Math.round((frameCountRef.current * 1000) / elapsed);
        if (status === 'running') {
          setCurrentFPS(fps);
          addFPSRecord(fps);
          recordPhaseFPS(fps);
        }
        frameCountRef.current = 0;
        lastFPSTimeRef.current = now;
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [intensity, status, setCurrentFPS, addFPSRecord, recordPhaseFPS]);

  return <canvas ref={canvasRef} className="w-full h-full" />;
}

export function Canvas2DFallback() {
  const { status } = useTestStore();
  const intensity = status === 'running' ? 2 : 1;

  return (
    <div className="absolute inset-0 z-0 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-deep-black via-transparent to-deep-black pointer-events-none z-10" />
      <ParticleCanvas2D intensity={intensity} />

      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64"
      >
        <svg viewBox="0 0 200 200" className="w-full h-full">
          <defs>
            <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style={{ stopColor: '#3B82F6', stopOpacity: 1 }} />
              <stop offset="100%" style={{ stopColor: '#8B5CF6', stopOpacity: 1 }} />
            </linearGradient>
          </defs>
          <polygon
            points="100,10 140,40 170,90 160,150 110,180 50,170 20,120 30,50"
            fill="none"
            stroke="url(#grad1)"
            strokeWidth="1.5"
            opacity="0.4"
          />
        </svg>
      </motion.div>

      <motion.div
        animate={{ rotate: -360 }}
        transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40"
      >
        <svg viewBox="0 0 100 100" className="w-full h-full">
          <circle cx="50" cy="50" r="40" fill="none" stroke="#3B82F6" strokeWidth="1" strokeDasharray="5,5" opacity="0.3" />
          <circle cx="50" cy="50" r="25" fill="none" stroke="#8B5CF6" strokeWidth="1" strokeDasharray="3,3" opacity="0.5" />
        </svg>
      </motion.div>

      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          className="w-16 h-16 rounded-full bg-gradient-to-br from-tech-blue to-electric-purple opacity-30 blur-xl"
        />
      </div>
    </div>
  );
}
