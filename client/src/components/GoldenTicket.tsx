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

      // Text positions (moved to lower end of certificate)
      const valueX = 590; // X position for values
      
      // Configure text styling for values only (2x larger font)
      ctx.font = '28px Arial'; // Doubled from 14px to 28px
      ctx.fillStyle = '#ffffff';
      
      // Draw CLAIMANT value (moved to lower end)
      ctx.fillText(twitterHandle || 'Anonymous Hunter', valueX, 200);

      // Draw DATE value (moved to lower end)
      ctx.fillText(formatDate(claimedAt), valueX, 240);

      // Draw LOCATION value (moved to lower end)
      // Truncate location if too long
      const maxLocationLength = 15; // Reduced since font is larger
      const displayLocation = location.length > maxLocationLength 
        ? location.substring(0, maxLocationLength) + '...' 
        : location;
      ctx.fillText(displayLocation, valueX, 280);
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

