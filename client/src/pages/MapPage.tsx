/// <reference types="vite/client" />
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import Confetti from 'react-confetti';
import { Gift, ClockArrowUp, ClockAlert } from 'lucide-react';
import L from 'leaflet';
import { Hotspot } from '../types';
import { getHotspotStatus, getTimeUntilExpiration } from '../utils/time';
import { GoldenTicket } from '../components/GoldenTicket';
import 'leaflet/dist/leaflet.css';
import './MapPage.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

// Session storage keys
const CLAIM_SESSION_KEY = 'ping_claim_session';

// Store claim session when user successfully claims
const storeClaimSession = (hotspotId: string, privateKey: string) => {
  const session = {
    hotspotId,
    privateKey,
    timestamp: Date.now(),
  };
  localStorage.setItem(CLAIM_SESSION_KEY, JSON.stringify(session));
};

// Check if current user has a claim session for this hotspot
const getClaimSession = (hotspotId: string) => {
  const stored = localStorage.getItem(CLAIM_SESSION_KEY);
  if (!stored) return null;
  
  try {
    const session = JSON.parse(stored);
    if (session.hotspotId === hotspotId) {
      return session;
    }
  } catch (e) {
    console.error('Failed to parse claim session:', e);
  }
  return null;
};


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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showCertificate, setShowCertificate] = useState(false);
  const [certificateExpanded, setCertificateExpanded] = useState(false);
  const [shareTextReady, setShareTextReady] = useState(false);
  const [keyCopied, setKeyCopied] = useState(false);
  const [twitterHandle, setTwitterHandle] = useState<string>('');
  const [claimedAt, setClaimedAt] = useState<string>('');

  // Extract Twitter handle from tweet URL
  const extractTwitterHandle = (tweetUrl: string): string => {
    try {
      const match = tweetUrl.match(/twitter\.com\/([^\/]+)/);
      return match ? `@${match[1]}` : '';
    } catch (e) {
      return '';
    }
  };

  // Copy private key and show inline confirmation
  const handleCopyKey = () => {
    if (privateKey) {
      navigator.clipboard.writeText(privateKey);
      setKeyCopied(true);
      
      // Reset after 2 seconds
      setTimeout(() => {
        setKeyCopied(false);
      }, 2000);
    }
  };

  // Download certificate as PNG
  const downloadCertificate = async () => {
    const canvas = document.getElementById('golden-ticket-canvas') as HTMLCanvasElement;
    if (!canvas) return;

    try {
      const link = document.createElement('a');
      link.download = `ping-certificate-${selectedHotspot?.id}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Error generating certificate:', error);
    }
  };

  // Share on Twitter with certificate
  const shareOnTwitter = async () => {
    // First download the certificate
    await downloadCertificate();
    
    // Open Twitter with pre-filled tweet
    const tweetText = encodeURIComponent('Just claimed my $PING reward! Here is proof!');
    const twitterUrl = `https://twitter.com/intent/tweet?text=${tweetText}&hashtags=PING`;
    
    window.open(twitterUrl, '_blank', 'width=550,height=420');
  };

  // Check URL for NFC routing (e.g., /ping/:id)
  useEffect(() => {
    if (id) {
      fetchHotspotById(id);
    }
  }, [id]);

  useEffect(() => {
    fetchHotspots();
  }, []);

  // Expand certificate after 2 seconds
  useEffect(() => {
    if (showCertificate) {
      setCertificateExpanded(false);
      setShareTextReady(false);
      
      const timer = setTimeout(() => {
        setCertificateExpanded(true);
        setShareTextReady(true);
      }, 2000);
      
      return () => clearTimeout(timer);
    } else {
      setCertificateExpanded(false);
      setShareTextReady(false);
    }
  }, [showCertificate]);


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
      
      // Check if this user has a claim session for this hotspot
      const claimSession = getClaimSession(hotspotId);
      
      if (claimSession && claimSession.privateKey) {
        // Original claimer returning - show success modal
        setClaimStatus('claimed');
        setPrivateKey(claimSession.privateKey);
        setShowConfetti(true);
        setShowCertificate(true);
        setClaimedAt(new Date().toISOString());
        if (hotspot.tweetUrl) {
          setTwitterHandle(extractTwitterHandle(hotspot.tweetUrl));
        }
      } else if (hotspot.claimStatus === 'claimed') {
        // Different user or no session - show error
        setClaimError('This PING has already been claimed by someone else.');
      } else if (hotspot.claimStatus === 'pending') {
        setClaimStatus('pending');
      } else {
        setClaimStatus('unclaimed');
      }
    } catch (err) {
      console.error('Error fetching hotspot:', err);
    }
  };

  // Handle claim button click
  const handleClaim = async () => {
    if (!selectedHotspot) return;

    setClaimError(null);

    // Open Twitter Web Intent
    const tweetText = `Just found a PING! @YourPingAccount #PINGGame`;
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
            
            // Store claim session so user can refresh
            storeClaimSession(selectedHotspot.id, data.privateKey);
            
            // Set certificate data
            setShowCertificate(true);
            setClaimedAt(new Date().toISOString());
            if (data.tweetUrl) {
              setTwitterHandle(extractTwitterHandle(data.tweetUrl));
            }
            
            clearInterval(interval);
            // Stop confetti after 6 seconds
            setTimeout(() => setShowConfetti(false), 6000);
          }
        } catch (err) {
          console.error('Error polling claim status:', err);
        }
      }, 5000); // Poll every 5 seconds

      return () => clearInterval(interval);
    }
  }, [claimStatus, selectedHotspot]);

  return (
    <div className="map-page">
      {/* Vignette Overlay */}
      <div className="vignette-overlay"></div>
      
      {/* Confetti - Full screen on successful claim */}
      {showConfetti && (
        <div className="confetti-wrapper">
          <Confetti
            width={window.innerWidth}
            height={window.innerHeight}
            recycle={false}
            numberOfPieces={200}
          />
        </div>
      )}
      
      {/* Navigation Bar */}
      <nav className="map-nav">
        <div className="nav-left">
          <img src="/logo/ping-logo.svg" alt="PING Logo" className="nav-logo" />
        </div>
        <div className={`nav-center ${mobileMenuOpen ? 'mobile-menu-open' : ''}`}>
          <a href="#about" className="nav-link">About Us</a>
          <a href="https://x.com" target="_blank" rel="noopener noreferrer" className="nav-link">
            <span>𝕏</span>
          </a>
        </div>
        <button 
          className="hamburger-menu"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
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
          <div className="modal-wrapper">
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              {/* Close button */}
              <button className="modal-close" onClick={() => setSelectedHotspot(null)}>
                ✕
              </button>

            <div className="modal-sections">
              {/* Check if hotspot is queued (not active yet) */}
              {selectedHotspot.queuePosition && selectedHotspot.queuePosition > 0 ? (
                <div className="modal-section modal-queued">
                  <h3>This PING is Not Active Yet</h3>
                  <p>This PING is currently in queue. It will become active in the future.</p>
                  <button 
                    className="view-active-btn"
                    onClick={() => window.location.href = '/'}
                  >
                    View Active PING
                  </button>
                </div>
              ) : (
                <>
                  {/* Show all sections except when claimed */}
                  {claimStatus !== 'claimed' && (
                    <>
                      {/* Image section (if available) - First */}
                      {selectedHotspot.imageUrl && (
                        <div className="modal-section modal-image">
                          <img src={selectedHotspot.imageUrl} alt={selectedHotspot.title} />
                        </div>
                      )}

                      {/* Title + Time Info combined section - Second */}
                      <div className="modal-section modal-header">
                        <h2>{selectedHotspot.title}</h2>
                        <div className="header-time-info">
                          <div className="time-item">
                            <ClockArrowUp className="time-icon" />
                            <span className="time-value">
                              {getHotspotStatus(selectedHotspot.startDate, selectedHotspot.endDate)}
                            </span>
                          </div>
                          {(() => {
                            const endDate = new Date(selectedHotspot.endDate);
                            const now = new Date();
                            const yearsDiff = (endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 365);
                            const hasExpiration = yearsDiff < 50;
                            
                            return hasExpiration && (
                              <div className="time-item">
                                <ClockAlert className="time-icon" />
                                <span className="time-value">
                                  {getTimeUntilExpiration(selectedHotspot.endDate)}
                                </span>
                              </div>
                            );
                          })()}
                        </div>
                      </div>

                      {/* Prize - Shimmer Sweep with custom gradient - Third */}
                      {selectedHotspot.prize && (
                        <div className="modal-section modal-prize">
                          <div className="prize-badge">
                            <Gift className="prize-icon" />
                            <span className="prize-text">{selectedHotspot.prize} SOL</span>
                          </div>
                          <button className="hint-cta">
                            GET ANOTHER HINT
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}

              {/* Action section - Different states */}
              {/* Only show claim button for NFC URLs (when accessed via /ping/:id) and not queued */}
              {claimStatus === 'unclaimed' && id && (!selectedHotspot.queuePosition || selectedHotspot.queuePosition === 0) && (
                <div className="modal-section modal-actions">
                  {claimError && (
                    <p className="claim-error">{claimError}</p>
                  )}
                  <button 
                    className={claimError ? "view-active-btn" : "claim-btn"} 
                    onClick={claimError ? () => window.location.href = '/' : handleClaim}
                  >
                    {claimError ? 'View Active PING' : 'Claim Prize'}
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
                  <h3 className="congrats-title">Congratulations!</h3>
                  <p className="congrats-text">
                    You've successfully claimed this PING! Add this privat key to your Solana wallet to access your prize.
                  </p>
                  
                  <div className="private-key-box">
                    <label>Solana Private Key:</label>
                    <code 
                      className="clickable-key"
                      onClick={handleCopyKey}
                    >
                      {keyCopied ? 'Private key copied to clipboard!' : privateKey}
                    </code>
                  </div>
                </div>
              )}
            </div>
            </div>
            
            {/* Certificate */}
            {claimStatus === 'claimed' && privateKey && showCertificate && selectedHotspot && (
              <div 
                className={`certificate-container ${certificateExpanded ? 'expanded' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  shareOnTwitter();
                }}
              >
                <GoldenTicket
                  claimedAt={claimedAt}
                  location={selectedHotspot.title}
                  twitterHandle={twitterHandle}
                />
              </div>
            )}
            
            {/* Share Link */}
            {claimStatus === 'claimed' && privateKey && showCertificate && (
              <div 
                className={`share-text ${shareTextReady ? 'clickable' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (shareTextReady) {
                    shareOnTwitter();
                  }
                }}
              >
                {!shareTextReady ? (
                  <>
                    printing proof of claim
                    <span className="printing-dots-inline">
                      <span>.</span>
                      <span>.</span>
                      <span>.</span>
                    </span>
                  </>
                ) : (
                  'Share proof on X'
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default MapPage;

