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
  const [isAnimated, setIsAnimated] = useState(false); // Start false, enable after image loads
  const [imageLoaded, setImageLoaded] = useState(false); // Track image load state
  const [transform, setTransform] = useState('');
  const animationTimeoutRef = useRef<number>();
  
  // Final optimized positions for new certificate (817×529px)
  const textX1 = 378; // Claimant X
  const textX2 = 314; // Date X  
  const textX3 = 372; // Location X
  const textY1 = 371; // Claimant Y
  const textY2 = 414; // Date Y
  const textY3 = 457; // Location Y

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
      
      // Mark image as loaded and start animation after brief delay
      setImageLoaded(true);
      
      setTimeout(() => {
        setIsAnimated(true);
      }, 300); // 300ms delay before starting animation
    };

    img.onerror = () => {
      console.error('Failed to load certificate template image');
      // Still show the container even if image fails
      setImageLoaded(true);
    };
  }, [claimedAt, location, twitterHandle]);

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
        className={`certificate-holo-card ${isAnimated ? 'animated' : ''} ${imageLoaded ? 'loaded' : ''}`}
        style={{ 
          transform,
          '--bevel-size': '30px',
          '--mobile-bevel-size': '22px'
        } as React.CSSProperties & { '--bevel-size': string; '--mobile-bevel-size': string }}
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
    </div>
  );
};

