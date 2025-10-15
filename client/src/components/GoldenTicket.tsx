import React, { useEffect, useRef, useState } from 'react';
import './GoldenTicket.css';

interface GoldenTicketProps {
  claimedAt: string;
  location: string;
  twitterHandle?: string;
}

// Temporary adjustment controls for positioning
const TextPositionAdjuster: React.FC<{
  x1: number;
  x2: number;
  x3: number;
  y1: number;
  y2: number;
  y3: number;
  onAdjust: (x1: number, x2: number, x3: number, y1: number, y2: number, y3: number) => void;
}> = ({ x1, x2, x3, y1, y2, y3, onAdjust }) => {
  return (
    <div style={{
      position: 'fixed',
      top: '10px',
      right: '10px',
      background: 'rgba(0,0,0,0.8)',
      color: 'white',
      padding: '15px',
      borderRadius: '5px',
      fontSize: '12px',
      zIndex: 9999,
      fontFamily: 'monospace',
      maxWidth: '200px'
    }}>
      <div style={{marginBottom: '10px', fontWeight: 'bold'}}>Certificate: 886×598px</div>
      
      <div style={{marginBottom: '5px', fontWeight: 'bold', color: '#ffd700'}}>CLAIMANT:</div>
      <div>
        X1: <input type="number" value={x1} onChange={(e) => onAdjust(Number(e.target.value), x2, x3, y1, y2, y3)} style={{width: '60px'}} />
        Y1: <input type="number" value={y1} onChange={(e) => onAdjust(x1, x2, x3, Number(e.target.value), y2, y3)} style={{width: '60px'}} />
      </div>
      
      <div style={{marginBottom: '5px', marginTop: '10px', fontWeight: 'bold', color: '#ffd700'}}>DATE:</div>
      <div>
        X2: <input type="number" value={x2} onChange={(e) => onAdjust(x1, Number(e.target.value), x3, y1, y2, y3)} style={{width: '60px'}} />
        Y2: <input type="number" value={y2} onChange={(e) => onAdjust(x1, x2, x3, y1, Number(e.target.value), y3)} style={{width: '60px'}} />
      </div>
      
      <div style={{marginBottom: '5px', marginTop: '10px', fontWeight: 'bold', color: '#ffd700'}}>LOCATION:</div>
      <div>
        X3: <input type="number" value={x3} onChange={(e) => onAdjust(x1, x2, Number(e.target.value), y1, y2, y3)} style={{width: '60px'}} />
        Y3: <input type="number" value={y3} onChange={(e) => onAdjust(x1, x2, x3, y1, y2, Number(e.target.value))} style={{width: '60px'}} />
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
  
  // Position state for live adjustment - individual X and Y for each text
  const [textX1, setTextX1] = useState(590); // Claimant X
  const [textX2, setTextX2] = useState(590); // Date X
  const [textX3, setTextX3] = useState(590); // Location X
  const [textY1, setTextY1] = useState(200); // Claimant Y
  const [textY2, setTextY2] = useState(240); // Date Y
  const [textY3, setTextY3] = useState(280); // Location Y

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
  }, [claimedAt, location, twitterHandle, textX1, textX2, textX3, textY1, textY2, textY3]);

  const handlePositionAdjust = (x1: number, x2: number, x3: number, y1: number, y2: number, y3: number) => {
    setTextX1(x1);
    setTextX2(x2);
    setTextX3(x3);
    setTextY1(y1);
    setTextY2(y2);
    setTextY3(y3);
  };

  return (
    <>
      {/* Position adjustment controls - remove this after positioning is perfect */}
      <TextPositionAdjuster 
        x1={textX1}
        x2={textX2}
        x3={textX3}
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

