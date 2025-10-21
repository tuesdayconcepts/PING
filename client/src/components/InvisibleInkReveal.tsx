import { useEffect, useRef, useState } from 'react';
import './InvisibleInkReveal.css';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  opacity: number;
  size: number;
}

interface InvisibleInkRevealProps {
  text: string;
  revealed: boolean;
  onRevealComplete?: () => void;
}

export function InvisibleInkReveal({ text, revealed, onRevealComplete }: InvisibleInkRevealProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [isRevealing, setIsRevealing] = useState(false);
  const particlesRef = useRef<Particle[]>([]);
  const animationFrameRef = useRef<number>();
  const revealStartTimeRef = useRef<number>(0);

  // Initialize particles
  useEffect(() => {
    if (!canvasRef.current || !textRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to match container
    const updateCanvasSize = () => {
      const rect = textRef.current?.getBoundingClientRect();
      if (rect) {
        canvas.width = rect.width;
        canvas.height = rect.height;
      }
    };

    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);

    // Create particles to cover text
    const particleCount = Math.floor((canvas.width * canvas.height) / 80); // Density
    const particles: Particle[] = [];

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 3, // Random velocity for disperse
        vy: (Math.random() - 0.5) * 3,
        opacity: 0.6 + Math.random() * 0.4,
        size: 2 + Math.random() * 2,
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
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animating = true;

    const animate = () => {
      if (!animating) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const particles = particlesRef.current;
      const now = Date.now();
      const revealDuration = 1500; // 1.5 seconds
      const elapsed = now - revealStartTimeRef.current;
      const revealProgress = isRevealing ? Math.min(elapsed / revealDuration, 1) : 0;

      // Easing function (power2.out)
      const ease = (t: number) => 1 - Math.pow(1 - t, 2);
      const easedProgress = ease(revealProgress);

      particles.forEach((particle) => {
        if (isRevealing) {
          // Disperse particles
          particle.x += particle.vx * easedProgress * 2;
          particle.y += particle.vy * easedProgress * 2;
          particle.opacity = Math.max(0, 1 - easedProgress);
        } else {
          // Gentle idle movement
          particle.x += Math.sin(now / 1000 + particle.x) * 0.1;
          particle.y += Math.cos(now / 1000 + particle.y) * 0.1;
        }

        // Draw particle
        ctx.fillStyle = `rgba(200, 200, 200, ${particle.opacity})`;
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
    <div className="invisible-ink-container">
      <div ref={textRef} className={`invisible-ink-text ${revealed ? 'revealed' : ''}`}>
        {text}
      </div>
      {!revealed && <canvas ref={canvasRef} className="invisible-ink-canvas" />}
    </div>
  );
}

