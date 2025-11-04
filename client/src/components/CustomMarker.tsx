import { useEffect, useRef } from 'react';

interface CustomMarkerProps {
  position: { lat: number; lng: number };
  isActive: boolean;
  onClick: () => void;
  map?: google.maps.Map;
  animate?: boolean; // Control whether to show slide-up animation
  claimType?: 'nfc' | 'proximity'; // Claim type for visual distinction
  proximityRadius?: number | null; // Proximity radius for pulse size calculation
  userDistance?: number | null; // Current user distance in meters (for proximity pings)
}

export const CustomMarker: React.FC<CustomMarkerProps> = ({ 
  position, 
  isActive, 
  onClick, 
  map, 
  animate = false,
  claimType = 'nfc',
  proximityRadius = null,
  userDistance = null,
}) => {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const hasAnimated = useRef(false); // Track if animation has played

  useEffect(() => {
    if (!map) return;

    // Active markers: gold fill, inactive markers: gold stroke with no fill
    const color = 'gold';
    const starPath = "M344.13,6.42l80.5,217.54c3.64,9.83,11.39,17.58,21.22,21.22l217.54,80.5c8.56,3.17,8.56,15.28,0,18.45l-217.54,80.5c-9.83,3.64-17.58,11.39-21.22,21.22l-80.5,217.54c-3.17,8.56-15.28,8.56-18.45,0l-80.5-217.54c-3.64-9.83-11.39-17.58-21.22-21.22L6.42,344.13c-8.56-3.17-8.56-15.28,0-18.45l217.54-80.5c9.83-3.64,17.58-11.39,21.22-21.22L325.68,6.42c3.17-8.56,15.28,8.56,18.45,0Z";
    
    // Calculate pulse size for proximity pings (10x claim radius, default 50m for 5m radius)
    const pulseRadius = claimType === 'proximity' 
      ? (proximityRadius || 5) * 10 
      : 80; // Default size for NFC
    
    // For proximity pings, adjust pulse size based on user distance
    // When user is within claim radius, pulse shrinks to regular marker size
    const isWithinClaimRadius = userDistance !== null && proximityRadius !== null && userDistance <= proximityRadius;
    const finalPulseSize = (claimType === 'proximity' && isWithinClaimRadius) ? 80 : pulseRadius;

    // Create custom overlay
    class CustomOverlay extends google.maps.OverlayView {
      position: google.maps.LatLng;
      containerDiv: HTMLDivElement | null = null;

      constructor(position: google.maps.LatLng) {
        super();
        this.position = position;
      }

      onAdd() {
        const div = document.createElement('div');
        // Only add slide-up animation class if animate prop is true AND hasn't animated yet
        const animationClass = (animate && !hasAnimated.current) ? 'marker-slide-up' : '';
        const proximityClass = claimType === 'proximity' ? 'proximity-marker' : '';
        const withinRadiusClass = (claimType === 'proximity' && isWithinClaimRadius) ? 'within-radius' : '';
        div.className = `pulse-marker ${isActive ? '' : 'inactive'} ${animationClass} ${proximityClass} ${withinRadiusClass}`;
        
        // For proximity pings, use larger size for pulse area (no center marker when far)
        const markerSize = (claimType === 'proximity' && !isWithinClaimRadius) ? finalPulseSize : 80;
        div.style.cssText = `cursor: pointer; width: ${markerSize}px; height: ${markerSize}px; position: absolute;`;
        
        // Mark as animated after first render (if animation was requested)
        if (animate && !hasAnimated.current) {
          hasAnimated.current = true;
        }
        
        // For proximity pings: show wide pulse (no center marker when far)
        // For NFC or proximity within radius: show regular marker with center star
        if (claimType === 'proximity' && !isWithinClaimRadius) {
          // Wide pulse only - no center marker
          for (let i = 0; i < 3; i++) {
            const ring = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            ring.setAttribute('class', 'pulse-marker-ring proximity-pulse');
            ring.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
            ring.setAttribute('viewBox', '0 0 669.82 669.82');
            ring.setAttribute('width', `${finalPulseSize}px`);
            ring.setAttribute('height', `${finalPulseSize}px`);
            const ringPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            ringPath.setAttribute('fill', 'none');
            ringPath.setAttribute('stroke', color);
            ringPath.setAttribute('stroke-width', '8');
            ringPath.setAttribute('stroke-opacity', '0.4');
            ringPath.setAttribute('fill-rule', 'evenodd');
            ringPath.setAttribute('d', starPath);
            ring.appendChild(ringPath);
            div.appendChild(ring);
          }
        } else {
          // Regular marker with rings + center star (NFC or proximity within radius)
          // Add pulse rings
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
            div.appendChild(ring);
          }

          const star = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          star.setAttribute('class', 'pulse-marker-star');
          star.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
          star.setAttribute('viewBox', '0 0 669.82 669.82');
          const starPathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          
          // Active: gold fill, Inactive: gold stroke with no fill
          // For proximity within radius: filled icon
          if (isActive || (claimType === 'proximity' && isWithinClaimRadius)) {
            starPathEl.setAttribute('fill', color);
            starPathEl.setAttribute('stroke', 'none');
          } else {
            starPathEl.setAttribute('fill', 'none');
            starPathEl.setAttribute('stroke', color);
            starPathEl.setAttribute('stroke-width', '40');
          }
          
          starPathEl.setAttribute('fill-rule', 'evenodd');
          starPathEl.setAttribute('d', starPath);
          star.appendChild(starPathEl);
          div.appendChild(star);
        }

        div.addEventListener('click', (e) => {
          e.stopPropagation();
          onClick();
        });

        this.containerDiv = div;
        const panes = this.getPanes();
        panes?.overlayMouseTarget.appendChild(div);
      }

      draw() {
        if (!this.containerDiv) return;
        const overlayProjection = this.getProjection();
        const pos = overlayProjection.fromLatLngToDivPixel(this.position);
        if (pos) {
          const markerSize = (claimType === 'proximity' && !isWithinClaimRadius) ? finalPulseSize : 80;
          const offset = markerSize / 2;
          this.containerDiv.style.left = (pos.x - offset) + 'px';
          this.containerDiv.style.top = (pos.y - offset) + 'px';
        }
      }

      onRemove() {
        if (this.containerDiv) {
          this.containerDiv.parentNode?.removeChild(this.containerDiv);
          this.containerDiv = null;
        }
      }
    }

    const overlay = new CustomOverlay(new google.maps.LatLng(position.lat, position.lng));
    overlay.setMap(map);
    overlayRef.current = overlay.containerDiv;

    return () => {
      overlay.setMap(null);
    };
  }, [map, position.lat, position.lng, isActive, onClick, claimType, proximityRadius, userDistance, finalPulseSize, isWithinClaimRadius]);

  return null;
};

