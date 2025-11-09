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
  isFocused?: boolean; // Whether this ping is focused (centered or being edited) - shows pulse animation
  pulseMode?: 'none' | 'focus' | 'always';
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
  isFocused = false,
  pulseMode = 'focus',
}) => {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const hasAnimated = useRef(false); // Track if animation has played

  useEffect(() => {
    if (!map) return;

    const color = 'gold';
    const starPath = "M344.13,6.42l80.5,217.54c3.64,9.83,11.39,17.58,21.22,21.22l217.54,80.5c8.56,3.17,8.56,15.28,0,18.45l-217.54,80.5c-9.83,3.64-17.58,11.39-21.22,21.22l-80.5,217.54c-3.17,8.56-15.28,8.56-18.45,0l-80.5-217.54c-3.64-9.83-11.39-17.58-21.22-21.22L6.42,344.13c-8.56-3.17-8.56-15.28,0-18.45l217.54-80.5c9.83-3.64,17.58-11.39,21.22-21.22L325.68,6.42c3.17-8.56,15.28,8.56,18.45,0Z";
    const isMapInstance = pulseMode === 'always';

    class CustomOverlay extends google.maps.OverlayView {
      position: google.maps.LatLng;
      containerDiv: HTMLDivElement | null = null;

      constructor(position: google.maps.LatLng) {
        super();
        this.position = position;
      }

      private createPulseRing(extraClass: string) {
        const ring = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        ring.setAttribute('class', `pulse-marker-ring ${extraClass}`);
        ring.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        ring.setAttribute('width', '80px');
        ring.setAttribute('height', '80px');

        if (claimType === 'proximity' || isMapInstance) {
          ring.setAttribute('viewBox', '0 0 669.82 669.82');
          const ringPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          ringPath.setAttribute('fill', 'none');
          ringPath.setAttribute('stroke', color);
          ringPath.setAttribute('stroke-width', isMapInstance ? '8' : '6');
          ringPath.setAttribute('stroke-opacity', '0.5');
          ringPath.setAttribute('fill-rule', 'evenodd');
          ringPath.setAttribute('d', starPath);
          ring.appendChild(ringPath);
        } else {
          ring.setAttribute('viewBox', '0 0 669.82 669.82');
          const ringPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          ringPath.setAttribute('fill', 'none');
          ringPath.setAttribute('stroke', color);
          ringPath.setAttribute('stroke-width', '6');
          ringPath.setAttribute('stroke-opacity', '0.4');
          ringPath.setAttribute('fill-rule', 'evenodd');
          ringPath.setAttribute('d', starPath);
          ring.appendChild(ringPath);
        }

        return ring;
      }

      onAdd() {
        const div = document.createElement('div');
        const animationClass = (animate && !hasAnimated.current) ? 'marker-slide-up' : '';
        const proximityClass = claimType === 'proximity' ? 'proximity-marker' : '';
        div.className = `pulse-marker ${isActive ? '' : 'inactive'} ${animationClass} ${proximityClass}`.trim();

        div.style.cssText = `cursor: pointer; width: 80px; height: 80px; position: absolute; overflow: visible;`;

        if (animate && !hasAnimated.current) {
          hasAnimated.current = true;
        }

        const shouldPulse = pulseMode === 'always' || (pulseMode === 'focus' && isFocused);
        if (shouldPulse) {
          div.appendChild(this.createPulseRing('ring-1'));
          div.appendChild(this.createPulseRing('ring-2'));
          div.appendChild(this.createPulseRing('ring-3'));
        }

        const star = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        star.setAttribute('class', 'pulse-marker-star');
        star.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        star.setAttribute('viewBox', '0 0 669.82 669.82');
        const starPathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');

        if (claimType === 'proximity') {
          starPathEl.setAttribute('fill', 'none');
          starPathEl.setAttribute('fill-opacity', '0');
          starPathEl.setAttribute('stroke', color);
          starPathEl.setAttribute('stroke-width', '40');
          starPathEl.setAttribute('stroke-opacity', '1');
        } else {
          starPathEl.setAttribute('fill', color);
          starPathEl.setAttribute('fill-opacity', '1');
          starPathEl.setAttribute('stroke', 'none');
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
        this.getPanes()?.overlayMouseTarget.appendChild(div);
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
  }, [map, position.lat, position.lng, isActive, onClick, claimType, proximityRadius, userDistance, isFocused, animate, pulseMode]);

  return null;
};

