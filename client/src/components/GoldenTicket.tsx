import React, { useEffect, useRef, useState } from 'react';
import './GoldenTicket.css';

interface GoldenTicketProps {
  claimedAt: string;
  location: string;
  twitterHandle?: string;
}

// Temporary adjustment controls for positioning
const TextPositionAdjuster: React.FC<{
  x: number;
  y1: number;
  y2: number;
  y3: number;
  onAdjust: (x: number, y1: number, y2: number, y3: number) => void;
}> = ({ x, y1, y2, y3, onAdjust }) => {
  return (
    <div style={{
      position: 'fixed',
      top: '10px',
      right: '10px',
      background: 'rgba(0,0,0,0.8)',
      color: 'white',
      padding: '10px',
      borderRadius: '5px',
      fontSize: '12px',
      zIndex: 9999,
      fontFamily: 'monospace'
    }}>
      <div>Certificate: 886×598px</div>
      <div>
        X: <input type="number" value={x} onChange={(e) => onAdjust(Number(e.target.value), y1, y2, y3)} style={{width: '60px'}} />
      </div>
      <div>
        Y1 (Claimant): <input type="number" value={y1} onChange={(e) => onAdjust(x, Number(e.target.value), y2, y3)} style={{width: '60px'}} />
      </div>
      <div>
        Y2 (Date): <input type="number" value={y2} onChange={(e) => onAdjust(x, y1, Number(e.target.value), y3)} style={{width: '60px'}} />
      </div>
      <div>
        Y3 (Location): <input type="number" value={y3} onChange={(e) => onAdjust(x, y1, y2, Number(e.target.value))} style={{width: '60px'}} />
      </div>
    </div>
  );
};

export const GoldenTicket: React.FC<GoldenTicketProps> = ({
  claimedAt,
  location,
  twitterHandle
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Position state for live adjustment
  const [textX, setTextX] = useState(590);
  const [textY1, setTextY1] = useState(200); // Claimant
  const [textY2, setTextY2] = useState(240); // Date
  const [textY3, setTextY3] = useState(280); // Location

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

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

      // Configure text styling for values only (2x larger font)
      ctx.font = '28px Arial'; // Doubled from 14px to 28px
      ctx.fillStyle = '#ffffff';
      
      // Draw CLAIMANT value (using live position values)
      ctx.fillText(twitterHandle || 'Anonymous Hunter', textX, textY1);

      // Draw DATE value (using live position values)
      ctx.fillText(formatDate(claimedAt), textX, textY2);

      // Draw LOCATION value (using live position values)
      // Truncate location if too long
      const maxLocationLength = 15; // Reduced since font is larger
      const displayLocation = location.length > maxLocationLength 
        ? location.substring(0, maxLocationLength) + '...' 
        : location;
      ctx.fillText(displayLocation, textX, textY3);
    };

    img.onerror = () => {
      console.error('Failed to load certificate template image');
    };
  }, [claimedAt, location, twitterHandle, textX, textY1, textY2, textY3]);

  const handlePositionAdjust = (x: number, y1: number, y2: number, y3: number) => {
    setTextX(x);
    setTextY1(y1);
    setTextY2(y2);
    setTextY3(y3);
  };

  return (
    <>
      {/* Position adjustment controls - remove this after positioning is perfect */}
      <TextPositionAdjuster 
        x={textX}
        y1={textY1}
        y2={textY2}
        y3={textY3}
        onAdjust={handlePositionAdjust}
      />
      
      <canvas 
        ref={canvasRef} 
        id="golden-ticket-canvas"
        className="golden-ticket-canvas"
      />
    </>
  );
};

