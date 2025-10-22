import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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

// Debug controls - set via URL param ?debugInk=true
const useDebugMode = () => {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('debugInk') === 'true';
};

export function InvisibleInkReveal({ text, revealed, onRevealComplete }: InvisibleInkRevealProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isRevealing, setIsRevealing] = useState(false);
  const particlesRef = useRef<Particle[]>([]);
  const animationFrameRef = useRef<number>();
  const revealStartTimeRef = useRef<number>(0);
  const debugMode = useDebugMode();
  
  // Debug controllable parameters
  const [density, setDensity] = useState(25); // Particle density divider
  const [minSize, setMinSize] = useState(1.5); // Min particle size
  const [maxSize, setMaxSize] = useState(1); // Max additional size
  const [speed, setSpeed] = useState(2); // Movement speed multiplier
  const [moveRange, setMoveRange] = useState(15); // How far particles wander
  const [minOpacity, setMinOpacity] = useState(0.2); // Min opacity
  const [maxOpacity, setMaxOpacity] = useState(0.8); // Max opacity
  const [opacitySpeed, setOpacitySpeed] = useState(0.02); // Opacity change rate
  const [disperseSpeed, setDisperseSpeed] = useState(8); // Disperse multiplier
  const [revealDuration, setRevealDuration] = useState(800); // Reveal time in ms

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

    // Create many tiny particles - using debug parameters
    const particleCount = Math.floor((canvas.width * canvas.height) / density);
    const particles: Particle[] = [];

    for (let i = 0; i < particleCount; i++) {
      const baseX = Math.random() * canvas.width;
      const baseY = Math.random() * canvas.height;
      
      particles.push({
        x: baseX,
        y: baseY,
        baseX,
        baseY,
        vx: (Math.random() - 0.5) * speed,
        vy: (Math.random() - 0.5) * speed,
        opacity: minOpacity + Math.random() * (maxOpacity - minOpacity),
        opacityVelocity: (Math.random() - 0.5) * opacitySpeed,
        size: minSize + Math.random() * maxSize,
      });
    }

    particlesRef.current = particles;

    return () => {
      window.removeEventListener('resize', updateCanvasSize);
    };
  }, [density, minSize, maxSize, speed, minOpacity, maxOpacity, opacitySpeed]); // Recreate particles when params change

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
      const elapsed = now - revealStartTimeRef.current;
      const revealProgress = isRevealing ? Math.min(elapsed / revealDuration, 1) : 0;

      // Easing function (power2.out)
      const ease = (t: number) => 1 - Math.pow(1 - t, 2);
      const easedProgress = ease(revealProgress);

      particles.forEach((particle) => {
        if (isRevealing) {
          // Disperse particles rapidly outward
          particle.x += particle.vx * disperseSpeed * easedProgress;
          particle.y += particle.vy * disperseSpeed * easedProgress;
          particle.opacity = Math.max(0, particle.opacity * (1 - easedProgress));
        } else {
          // Rapid looping movement around base position
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
          if (particle.opacity > maxOpacity || particle.opacity < minOpacity) {
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
  }, [isRevealing, onRevealComplete, moveRange, minOpacity, maxOpacity, disperseSpeed, revealDuration]);

  return (
    <>
      <div className="invisible-ink-container" ref={containerRef}>
        <div className={`invisible-ink-text ${revealed ? 'revealed' : ''}`}>
          {text}
        </div>
        {!revealed && <canvas ref={canvasRef} className="invisible-ink-canvas" />}
      </div>
      
      {/* Debug Controller - Portal to body to escape modal container */}
      {debugMode && !revealed && createPortal(
        <div className="ink-debug-controller">
          <h4>Particle Controls</h4>
          
          <label>
            Density: {density}
            <input type="range" min="10" max="100" value={density} onChange={(e) => setDensity(Number(e.target.value))} />
          </label>
          
          <label>
            Min Size: {minSize.toFixed(1)}
            <input type="range" min="0.5" max="3" step="0.1" value={minSize} onChange={(e) => setMinSize(Number(e.target.value))} />
          </label>
          
          <label>
            Max Size: {maxSize.toFixed(1)}
            <input type="range" min="0" max="3" step="0.1" value={maxSize} onChange={(e) => setMaxSize(Number(e.target.value))} />
          </label>
          
          <label>
            Speed: {speed.toFixed(1)}
            <input type="range" min="0.5" max="5" step="0.1" value={speed} onChange={(e) => setSpeed(Number(e.target.value))} />
          </label>
          
          <label>
            Move Range: {moveRange}
            <input type="range" min="5" max="50" value={moveRange} onChange={(e) => setMoveRange(Number(e.target.value))} />
          </label>
          
          <label>
            Min Opacity: {minOpacity.toFixed(2)}
            <input type="range" min="0" max="1" step="0.05" value={minOpacity} onChange={(e) => setMinOpacity(Number(e.target.value))} />
          </label>
          
          <label>
            Max Opacity: {maxOpacity.toFixed(2)}
            <input type="range" min="0" max="1" step="0.05" value={maxOpacity} onChange={(e) => setMaxOpacity(Number(e.target.value))} />
          </label>
          
          <label>
            Opacity Speed: {opacitySpeed.toFixed(3)}
            <input type="range" min="0.001" max="0.05" step="0.001" value={opacitySpeed} onChange={(e) => setOpacitySpeed(Number(e.target.value))} />
          </label>
          
          <label>
            Disperse Speed: {disperseSpeed}
            <input type="range" min="1" max="20" value={disperseSpeed} onChange={(e) => setDisperseSpeed(Number(e.target.value))} />
          </label>
          
          <label>
            Reveal Duration: {revealDuration}ms
            <input type="range" min="200" max="2000" step="100" value={revealDuration} onChange={(e) => setRevealDuration(Number(e.target.value))} />
          </label>
          
          <button onClick={() => {
            console.log('Particle Settings:', {
              density, minSize, maxSize, speed, moveRange,
              minOpacity, maxOpacity, opacitySpeed, disperseSpeed, revealDuration
            });
          }}>
            Log Current Settings
          </button>
        </div>,
        document.body
      )}
    </>
  );
}
