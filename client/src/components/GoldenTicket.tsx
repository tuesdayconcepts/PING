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

      // Text positions (adjusted based on template design)
      const valueX = 590; // X position for values (30px left from before: 620 -> 590)
      
      // Configure text styling for values only (no labels needed)
      ctx.font = '14px Arial';
      ctx.fillStyle = '#ffffff';
      
      // Draw CLAIMANT value (80px lower: 110 -> 190)
      ctx.fillText(twitterHandle || 'Anonymous Hunter', valueX, 190);

      // Draw DATE value (80px lower: 150 -> 230)
      ctx.fillText(formatDate(claimedAt), valueX, 230);

      // Draw LOCATION value (80px lower: 190 -> 270)
      // Truncate location if too long
      const maxLocationLength = 20;
      const displayLocation = location.length > maxLocationLength 
        ? location.substring(0, maxLocationLength) + '...' 
        : location;
      ctx.fillText(displayLocation, valueX, 270);
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

