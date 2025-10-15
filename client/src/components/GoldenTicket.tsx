import React, { useEffect, useRef, useState } from 'react';
import './GoldenTicket.css';

interface GoldenTicketProps {
  claimedAt: string;
  location: string;
  twitterHandle?: string;
}

export const GoldenTicket: React.FC<GoldenTicketProps> = ({
  claimedAt,
  location,
  twitterHandle
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [isAnimated, setIsAnimated] = useState(true);
  const [transform, setTransform] = useState('');
  const animationTimeoutRef = useRef<number>();
  
  // Text position adjustment tool (temporary)
  const [textX1, setTextX1] = useState(412);
  const [textY1, setTextY1] = useState(405);
  const [textX2, setTextX2] = useState(351);
  const [textY2, setTextY2] = useState(449);
  const [textX3, setTextX3] = useState(409);
  const [textY3, setTextY3] = useState(491);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Draw certificate on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Load template image
    const img = new Image();
    img.src = '/certificate-template.png';
    
    img.onload = () => {
      // Set canvas size to match image
      canvas.width = img.width;
      canvas.height = img.height;

      // Draw template image
      ctx.drawImage(img, 0, 0);

      // Configure text styling
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left';
      ctx.shadowColor = 'rgba(255, 255, 255, 0.3)';
      ctx.shadowBlur = 5;

      // Configure text styling for values only
      ctx.font = '24px Arial'; // Optimized font size
      ctx.fillStyle = '#ffffff';
      
      // Draw CLAIMANT value (using individual position values)
      ctx.fillText(twitterHandle || 'Anonymous Hunter', textX1, textY1);

      // Draw DATE value (using individual position values)
      ctx.fillText(formatDate(claimedAt), textX2, textY2);

      // Draw LOCATION value (using individual position values)
      // Truncate location if too long
      const maxLocationLength = 15; // Reduced since font is larger
      const displayLocation = location.length > maxLocationLength 
        ? location.substring(0, maxLocationLength) + '...' 
        : location;
      ctx.fillText(displayLocation, textX3, textY3);
    };

    img.onerror = () => {
      console.error('Failed to load certificate template image');
    };
  }, [claimedAt, location, twitterHandle, textX1, textY1, textX2, textY2, textX3, textY3]);

  // Mouse/touch tracking for 3D effect
  const handleMove = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    if (!card) return;

    // Clear any pending animation restart
    if (animationTimeoutRef.current) {
      clearTimeout(animationTimeoutRef.current);
    }

    // Disable animation class when interacting
    setIsAnimated(false);

    // Get position from mouse or touch
    let clientX: number;
    let clientY: number;

    if ('touches' in e) {
      // Touch event
      if (e.touches.length === 0) return;
      const touch = e.touches[0];
      clientX = touch.clientX;
      clientY = touch.clientY;
    } else {
      // Mouse event
      clientX = e.clientX;
      clientY = e.clientY;
    }

    // Get card dimensions and position
    const rect = card.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    
    // Calculate position relative to card (0-100)
    const l = clientX - rect.left;
    const t = clientY - rect.top;
    const px = Math.abs(Math.floor(100 / w * l) - 100);
    const py = Math.abs(Math.floor(100 / h * t) - 100);
    
    // Calculate gradient positions (opposite to mouse for parallax effect)
    const lp = 50 + (px - 50) / 1.5;
    const tp = 50 + (py - 50) / 1.5;
    
    // Calculate sparkle positions (slower movement)
    const px_spark = 50 + (px - 50) / 7;
    const py_spark = 50 + (py - 50) / 7;
    
    // Calculate 3D rotation
    const ty = ((tp - 50) / 2) * -1;
    const tx = ((lp - 50) / 1.5) * 0.5;
    
    // Apply transform
    setTransform(`rotateX(${ty}deg) rotateY(${tx}deg)`);
    
    // Update CSS custom properties for gradient/sparkle positions
    card.style.setProperty('--grad-x', `${lp}%`);
    card.style.setProperty('--grad-y', `${tp}%`);
    card.style.setProperty('--spark-x', `${px_spark}%`);
    card.style.setProperty('--spark-y', `${py_spark}%`);
  };

  // Reset on mouse leave
  const handleLeave = () => {
    setTransform('');
    const card = cardRef.current;
    if (card) {
      card.style.removeProperty('--grad-x');
      card.style.removeProperty('--grad-y');
      card.style.removeProperty('--spark-x');
      card.style.removeProperty('--spark-y');
    }
    
    // Restart animation after a delay
    animationTimeoutRef.current = setTimeout(() => {
      setIsAnimated(true);
    }, 2500);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="certificate-holo-wrapper">
      <div 
        ref={cardRef}
        className={`certificate-holo-card ${isAnimated ? 'animated' : ''}`}
        style={{ 
          transform,
          '--bevel-size': '35px'
        } as React.CSSProperties & { '--bevel-size': string }}
        onMouseMove={handleMove}
        onMouseLeave={handleLeave}
        onTouchMove={handleMove}
        onTouchEnd={handleLeave}
      >
        <canvas 
          ref={canvasRef} 
          id="golden-ticket-canvas"
          className="golden-ticket-canvas"
        />
      </div>
      
      {/* Text Position Adjustment Tool - Temporary */}
      <div style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        background: 'rgba(0, 0, 0, 0.9)',
        padding: '20px',
        borderRadius: '10px',
        color: 'white',
        zIndex: 9999,
        fontFamily: 'monospace',
        border: '2px solid #d4af37',
        maxHeight: '80vh',
        overflowY: 'auto'
      }}>
        <div style={{ marginBottom: '15px', fontWeight: 'bold', color: '#d4af37' }}>
          Text Position Adjuster
        </div>
        <div style={{ fontSize: '11px', color: '#aaa', marginBottom: '15px' }}>
          New image: 817px × 529px
        </div>
        
        {/* Claimant (Line 1) */}
        <div style={{ marginBottom: '15px', paddingBottom: '15px', borderBottom: '1px solid #444' }}>
          <div style={{ marginBottom: '5px', color: '#ffd700' }}>Claimant:</div>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px' }}>
            X1: {textX1}
          </label>
          <input
            type="range"
            min="0"
            max="817"
            value={textX1}
            onChange={(e) => setTextX1(Number(e.target.value))}
            style={{ width: '100%', marginBottom: '8px' }}
          />
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px' }}>
            Y1: {textY1}
          </label>
          <input
            type="range"
            min="0"
            max="529"
            value={textY1}
            onChange={(e) => setTextY1(Number(e.target.value))}
            style={{ width: '100%' }}
          />
        </div>
        
        {/* Date (Line 2) */}
        <div style={{ marginBottom: '15px', paddingBottom: '15px', borderBottom: '1px solid #444' }}>
          <div style={{ marginBottom: '5px', color: '#ffd700' }}>Date:</div>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px' }}>
            X2: {textX2}
          </label>
          <input
            type="range"
            min="0"
            max="817"
            value={textX2}
            onChange={(e) => setTextX2(Number(e.target.value))}
            style={{ width: '100%', marginBottom: '8px' }}
          />
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px' }}>
            Y2: {textY2}
          </label>
          <input
            type="range"
            min="0"
            max="529"
            value={textY2}
            onChange={(e) => setTextY2(Number(e.target.value))}
            style={{ width: '100%' }}
          />
        </div>
        
        {/* Location (Line 3) */}
        <div style={{ marginBottom: '15px' }}>
          <div style={{ marginBottom: '5px', color: '#ffd700' }}>Location:</div>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px' }}>
            X3: {textX3}
          </label>
          <input
            type="range"
            min="0"
            max="817"
            value={textX3}
            onChange={(e) => setTextX3(Number(e.target.value))}
            style={{ width: '100%', marginBottom: '8px' }}
          />
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px' }}>
            Y3: {textY3}
          </label>
          <input
            type="range"
            min="0"
            max="529"
            value={textY3}
            onChange={(e) => setTextY3(Number(e.target.value))}
            style={{ width: '100%' }}
          />
        </div>
        
        <div style={{ fontSize: '11px', color: '#aaa', marginTop: '10px' }}>
          Adjust positions to align with certificate
        </div>
      </div>
    </div>
  );
};

