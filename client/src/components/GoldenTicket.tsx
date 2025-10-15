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
    
    console.log('Loading certificate template from:', img.src);
    
    img.onload = () => {
      console.log('Certificate template loaded successfully:', img.width, 'x', img.height);
      
      // Set canvas size to match image
      canvas.width = img.width;
      canvas.height = img.height;

      // Draw template image
      ctx.drawImage(img, 0, 0);
      console.log('Template image drawn to canvas');

      // Configure text styling
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left';
      ctx.shadowColor = 'rgba(255, 255, 255, 0.3)';
      ctx.shadowBlur = 5;

      // Text positions (adjust these based on your template design)
      const labelX = 520; // X position for labels
      const valueX = 620; // X position for values (after labels)
      
      // Draw CLAIMANT
      ctx.font = 'bold 12px Arial';
      ctx.fillStyle = '#ffd700';
      ctx.fillText('CLAIMANT:', labelX, 110);
      
      ctx.font = '14px Arial';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(twitterHandle || 'Anonymous Hunter', valueX, 110);

      // Draw DATE
      ctx.font = 'bold 12px Arial';
      ctx.fillStyle = '#ffd700';
      ctx.fillText('DATE:', labelX, 150);
      
      ctx.font = '14px Arial';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(formatDate(claimedAt), valueX, 150);

      // Draw LOCATION
      ctx.font = 'bold 12px Arial';
      ctx.fillStyle = '#ffd700';
      ctx.fillText('LOCATION:', labelX, 190);
      
      ctx.font = '14px Arial';
      ctx.fillStyle = '#ffffff';
      // Truncate location if too long
      const maxLocationLength = 20;
      const displayLocation = location.length > maxLocationLength 
        ? location.substring(0, maxLocationLength) + '...' 
        : location;
      ctx.fillText(displayLocation, valueX, 190);
    };

    img.onerror = (error) => {
      console.error('Failed to load certificate template image:', error);
      console.error('Image src:', img.src);
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

