import { useState, useEffect } from 'react';
import { Marker } from '@react-google-maps/api';

interface CustomMarkerProps {
  position: { lat: number; lng: number };
  isActive: boolean;
  onClick: () => void;
}

export const CustomMarker: React.FC<CustomMarkerProps> = ({ position, isActive, onClick }) => {
  const [icon, setIcon] = useState<google.maps.Icon | null>(null);

  useEffect(() => {
    const color = isActive ? 'gold' : '%2395a5a6'; // URL-encoded #95a5a6
    const starPath = "M344.13,6.42l80.5,217.54c3.64,9.83,11.39,17.58,21.22,21.22l217.54,80.5c8.56,3.17,8.56,15.28,0,18.45l-217.54,80.5c-9.83,3.64-17.58,11.39-21.22,21.22l-80.5,217.54c-3.17,8.56-15.28,8.56-18.45,0l-80.5-217.54c-3.64-9.83-11.39-17.58-21.22-21.22L6.42,344.13c-8.56-3.17-8.56-15.28,0-18.45l217.54-80.5c9.83-3.64,17.58-11.39,21.22-21.22L325.68,6.42c3.17-8.56,15.28,8.56,18.45,0Z";
    
    // Create SVG data URL
    const svgIcon = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 669.82 669.82"><path fill="${color}" fill-rule="evenodd" d="${starPath}"/></svg>`;
    
    setIcon({
      url: svgIcon,
      scaledSize: new google.maps.Size(40, 40),
      anchor: new google.maps.Point(20, 20),
    });
  }, [isActive]);

  if (!icon) return null;

  return (
    <Marker
      position={position}
      icon={icon}
      onClick={onClick}
      animation={isActive ? google.maps.Animation.BOUNCE : undefined}
    />
  );
};

