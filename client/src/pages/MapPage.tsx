/// <reference types="vite/client" />
import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { subscribeToPush, isNotificationSupported, getNotificationPermission } from '../utils/pushNotifications';
import { GoogleMap, useJsApiLoader, DirectionsRenderer } from '@react-google-maps/api';
import Confetti from 'react-confetti';
import { Gift, ClockPlus, ClockFading, Navigation, MapPin } from 'lucide-react';
import { Hotspot } from '../types';
import { getHotspotStatus, getTimeUntilExpiration, calculateETA } from '../utils/time';
import { getLocationName } from '../utils/geocoding';
import { GoldenTicket } from '../components/GoldenTicket';
import { HintModal } from '../components/HintModal';
import { MenuContent } from '../components/MenuContent';
import { customMapStyles } from '../utils/mapStyles';
import { CustomMarker } from '../components/CustomMarker';
import { NotificationPrompt } from '../components/NotificationPrompt';
import { useToast } from '../components/Toast';
import { useProximityDetector } from '../components/ProximityDetector';
import { Radio, Waves } from 'lucide-react';
import './MapPage.css';
import { createPortal } from 'react-dom';

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

const UserLocationMarker: React.FC<{ position: { lat: number; lng: number }; map: google.maps.Map | null }> = ({ position, map }) => {
  const overlayRef = useRef<google.maps.OverlayView | null>(null);

  useEffect(() => {
    if (!map) return;

    class UserLocationOverlay extends google.maps.OverlayView {
      position: google.maps.LatLng;
      containerDiv: HTMLDivElement | null = null;

      constructor(position: google.maps.LatLng) {
        super();
        this.position = position;
      }

      onAdd() {
        const div = document.createElement('div');
        div.className = 'user-location-marker';
        this.containerDiv = div;
        this.getPanes()?.overlayMouseTarget.appendChild(div);
      }

      draw() {
        if (!this.containerDiv) return;
        const projection = this.getProjection();
        const pos = projection.fromLatLngToDivPixel(this.position);
        if (pos) {
          const offset = 10;
          this.containerDiv.style.left = `${pos.x - offset}px`;
          this.containerDiv.style.top = `${pos.y - offset}px`;
        }
      }

      onRemove() {
        if (this.containerDiv) {
          this.containerDiv.parentNode?.removeChild(this.containerDiv);
          this.containerDiv = null;
        }
      }
    }

    const overlay = new UserLocationOverlay(new google.maps.LatLng(position.lat, position.lng));
    overlay.setMap(map);
    overlayRef.current = overlay;

    return () => {
      overlay.setMap(null);
    };
  }, [map, position.lat, position.lng]);

  return null;
};


function MapPage() {
  const { id, shareToken } = useParams<{ id?: string; shareToken?: string }>(); // Get hotspot ID or shareToken from URL params
  const isShareRoute = !!shareToken; // Determine if this is a share/view-only route
  const navigate = useNavigate();
  
  // Load Google Maps API
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
  });
  
  useEffect(() => {
    if ('permissions' in navigator && navigator.geolocation) {
      navigator.permissions.query({ name: 'geolocation' as PermissionName }).then((result) => {
        if (result.state === 'granted') {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
            },
            undefined,
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 10000 }
          );
        }
      }).catch(() => {
        // Ignore errors querying permissions API (not supported everywhere)
      });
    }
  }, []);
  
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markersLoaded, setMarkersLoaded] = useState(false);
  const [center, setCenter] = useState<{ lat: number; lng: number }>({ lat: 40.7128, lng: -74.0060 }); // Default: NYC
  const [zoom, setZoom] = useState(13);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [hasInitiallyCentered, setHasInitiallyCentered] = useState(false); // Track if we've done initial centering
  const [selectedHotspot, setSelectedHotspot] = useState<Hotspot | null>(null);
  const [directionsResponse, setDirectionsResponse] = useState<google.maps.DirectionsResult | null>(null);
  const [showRoute, setShowRoute] = useState(false);
  const [pendingDestination, setPendingDestination] = useState<{ lat: number; lng: number } | null>(null);
  const [isModalClosing, setIsModalClosing] = useState(false);
  const [claimStatus, setClaimStatus] = useState<'unclaimed' | 'pending' | 'claimed'>('unclaimed');
  const [showCheckmark, setShowCheckmark] = useState(false); // Controls checkmark animation
  const [privateKey, setPrivateKey] = useState<string | null>(null);
  const [showDiscoveryConfetti, setShowDiscoveryConfetti] = useState(false); // Discovery confetti
  const [claimError, setClaimError] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);
  const [socialSettings, setSocialSettings] = useState({
    pumpFunUrl: '',
    pumpFunEnabled: false,
    xUsername: '',
    xEnabled: false,
    instagramUsername: '',
    instagramEnabled: false,
    tiktokUsername: '',
    tiktokEnabled: false,
  });
  const [showCertificate, setShowCertificate] = useState(false);
  const [certificateExpanded, setCertificateExpanded] = useState(false);
  const [shareTextReady, setShareTextReady] = useState(false);
  const [keyCopied, setKeyCopied] = useState(false);
  const [twitterHandle, setTwitterHandle] = useState<string>('');
  const [claimedAt, setClaimedAt] = useState<string>('');
  const [locationName, setLocationName] = useState<string>('');
  const [showHintModal, setShowHintModal] = useState(false);
  const [showProximityIntro, setShowProximityIntro] = useState(false);
  
  // Proximity detection state
  const [proximityDistance, setProximityDistance] = useState<number | null>(null);
  const [isWithinProximityRadius, setIsWithinProximityRadius] = useState(false);
  const [proximityUserLocation, setProximityUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [proximityEnabled, setProximityEnabled] = useState(false);
  
  // Proximity detector hook for selected hotspot
  const proximityDetector = useProximityDetector({
    hotspotLat: selectedHotspot?.lat || 0,
    hotspotLng: selectedHotspot?.lng || 0,
    proximityRadius: selectedHotspot?.proximityRadius || 5,
    enabled: proximityEnabled && selectedHotspot?.claimType === 'proximity' && !!selectedHotspot,
  });
  
  // Update proximity state from detector
  useEffect(() => {
    if (selectedHotspot?.claimType === 'proximity') {
      setProximityDistance(proximityDetector.distance);
      setIsWithinProximityRadius(proximityDetector.isWithinRadius);
      setProximityUserLocation(proximityDetector.userLocation);
    } else {
      setProximityDistance(null);
      setIsWithinProximityRadius(false);
      setProximityUserLocation(null);
    }
  }, [proximityDetector, selectedHotspot]);
  
  // Sync global user location when proximity detector has a fix
  useEffect(() => {
    if (proximityDetector.userLocation) {
      setUserLocation(proximityDetector.userLocation);
    }
  }, [proximityDetector.userLocation]);
  
  // Manage proximity intro visibility (mobile Safari fallback)
  useEffect(() => {
    if (selectedHotspot?.claimType === 'proximity') {
      const hasLocation = !!proximityDetector.userLocation;
      setShowProximityIntro(!hasLocation);
    } else {
      setShowProximityIntro(false);
    }
  }, [selectedHotspot, proximityDetector.userLocation]);
  
  // Toast functionality
  const { showToast } = useToast();

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

  // Check URL for NFC routing (e.g., /ping/:id) or share route (/share/:shareToken)
  useEffect(() => {
    if (shareToken) {
      fetchHotspotByShareToken(shareToken);
    } else if (id) {
      fetchHotspotById(id);
    }
  }, [id, shareToken]);

  useEffect(() => {
    fetchHotspots();
    
    // Poll for hotspot updates every 30 seconds
    const interval = setInterval(fetchHotspots, 30000);
    return () => clearInterval(interval);
  }, []);

  // Handle push notification subscription (for users, not share routes)
  // Service worker is already registered in main.tsx
  useEffect(() => {
    if (isShareRoute) return; // Skip push notifications for share routes
    
    const initPushNotifications = async () => {
      if (!isNotificationSupported()) {
        console.log('[Push] Notifications not supported');
        return;
      }

      // Service worker is already registered in main.tsx, just wait for it to be ready
      let registration: ServiceWorkerRegistration | null = null;
      try {
        registration = await navigator.serviceWorker.ready;
      } catch (err) {
        console.log('[Push] Service worker not available');
        return;
      }

      if (!registration) {
        return;
      }

      // Check current permission status
      const permission = getNotificationPermission();
      
      // Only prompt if permission is default (not granted or denied)
      // For iOS PWA, we'll show a custom prompt (handled separately)
      if (permission === 'default') {
        // Don't auto-prompt, wait for user action or custom prompt
        console.log('[Push] Notification permission not yet requested');
        return;
      }

      // If permission is granted, subscribe
      if (permission === 'granted') {
        const subscribed = await subscribeToPush(registration, 'user');
        // Success log is already in subscribeToPush function, no need to log again
        if (!subscribed) {
          console.log('[Push] Failed to subscribe to push notifications');
        }
      }
    };

    initPushNotifications().catch((err) => {
      console.error('[Push] Error initializing push notifications:', err);
    });
  }, [isShareRoute]);

  // Fetch social settings
  useEffect(() => {
    const fetchSocialSettings = async () => {
      try {
        const response = await fetch(`${API_URL}/api/hints/settings`);
        if (response.ok) {
          const data = await response.json();
          setSocialSettings({
            pumpFunUrl: data.pumpFunUrl || '',
            pumpFunEnabled: data.pumpFunEnabled || false,
            xUsername: data.xUsername || '',
            xEnabled: data.xEnabled || false,
            instagramUsername: data.instagramUsername || '',
            instagramEnabled: data.instagramEnabled || false,
            tiktokUsername: data.tiktokUsername || '',
            tiktokEnabled: data.tiktokEnabled || false,
          });
        }
      } catch (err) {
        console.error('Failed to fetch social settings:', err);
      }
    };
    fetchSocialSettings();
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

  // Fetch hotspots with automatic retry logic
  const fetchHotspots = async (retryAttempt: number = 0) => {
    try {
      const response = await fetch(`${API_URL}/api/hotspots`);
      if (!response.ok) {
        throw new Error('Failed to fetch hotspots');
      }
      const data = await response.json();
      setHotspots(data);

      // Only center on first active ping on initial load, not on polling updates
      // This prevents the map from jumping around every 30 seconds when there are multiple active pings
      if (!hasInitiallyCentered && data.length > 0) {
        const activeHotspot = data.find((h: Hotspot) => h.active);
        if (activeHotspot) {
          setCenter({ lat: activeHotspot.lat, lng: activeHotspot.lng });
          setZoom(14);
          setHasInitiallyCentered(true); // Mark as done so we don't center again on polling updates
          
          // Small delay to show loading pill before marker appears with slide-up animation
          setTimeout(() => setMarkersLoaded(true), 500);
        } else {
          setMarkersLoaded(true);
        }
      } else {
        // On subsequent polling updates, just refresh the data without recentering
        setMarkersLoaded(true);
      }
      
      // If no hotspots exist, keep default NYC location
      // Geolocation will only be requested when user clicks "Get My Location" button

      // Reset error state on success
      setError(null);
      setLoading(false);
    } catch (err) {
      // Check if it's a network/CORS error
      const isNetworkError = err instanceof TypeError && 
        (err.message.includes('Failed to fetch') || 
         err.message.includes('NetworkError') ||
         err.message.includes('CORS'));
      
      // For network errors, implement auto-retry with exponential backoff
      if (isNetworkError && retryAttempt < 4) {
        const delays = [1000, 2000, 4000, 8000]; // 1s, 2s, 4s, 8s
        const delay = delays[retryAttempt];
        
        // Show subtle toast notification
        if (retryAttempt === 0) {
          showToast('Connection issue. Retrying...', 'info', 2000);
        }
        
        // Retry after delay
        setTimeout(() => {
          fetchHotspots(retryAttempt + 1);
        }, delay);
      } else {
        // Max retries reached or non-network error - show empty state gracefully
        setError(null); // Don't show error modal
        setLoading(false);
        setMarkersLoaded(true);
        
        // Only show toast if we exhausted retries (not on first failure)
        if (retryAttempt > 0) {
          showToast('Unable to connect. Showing cached data if available.', 'error', 4000);
        }
      }
    }
  };

  // Fetch specific hotspot by share token (view-only mode)
  const fetchHotspotByShareToken = async (token: string) => {
    try {
      const response = await fetch(`${API_URL}/api/share/${token}`);
      if (!response.ok) {
        console.error('Hotspot not found');
        return;
      }
      const hotspot = await response.json();
      setSelectedHotspot(hotspot);
      setCenter({ lat: hotspot.lat, lng: hotspot.lng });
      setZoom(16);
      
      // Share routes are always view-only - no claim flow
      setClaimStatus('unclaimed'); // Show as unclaimed but without claim buttons
    } catch (err) {
      console.error('Error fetching hotspot by share token:', err);
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
      
      // Enable proximity detection if this is a proximity ping
      if (hotspot.claimType === 'proximity') {
        setProximityEnabled(true);
      } else {
        setProximityEnabled(false);
      }
      
      // Check if this user has a claim session for this hotspot
      const claimSession = getClaimSession(hotspotId);
      
      if (claimSession && claimSession.privateKey) {
        // Original claimer returning - show success modal
        setClaimStatus('claimed');
        setPrivateKey(claimSession.privateKey);
        setShowCertificate(true);
        setClaimedAt(new Date().toISOString());
        if (hotspot.tweetUrl) {
          setTwitterHandle(extractTwitterHandle(hotspot.tweetUrl));
        }
      } else if (hotspot.claimStatus === 'claimed') {
        // Different user or no session - show error
        setClaimStatus('claimed'); // Set status to claimed so modal-claim-intro doesn't show
        setClaimError('This PING has already been claimed by someone else.');
      } else if (hotspot.claimStatus === 'pending') {
        setClaimStatus('pending');
      } else {
        setClaimStatus('unclaimed');
        // Trigger discovery celebration (only for claim routes, not share routes)
        if (!isShareRoute) {
          setShowDiscoveryConfetti(true);
          playSuccessSound();
          setTimeout(() => setShowDiscoveryConfetti(false), 6000); // 6 seconds to let confetti fall completely
        }
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

    // For proximity claims, verify user is within radius and get location
    if (selectedHotspot.claimType === 'proximity') {
      if (!proximityUserLocation) {
        setClaimError('Location is required for proximity claims. Please enable GPS.');
        return;
      }
      
      if (!isWithinProximityRadius) {
        setClaimError(`You must be within ${selectedHotspot.proximityRadius || 5} meters to claim this ping. You are ${proximityDetector.formattedDistance} away.`);
        return;
      }
    }

    // Open Twitter Web Intent
    const tweetText = `Just found a PING! @YourPingAccount #PINGGame`;
    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
    window.open(tweetUrl, '_blank');

    // Submit claim to backend
    try {
      const claimBody: any = { tweetUrl: 'user-tweeted' };
      
      // Include user location for proximity claims
      if (selectedHotspot.claimType === 'proximity' && proximityUserLocation) {
        claimBody.userLat = proximityUserLocation.lat;
        claimBody.userLng = proximityUserLocation.lng;
      }
      
      const response = await fetch(`${API_URL}/api/hotspots/${selectedHotspot.id}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(claimBody),
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
              
              // Store claim session so user can refresh
              storeClaimSession(selectedHotspot.id, data.privateKey);
              
              // Set certificate data
              setShowCertificate(true);
              setClaimedAt(new Date().toISOString());
              if (data.tweetUrl) {
                setTwitterHandle(extractTwitterHandle(data.tweetUrl));
              }
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
      
      {/* Confetti - Gold confetti on discovery only */}
      {showDiscoveryConfetti && typeof document !== 'undefined' &&
        createPortal(
          <div className="confetti-wrapper">
            <Confetti
              width={window.innerWidth}
              height={window.innerHeight}
              numberOfPieces={75}
              colors={['#FFD700', '#FFC700', '#FFE87C', '#FFAA00', '#FF8C00']}
              recycle={false}
              gravity={0.3}
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                zIndex: 1600,
                pointerEvents: 'none',
              }}
            />
          </div>,
          document.body
        )}
      
      {/* Proximity Intro Modal */}
      {showProximityIntro && selectedHotspot?.claimType === 'proximity' && !proximityUserLocation && (
        <div className="modal-overlay proximity-intro-overlay" onClick={() => setShowProximityIntro(false)}>
          <div className="modal-wrapper proximity-intro" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowProximityIntro(false)}>✕</button>
            <div className="modal-sections">
              <div className="modal-section proximity-intro-content">
                <h2>Enable GPS</h2>
                <p>This is a proximity-based ping. Turn on location sharing to track how close you are.</p>
                <div className="proximity-gps-buttons">
                  <button
                    className="enable-gps-btn"
                    onClick={async () => {
                      if (!selectedHotspot) return;
                      try {
                        await navigator.geolocation.getCurrentPosition(
                          () => {
                            setProximityEnabled(true);
                            requestUserLocation(selectedHotspot.lat, selectedHotspot.lng);
                            showToast('Location enabled!', 'success');
                            setShowProximityIntro(false);
                          },
                          () => {
                            showToast('Location permission denied', 'error');
                          }
                        );
                      } catch (err) {
                        showToast('Failed to enable location', 'error');
                      }
                    }}
                  >
                    Enable GPS
                  </button>
                  <button className="later-btn" onClick={() => setShowProximityIntro(false)}>Later</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Navigation Bar */}
      <nav className="map-nav">
        <Link to="/" style={{ textDecoration: 'none' }}>
          <img src="/logo/ping-logo.svg" alt="PING Logo" className="nav-logo" />
        </Link>
        <button 
          className={`hamburger-menu ${mobileMenuOpen ? 'open' : ''}`}
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
        >
          <span className="line-menu half start"></span>
          <span className="line-menu"></span>
          <span className="line-menu half end"></span>
        </button>
        {mobileMenuOpen && (
          <div className="menu-overlay menu-open">
            <MenuContent 
              socialSettings={socialSettings}
            />
          </div>
        )}
      </nav>

      {/* Loading/Error States */}
      {loading && (
        <div className="map-overlay">
          <p>Loading map...</p>
        </div>
      )}

      {/* Only show error modal for critical non-network errors (network errors use toast + auto-retry) */}
      {/* Network errors are handled via toast notifications and don't set error state */}
      {error && (
        <div className="map-overlay error">
          <p>Error: {error}</p>
          <button onClick={() => fetchHotspots(0)}>Retry</button>
        </div>
      )}

      {/* Map */}
      {!loading && isLoaded && (
        <GoogleMap
          center={center}
          zoom={zoom}
          mapContainerClassName="map-container"
          onLoad={(map) => {
            setMapInstance(map);
          }}
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
          {/* Render custom markers for each ACTIVE hotspot with slide-up animation */}
          {markersLoaded && hotspots.filter(h => h.active && new Date(h.endDate) >= new Date()).map((hotspot) => {
            const now = new Date();
            const endDate = new Date(hotspot.endDate);
            const isActive = now <= endDate && hotspot.active;
            
            const userDistance = (selectedHotspot?.id === hotspot.id && hotspot.claimType === 'proximity')
              ? proximityDistance
              : null;
            
            return (
              <CustomMarker
                key={hotspot.id}
                position={{ lat: hotspot.lat, lng: hotspot.lng }}
                isActive={isActive}
                onClick={() => {
                  setSelectedHotspot(hotspot);
                  if (hotspot.claimType === 'proximity') {
                    setProximityEnabled(true);
                  } else {
                    setProximityEnabled(false);
                  }
                }}
                map={mapInstance || undefined}
                animate={true}
                claimType={hotspot.claimType || 'nfc'}
                proximityRadius={hotspot.proximityRadius || null}
                userDistance={userDistance}
                isFocused={selectedHotspot?.id === hotspot.id}
                enablePulse={hotspot.claimType === 'proximity'}
                pulseOnFocus={hotspot.claimType === 'nfc'}
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

          {userLocation && mapInstance && (
            <UserLocationMarker position={userLocation} map={mapInstance} />
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
      {selectedHotspot && !showHintModal && (
        <div className={`modal-overlay ${isModalClosing ? 'closing' : ''}`} onClick={() => setSelectedHotspot(null)}>
          <div className="modal-wrapper">
            <div className={`modal-content ${isModalClosing ? 'closing' : ''}`} onClick={(e) => e.stopPropagation()}>
              {/* Close button */}
              <button className="modal-close" onClick={() => setSelectedHotspot(null)}>
                ✕
              </button>

            <div className="modal-sections">
              {/* Show ping content */}
              <>
                  {/* Show congratulations for claim flow (unique URLs), otherwise show all sections */}
                  {claimStatus === 'unclaimed' && selectedHotspot.claimStatus === 'unclaimed' && id && !isShareRoute ? (
                    <div className="modal-section modal-claim-intro">
                      <h3>GREAT JOB!</h3>
                      <p>You found the PING! That means you are almost <span className="prize-amount">{selectedHotspot.prize} SOL</span> richer!</p>
                      <p>To finish claiming it, press the big yellow button to notify our team on X, and return to this screen.</p>
                    </div>
                  ) : (
                    <>
                      {/* Show all sections except when claimed or pending (for claim flow) */}
                      {claimStatus !== 'claimed' && !(claimStatus === 'pending' && id && !isShareRoute) && (
                        <>
                          {/* Image section (if available) - First */}
                          {selectedHotspot.imageUrl && (
                            <div className="modal-section modal-image">
                              <img src={selectedHotspot.imageUrl} alt={selectedHotspot.title} />
                            </div>
                          )}

                          {/* Title + Time Info combined section - Second */}
                          <div className="modal-section modal-header">
                            <div className="modal-title-row">
                              <h2>{selectedHotspot.title}</h2>
                              {/* Claim Type Badge */}
                              <div className="claim-type-badge-small">
                                {selectedHotspot.claimType === 'proximity' ? (
                                  <>
                                    <Waves size={14} />
                                    <span>Proximity</span>
                                  </>
                                ) : (
                                  <>
                                    <Radio size={14} />
                                    <span>NFC</span>
                                  </>
                                )}
                              </div>
                            </div>
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
                          {(selectedHotspot.prize != null) && (
                            <div className="modal-section modal-prize">
                              <div className="prize-badge">
                                <Gift className="prize-icon" />
                                <span className="prize-text">{selectedHotspot.prize ?? 0} SOL</span>
                              </div>
                              {/* For proximity pings: Show GPS intro if location not enabled, otherwise show hint button */}
                              <button 
                                className="hint-cta" 
                                onClick={() => {
                                  if (selectedHotspot.claimType === 'proximity' && !proximityUserLocation) {
                                    setShowProximityIntro(true);
                                    return;
                                  }
                                  setShowHintModal(true);
                                }}
                              >
                                {selectedHotspot.claimType === 'proximity' && !proximityUserLocation
                                  ? 'ENABLE GPS'
                                  : 'GET A HINT!'}
                              </button>
                            </div>
                          )}
                          
                          {/* Proximity Distance Indicator (for proximity pings with GPS enabled) */}
                          {selectedHotspot.claimType === 'proximity' && proximityDetector.locationPermission === 'granted' && proximityDistance !== null && (
                            <div className="modal-section proximity-distance">
                              <div className="distance-indicator" style={{ color: proximityDetector.distanceColor }}>
                                <span className="distance-value">{proximityDetector.formattedDistance}</span>
                                <span className="distance-label">away</span>
                              </div>
                              {proximityDetector.locationError && (
                                <p className="location-error-text">{proximityDetector.locationError}</p>
                              )}
                            </div>
                          )}
                          
                          {/* Verify Proximity Button (shown when within claim radius) */}
                          {selectedHotspot.claimType === 'proximity' && isWithinProximityRadius && !id && (
                            <div className="modal-section modal-actions">
                              <button 
                                className="verify-proximity-btn" 
                                onClick={() => {
                                  // Navigate to the ping's unique URL to start the claim flow
                                  navigate(`/ping/${selectedHotspot.id}`);
                                }}
                              >
                                Verify Proximity
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </>
                  )}
              </>

              {/* Action section - Different states */}
              {/* Only show claim button for NFC URLs (when accessed via /ping/:id) and not share routes */}
              {/* Show when unclaimed OR when there's a claim error (someone else claimed it) */}
              {id && !isShareRoute && (claimStatus === 'unclaimed' || claimError) && (
                <>
                  {claimError && (
                    <div className="modal-section claim-error-section">
                      <h2>PING Already Claimed</h2>
                      <p className="claim-error-text">{claimError}</p>
                    </div>
                  )}
                  <div className="modal-section modal-actions">
                    <button 
                      className={claimError ? "view-active-btn" : "claim-btn"} 
                      onClick={claimError ? () => window.location.href = '/' : handleClaim}
                    >
                      {claimError ? 'View Active PING' : 'Claim Prize'}
                    </button>
                  </div>
                </>
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
                    You've successfully claimed this PING! Add this private key to your Solana wallet to access your prize.
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

      {/* Hint Modal - Closes both modals on exit */}
      {showHintModal && selectedHotspot && (
        <HintModal
          hotspotId={selectedHotspot.id}
          onClose={() => {
            setShowHintModal(false);
            setSelectedHotspot(null); // Close main modal too - return to map
          }}
          onShowDetails={() => setShowHintModal(false)} // Just close hint modal, show main
        />
        )}

        {/* Notification Prompt */}
        {!isShareRoute && (
          <NotificationPrompt userType="user" />
        )}
      </div>
    );
}

export default MapPage;

