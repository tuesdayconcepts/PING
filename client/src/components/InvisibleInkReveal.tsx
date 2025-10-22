import { useEffect, useRef, useState } from 'react';
import './InvisibleInkReveal.css';

interface Particle {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  vx: number;
  vy: number;
  opacity: number;
  opacityVelocity: number;
  size: number;
}

interface InvisibleInkRevealProps {
  text: string;
  revealed: boolean;
  onRevealComplete?: () => void;
}

export function InvisibleInkReveal({ text, revealed, onRevealComplete }: InvisibleInkRevealProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isRevealing, setIsRevealing] = useState(false);
  const particlesRef = useRef<Particle[]>([]);
  const animationFrameRef = useRef<number>();
  const revealStartTimeRef = useRef<number>(0);

  // Initialize particles
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to match container
    const updateCanvasSize = () => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        canvas.width = rect.width;
        canvas.height = rect.height;
      }
    };

    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);

    // Create many tiny particles
    const particleCount = Math.floor((canvas.width * canvas.height) / 25); // Higher density
    const particles: Particle[] = [];

    for (let i = 0; i < particleCount; i++) {
      const baseX = Math.random() * canvas.width;
      const baseY = Math.random() * canvas.height;
      
      particles.push({
        x: baseX,
        y: baseY,
        baseX,
        baseY,
        vx: (Math.random() - 0.5) * 2, // Random movement speed
        vy: (Math.random() - 0.5) * 2,
        opacity: 0.3 + Math.random() * 0.5, // Random starting opacity
        opacityVelocity: (Math.random() - 0.5) * 0.02, // Opacity change rate
        size: 1.5 + Math.random() * 1, // Tiny particles (1.5-2.5px)
      });
    }

    particlesRef.current = particles;

    return () => {
      window.removeEventListener('resize', updateCanvasSize);
    };
  }, []);

  // Trigger reveal animation
  useEffect(() => {
    if (revealed && !isRevealing) {
      setIsRevealing(true);
      revealStartTimeRef.current = Date.now();
    }
  }, [revealed, isRevealing]);

  // Animation loop
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animating = true;

    const animate = () => {
      if (!animating) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const particles = particlesRef.current;
      const now = Date.now();
      const revealDuration = 800; // Faster reveal (0.8s)
      const elapsed = now - revealStartTimeRef.current;
      const revealProgress = isRevealing ? Math.min(elapsed / revealDuration, 1) : 0;

      // Easing function (power2.out)
      const ease = (t: number) => 1 - Math.pow(1 - t, 2);
      const easedProgress = ease(revealProgress);

      particles.forEach((particle) => {
        if (isRevealing) {
          // Disperse particles rapidly outward
          particle.x += particle.vx * 8 * easedProgress;
          particle.y += particle.vy * 8 * easedProgress;
          particle.opacity = Math.max(0, particle.opacity * (1 - easedProgress));
        } else {
          // Rapid looping movement around base position
          const moveRange = 15; // How far particles wander from base
          particle.x += particle.vx;
          particle.y += particle.vy;
          
          // Bounce back toward base position (loop effect)
          const dx = particle.x - particle.baseX;
          const dy = particle.y - particle.baseY;
          
          if (Math.abs(dx) > moveRange) {
            particle.vx *= -1;
          }
          if (Math.abs(dy) > moveRange) {
            particle.vy *= -1;
          }
          
          // Oscillate opacity
          particle.opacity += particle.opacityVelocity;
          if (particle.opacity > 0.8 || particle.opacity < 0.2) {
            particle.opacityVelocity *= -1;
          }
        }

        // Draw particle as perfect circle
        ctx.fillStyle = `rgba(180, 180, 180, ${particle.opacity})`;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
      });

      // Check if reveal is complete
      if (isRevealing && revealProgress >= 1) {
        animating = false;
        if (onRevealComplete) {
          onRevealComplete();
        }
      } else {
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    };

    animate();

    return () => {
      animating = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isRevealing, onRevealComplete]);

  return (
    <div className="invisible-ink-container" ref={containerRef}>
      <div className={`invisible-ink-text ${revealed ? 'revealed' : ''}`}>
        {text}
      </div>
      {!revealed && <canvas ref={canvasRef} className="invisible-ink-canvas" />}
    </div>
  );
}
