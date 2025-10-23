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
  const revealStartTimeRef = useRef<number>(0);
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
  const [disperseSpeed, setDisperseSpeed] = useState(15); // How fast particles disperse during reveal
  const [revealDuration, setRevealDuration] = useState(2000); // Reveal duration in ms (match processing time)
  const [circularMotion, setCircularMotion] = useState(0.55); // Circular motion strength (0=linear, 1=full circular)
  const [vignetteFade, setVignetteFade] = useState(0.85); // Adjustable fade start point
  
  // Removed normal particle settings - using original simple approach

  // Calculate edge fade factor (1.0 at center, subtle fade at edges)
  const getEdgeFadeFactor = (x: number, y: number, width: number, height: number): number => {
    // Calculate distance from each edge (maintains square shape)
    const distFromLeft = x;
    const distFromRight = width - x;
    const distFromTop = y;
    const distFromBottom = height - y;
    
    // Find the closest edge
    const minDistToEdge = Math.min(distFromLeft, distFromRight, distFromTop, distFromBottom);
    
    // Only start fading in the outer 30% of the canvas
    const fadeStartDistance = Math.min(width, height) * 0.3;
    
    if (minDistToEdge > fadeStartDistance) {
      return 1.0; // Full opacity in center area
    } else {
      // Fade from 100% to 0% in the outer 30%
      const fadeAmount = (fadeStartDistance - minDistToEdge) / fadeStartDistance;
      return Math.max(0, 1 - fadeAmount); // Fade to 0% opacity at edges
    }
  };

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

    // Create particles using debug parameters
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
        vx: (Math.random() - 0.5) * 2 * speed, // Use speed parameter
        vy: (Math.random() - 0.5) * 2 * speed,
        opacity: minOpacity + Math.random() * (maxOpacity - minOpacity), // Use opacity range
        opacityVelocity: (Math.random() - 0.5) * opacitySpeed, // Use opacity speed
        size: minSize + Math.random() * maxSize, // Use size parameters
        angle: Math.random() * Math.PI * 2,
        angularVelocity: (Math.random() - 0.5) * 0.1,
      });
    }

    particlesRef.current = particles;

    return () => {
      window.removeEventListener('resize', updateCanvasSize);
    };
  }, [density, minSize, maxSize, speed, moveRange, minOpacity, maxOpacity, opacitySpeed, opacityRange]); // Recreate particles when params change

  // Trigger reveal animation when revealed prop changes
  // Start reveal animation when revealed becomes true
  useEffect(() => {
    if (revealed) {
      revealStartTimeRef.current = Date.now();
    }
  }, [revealed]);

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
      const revealProgress = revealed ? Math.min(elapsed / revealDuration, 1) : 0;

      // Easing function (power2.out)
      const ease = (t: number) => 1 - Math.pow(1 - t, 2);
      const easedProgress = ease(revealProgress);

      // STATE 1: revealed = false - Show particles only
      if (!revealed) {
        particles.forEach((particle) => {
          // Bouncing movement around base position using moveRange parameter
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
          
          // Oscillate opacity using debug parameters
          particle.opacity += particle.opacityVelocity;
          if (particle.opacity > maxOpacity || particle.opacity < minOpacity) {
            particle.opacityVelocity *= -1;
          }
          
          // Draw particle as perfect circle with edge fade
          const edgeFade = getEdgeFadeFactor(particle.x, particle.y, canvas.width, canvas.height);
          ctx.fillStyle = `rgba(180, 180, 180, ${particle.opacity * edgeFade})`;
          ctx.beginPath();
          ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
          ctx.fill();
        });
      }
      
      // STATE 2: revealed = true - Transition from particles to text over 2 seconds
      else {
        // ALWAYS render the text underneath first (like it's already there)
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
        
        // Then render particles on top (slower dispersion to create true reveal effect)
        particles.forEach((particle) => {
          // Much slower, more gradual dispersion (3x slower)
          const dispersionSpeed = disperseSpeed * 0.1; // 3x slower than before
          particle.x += particle.vx * dispersionSpeed * easedProgress;
          particle.y += particle.vy * dispersionSpeed * easedProgress;
          
          // Much more gradual opacity fade (3x slower)
          particle.opacity = Math.max(0, particle.opacity * (1 - easedProgress * 0.27));
          
          // Only draw particles if they still have opacity
          if (particle.opacity > 0) {
            const edgeFade = getEdgeFadeFactor(particle.x, particle.y, canvas.width, canvas.height);
            ctx.fillStyle = `rgba(180, 180, 180, ${particle.opacity * edgeFade})`;
            ctx.beginPath();
            ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
            ctx.fill();
          }
        });
      }

      // Continue animation
      animationFrameRef.current = requestAnimationFrame(animate);
      
      // Call onRevealComplete when transition is done
      if (revealed && revealProgress >= 1 && onRevealComplete) {
        onRevealComplete();
      }
    };

    animate();

    return () => {
      animating = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [revealed, onRevealComplete, disperseSpeed, moveRange, minOpacity, maxOpacity, revealDuration, vignetteFade]);

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
          
          <label>
            Disperse Speed: {disperseSpeed}
            <input type="range" min="5" max="30" value={disperseSpeed} onChange={(e) => setDisperseSpeed(Number(e.target.value))} />
            <small style={{color: '#999', fontSize: '0.75rem'}}>How fast particles disperse during reveal</small>
          </label>
          
          <label>
            Reveal Duration: {revealDuration}ms
            <input type="range" min="1000" max="4000" step="100" value={revealDuration} onChange={(e) => setRevealDuration(Number(e.target.value))} />
            <small style={{color: '#999', fontSize: '0.75rem'}}>How long the reveal animation takes</small>
          </label>
          
          <label>
            Vignette Fade: {vignetteFade.toFixed(2)}
            <input type="range" min="0.5" max="1.0" step="0.05" value={vignetteFade} onChange={(e) => setVignetteFade(Number(e.target.value))} />
            <small style={{color: '#999', fontSize: '0.75rem'}}>Edge fade intensity - affects outer 30%, fades 100% to 0%</small>
          </label>
          
          <button onClick={() => {
            console.log('Particle Settings:', {
              density, minSize, maxSize, speed, moveRange,
              minOpacity, maxOpacity, opacitySpeed, opacityRange,
              circularMotion, disperseSpeed, revealDuration, vignetteFade
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
