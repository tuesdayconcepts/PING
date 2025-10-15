import React, { useEffect, useRef } from 'react';
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
  
  // Final optimized positions for certificate (886×598px)
  const textX1 = 412; // Claimant X
  const textX2 = 351; // Date X  
  const textX3 = 409; // Location X
  const textY1 = 405; // Claimant Y
  const textY2 = 449; // Date Y
  const textY3 = 491; // Location Y

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
  }, [claimedAt, location, twitterHandle]);

  return (
    <canvas 
      ref={canvasRef} 
      id="golden-ticket-canvas"
      className="golden-ticket-canvas"
    />
  );
};

