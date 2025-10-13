/// <reference types="vite/client" />
import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { Hotspot } from '../types';
import { getHotspotStatus } from '../utils/time';
import { truncateText } from '../utils/sanitize';
import 'leaflet/dist/leaflet.css';
import './MapPage.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

// Create pulsing marker icon
const createPulseIcon = (isActive: boolean = true) => {
  return L.divIcon({
    className: 'custom-pulse-icon',
    html: `
      <div class="pulse-marker ${isActive ? '' : 'inactive'}">
        <div class="pulse-marker-ring"></div>
        <div class="pulse-marker-ring"></div>
        <div class="pulse-marker-ring"></div>
        <div class="pulse-marker-center"></div>
      </div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -15],
  });
};

function MapPage() {
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [center, setCenter] = useState<[number, number]>([40.7128, -74.0060]); // Default: NYC
  const [zoom, setZoom] = useState(13);

  useEffect(() => {
    fetchHotspots();
  }, []);

  const fetchHotspots = async () => {
    try {
      const response = await fetch(`${API_URL}/api/hotspots`);
      if (!response.ok) {
        throw new Error('Failed to fetch hotspots');
      }
      const data = await response.json();
      setHotspots(data);

      // If hotspots exist, center on the first active one
      if (data.length > 0) {
        const activeHotspot = data.find((h: Hotspot) => h.active);
        if (activeHotspot) {
          setCenter([activeHotspot.lat, activeHotspot.lng]);
          setZoom(14);
        }
      } else {
        // Try to get user's geolocation
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              setCenter([position.coords.latitude, position.coords.longitude]);
              setZoom(13);
            },
            (err) => {
              console.log('Geolocation not available:', err.message);
              // Keep default NYC location
            }
          );
        }
      }

      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setLoading(false);
    }
  };

  const getStatusColor = (startDate: string, endDate: string): string => {
    const now = new Date();
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Expired
    if (now > end) {
      return '#999'; // Gray
    }
    // Not started yet
    if (now < start) {
      return '#f39c12'; // Orange
    }
    // Active
    return '#27ae60'; // Green
  };

  return (
    <div className="map-page">
      {/* Navigation Bar */}
      <nav className="map-nav">
        <div className="nav-left">
          <img src="/logo/logo.svg" alt="Logo" className="nav-logo" />
        </div>
        <div className="nav-center">
          <a href="#about" className="nav-link">About Us</a>
          <a href="https://x.com" target="_blank" rel="noopener noreferrer" className="nav-link">
            <span>𝕏</span>
          </a>
        </div>
        <div className="nav-right">
          <span className="active-pings">
            {hotspots.length} Active {hotspots.length !== 1 ? 'Pings' : 'Ping'}
          </span>
        </div>
      </nav>

      {/* Loading/Error States */}
      {loading && (
        <div className="map-overlay">
          <p>Loading map...</p>
        </div>
      )}

      {error && (
        <div className="map-overlay error">
          <p>Error: {error}</p>
          <button onClick={fetchHotspots}>Retry</button>
        </div>
      )}

      {/* Map */}
      {!loading && (
        <MapContainer 
          center={center} 
          zoom={zoom} 
          className="map-container"
          scrollWheelZoom={true}
        >
          {/* ESRI Dark Gray Canvas Basemap */}
          <TileLayer
            attribution='Tiles &copy; Esri'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
            maxZoom={16}
          />
          <TileLayer
            attribution='&copy; Esri'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}"
            maxZoom={16}
          />

          {/* Render markers for each hotspot */}
          {hotspots.map((hotspot) => {
            // Check if hotspot is active/expired
            const now = new Date();
            const endDate = new Date(hotspot.endDate);
            const isActive = now <= endDate && hotspot.active;
            
            return (
              <Marker 
                key={hotspot.id} 
                position={[hotspot.lat, hotspot.lng]}
                icon={createPulseIcon(isActive)}
              >
                <Popup className="hotspot-popup" maxWidth={300}>
                <div className="popup-content">
                  <h3>{hotspot.title}</h3>
                  
                  {hotspot.prize && (
                    <div className="prize-badge" style={{ 
                      backgroundColor: getStatusColor(hotspot.startDate, hotspot.endDate) 
                    }}>
                      🎁 {hotspot.prize}
                    </div>
                  )}

                  <div className="status-line">
                    ⏱️ {getHotspotStatus(hotspot.startDate, hotspot.endDate)}
                  </div>

                  <p className="description">
                    {truncateText(hotspot.description, 100)}
                  </p>

                  <div className="popup-actions">
                    <button 
                      onClick={() => {
                        alert(`Full description:\n\n${hotspot.description}`);
                      }}
                      className="details-btn"
                    >
                      View Details
                    </button>
                  </div>
                </div>
              </Popup>
            </Marker>
            );
          })}
        </MapContainer>
      )}

      {/* Empty state */}
      {!loading && hotspots.length === 0 && (
        <div className="empty-state">
          <p>No active scavenger hunts at the moment.</p>
          <p>Check back later!</p>
        </div>
      )}
    </div>
  );
}

export default MapPage;

