import { useEffect, useRef } from 'react';
import { MarkerF } from '@react-google-maps/api';

interface CustomMarkerProps {
  position: { lat: number; lng: number };
  isActive: boolean;
  onClick: () => void;
  map?: google.maps.Map;
}

export const CustomMarker: React.FC<CustomMarkerProps> = ({ position, isActive, onClick, map }) => {
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!map || !window.google?.maps?.marker?.AdvancedMarkerElement) return;

    const color = isActive ? 'gold' : '#95a5a6';
    const starPath = "M344.13,6.42l80.5,217.54c3.64,9.83,11.39,17.58,21.22,21.22l217.54,80.5c8.56,3.17,8.56,15.28,0,18.45l-217.54,80.5c-9.83,3.64-17.58,11.39-21.22,21.22l-80.5,217.54c-3.17,8.56-15.28,8.56-18.45,0l-80.5-217.54c-3.64-9.83-11.39-17.58-21.22-21.22L6.42,344.13c-8.56-3.17-8.56-15.28,0-18.45l217.54-80.5c9.83-3.64,17.58-11.39,21.22-21.22L325.68,6.42c3.17-8.56,15.28,8.56,18.45,0Z";

    // Create content div
    const content = document.createElement('div');
    content.className = `pulse-marker ${isActive ? '' : 'inactive'}`;
    content.style.cssText = 'cursor: pointer; width: 80px; height: 80px; position: relative;';
    
    // Add SVGs
    for (let i = 0; i < 3; i++) {
      const ring = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      ring.setAttribute('class', 'pulse-marker-ring');
      ring.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      ring.setAttribute('viewBox', '0 0 669.82 669.82');
      const ringPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      ringPath.setAttribute('fill', 'none');
      ringPath.setAttribute('stroke', color);
      ringPath.setAttribute('stroke-width', '8');
      ringPath.setAttribute('stroke-opacity', '0.6');
      ringPath.setAttribute('fill-rule', 'evenodd');
      ringPath.setAttribute('d', starPath);
      ring.appendChild(ringPath);
      content.appendChild(ring);
    }

    const star = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    star.setAttribute('class', 'pulse-marker-star');
    star.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    star.setAttribute('viewBox', '0 0 669.82 669.82');
    const starPathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    starPathEl.setAttribute('fill', color);
    starPathEl.setAttribute('fill-rule', 'evenodd');
    starPathEl.setAttribute('d', starPath);
    star.appendChild(starPathEl);
    content.appendChild(star);

    contentRef.current = content;

    // Create AdvancedMarker
    const marker = new google.maps.marker.AdvancedMarkerElement({
      map,
      position,
      content,
    });

    // Add click listener
    content.addEventListener('click', (e) => {
      e.stopPropagation();
      onClick();
    });

    markerRef.current = marker;

    return () => {
      if (markerRef.current) {
        markerRef.current.map = null;
      }
    };
  }, [map, position.lat, position.lng, isActive, onClick]);

  return null;
};

