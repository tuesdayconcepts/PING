import { OverlayView } from '@react-google-maps/api';

interface CustomMarkerProps {
  position: { lat: number; lng: number };
  isActive: boolean;
  onClick: () => void;
}

export const CustomMarker: React.FC<CustomMarkerProps> = ({ position, isActive, onClick }) => {
  const color = isActive ? 'gold' : '#95a5a6';
  const starPath = "M344.13,6.42l80.5,217.54c3.64,9.83,11.39,17.58,21.22,21.22l217.54,80.5c8.56,3.17,8.56,15.28,0,18.45l-217.54,80.5c-9.83,3.64-17.58,11.39-21.22,21.22l-80.5,217.54c-3.17,8.56-15.28,8.56-18.45,0l-80.5-217.54c-3.64-9.83-11.39-17.58-21.22-21.22L6.42,344.13c-8.56-3.17-8.56-15.28,0-18.45l217.54-80.5c9.83-3.64,17.58-11.39,21.22-21.22L325.68,6.42c3.17-8.56,15.28,8.56,18.45,0Z";

  return (
    <OverlayView
      position={position}
      mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
    >
      <div 
        className={`pulse-marker ${isActive ? '' : 'inactive'}`}
        onClick={onClick}
        style={{ cursor: 'pointer' }}
      >
        <svg className="pulse-marker-ring" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 669.82 669.82">
          <path fill="none" stroke={color} strokeWidth="8" strokeOpacity="0.6" fillRule="evenodd" d={starPath}/>
        </svg>
        <svg className="pulse-marker-ring" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 669.82 669.82">
          <path fill="none" stroke={color} strokeWidth="8" strokeOpacity="0.6" fillRule="evenodd" d={starPath}/>
        </svg>
        <svg className="pulse-marker-ring" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 669.82 669.82">
          <path fill="none" stroke={color} strokeWidth="8" strokeOpacity="0.6" fillRule="evenodd" d={starPath}/>
        </svg>
        <svg className="pulse-marker-star" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 669.82 669.82">
          <path fill={color} fillRule="evenodd" d={starPath}/>
        </svg>
      </div>
    </OverlayView>
  );
};

