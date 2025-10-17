/// <reference types="vite/client" />
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { GoogleMap, useJsApiLoader, DirectionsRenderer } from '@react-google-maps/api';
import Confetti from 'react-confetti';
import { Gift, ClockPlus, ClockFading, Navigation, MapPin } from 'lucide-react';
import { Hotspot } from '../types';
import { getHotspotStatus, getTimeUntilExpiration, calculateETA } from '../utils/time';
import { getLocationName } from '../utils/geocoding';
import { GoldenTicket } from '../components/GoldenTicket';
import { customMapStyles } from '../utils/mapStyles';
import { CustomMarker } from '../components/CustomMarker';
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


function MapPage() {
  const { id } = useParams<{ id: string }>(); // Get hotspot ID from URL params
  
  // Load Google Maps API
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
  });
  
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [center, setCenter] = useState<{ lat: number; lng: number }>({ lat: 40.7128, lng: -74.0060 }); // Default: NYC
  const [zoom, setZoom] = useState(13);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedHotspot, setSelectedHotspot] = useState<Hotspot | null>(null);
  const [directionsResponse, setDirectionsResponse] = useState<google.maps.DirectionsResult | null>(null);
  const [showRoute, setShowRoute] = useState(false);
  const [pendingDestination, setPendingDestination] = useState<{ lat: number; lng: number } | null>(null);
  const [isModalClosing, setIsModalClosing] = useState(false);
  const [claimStatus, setClaimStatus] = useState<'unclaimed' | 'pending' | 'claimed'>('unclaimed');
  const [showCheckmark, setShowCheckmark] = useState(false); // Controls checkmark animation
  const [privateKey, setPrivateKey] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showDiscoveryConfetti, setShowDiscoveryConfetti] = useState(false); // Discovery confetti
  const [claimError, setClaimError] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showCertificate, setShowCertificate] = useState(false);
  const [certificateExpanded, setCertificateExpanded] = useState(false);
  const [shareTextReady, setShareTextReady] = useState(false);
  const [keyCopied, setKeyCopied] = useState(false);
  const [twitterHandle, setTwitterHandle] = useState<string>('');
  const [claimedAt, setClaimedAt] = useState<string>('');
  const [locationName, setLocationName] = useState<string>('');

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

  // Fetch and display route on map
  const fetchAndDisplayRoute = async (destinationLat: number, destinationLng: number) => {
    if (!userLocation) {
      requestUserLocation();
      return;
    }

    const directionsService = new google.maps.DirectionsService();
    
    try {
      const results = await directionsService.route({
        origin: new google.maps.LatLng(userLocation.lat, userLocation.lng),
        destination: new google.maps.LatLng(destinationLat, destinationLng),
        travelMode: google.maps.TravelMode.WALKING,
      });

      setDirectionsResponse(results);
      setShowRoute(true);
      
      // Smooth close modal after directions load
      setIsModalClosing(true);
      setTimeout(() => {
        setSelectedHotspot(null);
        setIsModalClosing(false);
      }, 300); // Match animation duration
    } catch (error) {
      console.error('Error fetching directions:', error);
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


  // Automatically fetch route when location is granted and destination is pending
  useEffect(() => {
    if (userLocation && pendingDestination) {
      fetchAndDisplayRoute(pendingDestination.lat, pendingDestination.lng);
      setPendingDestination(null); // Clear pending destination
    }
  }, [userLocation, pendingDestination]);

  // Request user location for ETA calculation
  const requestUserLocation = (destinationLat?: number, destinationLng?: number) => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userLat = position.coords.latitude;
          const userLng = position.coords.longitude;
          setUserLocation({ lat: userLat, lng: userLng });
          console.log('User location acquired:', userLat, userLng);
          
          // If destination was provided, store it to trigger route fetch
          if (destinationLat !== undefined && destinationLng !== undefined) {
            setPendingDestination({ lat: destinationLat, lng: destinationLng });
          }
        },
        (err) => {
          console.log('Geolocation permission denied or unavailable:', err.message);
        }
      );
    }
  };

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
          setCenter({ lat: activeHotspot.lat, lng: activeHotspot.lng });
          setZoom(14);
        }
      } else {
        // Try to get user's geolocation for map centering
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const userLat = position.coords.latitude;
              const userLng = position.coords.longitude;
              setCenter({ lat: userLat, lng: userLng });
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
      setCenter({ lat: hotspot.lat, lng: hotspot.lng });
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
        // Trigger discovery celebration
        setShowDiscoveryConfetti(true);
        playSuccessSound();
        setTimeout(() => setShowDiscoveryConfetti(false), 4000);
      }
    } catch (err) {
      console.error('Error fetching hotspot:', err);
    }
  };

  // Play retro success sound using Web Audio API
  const playSuccessSound = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Classic 8-bit success: E -> G# -> E (high)
      oscillator.type = 'square'; // Retro square wave
      
      const now = audioContext.currentTime;
      
      // Note frequencies
      const E4 = 329.63;
      const Gs4 = 415.30;
      const E5 = 659.25;
      
      // Play sequence
      oscillator.frequency.setValueAtTime(E4, now);
      oscillator.frequency.setValueAtTime(Gs4, now + 0.1);
      oscillator.frequency.setValueAtTime(E5, now + 0.2);
      
      // Volume envelope
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.15, now + 0.01); // Quick attack
      gainNode.gain.setValueAtTime(0.15, now + 0.3);
      gainNode.gain.linearRampToValueAtTime(0, now + 0.5); // Fade out
      
      oscillator.start(now);
      oscillator.stop(now + 0.5);
    } catch (err) {
      console.log('Audio not supported:', err);
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

  // Fetch location name when selectedHotspot changes
  useEffect(() => {
    if (selectedHotspot) {
      getLocationName(selectedHotspot.lat, selectedHotspot.lng).then(name => {
        setLocationName(name);
      });
    }
  }, [selectedHotspot]);

  // Poll for approval status
  useEffect(() => {
    if (claimStatus === 'pending' && selectedHotspot) {
      const interval = setInterval(async () => {
        try {
          const response = await fetch(`${API_URL}/api/hotspots/${selectedHotspot.id}`);
          const data = await response.json();
          if (data.claimStatus === 'claimed') {
            // First, trigger the checkmark animation
            setShowCheckmark(true);
            
            // Then after animation completes (2.5 seconds: 0.75s checkmark + 1.75s display time), update to claimed state
            setTimeout(() => {
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
              
              // Stop confetti after 6 seconds
              setTimeout(() => setShowConfetti(false), 6000);
            }, 2500);
            
            clearInterval(interval);
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
      
      {/* Confetti - Full screen on successful claim or discovery */}
      {(showConfetti || showDiscoveryConfetti) && (
        <div className="confetti-wrapper">
          <Confetti
            width={window.innerWidth}
            height={window.innerHeight}
            numberOfPieces={showDiscoveryConfetti ? 150 : 200}
            colors={showDiscoveryConfetti ? ['#FFD700', '#FFC700', '#FFE87C', '#FFAA00', '#FF8C00'] : undefined}
            recycle={false}
            gravity={0.3}
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
          className={`hamburger-menu ${mobileMenuOpen ? 'open' : ''}`}
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
        >
          <span className="line-menu half start"></span>
          <span className="line-menu"></span>
          <span className="line-menu half end"></span>
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
      {!loading && isLoaded && (
        <GoogleMap
          center={center}
          zoom={zoom}
          mapContainerClassName="map-container"
          options={{
            styles: customMapStyles,
            mapTypeControl: false,
            streetViewControl: false,
            clickableIcons: false, // Disable clicking on POI icons
            gestureHandling: 'greedy', // Allow single-finger pan on mobile
            // Hide Google branding and legal text
            disableDefaultUI: true, // Hide all default UI elements
            zoomControl: true, // Re-enable only zoom control
            fullscreenControl: false, // Disable fullscreen control
          }}
          onClick={(e) => {
            // Prevent default Google Maps click behavior (location info dialog)
            e.stop();
          }}
        >
          {/* Render custom markers for each hotspot */}
          {hotspots.map((hotspot) => {
            // Check if hotspot is active/expired
            const now = new Date();
            const endDate = new Date(hotspot.endDate);
            const isActive = now <= endDate && hotspot.active;
            
            return (
              <CustomMarker
                key={hotspot.id}
                position={{ lat: hotspot.lat, lng: hotspot.lng }}
                isActive={isActive}
                onClick={() => setSelectedHotspot(hotspot)}
              />
            );
          })}

          {/* Render directions on map when route is shown */}
          {showRoute && directionsResponse && (
            <DirectionsRenderer
              directions={directionsResponse}
              options={{
                suppressMarkers: true, // Hide default Google Maps markers
                polylineOptions: {
                  strokeColor: '#FFD700',
                  strokeWeight: 5,
                  strokeOpacity: 0.8,
                },
              }}
            />
          )}
        </GoogleMap>
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
        <div className={`modal-overlay ${isModalClosing ? 'closing' : ''}`} onClick={() => setSelectedHotspot(null)}>
          <div className="modal-wrapper">
            <div className={`modal-content ${isModalClosing ? 'closing' : ''}`} onClick={(e) => e.stopPropagation()}>
              {/* Close button */}
              <button className="modal-close" onClick={() => setSelectedHotspot(null)}>
                ✕
              </button>

            <div className="modal-sections">
              {/* Check if hotspot is queued (not active yet) */}
              {selectedHotspot.queuePosition && selectedHotspot.queuePosition > 0 ? (
                <div className="modal-section modal-queued">
                  <h3>INACTIVE PING</h3>
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
                  {/* Show congratulations for claim flow (unique URLs), otherwise show all sections */}
                  {claimStatus === 'unclaimed' && id && (!selectedHotspot.queuePosition || selectedHotspot.queuePosition === 0) ? (
                    <div className="modal-section modal-claim-intro">
                      <h3>GREAT JOB!</h3>
                      <p>You found the PING! That means you are almost <span className="prize-amount">{selectedHotspot.prize} SOL</span> richer!</p>
                      <p>To finish claiming it, press the big yellow button to notify our team on X, and return to this screen.</p>
                    </div>
                  ) : (
                    <>
                      {/* Show all sections except when claimed or pending (for claim flow) */}
                      {claimStatus !== 'claimed' && !(claimStatus === 'pending' && id) && (
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
                            {locationName && (
                              <div className="location-info">
                                <MapPin size={14} />
                                <span>{locationName}</span>
                              </div>
                            )}
                            <div className="header-time-info">
                              <div className="time-item">
                                <ClockPlus className="time-icon" />
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
                                    <ClockFading className="time-icon" />
                                    <span className="time-value">
                                      {getTimeUntilExpiration(selectedHotspot.endDate)}
                                    </span>
                                  </div>
                                );
                              })()}
                              <div 
                                className={`time-item ${!userLocation ? 'eta-inactive' : ''}`}
                                onClick={() => {
                                  if (userLocation) {
                                    // Show route on map
                                    fetchAndDisplayRoute(selectedHotspot.lat, selectedHotspot.lng);
                                  } else {
                                    // Request location and auto-fetch route after permission
                                    requestUserLocation(selectedHotspot.lat, selectedHotspot.lng);
                                  }
                                }}
                                title={userLocation ? "Show route on map" : "Click to get ETA"}
                                style={{ cursor: 'pointer' }}
                              >
                                <Navigation className="time-icon" />
                                <span className="time-value">
                                  {userLocation 
                                    ? calculateETA(userLocation.lat, userLocation.lng, selectedHotspot.lat, selectedHotspot.lng)
                                    : "Get ETA"
                                  }
                                </span>
                              </div>
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
                                GET A HINT!
                              </button>
                            </div>
                          )}
                        </>
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
                <>
                  <div className="modal-section modal-pending">
                    <div className={`sa ${showCheckmark ? 'show-checkmark' : ''}`}>
                      <div className="sa-spinner"></div>
                      <div className="sa-success">
                        <div className="sa-success-tip"></div>
                        <div className="sa-success-long"></div>
                      </div>
                    </div>
                    <h3>Waiting for Approval</h3>
                    <p>Your claim is being reviewed by the admin. This usually takes a few minutes.</p>
                    <p className="pending-note">Stay on this page to see when it's approved!</p>
                  </div>
                  <div className="modal-section modal-actions">
                    <button className="claim-btn" disabled>
                      CLAIM PENDING
                    </button>
                  </div>
                </>
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

