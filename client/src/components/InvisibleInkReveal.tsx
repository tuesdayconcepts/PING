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
  angle: number; // For circular motion
  angularVelocity: number; // Rotation speed
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
  const particlesRef = useRef<Particle[]>([]);
  const animationFrameRef = useRef<number>();
  const debugMode = useDebugMode();
  
  // Debug controllable parameters
  const [density, setDensity] = useState(65); // Particle density divider
  const [minSize, setMinSize] = useState(0.5); // Min particle size
  const [maxSize, setMaxSize] = useState(2.7); // Max additional size
  const [speed, setSpeed] = useState(0.5); // Movement speed multiplier
  const [moveRange, setMoveRange] = useState(5); // How far particles wander
  const [minOpacity, setMinOpacity] = useState(0.3); // Min opacity
  const [maxOpacity, setMaxOpacity] = useState(1.0); // Max opacity
  const [opacitySpeed, setOpacitySpeed] = useState(0.1); // Opacity change rate (visibility transition speed)
  const [opacityRange, setOpacityRange] = useState(1.0); // How much opacity changes (0-1)
  // Removed disperseSpeed and revealDuration - no longer needed with simplified logic
  const [circularMotion, setCircularMotion] = useState(0.55); // Circular motion strength (0=linear, 1=full circular)
  
  // Normal particle loop settings (not affected by debug)
  const normalSpeed = 0.5;
  const normalMoveRange = 15;
  const normalMinOpacity = 0.2;
  const normalMaxOpacity = 0.8;
  const normalOpacitySpeed = 0.02;

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

    // Create many tiny particles - using normal settings for stable loop
    const particleCount = Math.floor((canvas.width * canvas.height) / density);
    const particles: Particle[] = [];

    for (let i = 0; i < particleCount; i++) {
      const baseX = Math.random() * canvas.width;
      const baseY = Math.random() * canvas.height;
      const randomAngle = Math.random() * Math.PI * 2;
      
      particles.push({
        x: baseX,
        y: baseY,
        baseX,
        baseY,
        vx: (Math.random() - 0.5) * normalSpeed,
        vy: (Math.random() - 0.5) * normalSpeed,
        opacity: normalMinOpacity + Math.random() * (normalMaxOpacity - normalMinOpacity),
        opacityVelocity: (Math.random() - 0.5) * normalOpacitySpeed,
        size: minSize + Math.random() * maxSize,
        angle: randomAngle,
        angularVelocity: (Math.random() - 0.5) * 0.05, // Random rotation speed
      });
    }

    particlesRef.current = particles;

    return () => {
      window.removeEventListener('resize', updateCanvasSize);
    };
  }, [density, minSize, maxSize, speed, minOpacity, opacityRange, opacitySpeed]); // Recreate particles when params change

  // Trigger reveal animation when revealed prop changes
  // Call onRevealComplete when revealed becomes true
  useEffect(() => {
    if (revealed && onRevealComplete) {
      onRevealComplete();
    }
  }, [revealed, onRevealComplete]);

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

      // Render text in canvas if revealed
      if (revealed) {
        ctx.save();
        ctx.fillStyle = `rgba(255, 255, 255, 0.9)`;
        ctx.font = '16px DM Sans, Roboto, Helvetica Neue, Helvetica, Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Wrap text to fit canvas width
        const maxWidth = canvas.width - 40; // 20px padding on each side
        const words = text.split(' ');
        const lines: string[] = [];
        let currentLine = '';
        
        for (const word of words) {
          const testLine = currentLine + (currentLine ? ' ' : '') + word;
          const metrics = ctx.measureText(testLine);
          
          if (metrics.width > maxWidth && currentLine) {
            lines.push(currentLine);
            currentLine = word;
          } else {
            currentLine = testLine;
          }
        }
        if (currentLine) lines.push(currentLine);
        
        // Draw text lines
        const lineHeight = 24;
        const startY = canvas.height / 2 - (lines.length - 1) * lineHeight / 2;
        
        lines.forEach((line, index) => {
          ctx.fillText(line, canvas.width / 2, startY + index * lineHeight);
        });
        
        ctx.restore();
      }

      // Only show particles when not revealed (to cover text)
      if (!revealed) {
        particles.forEach((particle) => {
          // Normal particle loop - use stable settings
          particle.angle += particle.angularVelocity;
          
          // Blend linear and circular motion based on circularMotion parameter
          const linearX = particle.vx;
          const linearY = particle.vy;
          const circularX = Math.cos(particle.angle) * normalSpeed * 0.5;
          const circularY = Math.sin(particle.angle) * normalSpeed * 0.5;
          
          // Interpolate between linear and circular motion
          const moveX = linearX * (1 - circularMotion) + circularX * circularMotion;
          const moveY = linearY * (1 - circularMotion) + circularY * circularMotion;
          
          particle.x += moveX;
          particle.y += moveY;
          
          // Bounce back toward base position (loop effect)
          const dx = particle.x - particle.baseX;
          const dy = particle.y - particle.baseY;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance > normalMoveRange) {
            // Pull back toward base with elastic effect
            particle.vx *= -1;
            particle.vy *= -1;
            particle.angularVelocity *= -1;
          }
          
          // Gentle oscillate opacity for stable loop
          particle.opacity += particle.opacityVelocity;
          const opacityMin = normalMinOpacity;
          const opacityMax = normalMaxOpacity;
          
          if (particle.opacity > opacityMax || particle.opacity < opacityMin) {
            particle.opacityVelocity *= -1;
            // Clamp opacity within range
            particle.opacity = Math.max(opacityMin, Math.min(opacityMax, particle.opacity));
          }
          
          // Draw particle as perfect circle
          ctx.fillStyle = `rgba(180, 180, 180, ${particle.opacity})`;
          ctx.beginPath();
          ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      animating = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isRevealing, onRevealComplete, moveRange, minOpacity, opacityRange, disperseSpeed, revealDuration, circularMotion, speed]);

  return (
    <>
      <div className="invisible-ink-container" ref={containerRef}>
        <canvas 
          ref={canvasRef} 
          className="invisible-ink-canvas"
          aria-label={revealed ? `Hint: ${text}` : 'Hint content hidden - purchase to reveal'}
          role="img"
        />
        {/* Hidden text for screen readers */}
        <div className="sr-only" aria-live="polite">
          {revealed ? text : 'Hint content is hidden until purchased'}
        </div>
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
            <input type="range" min="0.001" max="0.1" step="0.001" value={opacitySpeed} onChange={(e) => setOpacitySpeed(Number(e.target.value))} />
            <small style={{color: '#999', fontSize: '0.75rem'}}>How fast opacity changes</small>
          </label>
          
          <label>
            Opacity Range: {opacityRange.toFixed(2)}
            <input type="range" min="0.1" max="1" step="0.05" value={opacityRange} onChange={(e) => setOpacityRange(Number(e.target.value))} />
            <small style={{color: '#999', fontSize: '0.75rem'}}>Transition visible ↔ transparent range</small>
          </label>
          
          <label>
            Circular Motion: {circularMotion.toFixed(2)}
            <input type="range" min="0" max="1" step="0.05" value={circularMotion} onChange={(e) => setCircularMotion(Number(e.target.value))} />
            <small style={{color: '#999', fontSize: '0.75rem'}}>0=straight lines, 1=full swirl</small>
          </label>
          
          {/* Removed disperse speed and reveal duration - no longer needed with simplified logic */}
          
          <button onClick={() => {
            console.log('Particle Settings:', {
              density, minSize, maxSize, speed, moveRange,
              minOpacity, maxOpacity, opacitySpeed, opacityRange,
              circularMotion, disperseSpeed, revealDuration
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
