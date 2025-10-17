import { useEffect, useRef } from 'react';

interface CustomMarkerProps {
  position: { lat: number; lng: number };
  isActive: boolean;
  onClick: () => void;
  map?: google.maps.Map;
}

export const CustomMarker: React.FC<CustomMarkerProps> = ({ position, isActive, onClick, map }) => {
  const overlayRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!map) return;

    const color = isActive ? 'gold' : '#95a5a6';
    const starPath = "M344.13,6.42l80.5,217.54c3.64,9.83,11.39,17.58,21.22,21.22l217.54,80.5c8.56,3.17,8.56,15.28,0,18.45l-217.54,80.5c-9.83,3.64-17.58,11.39-21.22,21.22l-80.5,217.54c-3.17,8.56-15.28,8.56-18.45,0l-80.5-217.54c-3.64-9.83-11.39-17.58-21.22-21.22L6.42,344.13c-8.56-3.17-8.56-15.28,0-18.45l217.54-80.5c9.83-3.64,17.58-11.39,21.22-21.22L325.68,6.42c3.17-8.56,15.28,8.56,18.45,0Z";

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
        div.className = `pulse-marker ${isActive ? '' : 'inactive'}`;
        div.style.cssText = 'cursor: pointer; width: 80px; height: 80px; position: absolute;';
        
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
          div.appendChild(ring);
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
          this.containerDiv.style.left = (pos.x - 40) + 'px';
          this.containerDiv.style.top = (pos.y - 40) + 'px';
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
  }, [map, position.lat, position.lng, isActive, onClick]);

  return null;
};

