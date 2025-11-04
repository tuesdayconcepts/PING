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
    
    // Marker visuals:
    // NFC pings: solid gold star when active, transparent with stroke when inactive
    // Proximity pings: always transparent with solid stroke (larger pulse via CSS)

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
        div.className = `pulse-marker ${isActive ? '' : 'inactive'} ${animationClass} ${proximityClass}`;
        
        // Marker container size: 80px for all, pulse rings will be larger for proximity
        div.style.cssText = `cursor: pointer; width: 80px; height: 80px; position: absolute;`;
        
        // Mark as animated after first render (if animation was requested)
        if (animate && !hasAnimated.current) {
          hasAnimated.current = true;
        }
        
        // All markers show pulse rings + center star
        // Proximity pings: larger pulse radius (via CSS scale), transparent center star with stroke
        // NFC pings: regular pulse radius, solid center star when active
        // Add pulse rings (same animation style, proximity gets larger scale via CSS)
        for (let i = 0; i < 3; i++) {
          const ring = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          ring.setAttribute('class', claimType === 'proximity' ? 'pulse-marker-ring proximity-pulse' : 'pulse-marker-ring');
          ring.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
          ring.setAttribute('viewBox', '0 0 669.82 669.82');
          ring.setAttribute('width', '80px');
          ring.setAttribute('height', '80px');
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
          
          // Visual distinction:
          // NFC pings: solid gold fill when active, transparent with stroke when inactive
          // Proximity pings: always transparent with solid stroke (regardless of active/inactive)
          if (claimType === 'proximity') {
            // Proximity: always transparent with stroke
            starPathEl.setAttribute('fill', 'none');
            starPathEl.setAttribute('stroke', color);
            starPathEl.setAttribute('stroke-width', '40');
          } else {
            // NFC: solid fill when active, transparent with stroke when inactive
            if (isActive) {
              starPathEl.setAttribute('fill', color);
              starPathEl.setAttribute('stroke', 'none');
            } else {
              starPathEl.setAttribute('fill', 'none');
              starPathEl.setAttribute('stroke', color);
              starPathEl.setAttribute('stroke-width', '40');
            }
          }
          
          starPathEl.setAttribute('fill-rule', 'evenodd');
          starPathEl.setAttribute('d', starPath);
          star.appendChild(starPathEl);
          div.appendChild(star);

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
          const offset = 40; // Always 40px (half of 80px marker size)
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
  }, [map, position.lat, position.lng, isActive, onClick, claimType, proximityRadius, userDistance]);

  return null;
};

