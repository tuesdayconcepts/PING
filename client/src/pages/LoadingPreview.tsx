import { useEffect, useRef } from 'react';
import './LoadingPreview.css';

declare global {
  interface Window {
    bodymovin?: any;
  }
}

const BODYMOVIN_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/bodymovin/4.12.1/bodymovin.min.js';
const ANIMATION_JSON = 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/35984/world.json';

const LoadingPreview: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let animationInstance: any;

    const ensureBodymovin = () => {
      if (window.bodymovin) {
        return Promise.resolve(window.bodymovin);
      }
      return new Promise<any>((resolve, reject) => {
        const existing = document.getElementById('bodymovin-cdn') as HTMLScriptElement | null;
        if (existing) {
          existing.addEventListener('load', () => resolve(window.bodymovin));
          existing.addEventListener('error', reject);
          return;
        }
        const script = document.createElement('script');
        script.id = 'bodymovin-cdn';
        script.src = BODYMOVIN_CDN;
        script.async = true;
        script.onload = () => resolve(window.bodymovin);
        script.onerror = reject;
        document.head.appendChild(script);
      });
    };

    const initAnimation = async () => {
      try {
        const bodymovin = await ensureBodymovin();
        if (cancelled || !bodymovin || !containerRef.current) {
          return;
        }
        animationInstance = bodymovin.loadAnimation({
          wrapper: containerRef.current,
          animType: 'svg',
          loop: true,
          prerender: true,
          autoplay: true,
          path: ANIMATION_JSON,
        });
        animationInstance.setSpeed(1.4);
      } catch (error) {
        console.error('Failed to load bodymovin animation', error);
      }
    };

    initAnimation();

    return () => {
      cancelled = true;
      if (animationInstance) {
        animationInstance.destroy();
      }
    };
  }, []);

  return (
    <div className="loading-preview-page">
      <div className="loading-preview-overlay" />
      <div className="loading-preview-container" ref={containerRef} />
    </div>
  );
};

export default LoadingPreview;
