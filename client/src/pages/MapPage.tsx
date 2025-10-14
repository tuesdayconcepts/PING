/// <reference types="vite/client" />
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import Confetti from 'react-confetti';
import L from 'leaflet';
import { Hotspot } from '../types';
import { getHotspotStatus } from '../utils/time';
import 'leaflet/dist/leaflet.css';
import './MapPage.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

// Create pulsing marker icon with custom star SVG
const createPulseIcon = (isActive: boolean = true) => {
  const color = isActive ? 'gold' : '#95a5a6';
  const starPath = "M344.13,6.42l80.5,217.54c3.64,9.83,11.39,17.58,21.22,21.22l217.54,80.5c8.56,3.17,8.56,15.28,0,18.45l-217.54,80.5c-9.83,3.64-17.58,11.39-21.22,21.22l-80.5,217.54c-3.17,8.56-15.28,8.56-18.45,0l-80.5-217.54c-3.64-9.83-11.39-17.58-21.22-21.22L6.42,344.13c-8.56-3.17-8.56-15.28,0-18.45l217.54-80.5c9.83-3.64,17.58-11.39,21.22-21.22L325.68,6.42c3.17-8.56,15.28-8.56,18.45,0Z";
  
  return L.divIcon({
    className: 'custom-pulse-icon',
    html: `
      <div class="pulse-marker ${isActive ? '' : 'inactive'}">
        <svg class="pulse-marker-ring" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 669.82 669.82">
          <path fill="none" stroke="${color}" stroke-width="8" stroke-opacity="0.6" fill-rule="evenodd" d="${starPath}"/>
        </svg>
        <svg class="pulse-marker-ring" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 669.82 669.82">
          <path fill="none" stroke="${color}" stroke-width="8" stroke-opacity="0.6" fill-rule="evenodd" d="${starPath}"/>
        </svg>
        <svg class="pulse-marker-ring" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 669.82 669.82">
          <path fill="none" stroke="${color}" stroke-width="8" stroke-opacity="0.6" fill-rule="evenodd" d="${starPath}"/>
        </svg>
        <svg class="pulse-marker-star" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 669.82 669.82">
          <path fill="${color}" fill-rule="evenodd" d="${starPath}"/>
        </svg>
      </div>
    `,
    iconSize: [80, 80],
    iconAnchor: [40, 40],
    popupAnchor: [0, -40],
  });
};

function MapPage() {
  const { id } = useParams<{ id: string }>(); // Get hotspot ID from URL params
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [center, setCenter] = useState<[number, number]>([40.7128, -74.0060]); // Default: NYC
  const [zoom, setZoom] = useState(13);
  const [selectedHotspot, setSelectedHotspot] = useState<Hotspot | null>(null);
  const [claimStatus, setClaimStatus] = useState<'unclaimed' | 'pending' | 'claimed'>('unclaimed');
  const [privateKey, setPrivateKey] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);

  // Check URL for NFC routing (e.g., /ping/:id)
  useEffect(() => {
    if (id) {
      fetchHotspotById(id);
    }
  }, [id]);

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

  // Fetch specific hotspot by ID (for NFC routing)
  const fetchHotspotById = async (hotspotId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/hotspots/${hotspotId}`);
      if (!response.ok) {
        console.error('Hotspot not found');
        return;
      }
      const hotspot = await response.json();
      setSelectedHotspot(hotspot);
      setCenter([hotspot.lat, hotspot.lng]);
      setZoom(16);
    } catch (err) {
      console.error('Error fetching hotspot:', err);
    }
  };

  // Handle claim button click
  const handleClaim = async () => {
    if (!selectedHotspot) return;

    setClaimError(null);

    // Open Twitter Web Intent
    const tweetText = `Just found a PING! 🎉 @YourPingAccount #PINGGame`;
    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
    window.open(tweetUrl, '_blank');

    // Submit claim to backend
    try {
      const response = await fetch(`${API_URL}/api/hotspots/${selectedHotspot.id}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tweetUrl: 'user-tweeted' }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        setClaimError(errorData.error || 'Failed to submit claim');
        return;
      }

      // Show "Waiting for approval" state
      setClaimStatus('pending');
    } catch (err) {
      setClaimError('Failed to submit claim. Please try again.');
    }
  };

  // Poll for approval status
  useEffect(() => {
    if (claimStatus === 'pending' && selectedHotspot) {
      const interval = setInterval(async () => {
        try {
          const response = await fetch(`${API_URL}/api/hotspots/${selectedHotspot.id}`);
          const data = await response.json();
          if (data.claimStatus === 'claimed') {
            setClaimStatus('claimed');
            setPrivateKey(data.privateKey);
            setShowConfetti(true);
            clearInterval(interval);
            // Stop confetti after 5 seconds
            setTimeout(() => setShowConfetti(false), 5000);
          }
        } catch (err) {
          console.error('Error polling claim status:', err);
        }
      }, 5000); // Poll every 5 seconds

      return () => clearInterval(interval);
    }
  }, [claimStatus, selectedHotspot]);

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
      {/* Vignette Overlay */}
      <div className="vignette-overlay"></div>
      
      {/* Navigation Bar */}
      <nav className="map-nav">
        <div className="nav-left">
          <img src="/logo/ping-logo.svg" alt="PING Logo" className="nav-logo" />
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
                eventHandlers={{
                  click: () => setSelectedHotspot(hotspot)
                }}
              />
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

      {/* Hotspot Modal Popup */}
      {selectedHotspot && (
        <div className="modal-overlay" onClick={() => setSelectedHotspot(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            {/* Close button */}
            <button className="modal-close" onClick={() => setSelectedHotspot(null)}>
              ✕
            </button>

            {/* Title section */}
            <div className="modal-section modal-title">
              <h2>{selectedHotspot.title}</h2>
            </div>

            {/* Prize section */}
            {selectedHotspot.prize && (
              <div className="modal-section modal-prize">
                <div className="prize-badge" style={{ 
                  backgroundColor: getStatusColor(selectedHotspot.startDate, selectedHotspot.endDate) 
                }}>
                  <span className="prize-icon">🎁</span>
                  <span className="prize-text">{selectedHotspot.prize}</span>
                </div>
              </div>
            )}

            {/* Status section */}
            <div className="modal-section modal-status">
              <div className="status-info">
                <span className="status-icon">⏱️</span>
                <span className="status-text">
                  {getHotspotStatus(selectedHotspot.startDate, selectedHotspot.endDate)}
                </span>
              </div>
            </div>

            {/* Description section */}
            <div className="modal-section modal-description">
              <h3>Details</h3>
              <p>{selectedHotspot.description}</p>
            </div>

            {/* Image section (if available) */}
            {selectedHotspot.imageUrl && (
              <div className="modal-section modal-image">
                <img src={selectedHotspot.imageUrl} alt={selectedHotspot.title} />
              </div>
            )}

            {/* Action section - Different states */}
            {claimStatus === 'unclaimed' && (
              <div className="modal-section modal-actions">
                {claimError && (
                  <p className="claim-error">{claimError}</p>
                )}
                <button className="claim-btn" onClick={handleClaim}>
                  Claim Prize
                </button>
              </div>
            )}

            {claimStatus === 'pending' && (
              <div className="modal-section modal-pending">
                <div className="pending-animation">⏳</div>
                <h3>Waiting for Approval</h3>
                <p>Your claim is being reviewed by the admin. This usually takes a few minutes.</p>
                <p className="pending-note">Stay on this page to see when it's approved!</p>
              </div>
            )}

            {claimStatus === 'claimed' && privateKey && (
              <div className="modal-section modal-reveal">
                {showConfetti && (
                  <Confetti
                    width={window.innerWidth}
                    height={window.innerHeight}
                    recycle={false}
                    numberOfPieces={200}
                  />
                )}
                <h3 className="congrats-title">🎉 Congratulations! 🎉</h3>
                <p className="congrats-text">You've successfully claimed this PING!</p>
                <div className="private-key-box">
                  <label>Solana Private Key:</label>
                  <code>{privateKey}</code>
                  <button 
                    className="copy-btn"
                    onClick={() => {
                      navigator.clipboard.writeText(privateKey);
                      alert('Private key copied to clipboard!');
                    }}
                  >
                    📋 Copy to Clipboard
                  </button>
                </div>
                <p className="warning-text">
                  ⚠️ Save this private key securely! You won't be able to see it again.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default MapPage;

