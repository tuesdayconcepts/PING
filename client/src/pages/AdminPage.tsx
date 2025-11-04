/// <reference types="vite/client" />
import { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleMap, useJsApiLoader } from '@react-google-maps/api';
import { LogOut, SquarePen, Check, Trash2, MapPin, Gift, X, ImageUp, LocateFixed, Link as LinkIcon, Wallet as WalletIcon, KeyRound, Unlock, Share, Bell, BellOff, SmartphoneNfc, Radio } from 'lucide-react';
import { Hotspot, AdminLog } from '../types';
import { getToken, setToken, removeToken, setUsername, getAuthHeaders } from '../utils/auth';
import { formatDate } from '../utils/time';
import { customMapStyles } from '../utils/mapStyles';
import { CustomMarker } from '../components/CustomMarker';
import { HotspotSkeletonList } from '../components/HotspotSkeleton';
import { useToast } from '../components/Toast';
import { NotificationPrompt } from '../components/NotificationPrompt';
import { registerServiceWorker, subscribeToPush, isNotificationSupported, getNotificationPermission } from '../utils/pushNotifications';
import './AdminPage.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

// Preview Marker Component (cursor-style: circle with crosshair)
interface PreviewMarkerProps {
  position: { lat: number; lng: number };
  map: google.maps.Map;
}

const PreviewMarker: React.FC<PreviewMarkerProps> = ({ position, map }) => {
  const overlayRef = useRef<google.maps.OverlayView | null>(null);

  useEffect(() => {
    if (!map) return;

    class PreviewOverlay extends google.maps.OverlayView {
      position: google.maps.LatLng;
      containerDiv: HTMLDivElement | null = null;

      constructor(position: google.maps.LatLng) {
        super();
        this.position = position;
      }

      onAdd() {
        const div = document.createElement('div');
        div.style.cssText = `
          width: 32px;
          height: 32px;
          position: absolute;
          cursor: pointer;
        `;
        
        // Create SVG matching the cursor style
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '32');
        svg.setAttribute('height', '32');
        svg.setAttribute('viewBox', '0 0 32 32');
        svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        
        // Defs for blur filter
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        const filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
        filter.setAttribute('id', 'preview-blur');
        const blur = document.createElementNS('http://www.w3.org/2000/svg', 'feGaussianBlur');
        blur.setAttribute('in', 'SourceGraphic');
        blur.setAttribute('stdDeviation', '2');
        filter.appendChild(blur);
        defs.appendChild(filter);
        svg.appendChild(defs);
        
        // Blurred white circle background
        const bgCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        bgCircle.setAttribute('cx', '16');
        bgCircle.setAttribute('cy', '16');
        bgCircle.setAttribute('r', '15');
        bgCircle.setAttribute('fill', 'rgba(255,255,255,0.19)');
        bgCircle.setAttribute('filter', 'url(#preview-blur)');
        svg.appendChild(bgCircle);
        
        // Yellow circle stroke
        const strokeCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        strokeCircle.setAttribute('cx', '16');
        strokeCircle.setAttribute('cy', '16');
        strokeCircle.setAttribute('r', '14');
        strokeCircle.setAttribute('fill', 'none');
        strokeCircle.setAttribute('stroke', 'rgba(255,215,0,0.9)');
        strokeCircle.setAttribute('stroke-width', '2');
        svg.appendChild(strokeCircle);
        
        // Vertical line (crosshair)
        const vLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        vLine.setAttribute('x1', '16');
        vLine.setAttribute('y1', '10');
        vLine.setAttribute('x2', '16');
        vLine.setAttribute('y2', '22');
        vLine.setAttribute('stroke', 'rgba(255,215,0,0.9)');
        vLine.setAttribute('stroke-width', '2.5');
        vLine.setAttribute('stroke-linecap', 'round');
        svg.appendChild(vLine);
        
        // Horizontal line (crosshair)
        const hLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        hLine.setAttribute('x1', '10');
        hLine.setAttribute('y1', '16');
        hLine.setAttribute('x2', '22');
        hLine.setAttribute('y2', '16');
        hLine.setAttribute('stroke', 'rgba(255,215,0,0.9)');
        hLine.setAttribute('stroke-width', '2.5');
        hLine.setAttribute('stroke-linecap', 'round');
        svg.appendChild(hLine);
        
        div.appendChild(svg);
        this.containerDiv = div;
        const panes = this.getPanes();
        panes?.overlayMouseTarget.appendChild(div);
      }

      draw() {
        if (!this.containerDiv) return;
        const overlayProjection = this.getProjection();
        const pos = overlayProjection.fromLatLngToDivPixel(this.position);
        if (pos) {
          const offset = 16; // Half of 32px
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

    const overlay = new PreviewOverlay(new google.maps.LatLng(position.lat, position.lng));
    overlay.setMap(map);
    overlayRef.current = overlay;

    return () => {
      overlay.setMap(null);
    };
  }, [map, position.lat, position.lng]);

  return null;
};

// Edit Preview Marker Component (filled for NFC, hollow for proximity)
interface EditPreviewMarkerProps {
  position: { lat: number; lng: number };
  map: google.maps.Map;
  claimType: 'nfc' | 'proximity';
}

const EditPreviewMarker: React.FC<EditPreviewMarkerProps> = ({ position, map, claimType }) => {
  const overlayRef = useRef<google.maps.OverlayView | null>(null);

  useEffect(() => {
    if (!map) return;

    const color = 'gold';
    const starPath = "M344.13,6.42l80.5,217.54c3.64,9.83,11.39,17.58,21.22,21.22l217.54,80.5c8.56,3.17,8.56,15.28,0,18.45l-217.54,80.5c-9.83,3.64-17.58,11.39-21.22,21.22l-80.5,217.54c-3.17,8.56-15.28,8.56-18.45,0l-80.5-217.54c-3.64-9.83-11.39-17.58-21.22-21.22L6.42,344.13c-8.56-3.17-8.56-15.28,0-18.45l217.54-80.5c9.83-3.64,17.58-11.39,21.22-21.22L325.68,6.42c3.17-8.56,15.28,8.56,18.45,0Z";

    class EditPreviewOverlay extends google.maps.OverlayView {
      position: google.maps.LatLng;
      containerDiv: HTMLDivElement | null = null;

      constructor(position: google.maps.LatLng) {
        super();
        this.position = position;
      }

      onAdd() {
        const div = document.createElement('div');
        div.className = 'pulse-marker';
        div.style.cssText = `cursor: pointer; width: 80px; height: 80px; position: absolute;`;

        const star = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        star.setAttribute('class', 'pulse-marker-star');
        star.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        star.setAttribute('viewBox', '0 0 669.82 669.82');
        const starPathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        
        // NFC: filled, Proximity: hollow
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

        this.containerDiv = div;
        const panes = this.getPanes();
        panes?.overlayMouseTarget.appendChild(div);
      }

      draw() {
        if (!this.containerDiv) return;
        const overlayProjection = this.getProjection();
        const pos = overlayProjection.fromLatLngToDivPixel(this.position);
        if (pos) {
          const offset = 40; // Half of 80px marker size
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

    const overlay = new EditPreviewOverlay(new google.maps.LatLng(position.lat, position.lng));
    overlay.setMap(map);
    overlayRef.current = overlay;

    return () => {
      overlay.setMap(null);
    };
  }, [map, position.lat, position.lng, claimType]);

  return null;
};

// User Location Marker Component (white circle with yellow stroke)
interface UserLocationMarkerProps {
  position: { lat: number; lng: number };
  map: google.maps.Map;
}

const UserLocationMarker: React.FC<UserLocationMarkerProps> = ({ position, map }) => {
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
        div.style.cssText = `
          width: 20px;
          height: 20px;
          background: white;
          border: 3px solid #ffd700;
          border-radius: 50%;
          position: absolute;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        `;
        this.containerDiv = div;
        const panes = this.getPanes();
        panes?.overlayMouseTarget.appendChild(div);
      }

      draw() {
        if (!this.containerDiv) return;
        const overlayProjection = this.getProjection();
        const pos = overlayProjection.fromLatLngToDivPixel(this.position);
        if (pos) {
          const offset = 10; // Half of 20px
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

    const overlay = new UserLocationOverlay(new google.maps.LatLng(position.lat, position.lng));
    overlay.setMap(map);
    overlayRef.current = overlay;

    return () => {
      overlay.setMap(null);
    };
  }, [map, position.lat, position.lng]);

  return null;
};

function AdminPage() {
  // Load Google Maps API
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
  });

  // Ref for create form to enable auto-scroll
  const createFormRef = useRef<HTMLDivElement>(null);
  // Refs for tabs containers to track active tab position
  const tabsRef = useRef<HTMLDivElement>(null); // Desktop tabs
  const mobileTabsRef = useRef<HTMLDivElement>(null); // Mobile tabs
  // Ref to prevent double-firing on mobile (touch + click)
  const lastTabChangeRef = useRef<number>(0);
  
  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsernameInput] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  
  // Data state
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [selectedHotspot, setSelectedHotspot] = useState<Hotspot | null>(null);
  const [hotspotsLoading, setHotspotsLoading] = useState(true);
  const [walletBalances, setWalletBalances] = useState<Record<string, number>>({});
  
  // Pagination state for claimed hotspots (lazy-loaded)
  const [claimedHotspots, setClaimedHotspots] = useState<Hotspot[]>([]);
  const [claimedLoading, setClaimedLoading] = useState(false);
  const [claimedOffset, setClaimedOffset] = useState(0);
  const [claimedHasMore, setClaimedHasMore] = useState(true);
  
  // Pagination state for logs
  const [logsOffset, setLogsOffset] = useState(0);
  const [logsHasMore, setLogsHasMore] = useState(true);
  const [logsLoading, setLogsLoading] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    title: '',
    lat: 40.7128,
    lng: -74.0060,
    prize: '' as string | number, // Number for prize amount in SOL
    endDate: '',
    imageUrl: '',
    privateKey: '',
    hint1: '',
    hint2: '',
    hint3: '',
    hint1PriceUsd: '' as string | number,
    hint2PriceUsd: '' as string | number,
    hint3PriceUsd: '' as string | number,
    claimType: 'nfc' as 'nfc' | 'proximity',
    proximityRadius: 5 as number,
  });

  // Claim type selection state (inline, not modal)
  const [showClaimTypeSelection, setShowClaimTypeSelection] = useState(false);
  const [pendingMapClickCoords, setPendingMapClickCoords] = useState<{ lat: number; lng: number } | null>(null);

  const [pendingClaims, setPendingClaims] = useState<Hotspot[]>([]);
  const [activeTab, setActiveTab] = useState<'active' | 'history' | 'activity' | 'access' | 'hints'>('active');
  const [currentUserRole, setCurrentUserRole] = useState<'admin' | 'editor'>('editor'); // Default to editor, will be updated by API
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [drawerExpanded, setDrawerExpanded] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedWalletId, setCopiedWalletId] = useState<string | null>(null);
  const [formClosing, setFormClosing] = useState(false);
  const [previewMarker, setPreviewMarker] = useState<{ lat: number; lng: number } | null>(null);
  const [showingPrivateKeyId, setShowingPrivateKeyId] = useState<string | null>(null);
  const [privateKeyData, setPrivateKeyData] = useState<Record<string, string>>({});
  const [copiedPrivateKeyId, setCopiedPrivateKeyId] = useState<string | null>(null);
  const [copiedShareId, setCopiedShareId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isNotificationSubscribed, setIsNotificationSubscribed] = useState(false);
  const [focusedHotspotId, setFocusedHotspotId] = useState<string | null>(null); // Track which ping is focused (centered or being edited)
  
  // State for sliding tab indicator
  const [indicatorReady, setIndicatorReady] = useState(false);
  
  // Access Control state
  const [adminUsers, setAdminUsers] = useState<Array<{id: string, username: string, role: 'admin' | 'editor', createdAt: string}>>([]);
  const [newUserForm, setNewUserForm] = useState({ username: '', password: '', role: 'editor' as 'admin' | 'editor' });
  const [showNewUserForm, setShowNewUserForm] = useState(false);
  
  // Hint Settings state (only wallets + token mint, no default prices)
  const [hintSettings, setHintSettings] = useState({
    treasuryWallet: '',
    burnWallet: '',
    pingTokenMint: '',
    buyButtonUrl: '',
    pumpFunUrl: '',
    pumpFunEnabled: false,
    xUsername: '',
    xEnabled: false,
    instagramUsername: '',
    instagramEnabled: false,
    tiktokUsername: '',
    tiktokEnabled: false,
  });

  // Disable edits if the selected hotspot is pending, even if local state hasn't refreshed yet
  const isSelectedPending = !!selectedHotspot && (
    selectedHotspot.claimStatus === 'pending' || pendingClaims.some(p => p.id === selectedHotspot.id)
  );

  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>({ lat: 40.7128, lng: -74.0060 });
  const [adminMapInstance, setAdminMapInstance] = useState<google.maps.Map | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null); // User's current location for marker

  // Set theme color for mobile Safari chrome
  useEffect(() => {
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', '#000e82');
    }
    
    // Reset to default on unmount
    return () => {
      if (metaThemeColor) {
        metaThemeColor.setAttribute('content', '#000000');
      }
    };
  }, []);

  // Toast functionality
  const { showToast } = useToast();
  
  // Delete confirmation state
  const [deletingHotspotId, setDeletingHotspotId] = useState<string | null>(null);
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false);


  useEffect(() => {
    if (getToken()) {
      setIsAuthenticated(true);
      
      // Load data sequentially with priority to avoid overwhelming server
      const loadData = async () => {
        // 1. Load critical data first (main content - only active hotspots)
        await fetchHotspots();
        
        // 2. Load secondary data in parallel (initial logs batch, not claimed hotspots)
        await Promise.all([
          fetchLogs(0, false), // Fetch initial 10 logs
          fetchAdminUsers(),
          fetchHintSettings()
        ]);
        
        // 3. Load polling data last (will refresh via interval anyway)
        fetchPendingClaims();
        
        // Note: Claimed hotspots are lazy-loaded when History tab is opened
      };
      
      loadData();
      
      // Subscribe to push notifications if already authenticated
      const initAdminPushNotifications = async () => {
        if (!isNotificationSupported()) {
          return;
        }

        const registration = await registerServiceWorker();
        if (!registration) {
          return;
        }

        const permission = getNotificationPermission();
        if (permission === 'granted') {
          // Decode JWT to get adminId
          try {
            const token = getToken();
            if (token) {
              const tokenPayload = token.split('.')[1];
              const decoded = JSON.parse(atob(tokenPayload));
              const adminId = decoded.adminId;
              
              await subscribeToPush(registration, 'admin', adminId);
              console.log('[Push] Admin subscribed to push notifications');
            }
          } catch (err) {
            console.error('[Push] Error subscribing admin:', err);
          }
        }
      };
      
      initAdminPushNotifications().catch((err) => {
        console.error('[Push] Error initializing admin push notifications:', err);
      });
    }
  }, []);

  // Check notification subscription status
  useEffect(() => {
    const checkSubscriptionStatus = async () => {
      if ('serviceWorker' in navigator && 'PushManager' in window) {
        try {
          const registration = await navigator.serviceWorker.ready;
          const subscription = await registration.pushManager.getSubscription();
          setIsNotificationSubscribed(!!subscription);
        } catch (err) {
          console.error('[Push] Error checking subscription:', err);
        }
      }
    };
    
    if (isAuthenticated) {
      checkSubscriptionStatus();
    }
  }, [isAuthenticated]);

  // Poll for pending claims every 30 seconds (reduced from 10s)
  useEffect(() => {
    if (isAuthenticated) {
      const interval = setInterval(fetchPendingClaims, 30000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  // Fetch claimed hotspots with pagination (lazy-loaded)
  // Defined before useEffect to avoid "used before declaration" error
  const fetchClaimedHotspots = useCallback(async (offset: number = 0, append: boolean = false) => {
    setClaimedLoading(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
      
      const response = await fetch(
        `${API_URL}/api/admin/hotspots/claimed?limit=10&offset=${offset}`,
        {
          headers: getAuthHeaders(),
          signal: controller.signal,
        }
      );
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        if (append) {
          setClaimedHotspots(prev => [...prev, ...data.hotspots]);
        } else {
          setClaimedHotspots(data.hotspots);
        }
        setClaimedHasMore(data.hasMore);
        setClaimedOffset(offset + data.hotspots.length);
        
        // Preload wallet balances for new hotspots
        data.hotspots.forEach((h: Hotspot) => {
          if (h.prizePublicKey) {
            // Check current balances state before fetching
            setWalletBalances(prev => {
              if (prev[h.prizePublicKey!] === undefined) {
                // Fetch balance asynchronously (don't await)
                fetchWalletBalance(h.prizePublicKey!).catch(console.error);
              }
              return prev;
            });
          }
        });
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        console.warn('Claimed hotspots fetch timed out');
      } else {
        console.error('Failed to fetch claimed hotspots:', err);
      }
    } finally {
      setClaimedLoading(false);
    }
  }, []);

  // Lazy-load claimed hotspots when History tab is opened
  useEffect(() => {
    if (activeTab === 'history' && claimedHotspots.length === 0 && !claimedLoading && isAuthenticated) {
      fetchClaimedHotspots(0, false);
    }
  }, [activeTab, isAuthenticated, claimedHotspots.length, claimedLoading, fetchClaimedHotspots]);

  // Handle hash-based navigation (e.g., from push notifications: /admin#hotspot-{id})
  useEffect(() => {
    if (!isAuthenticated || hotspotsLoading) return;

    const hash = window.location.hash;
    if (hash && hash.startsWith('#hotspot-')) {
      const hotspotId = hash.replace('#hotspot-', '');
      
      // Expand sidebar on mobile (especially important when navigating from push notification)
      setDrawerExpanded(true);
      
      // Switch to active tab (where pending claims are shown)
      setActiveTab('active');
      
      // Wait for tab switch and DOM update, then scroll to the card
      setTimeout(() => {
        // Try both id and data-hotspot-id selectors
        const hotspotElement = document.getElementById(`hotspot-${hotspotId}`) || 
                               document.querySelector(`[data-hotspot-id="${hotspotId}"]`) as HTMLElement;
        
        if (hotspotElement) {
          hotspotElement.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center' 
          });
          
          // Briefly highlight the card
          hotspotElement.style.transition = 'box-shadow 0.3s ease';
          hotspotElement.style.boxShadow = '0 0 20px rgba(59, 130, 246, 0.5)';
          setTimeout(() => {
            hotspotElement.style.boxShadow = '';
          }, 2000);
        }
      }, 300); // Small delay to ensure tab switch completes
    }
  }, [isAuthenticated, hotspotsLoading, hotspots]);

  // Calculate active tab position and width for sliding indicator
  useEffect(() => {
    // Use requestAnimationFrame to avoid forced reflow
    const calculateIndicator = () => {
      requestAnimationFrame(() => {
        // Check both desktop and mobile tabs
        const desktopTabs = tabsRef.current;
        const mobileTabs = mobileTabsRef.current;
        const desktopButton = desktopTabs?.querySelector('.tab-btn.active');
        const mobileButton = mobileTabs?.querySelector('.tab-btn.active');
        
        // Update desktop tabs
        if (desktopTabs && desktopButton) {
          const { offsetLeft, offsetWidth } = desktopButton as HTMLElement;
          desktopTabs.style.setProperty('--indicator-left', `${offsetLeft}px`);
          desktopTabs.style.setProperty('--indicator-width', `${offsetWidth}px`);
        }
        
        // Update mobile tabs
        if (mobileTabs && mobileButton) {
          const { offsetLeft, offsetWidth } = mobileButton as HTMLElement;
          mobileTabs.style.setProperty('--indicator-left', `${offsetLeft}px`);
          mobileTabs.style.setProperty('--indicator-width', `${offsetWidth}px`);
        }

        // Enable transitions after first render
        if (!indicatorReady) {
          if (desktopTabs) desktopTabs.classList.add('indicator-ready');
          if (mobileTabs) mobileTabs.classList.add('indicator-ready');
          setIndicatorReady(true);
        }
      });
    };

    // Calculate on next frame
    calculateIndicator();
  }, [activeTab, isAuthenticated, indicatorReady]);

  // Handle tab click with auto-scroll
  const handleTabClick = (tab: 'active' | 'history' | 'activity' | 'access' | 'hints', event: React.MouseEvent<HTMLButtonElement> | React.TouchEvent<HTMLButtonElement>) => {
    // Prevent double-firing on mobile (touch event followed by click event)
    const now = Date.now();
    if (now - lastTabChangeRef.current < 300) {
      return; // Ignore if called within 300ms (touch+click both fire)
    }
    lastTabChangeRef.current = now;
    
    setActiveTab(tab);
    setDrawerExpanded(true);
    
    // Scroll clicked tab into view - use 'auto' instead of 'smooth' for Safari touch compatibility
    const button = event.currentTarget;
    button.scrollIntoView({
      behavior: 'auto', // Changed from 'smooth' to fix Safari touch blocking
      block: 'nearest',
      inline: 'center'
    });
  };

  // Login handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Login failed');
      }

      const data = await response.json();
      setToken(data.token);
      setUsername(data.username);
      setCurrentUserRole(data.role || 'editor'); // Set role from login response
      setIsAuthenticated(true);
      fetchHotspots();
      fetchLogs();
      
      // Subscribe to push notifications for admin
      const initAdminPushNotifications = async () => {
        if (!isNotificationSupported()) {
          return;
        }

        const registration = await registerServiceWorker();
        if (!registration) {
          return;
        }

        const permission = getNotificationPermission();
        if (permission === 'granted') {
          // Decode JWT to get adminId (payload is base64 encoded)
          try {
            const tokenPayload = data.token.split('.')[1];
            const decoded = JSON.parse(atob(tokenPayload));
            const adminId = decoded.adminId;
            
            await subscribeToPush(registration, 'admin', adminId);
            console.log('[Push] Admin subscribed to push notifications');
          } catch (err) {
            console.error('[Push] Error subscribing admin:', err);
          }
        }
      };
      
      initAdminPushNotifications().catch((err) => {
        console.error('[Push] Error initializing admin push notifications:', err);
      });
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Login failed');
    }
  };

  // Logout handler
  const handleLogout = () => {
    removeToken();
    setIsAuthenticated(false);
    setCurrentUserRole('editor'); // Reset role to default on logout
    setHotspots([]);
    setLogs([]);
  };

  // Format log for display
  const formatLogDisplay = (log: AdminLog) => {
    // Extract title from details (only for Hotspot entity)
    const extractTitle = () => {
      if (log.entity === 'Hotspot' && log.details) {
        // Pattern: "Updated hotspot: Title" or "Created hotspot: Title (queue position: 1)" etc
        const match = log.details.match(/hotspot:\s*(.+?)(?:\s*\(|$)/i);
        if (match) return match[1];
      }
      return null;
    };

    // Get action text based on entity and action
    const getActionText = () => {
      if (log.entity === 'Hotspot') {
        if (log.action === 'CREATE') return 'CREATED';
        if (log.action === 'UPDATE') return 'UPDATED';
        if (log.action === 'DELETE') return 'DELETED';
      }
      
      // Generic fallback
      return log.action;
    };

    const title = extractTitle();
    const username = (log.username || 'UNKNOWN').toUpperCase();
    const actionText = getActionText();
    
    return {
      username,
      actionText,
      titleLine: title ? `${title} Ping` : null,
      timeLine: formatDate(log.timestamp)
    };
  };

  // Toggle notification subscription
  const toggleNotifications = async () => {
    if (!isNotificationSupported()) {
      showToast('Push notifications not supported on this device', 'error');
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      
      if (isNotificationSubscribed) {
        // Unsubscribe
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          await subscription.unsubscribe();
          setIsNotificationSubscribed(false);
          showToast('Push notifications disabled', 'success');
        }
      } else {
        // Subscribe
        const permission = getNotificationPermission();
        if (permission !== 'granted') {
          showToast('Please enable notifications in your browser settings', 'error');
          return;
        }

        const token = getToken();
        if (token) {
          const tokenPayload = token.split('.')[1];
          const decoded = JSON.parse(atob(tokenPayload));
          const adminId = decoded.adminId;
          
          await subscribeToPush(registration, 'admin', adminId);
          setIsNotificationSubscribed(true);
          showToast('Push notifications enabled', 'success');
        }
      }
    } catch (err) {
      console.error('[Push] Error toggling notifications:', err);
      showToast('Failed to toggle notifications', 'error');
    }
  };

  // Fetch hotspots (all, including inactive)
  const fetchHotspots = async () => {
    setHotspotsLoading(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
      
      const response = await fetch(`${API_URL}/api/hotspots?admin=true`, {
        headers: getAuthHeaders(),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        setHotspots(data);
        // preload balances for claimed hotspots with prizePublicKey
        const claimedWithWallet = data.filter((h: Hotspot) => h.claimStatus === 'claimed' && h.prizePublicKey);
        for (const h of claimedWithWallet) {
          if (h.prizePublicKey && walletBalances[h.prizePublicKey] === undefined) {
            fetchWalletBalance(h.prizePublicKey);
          }
        }
        
        // Auto-center map on active ping only on initial load
        if (!hasInitiallyLoaded) {
          // Find first active ping to center map on
          const firstActivePing = data.find((h: Hotspot) => h.active && h.claimStatus === 'unclaimed');
          if (firstActivePing && adminMapInstance) {
            // Use smooth pan animation instead of instant center
            adminMapInstance.panTo({ lat: firstActivePing.lat, lng: firstActivePing.lng });
          } else if (firstActivePing) {
            // Fallback if map not loaded yet
            setMapCenter({ lat: firstActivePing.lat, lng: firstActivePing.lng });
          }
          setHasInitiallyLoaded(true);
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        console.warn('Hotspots fetch timed out');
      } else {
        console.error('Failed to fetch hotspots:', err);
      }
    } finally {
      setHotspotsLoading(false);
    }
  };

  const fetchWalletBalance = async (pubkey: string) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const resp = await fetch(`${API_URL}/api/admin/wallet/balance?pubkey=${encodeURIComponent(pubkey)}`, {
        headers: getAuthHeaders(),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (resp.ok) {
        const json = await resp.json();
        setWalletBalances(prev => ({ ...prev, [pubkey]: json.balance }));
      }
    } catch (e) {
      console.error('Failed to fetch wallet balance:', e);
    }
  };

  // Fetch admin logs with pagination support
  const fetchLogs = async (offset: number = 0, append: boolean = false) => {
    setLogsLoading(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout
      
      const response = await fetch(`${API_URL}/api/admin/logs?limit=10&offset=${offset}`, {
        headers: getAuthHeaders(),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        // Handle both old format (array) and new format (object with logs array)
        const logsData = Array.isArray(data) ? data : data.logs;
        const hasMore = Array.isArray(data) ? false : data.hasMore;
        
        if (append) {
          setLogs(prev => [...prev, ...logsData]);
        } else {
          setLogs(logsData);
        }
        setLogsHasMore(hasMore);
        setLogsOffset(offset + logsData.length);
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        console.warn('Logs fetch timed out');
      } else {
        console.error('Failed to fetch logs:', err);
      }
    } finally {
      setLogsLoading(false);
    }
  };


  // Fetch pending claims
  const fetchPendingClaims = async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout
      
      const response = await fetch(`${API_URL}/api/admin/claims`, {
        headers: getAuthHeaders(),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        setPendingClaims(data);
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        console.warn('Pending claims fetch timed out - will retry on next poll');
      } else {
        console.error('Failed to fetch pending claims:', err);
      }
    }
  };

  // Approve a claim
  const handleApprove = async (hotspotId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/hotspots/${hotspotId}/approve`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error('Failed to approve claim');
      }

      // Add checkmark animation to the hotspot item
      const hotspotElement = document.querySelector(`[data-hotspot-id="${hotspotId}"]`) as HTMLElement;
      if (hotspotElement) {
        hotspotElement.classList.add('approving-complete');
        // Remove the item after animation completes
        setTimeout(() => {
          hotspotElement.remove();
        }, 1000);
      }

      showToast('Claim approved! Private key revealed to user.', 'success');
      fetchPendingClaims();
      fetchHotspots();
    } catch (err) {
      showToast(`Error: ${err instanceof Error ? err.message : 'Failed to approve claim'}`, 'error');
    }
  };

  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    });

    // Update preview marker when lat/lng changes manually
    if (name === 'lat' || name === 'lng') {
      const lat = name === 'lat' ? parseFloat(value) : formData.lat;
      const lng = name === 'lng' ? parseFloat(value) : formData.lng;
      if (!isNaN(lat) && !isNaN(lng)) {
        setPreviewMarker({ lat, lng });
      }
    }

    // Don't auto-center map when manually typing coordinates
    // (removed to prevent unwanted map jumping)
  };

  // Compress and optimize image
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      // Initial size check (before compression)
      if (file.size > 5 * 1024 * 1024) {
        reject(new Error('Image size must be less than 5MB'));
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          // Create canvas with 16:9 aspect ratio
          const targetWidth = 1920;
          const targetHeight = 1080; // 16:9 ratio
          
          const canvas = document.createElement('canvas');
          canvas.width = targetWidth;
          canvas.height = targetHeight;
          
          const ctx = canvas.getContext('2d')!;
          
          // Calculate dimensions to cover 16:9 area (crop if needed)
          const imgRatio = img.width / img.height;
          const targetRatio = targetWidth / targetHeight;
          
          let drawWidth = img.width;
          let drawHeight = img.height;
          let offsetX = 0;
          let offsetY = 0;
          
          if (imgRatio > targetRatio) {
            // Image is wider - crop sides
            drawWidth = img.height * targetRatio;
            offsetX = (img.width - drawWidth) / 2;
          } else {
            // Image is taller - crop top/bottom
            drawHeight = img.width / targetRatio;
            offsetY = (img.height - drawHeight) / 2;
          }
          
          // Draw image cropped to 16:9
          ctx.drawImage(
            img,
            offsetX, offsetY, drawWidth, drawHeight,
            0, 0, targetWidth, targetHeight
          );
          
          // Convert to WebP with compression
          const compressed = canvas.toDataURL('image/webp', 0.85);
          resolve(compressed);
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  // Handle image file selection
  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressed = await compressImage(file);
      setFormData({
        ...formData,
        imageUrl: compressed,
      });
      setImagePreview(compressed);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to process image', 'error');
    }
  };

  // Handle opening the form (from + card)
  const handleOpenForm = () => {
    // Show inline claim type selection (transitions from card)
    setShowClaimTypeSelection(true);
  };

  // Handle claim type selection
  const handleClaimTypeSelect = (type: 'nfc' | 'proximity') => {
    setShowClaimTypeSelection(false); // Hide selection UI
    setFormMode('create');
    setFormOpen(true);
    setSelectedHotspot(null);
    
    // Use pending map click coordinates if available, otherwise use map center
    const coords = pendingMapClickCoords || { lat: mapCenter.lat, lng: mapCenter.lng };
    
    // Reset form when opening new create form
    setFormData({
      title: '',
      lat: coords.lat,
      lng: coords.lng,
      prize: '',
      endDate: '',
      imageUrl: '',
      privateKey: '',
      hint1: '',
      hint2: '',
      hint3: '',
      hint1PriceUsd: '',
      hint2PriceUsd: '',
      hint3PriceUsd: '',
      claimType: type,
      proximityRadius: type === 'proximity' ? 5 : 5, // Default 5m for proximity
    });
    setImagePreview(null);
    
    // Clear pending coordinates after using them
    setPendingMapClickCoords(null);
    
    // Scroll to create form after state updates - use requestAnimationFrame
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        createFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  };

  // Handle map click to set location and open form
  const handleMapClickOpen = (lat: number, lng: number) => {
    // Store the clicked coordinates
    setPendingMapClickCoords({ lat, lng });
    
    // Show preview marker immediately
    setPreviewMarker({ lat, lng });
    
    // Center map on clicked location with smooth animation
    if (adminMapInstance) {
      adminMapInstance.panTo({ lat, lng });
    } else {
      // Fallback if map instance not ready
      setMapCenter({ lat, lng });
    }
    
    // Always switch to active tab and expand drawer (map click works from any tab)
    setActiveTab('active');
    setDrawerExpanded(true);
    
    // If form is not open, show inline claim type selection first
    if (!formOpen) {
      setShowClaimTypeSelection(true);
    } else {
      // If form is already open, just update coordinates
      setFormData({ ...formData, lat, lng });
    }
  };

  // Edit hotspot
  const handleEdit = (hotspot: Hotspot) => {
    setSelectedHotspot(hotspot);
    setFocusedHotspotId(hotspot.id); // Set as focused when editing (shows pulse)
    setFormMode('edit');
    setFormOpen(true);
    setActiveTab('active'); // Switch to active tab to show form
    setDrawerExpanded(true); // Expand drawer on mobile
    
    // Set preview marker when editing to show placeholder
    setPreviewMarker({ lat: hotspot.lat, lng: hotspot.lng });
    
    // Center map on the ping being edited with smooth animation
    if (adminMapInstance) {
      adminMapInstance.panTo({ lat: hotspot.lat, lng: hotspot.lng });
    } else {
      // Fallback if map instance not ready
      setMapCenter({ lat: hotspot.lat, lng: hotspot.lng });
    }
    
    // Check if endDate is far in future (>50 years = no expiration)
    const endDate = new Date(hotspot.endDate);
    const now = new Date();
    const yearsDiff = (endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 365);
    const hasExpiry = yearsDiff < 50;
    
    setFormData({
      title: hotspot.title,
      lat: hotspot.lat,
      lng: hotspot.lng,
      prize: hotspot.prize || '',
      endDate: hasExpiry ? hotspot.endDate.slice(0, 16) : '',
      imageUrl: hotspot.imageUrl || '',
      privateKey: '',
      hint1: hotspot.hint1 || '',
      hint2: hotspot.hint2 || '',
      hint3: hotspot.hint3 || '',
      hint1PriceUsd: hotspot.hint1PriceUsd || '',
      hint2PriceUsd: hotspot.hint2PriceUsd || '',
      hint3PriceUsd: hotspot.hint3PriceUsd || '',
      claimType: hotspot.claimType || 'nfc',
      proximityRadius: hotspot.proximityRadius || 5,
    });
    setImagePreview(hotspot.imageUrl || null);
    
    
    // Scroll to the hotspot item after state updates - use requestAnimationFrame
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const hotspotElement = document.getElementById(`hotspot-${hotspot.id}`);
        if (hotspotElement) {
          hotspotElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
  };

  // Save hotspot (create or update)
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    // Prevent double submission
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);
      const method = selectedHotspot ? 'PUT' : 'POST';
      const url = selectedHotspot 
        ? `${API_URL}/api/hotspots/${selectedHotspot.id}`
        : `${API_URL}/api/hotspots`;

      // Prepare payload: exclude endDate if no expiration set
      const payload: any = {
        title: formData.title,
        lat: parseFloat(formData.lat.toString()),
        lng: parseFloat(formData.lng.toString()),
        prize: formData.prize,
        imageUrl: formData.imageUrl,
        // Hint system fields
        hint1: formData.hint1 || null,
        hint2: formData.hint2 || null,
        hint3: formData.hint3 || null,
        hint1PriceUsd: formData.hint1PriceUsd === '' ? null : parseFloat(formData.hint1PriceUsd.toString()),
        hint2PriceUsd: formData.hint2PriceUsd === '' ? null : parseFloat(formData.hint2PriceUsd.toString()),
        hint3PriceUsd: formData.hint3PriceUsd === '' ? null : parseFloat(formData.hint3PriceUsd.toString()),
        // Proximity claim system fields (only on create, immutable on edit)
        ...(method === 'POST' ? {
          claimType: formData.claimType,
          proximityRadius: formData.claimType === 'proximity' ? parseFloat(formData.proximityRadius.toString()) : null,
        } : {
          // On edit, only allow proximityRadius update (claimType is immutable)
          ...(selectedHotspot?.claimType === 'proximity' ? {
            proximityRadius: parseFloat(formData.proximityRadius.toString()),
          } : {}),
        }),
      };

      // Only include endDate if expiration toggle is enabled
      if (formData.endDate) {
        payload.endDate = formData.endDate;
      }

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save hotspot');
      }

      // Clear preview marker and reset form
      setPreviewMarker(null);
      handleCancel();
      fetchHotspots();
      fetchLogs();
      showToast(selectedHotspot ? 'Hotspot updated!' : 'Hotspot created!', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save hotspot', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show delete confirmation
  const handleDeleteClick = (id: string) => {
    setDeletingHotspotId(id);
  };

  // Confirm delete
  const handleDeleteConfirm = async (id: string) => {
    try {
      const response = await fetch(`${API_URL}/api/hotspots/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error('Failed to delete hotspot');
      }

      // Add shrink-out animation to the hotspot item
      const hotspotElement = document.querySelector(`[data-hotspot-id="${id}"]`) as HTMLElement;
      if (hotspotElement) {
        hotspotElement.style.animation = 'shrinkOut 0.5s ease-out forwards';
        // Wait for animation to complete, then refresh list with updated queue positions
        setTimeout(() => {
          setDeletingHotspotId(null);
          fetchHotspots();
          fetchLogs();
          if (selectedHotspot?.id === id) {
            handleCancel();
          }
          showToast('PING deleted successfully', 'success');
        }, 500);
      } else {
        // If element not found, update immediately
        setDeletingHotspotId(null);
        fetchHotspots();
        fetchLogs();
        if (selectedHotspot?.id === id) {
          handleCancel();
        }
        showToast('PING deleted successfully', 'success');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete hotspot', 'error');
      setDeletingHotspotId(null);
    }
  };

  // Cancel delete
  const handleDeleteCancel = () => {
    setDeletingHotspotId(null);
  };

  // Cancel editing with smooth closing animation
  const handleCancel = () => {
    setFormClosing(true);
    
    // Clear preview marker immediately
    setPreviewMarker(null);
    
    // Clear pending map click coordinates
    setPendingMapClickCoords(null);
    
    // Hide claim type selection if showing
    setShowClaimTypeSelection(false);
    
    // Clear focused hotspot when canceling edit
    setFocusedHotspotId(null);
    
    // Wait for animation to complete before clearing state
    setTimeout(() => {
      setSelectedHotspot(null);
      setFormOpen(false);
      setFormMode('create');
      setImagePreview(null);
      setFormData({
        title: '',
        lat: 40.7128,
        lng: -74.0060,
        prize: '',
        endDate: '',
        imageUrl: '',
        privateKey: '',
        hint1: '',
        hint2: '',
        hint3: '',
        hint1PriceUsd: '',
        hint2PriceUsd: '',
        hint3PriceUsd: '',
        claimType: 'nfc',
        proximityRadius: 5,
      });
      // Don't reset map center - let user keep their current view
      setFormClosing(false);
    }, 300); // Match animation duration
  };

  // Copy PING URL to clipboard
  const handleCopyUrl = (id: string, url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    showToast('PING URL copied', 'success');
  };

  // Copy share link to clipboard
  const handleCopyShareLink = (hotspotId: string, shareToken: string | null) => {
    if (!shareToken) {
      showToast('Share link not available', 'error');
      return;
    }
    const shareUrl = `${window.location.origin}/share/${shareToken}`;
    navigator.clipboard.writeText(shareUrl);
    setCopiedShareId(hotspotId);
    setTimeout(() => setCopiedShareId(null), 2000);
    showToast('Share link copied', 'success');
  };

  // Center map on user's current location
  const centerOnCurrentLocation = () => {
    if (!adminMapInstance) return;
    
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const location = { lat: latitude, lng: longitude };
          setUserLocation(location); // Save location for marker
          adminMapInstance.panTo(location);
          adminMapInstance.setZoom(15);
          setFocusedHotspotId(null); // Clear focused hotspot since we're centering on user location
          showToast('Centered on your location', 'success');
        },
        () => {
          showToast('Unable to get your location. Please enable location services.', 'error');
        }
      );
    } else {
      showToast('Geolocation is not supported by your browser', 'error');
    }
  };

  // Center map on a specific hotspot
  const centerOnHotspot = (hotspot: Hotspot) => {
    if (adminMapInstance) {
      adminMapInstance.panTo({ lat: hotspot.lat, lng: hotspot.lng });
      adminMapInstance.setZoom(15);
      setFocusedHotspotId(hotspot.id); // Set as focused to show pulse
    }
  };

  // Fetch hint settings
  const fetchHintSettings = async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      
      const response = await fetch(`${API_URL}/api/admin/hints/settings`, {
        headers: getAuthHeaders(),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        setHintSettings({
          treasuryWallet: data.treasuryWallet || '',
          burnWallet: data.burnWallet || '',
          pingTokenMint: data.pingTokenMint || '',
          buyButtonUrl: data.buyButtonUrl || '',
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
      if (err instanceof Error && err.name === 'AbortError') {
        console.warn('Hint settings fetch timed out');
      } else {
        console.error('Failed to fetch hint settings:', err);
      }
    }
  };

  // Save hint settings
  const handleSaveHintSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_URL}/api/admin/hints/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(hintSettings),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save hint settings');
      }

      showToast('Hint settings updated successfully!', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save hint settings', 'error');
    }
  };

  // Fetch admin users
  const fetchAdminUsers = async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout
      
      const response = await fetch(`${API_URL}/api/admin/users`, {
        headers: getAuthHeaders(),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        setAdminUsers(data.users);
        setCurrentUserRole(data.currentUserRole);
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        console.warn('Admin users fetch timed out');
      } else {
        console.error('Failed to fetch admin users:', err);
      }
    }
  };

  // Create new admin user
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_URL}/api/admin/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(newUserForm),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create user');
      }

      showToast('User created successfully!', 'success');
      setNewUserForm({ username: '', password: '', role: 'editor' });
      setShowNewUserForm(false);
      fetchAdminUsers();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create user', 'error');
    }
  };

  // Update user role
  const handleUpdateRole = async (userId: string, newRole: 'admin' | 'editor') => {
    try {
      const response = await fetch(`${API_URL}/api/admin/users/${userId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ role: newRole }),
      });

      if (!response.ok) {
        throw new Error('Failed to update role');
      }

      showToast('Role updated successfully!', 'success');
      fetchAdminUsers();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update role', 'error');
    }
  };

  // Delete admin user
  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error('Failed to delete user');
      }

      showToast('User deleted successfully!', 'success');
      fetchAdminUsers();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete user', 'error');
    }
  };

  // Login view
  if (!isAuthenticated) {
    return (
      <div className="admin-page">
        {/* Map behind login */}
        <div className="admin-map-container">
          {isLoaded && (
            <GoogleMap
              center={mapCenter}
              zoom={13}
              mapContainerClassName="admin-map"
              options={{
                styles: customMapStyles,
                disableDefaultUI: false,
                zoomControl: true,
                mapTypeControl: false,
                streetViewControl: false,
                fullscreenControl: false,
                gestureHandling: 'greedy',
                clickableIcons: false,
              }}
            />
          )}
        </div>
        <div className="login-container">
          <div className="login-card">
            <h2>Admin Login</h2>
            <form onSubmit={handleLogin}>
              <div className="form-group">
                <label htmlFor="username">Username</label>
                <input
                  type="text"
                  id="username"
                  value={username}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label htmlFor="password">Password</label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              {loginError && <div className="error-message">{loginError}</div>}
              <button type="submit" className="login-btn">Login</button>
            </form>
            <a href="/" className="back-link">← Back to Map</a>
          </div>
        </div>
      </div>
    );
  }

  // Admin dashboard view
  return (
    <>
      {isAuthenticated && (
        <NotificationPrompt 
          userType="admin" 
          userId={(() => {
            try {
              const token = getToken();
              if (token) {
                const tokenPayload = token.split('.')[1];
                const decoded = JSON.parse(atob(tokenPayload));
                return decoded.adminId;
              }
            } catch (e) {
              console.error('[Admin] Error decoding admin ID:', e);
            }
            return undefined;
          })()}
        />
      )}
      <div className="admin-page">
        {/* Mobile Top Bar (logo + logout) */}
      <div className="mobile-top-bar">
        <img src="/logo/ping-logo.svg" alt="PING Logo" className="admin-logo" />
        <div className="header-actions">
          <button onClick={centerOnCurrentLocation} className="center-btn" aria-label="Center on current location">
            <LocateFixed size={24} />
          </button>
          <button onClick={toggleNotifications} className="center-btn" aria-label="Toggle notifications">
            {isNotificationSubscribed ? <BellOff size={24} /> : <Bell size={24} />}
          </button>
          <button onClick={handleLogout} className="logout-btn" aria-label="Logout">
            <LogOut size={24} />
          </button>
        </div>
      </div>

      {/* Full viewport map */}
      <div className="admin-map-container">
        {isLoaded && (
          <GoogleMap
            center={mapCenter}
            zoom={13}
            mapContainerClassName="admin-map"
            onLoad={(map) => {
              setAdminMapInstance(map);
            }}
            options={{
              styles: customMapStyles,
              disableDefaultUI: false,
              zoomControl: true,
              mapTypeControl: false,
              streetViewControl: false,
              fullscreenControl: true,
              gestureHandling: 'greedy',
              clickableIcons: false,
            }}
            onClick={(e) => {
              if (e.latLng) {
                e.stop(); // Prevent event propagation
                // Round to 6 decimal places (~11cm precision)
                const lat = Math.round(e.latLng.lat() * 1000000) / 1000000;
                const lng = Math.round(e.latLng.lng() * 1000000) / 1000000;
                handleMapClickOpen(lat, lng);
              }
            }}
          >
            {/* Show markers for ACTIVE unclaimed hotspots only */}
            {/* Hide the marker being edited when preview marker is showing */}
            {hotspots
              .filter(hotspot => hotspot.claimStatus !== 'claimed' && hotspot.active)
              .sort((a, b) => {
                // Sort by creation date (newest first)
                return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
              })
              .filter(hotspot => {
                // Hide the hotspot marker if it's being edited AND preview marker position differs from original
                // This way the original shows when editing starts, but hides when coordinates change
                if (formMode === 'edit' && selectedHotspot?.id === hotspot.id && previewMarker) {
                  // Only hide if preview marker position is different from original position
                  const previewLat = previewMarker.lat;
                  const previewLng = previewMarker.lng;
                  const originalLat = hotspot.lat;
                  const originalLng = hotspot.lng;
                  // Use small epsilon for floating point comparison
                  const epsilon = 0.000001;
                  if (Math.abs(previewLat - originalLat) > epsilon || Math.abs(previewLng - originalLng) > epsilon) {
                    return false; // Hide original marker when position has changed
                  }
                }
                return true;
              })
              .map((hotspot) => (
                <CustomMarker
                  key={hotspot.id}
                  position={{ lat: hotspot.lat, lng: hotspot.lng }}
                  isActive={hotspot.active}
                  onClick={() => handleEdit(hotspot)} // Open edit form on click
                  map={adminMapInstance || undefined}
                  claimType={hotspot.claimType || 'nfc'}
                  proximityRadius={hotspot.proximityRadius || null}
                  isFocused={focusedHotspotId === hotspot.id} // Pulse when focused (centered or being edited)
                />
              ))}
            
            {/* Preview marker for create mode - shows cursor style */}
            {previewMarker && formMode === 'create' && adminMapInstance && (
              <PreviewMarker
                position={previewMarker}
                map={adminMapInstance}
              />
            )}

            {/* Preview marker for edit mode - shows filled (NFC) or hollow (proximity) */}
            {previewMarker && formMode === 'edit' && selectedHotspot && adminMapInstance && (
              <EditPreviewMarker
                position={previewMarker}
                map={adminMapInstance}
                claimType={selectedHotspot.claimType || 'nfc'}
              />
            )}

            {/* User location marker */}
            {userLocation && adminMapInstance && (
              <UserLocationMarker
                position={userLocation}
                map={adminMapInstance}
              />
            )}
          </GoogleMap>
        )}
      </div>

      {/* Left Sidebar (Desktop) / Bottom Drawer (Mobile) */}
      <div className={`admin-sidebar ${drawerExpanded ? 'expanded' : ''}`}>
        {/* Desktop: Logo and Logout */}
        <div className="sidebar-header">
          <img src="/logo/ping-logo.svg" alt="PING Logo" className="admin-logo" />
          <div className="header-actions">
            <button onClick={centerOnCurrentLocation} className="center-btn" aria-label="Center on current location">
              <LocateFixed size={24} />
            </button>
            <button onClick={toggleNotifications} className="center-btn" aria-label="Toggle notifications">
              {isNotificationSubscribed ? <Bell size={24} /> : <BellOff size={24} />}
            </button>
            <button onClick={handleLogout} className="logout-btn" aria-label="Logout">
              <LogOut size={24} />
            </button>
          </div>
        </div>

        {/* Mobile drag handle */}
        <div className="drag-handle" onClick={() => {
          setDrawerExpanded(!drawerExpanded);
        }}>
          <div className="handle-bar"></div>
        </div>

        {/* Tabs */}
        <div className="admin-tabs" ref={tabsRef}>
          <button 
            className={`tab-btn ${activeTab === 'active' ? 'active' : ''}`}
            onClick={(e) => handleTabClick('active', e)}
            onTouchStart={(e) => handleTabClick('active', e)}
          >
            Active PINGs
          </button>
          <button 
            className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
            onClick={(e) => handleTabClick('history', e)}
            onTouchStart={(e) => handleTabClick('history', e)}
          >
            Claimed History
          </button>
          <button 
            className={`tab-btn ${activeTab === 'activity' ? 'active' : ''}`}
            onClick={(e) => handleTabClick('activity', e)}
            onTouchStart={(e) => handleTabClick('activity', e)}
          >
            Recent Activity
          </button>
          {currentUserRole === 'admin' && (
            <>
              <button 
                className={`tab-btn ${activeTab === 'access' ? 'active' : ''}`}
                onClick={(e) => handleTabClick('access', e)}
                onTouchStart={(e) => handleTabClick('access', e)}
              >
                Access Control
              </button>
              <button 
                className={`tab-btn ${activeTab === 'hints' ? 'active' : ''}`}
                onClick={(e) => handleTabClick('hints', e)}
                onTouchStart={(e) => handleTabClick('hints', e)}
              >
                General Settings
              </button>
            </>
          )}
        </div>

        {/* Tab Content */}
        <div className="sidebar-content">
          {/* Active PINGs Tab */}
          {activeTab === 'active' && (
            <div className="active-pings-content">
              {/* Show skeleton while loading */}
              {hotspotsLoading ? (
                <HotspotSkeletonList count={1} />
              ) : (
                <>
                  {/* Active/Queued PINGs List */}
                  {hotspots
                    .filter(h => h.claimStatus !== 'claimed')
                    .sort((a, b) => {
                      // Sort: active first, then by creation date (newest first)
                      if (a.active !== b.active) return a.active ? -1 : 1;
                      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
                    })
                    .map((hotspot, index) => {
                  const nfcUrl = `${window.location.origin}/ping/${hotspot.id}`;
                  const pendingClaim = pendingClaims.find(claim => claim.id === hotspot.id);
                  const hasPendingClaim = !!pendingClaim;
                  
                  // Toggle active status handler
                  const handleToggleActive = async (e: React.MouseEvent) => {
                    e.stopPropagation(); // Prevent triggering edit
                    const newActiveStatus = !hotspot.active;
                    try {
                      const response = await fetch(`${API_URL}/api/hotspots/${hotspot.id}`, {
                        method: 'PUT',
                        headers: {
                          'Content-Type': 'application/json',
                          ...getAuthHeaders(),
                        },
                        body: JSON.stringify({ active: newActiveStatus }),
                      });

                      if (!response.ok) {
                        throw new Error('Failed to update active status');
                      }

                      showToast(`Ping ${newActiveStatus ? 'activated' : 'deactivated'}`, 'success');
                      fetchHotspots();
                    } catch (err) {
                      showToast(err instanceof Error ? err.message : 'Failed to update status', 'error');
                    }
                  };
                  
                  return (
                    <div 
                      key={hotspot.id}
                      id={`hotspot-${hotspot.id}`}
                      data-hotspot-id={hotspot.id}
                      className={`hotspot-item ${hotspot.active ? 'active-hotspot' : 'inactive-hotspot'} ${hasPendingClaim ? 'pending-claim' : ''}`}
                      style={{ animationDelay: `${index * 0.1}s` }}
                    >
                      <div className="hotspot-header">
                        <div className="header-title-section">
                          <strong>{hotspot.title}</strong>
                          {hotspot.locationName && (
                            <div className="hotspot-location">
                              {hotspot.claimType === 'proximity' ? (
                                <Radio size={16} />
                              ) : (
                                <SmartphoneNfc size={16} />
                              )}
                              <span>{hotspot.locationName}</span>
                            </div>
                          )}
                        </div>
                        <div className="header-status-section">
                          {hasPendingClaim && (
                            <span className="status-badge badge-pending">Pending</span>
                          )}
                          <button
                            onClick={handleToggleActive}
                            className={`active-toggle ${hotspot.active ? 'active' : 'inactive'}`}
                            aria-label={hotspot.active ? 'Deactivate ping' : 'Activate ping'}
                            title={hotspot.active ? 'Click to deactivate' : 'Click to activate'}
                          >
                            <span className="toggle-slider"></span>
                          </button>
                        </div>
                      </div>
                      <div className="hotspot-footer">
                        <p className="hotspot-prize">
                          <Gift size={20} />
                          {hotspot.prize ? `${hotspot.prize} SOL` : '0 SOL'}
                        </p>
                        {/* Funding summary removed from footer per request */}
                        <div className="hotspot-actions">
                         <button
                           onClick={() => centerOnHotspot(hotspot)}
                           className="action-icon-btn"
                           aria-label="Center map on this ping"
                           title="Center map on this ping"
                         >
                           <LocateFixed size={18} />
                         </button>
                          {hotspot.shareToken && (
                            <button
                              onClick={() => handleCopyShareLink(hotspot.id, hotspot.shareToken || null)}
                              className="action-icon-btn"
                              aria-label={copiedShareId === hotspot.id ? 'Copied!' : 'Copy Share Link'}
                            >
                              {copiedShareId === hotspot.id ? <Check size={18} /> : <Share size={18} />}
                            </button>
                          )}
                          <button 
                            onClick={() => handleCopyUrl(hotspot.id, nfcUrl)} 
                            className="action-icon-btn"
                            aria-label={copiedId === hotspot.id ? 'Copied!' : 'Copy PING URL'}
                          >
                            {copiedId === hotspot.id ? <Check size={18} /> : <LinkIcon size={18} />}
                          </button>
                          {hotspot.prizePublicKey && (
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(hotspot.prizePublicKey!);
                                setCopiedWalletId(hotspot.id);
                                setTimeout(() => setCopiedWalletId(null), 1500);
                                showToast('Wallet address copied', 'success');
                              }}
                              className="action-icon-btn"
                              aria-label={copiedWalletId === hotspot.id ? 'Copied!' : 'Copy Wallet Address'}
                            >
                              {copiedWalletId === hotspot.id ? <Check size={18} /> : <WalletIcon size={18} />}
                            </button>
                          )}
                          {hotspot.claimStatus !== 'pending' && !hasPendingClaim && (
                            <button 
                              onClick={() => {
                                // If this hotspot's form is open, close it; otherwise open it
                                if (formOpen && formMode === 'edit' && selectedHotspot?.id === hotspot.id) {
                                  handleCancel();
                                } else {
                                  handleEdit(hotspot);
                                }
                              }} 
                              className="action-icon-btn" 
                              aria-label={formOpen && formMode === 'edit' && selectedHotspot?.id === hotspot.id ? 'Close Edit Form' : 'Edit PING'}
                            >
                              {formOpen && formMode === 'edit' && selectedHotspot?.id === hotspot.id ? <X size={18} /> : <SquarePen size={18} />}
                            </button>
                          )}
                          <button 
                            onClick={() => handleDeleteClick(hotspot.id)}
                            className="action-icon-btn"
                            aria-label="Delete PING"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>

                      {/* Delete Confirmation - Pops in from center */}
                      {deletingHotspotId === hotspot.id && (
                        <div className="delete-confirmation">
                          <div className="delete-confirmation-content">
                            <div className="delete-confirmation-buttons">
                              <button 
                                onClick={() => handleDeleteConfirm(hotspot.id)}
                                className="delete-confirm-btn"
                              >
                                Confirm Deletion
                              </button>
                              <button 
                                onClick={handleDeleteCancel}
                                className="delete-cancel-btn"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* Inline Pending Claim Details */}
                      {hasPendingClaim && pendingClaim && (
                        <div className="inline-claim-details">
                          <p><strong>Claimed by:</strong> {pendingClaim.claimedBy || 'Unknown'}</p>
                          <p><strong>Claimed at:</strong> {formatDate(pendingClaim.claimedAt || '')}</p>
                          {pendingClaim.tweetUrl && <p><strong>Tweet:</strong> Posted</p>}
                          <button
                            onClick={() => handleApprove(pendingClaim.id)}
                            className="approve-btn"
                          >
                            Approve Claim
                          </button>
                        </div>
                      )}
                      
                      {/* Inline Edit Form - Show under this hotspot if it's being edited */}
                      {formOpen && formMode === 'edit' && selectedHotspot?.id === hotspot.id && (
                        <div className={`inline-form-container inline-edit-form ${formClosing ? 'closing' : ''}`} style={{ marginTop: '15px' }}>
                          <form onSubmit={handleSave}>
                            {/* Proximity Radius Input (only for proximity pings in edit mode) */}
                            {selectedHotspot?.claimType === 'proximity' && (
                              <div className="form-group">
                                <label htmlFor="edit-proximityRadius">Proximity Radius (meters) *</label>
                                <input
                                  type="number"
                                  id="edit-proximityRadius"
                                  name="proximityRadius"
                                  value={formData.proximityRadius}
                                  onChange={handleInputChange}
                                  step="0.1"
                                  min="1"
                                  max="20"
                                  required
                                  disabled={selectedHotspot?.claimStatus === 'pending'}
                                />
                                <small className="form-hint">Users must be within this distance to claim (1-20 meters)</small>
                              </div>
                            )}

                            <div className="form-group">
                              <label htmlFor="edit-title">Title *</label>
                              <input
                                type="text"
                                id="edit-title"
                                name="title"
                                value={formData.title}
                                onChange={handleInputChange}
                                required
                              />
                            </div>

                            <div className="form-row">
                              <div className="form-group">
                                <label htmlFor="edit-lat">Latitude *</label>
                                <input
                                  type="number"
                                  id="edit-lat"
                                  name="lat"
                                  value={formData.lat}
                                  onChange={handleInputChange}
                                  step="0.000001"
                                  min="-90"
                                  max="90"
                                  required
                                  disabled={isSelectedPending}
                                />
                              </div>
                              <div className="form-group">
                                <label htmlFor="edit-lng">Longitude *</label>
                                <input
                                  type="number"
                                  id="edit-lng"
                                  name="lng"
                                  value={formData.lng}
                                  onChange={handleInputChange}
                                  step="0.000001"
                                  min="-180"
                                  max="180"
                                  required
                                  disabled={isSelectedPending}
                                />
                              </div>
                            </div>
                            
                            <div className="form-hint-map">
                              Tip: Click on the map to select location
                            </div>

                            <div className="form-group">
                              <label htmlFor="edit-prize">Prize (SOL) *</label>
                              <input
                                type="number"
                                id="edit-prize"
                                name="prize"
                                value={formData.prize}
                                onChange={handleInputChange}
                                step="0.01"
                                min="0"
                                placeholder="0.00"
                                autoComplete="off"
                                data-form-type="other"
                                required
                                disabled={isSelectedPending}
                              />
                            </div>

                            {/* Private key is auto-generated on creation and revealed on approval */}

                            <div className="form-group">
                              <label htmlFor="edit-endDate">Expiration Date & Time (Optional)</label>
                              <input
                                type="datetime-local"
                                id="edit-endDate"
                                name="endDate"
                                value={formData.endDate}
                                onChange={handleInputChange}
                                disabled={isSelectedPending}
                              />
                            </div>

                            <div className="form-group">
                              <label htmlFor="image-edit">PING Image</label>
                              {!imagePreview ? (
                                <div className="file-input-wrapper">
                                  <input
                                    type="file"
                                    id="image-edit"
                                    accept="image/*"
                                    onChange={handleImageChange}
                                    className="file-input"
                                  />
                                  <div className="file-input-card">
                                    <div className="plus-icon">+</div>
                                    <span>Add Image</span>
                                    <small className="form-hint">Max 2MB • JPG, PNG, GIF, WebP</small>
                                  </div>
                                </div>
                              ) : (
                                <div className="image-preview">
                                  <img src={imagePreview} alt="Preview" />
                                  <div className="image-actions">
                                    <button 
                                      type="button" 
                                      onClick={() => {
                                        const fileInput = document.getElementById('image-edit-replace') as HTMLInputElement;
                                        fileInput?.click();
                                      }}
                                      className="replace-image-btn"
                                      aria-label="Replace image"
                                    >
                                      <ImageUp size={40} />
                                    </button>
                                    <button 
                                      type="button" 
                                      onClick={() => {
                                        setImagePreview(null);
                                        setFormData({ ...formData, imageUrl: '' });
                                      }}
                                      className="remove-image-btn"
                                      aria-label="Remove image"
                                    >
                                      <Trash2 size={40} />
                                    </button>
                                  </div>
                                  <input
                                    type="file"
                                    id="image-edit-replace"
                                    accept="image/*"
                                    onChange={handleImageChange}
                                    style={{ display: 'none' }}
                                  />
                                </div>
                              )}
                            </div>

                            {/* Hints Section */}
                            <div className="hints-section">
                              <div className="hints-content">

                                  {/* Hint 1 */}
                                  <div className="hint-group">
                                    <label htmlFor="edit-hint1">Hint 1 (General Area)</label>
                                    <textarea
                                      id="edit-hint1"
                                      name="hint1"
                                      value={formData.hint1}
                                      onChange={handleInputChange}
                                      placeholder="e.g., Near the downtown library"
                                      rows={2}
                                    />
                                    <div className="hint-price-input">
                                      <label htmlFor="edit-hint1Price">Price (USD)</label>
                                      <input
                                        type="number"
                                        id="edit-hint1Price"
                                        name="hint1PriceUsd"
                                        value={formData.hint1PriceUsd}
                                        onChange={handleInputChange}
                                        placeholder="Leave empty to make Hint free"
                                        step="0.01"
                                        min="0"
                                      />
                                    </div>
                                  </div>

                                  {/* Hint 2 */}
                                  <div className="hint-group">
                                    <label htmlFor="edit-hint2">Hint 2 (Specific Location)</label>
                                    <textarea
                                      id="edit-hint2"
                                      name="hint2"
                                      value={formData.hint2}
                                      onChange={handleInputChange}
                                      placeholder="e.g., Third floor reading room"
                                      rows={2}
                                    />
                                    <div className="hint-price-input">
                                      <label htmlFor="edit-hint2Price">Price (USD)</label>
                                      <input
                                        type="number"
                                        id="edit-hint2Price"
                                        name="hint2PriceUsd"
                                        value={formData.hint2PriceUsd}
                                        onChange={handleInputChange}
                                        placeholder="Leave empty to make Hint free"
                                        step="0.01"
                                        min="0"
                                      />
                                    </div>
                                  </div>

                                  {/* Hint 3 */}
                                  <div className="hint-group">
                                    <label htmlFor="edit-hint3">Hint 3 (Exact Spot)</label>
                                    <textarea
                                      id="edit-hint3"
                                      name="hint3"
                                      value={formData.hint3}
                                      onChange={handleInputChange}
                                      placeholder="e.g., Behind the encyclopedias, section D"
                                      rows={2}
                                    />
                                    <div className="hint-price-input">
                                      <label htmlFor="edit-hint3Price">Price (USD)</label>
                                      <input
                                        type="number"
                                        id="edit-hint3Price"
                                        name="hint3PriceUsd"
                                        value={formData.hint3PriceUsd}
                                        onChange={handleInputChange}
                                        placeholder="Leave empty to make Hint free"
                                        step="0.01"
                                        min="0"
                                      />
                                    </div>
                                  </div>
                                </div>
                            </div>

                            <div className="form-actions">
                              <button type="submit" className="save-btn" disabled={isSelectedPending || isSubmitting}>
                                {isSubmitting ? 'Saving...' : 'Save Changes'}
                              </button>
                              <button type="button" className="cancel-btn" onClick={handleCancel}>
                                Cancel
                              </button>
                            </div>
                          </form>
                        </div>
                      )}
                    </div>
                  );
                })}

              {/* Add New PING Card / Claim Type Selection / Inline Form */}
              {!formOpen || formMode === 'edit' ? (
                // Show card if no selection UI, show selection UI if active
                !showClaimTypeSelection ? (
                  <div className="add-ping-card" onClick={handleOpenForm}>
                    <div className="plus-icon">+</div>
                    <span>Add New PING</span>
                  </div>
                ) : (
                  <div className={`inline-form-container claim-type-selection ${formClosing ? 'closing' : ''}`}>
                    <div className="claim-type-selection-header">
                      <h4>Choose PING Type</h4>
                      <button 
                        className="modal-close-btn" 
                        onClick={() => {
                          setShowClaimTypeSelection(false);
                          // Clear preview marker when closing claim type selection (only in create mode)
                          if (formMode === 'create') {
                            setPreviewMarker(null);
                            setPendingMapClickCoords(null);
                          }
                        }}
                        aria-label="Close"
                      >
                        <X size={20} />
                      </button>
                    </div>
                    <div className="claim-type-options">
                      <div 
                        className="claim-type-card" 
                        onClick={() => handleClaimTypeSelect('nfc')}
                      >
                        <div className="claim-type-icon">
                          <SmartphoneNfc size={50} />
                        </div>
                        <div className="claim-type-content">
                          <strong>NFC Card</strong>
                          <p>Physical NFC card that users tap to discover</p>
                        </div>
                      </div>
                      <div 
                        className="claim-type-card" 
                        onClick={() => handleClaimTypeSelect('proximity')}
                      >
                        <div className="claim-type-icon">
                          <Radio size={50} />
                        </div>
                        <div className="claim-type-content">
                          <strong>Proximity Based</strong>
                          <p>Location-based discovery using GPS</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              ) : (
                <div ref={createFormRef} className={`inline-form-container inline-create-form ${formClosing ? 'closing' : ''}`}>
                  <h4>Create New PING</h4>
                  <form onSubmit={handleSave}>
                    <div className="form-group">
                      <label htmlFor="title">Title *</label>
                      <input
                        type="text"
                        id="title"
                        name="title"
                        value={formData.title}
                        onChange={handleInputChange}
                        required
                      />
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label htmlFor="lat">Latitude *</label>
                        <input
                          type="number"
                          id="lat"
                          name="lat"
                          value={formData.lat}
                          onChange={handleInputChange}
                          step="0.000001"
                          min="-90"
                          max="90"
                          required
                          disabled={selectedHotspot?.claimStatus === 'pending'}
                        />
                      </div>
                      <div className="form-group">
                        <label htmlFor="lng">Longitude *</label>
                        <input
                          type="number"
                          id="lng"
                          name="lng"
                          value={formData.lng}
                          onChange={handleInputChange}
                          step="0.000001"
                          min="-180"
                          max="180"
                          required
                          disabled={selectedHotspot?.claimStatus === 'pending'}
                        />
                      </div>
                    </div>
                    
                    <div className="form-hint-map">
                      Tip: Click on the map to select location
                    </div>

                    {/* Proximity Radius Input (only for proximity pings) */}
                    {formData.claimType === 'proximity' && (
                      <div className="form-group">
                        <label htmlFor="proximityRadius">Proximity Radius (meters) *</label>
                        <input
                          type="number"
                          id="proximityRadius"
                          name="proximityRadius"
                          value={formData.proximityRadius}
                          onChange={handleInputChange}
                          step="0.1"
                          min="1"
                          max="20"
                          required
                          disabled={selectedHotspot?.claimStatus === 'pending'}
                        />
                        <small className="form-hint">Users must be within this distance to claim (1-20 meters)</small>
                      </div>
                    )}

                    <div className="form-group">
                      <label htmlFor="prize">Prize (SOL) *</label>
                      <input
                        type="number"
                        id="prize"
                        name="prize"
                        value={formData.prize}
                        onChange={handleInputChange}
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        autoComplete="off"
                        data-form-type="other"
                        required
                        disabled={selectedHotspot?.claimStatus === 'pending'}
                      />
                    </div>

                    {/* Private key is auto-generated on creation and revealed on approval */}

                    <div className="form-group">
                      <label htmlFor="endDate">Expiration Date & Time (Optional)</label>
                      <input
                        type="datetime-local"
                        id="endDate"
                        name="endDate"
                        value={formData.endDate}
                        onChange={handleInputChange}
                        disabled={selectedHotspot?.claimStatus === 'pending'}
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="image">PING Image</label>
                      {!imagePreview ? (
                        <div className="file-input-wrapper">
                          <input
                            type="file"
                            id="image"
                            accept="image/*"
                            onChange={handleImageChange}
                            className="file-input"
                          />
                          <div className="file-input-card">
                            <div className="plus-icon">+</div>
                            <span>Add Image</span>
                            <small className="form-hint">Max 2MB • JPG, PNG, GIF, WebP</small>
                          </div>
                        </div>
                      ) : (
                        <div className="image-preview">
                          <img src={imagePreview} alt="Preview" />
                          <div className="image-actions">
                            <button 
                              type="button" 
                              onClick={() => {
                                const fileInput = document.getElementById('image-replace') as HTMLInputElement;
                                fileInput?.click();
                              }}
                              className="replace-image-btn"
                              aria-label="Replace image"
                            >
                              <ImageUp size={40} />
                            </button>
                            <button 
                              type="button" 
                              onClick={() => {
                                setImagePreview(null);
                                setFormData({ ...formData, imageUrl: '' });
                              }}
                              className="remove-image-btn"
                              aria-label="Remove image"
                            >
                              <Trash2 size={40} />
                            </button>
                          </div>
                          <input
                            type="file"
                            id="image-replace"
                            accept="image/*"
                            onChange={handleImageChange}
                            style={{ display: 'none' }}
                          />
                        </div>
                      )}
                    </div>

                    {/* Hints Section */}
                    <div className="hints-section">
                      <div className="hints-content">

                          {/* Hint 1 */}
                          <div className="hint-group">
                            <label htmlFor="hint1">Hint 1 (General Area)</label>
                            <textarea
                              id="hint1"
                              name="hint1"
                              value={formData.hint1}
                              onChange={handleInputChange}
                              placeholder="e.g., Near the downtown library"
                              rows={2}
                            />
                            <div className="hint-price-input">
                              <label htmlFor="hint1Price">Price (USD)</label>
                              <input
                                type="number"
                                id="hint1Price"
                                name="hint1PriceUsd"
                                value={formData.hint1PriceUsd}
                                onChange={handleInputChange}
                                placeholder="Leave empty to make Hint free"
                                step="0.01"
                                min="0"
                              />
                            </div>
                          </div>

                          {/* Hint 2 */}
                          <div className="hint-group">
                            <label htmlFor="hint2">Hint 2 (Specific Location)</label>
                            <textarea
                              id="hint2"
                              name="hint2"
                              value={formData.hint2}
                              onChange={handleInputChange}
                              placeholder="e.g., Third floor reading room"
                              rows={2}
                            />
                            <div className="hint-price-input">
                              <label htmlFor="hint2Price">Price (USD)</label>
                              <input
                                type="number"
                                id="hint2Price"
                                name="hint2PriceUsd"
                                value={formData.hint2PriceUsd}
                                onChange={handleInputChange}
                                placeholder="Leave empty to make Hint free"
                                step="0.01"
                                min="0"
                              />
                            </div>
                          </div>

                          {/* Hint 3 */}
                          <div className="hint-group">
                            <label htmlFor="hint3">Hint 3 (Exact Spot)</label>
                            <textarea
                              id="hint3"
                              name="hint3"
                              value={formData.hint3}
                              onChange={handleInputChange}
                              placeholder="e.g., Behind the encyclopedias, section D"
                              rows={2}
                            />
                            <div className="hint-price-input">
                              <label htmlFor="hint3Price">Price (USD)</label>
                              <input
                                type="number"
                                id="hint3Price"
                                name="hint3PriceUsd"
                                value={formData.hint3PriceUsd}
                                onChange={handleInputChange}
                                placeholder="Leave empty to make Hint free"
                                step="0.01"
                                min="0"
                              />
                            </div>
                          </div>
                      </div>
                    </div>

                    <div className="form-actions">
                      <button type="submit" className="save-btn" disabled={isSubmitting}>
                        {isSubmitting ? 'Creating...' : 'Create PING'}
                      </button>
                      <button type="button" onClick={handleCancel} className="cancel-btn">
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )}
                </>
              )}
            </div>
          )}

          {/* Claimed History Tab */}
          {activeTab === 'history' && (
            <div className="history-content">
              {claimedLoading && claimedHotspots.length === 0 ? (
                <HotspotSkeletonList count={1} />
              ) : (
                <>
                  {claimedHotspots.map((hotspot, index) => (
                  <div key={hotspot.id} data-hotspot-id={hotspot.id} className="hotspot-item claimed-hotspot" style={{ animationDelay: `${index * 0.1}s` }}>
                    <div className="hotspot-header">
                      <div className="header-title-section">
                        <strong>{hotspot.title}</strong>
                        {hotspot.locationName && (
                          <div className="hotspot-location">
                            <MapPin size={12} />
                            <span>{hotspot.locationName}</span>
                          </div>
                        )}
                      </div>
                      <span className="status-badge badge-claimed">CLAIMED</span>
                    </div>
                    <div className="claim-details">
                      {/* Middle info group */}
                      <div className="claim-info-grid">
                        <p><strong>Claimed by:</strong> {hotspot.claimedBy || 'Unknown'}</p>
                        <p><strong>Claimed at:</strong> {hotspot.claimedAt ? formatDate(hotspot.claimedAt) : 'N/A'}</p>
                        <p>
                          <strong>Funding:</strong> {(hotspot.fundStatus || 'pending').toUpperCase()}
                          {hotspot.fundedAt && (
                            <> · {formatDate(hotspot.fundedAt)}</>
                          )}
                          {hotspot.fundTxSig && (
                            <> · <a href={`https://solscan.io/tx/${hotspot.fundTxSig}`} target="_blank" rel="noopener noreferrer">tx</a></>
                          )}
                        </p>
                        {hotspot.prizePublicKey && (
                          <p>
                            <strong>Wallet balance:</strong> <span>{walletBalances[hotspot.prizePublicKey] !== undefined ? `${walletBalances[hotspot.prizePublicKey].toFixed(1)} SOL` : '—'}</span>
                            <button 
                              className="action-icon-btn" 
                              onClick={() => hotspot.prizePublicKey && fetchWalletBalance(hotspot.prizePublicKey)}
                              aria-label="Refresh balance"
                            >
                              ↻
                            </button>
                          </p>
                        )}
                        {/* admin-only actions moved to footer as icon */}
                      </div>

                      {/* Bottom footer-like section */}
                      <div className="hotspot-footer">
                        <p className="hotspot-prize">
                          <Gift size={20} />
                          {hotspot.prize ? `${hotspot.prize} SOL` : '0 SOL'}
                        </p>
                        <div className="hotspot-actions">
                          {/* Copy Share Link */}
                          {hotspot.shareToken && (
                            <button
                              onClick={() => handleCopyShareLink(hotspot.id, hotspot.shareToken || null)}
                              className="action-icon-btn"
                              aria-label={copiedShareId === hotspot.id ? 'Copied!' : 'Copy Share Link'}
                            >
                              {copiedShareId === hotspot.id ? <Check size={18} /> : <Share size={18} />}
                            </button>
                          )}

                          {/* Copy PING URL */}
                          <button 
                            onClick={() => handleCopyUrl(hotspot.id, `${window.location.origin}/ping/${hotspot.id}`)} 
                            className="action-icon-btn"
                            aria-label={copiedId === hotspot.id ? 'Copied!' : 'Copy PING URL'}
                          >
                            {copiedId === hotspot.id ? <Check size={18} /> : <LinkIcon size={18} />}
                          </button>

                          {/* Tweet link */}
                          {hotspot.tweetUrl && (
                            <button
                              onClick={() => window.open(hotspot.tweetUrl!, '_blank')}
                              className="action-icon-btn"
                              aria-label="Open tweet"
                              title="Open tweet"
                            >
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path>
                              </svg>
                            </button>
                          )}

                          {/* Copy prize wallet (to the right of X) */}
                          {hotspot.prizePublicKey && (
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(hotspot.prizePublicKey!);
                                setCopiedWalletId(hotspot.id);
                                setTimeout(() => setCopiedWalletId(null), 1500);
                                showToast('Wallet address copied', 'success');
                              }}
                              className="action-icon-btn"
                              aria-label={copiedWalletId === hotspot.id ? 'Copied!' : 'Copy Wallet Address'}
                            >
                              {copiedWalletId === hotspot.id ? <Check size={18} /> : <WalletIcon size={18} />}
                            </button>
                          )}

                          {/* Copy private key (admin only) */}
                          {currentUserRole === 'admin' && (
                            <button
                              onClick={async (e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                
                                // Toggle: if already showing, close it
                                if (showingPrivateKeyId === hotspot.id) {
                                  setShowingPrivateKeyId(null);
                                  return;
                                }
                                
                                // If we already have the key cached, just show it
                                if (privateKeyData[hotspot.id]) {
                                  setShowingPrivateKeyId(hotspot.id);
                                  return;
                                }
                                
                                // Otherwise, fetch it
                                try {
                                  const r = await fetch(`${API_URL}/api/admin/hotspots/${hotspot.id}/key`, { headers: getAuthHeaders() });
                                  if (!r.ok) throw new Error('Failed to fetch key');
                                  const j = await r.json();
                                  if (j.privateKey) {
                                    setPrivateKeyData(prev => ({ ...prev, [hotspot.id]: j.privateKey }));
                                    setShowingPrivateKeyId(hotspot.id);
                                  } else {
                                    showToast('Private key not available', 'error');
                                  }
                                } catch (e) {
                                  showToast('Failed to fetch private key', 'error');
                                }
                              }}
                              onTouchStart={(e) => {
                                // On mobile, trigger click on touchstart for immediate response
                                e.currentTarget.click();
                                e.preventDefault();
                              }}
                              className="action-icon-btn"
                              aria-label={showingPrivateKeyId === hotspot.id ? 'Hide Private Key' : 'Show Private Key'}
                            >
                              {showingPrivateKeyId === hotspot.id ? <Unlock size={18} /> : <KeyRound size={18} />}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Private key expansion (admin only) */}
                      {currentUserRole === 'admin' && showingPrivateKeyId === hotspot.id && privateKeyData[hotspot.id] && (
                        <div className="private-key-expansion">
                          <div className="private-key-expansion-content">
                            <div className="private-key-input-container">
                              <p>PRIVATE KEY</p>
                              <div
                                className="private-key-display"
                                onClick={async () => {
                                  const key = privateKeyData[hotspot.id];
                                  let copySuccessful = false;
                                  
                                  // Try clipboard API first
                                  try {
                                    await navigator.clipboard.writeText(key);
                                    copySuccessful = true;
                                  } catch (clipboardErr) {
                                    // Fallback: create temporary textarea for execCommand
                                    try {
                                      const textarea = document.createElement('textarea');
                                      textarea.value = key;
                                      textarea.style.position = 'fixed';
                                      textarea.style.left = '0';
                                      textarea.style.top = '0';
                                      textarea.style.width = '2em';
                                      textarea.style.height = '2em';
                                      textarea.style.padding = '0';
                                      textarea.style.border = 'none';
                                      textarea.style.outline = 'none';
                                      textarea.style.boxShadow = 'none';
                                      textarea.style.background = 'transparent';
                                      textarea.style.opacity = '0';
                                      textarea.style.zIndex = '-1';
                                      document.body.appendChild(textarea);
                                      
                                      textarea.select();
                                      textarea.setSelectionRange(0, key.length);
                                      
                                      // For iOS Safari
                                      if (navigator.userAgent.match(/ipad|iphone/i)) {
                                        textarea.contentEditable = 'true';
                                        textarea.readOnly = false;
                                        const range = document.createRange();
                                        range.selectNodeContents(textarea);
                                        const selection = window.getSelection();
                                        selection?.removeAllRanges();
                                        selection?.addRange(range);
                                        textarea.setSelectionRange(0, 999999);
                                      }
                                      
                                      textarea.focus();
                                      copySuccessful = document.execCommand('copy');
                                      document.body.removeChild(textarea);
                                      
                                      if (!copySuccessful) {
                                        showToast('Failed to copy. Please try again.', 'error');
                                      }
                                    } catch (execErr) {
                                      showToast('Failed to copy. Please try again.', 'error');
                                    }
                                  }
                                  
                                  // If copy was successful, show the success message
                                  if (copySuccessful) {
                                    setCopiedPrivateKeyId(hotspot.id);
                                    setTimeout(() => {
                                      setCopiedPrivateKeyId(null);
                                    }, 2000);
                                  }
                                }}
                              >
                                {copiedPrivateKeyId === hotspot.id ? 'Private key copied to clipboard!' : privateKeyData[hotspot.id]}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                
                {/* Load More Button */}
                {claimedHasMore && (
                  <button
                    onClick={() => fetchClaimedHotspots(claimedOffset, true)}
                    className="load-more-btn"
                    disabled={claimedLoading}
                  >
                    {claimedLoading ? 'Loading...' : 'Load More'}
                  </button>
                )}
                
                {!claimedLoading && claimedHotspots.length === 0 && (
                  <p className="empty-message">No claimed PINGs yet.</p>
                )}
                </>
              )}
            </div>
          )}

          {/* Recent Activity Tab */}
          {activeTab === 'activity' && (
            <div className="activity-content">
              {logs.map((log) => {
                const formatted = formatLogDisplay(log);
                return (
                  <div key={log.id} className="log-item">
                    <div className="log-action-line">
                      <span className="log-username">{formatted.username}</span>{' '}
                      <span className="log-action">{formatted.actionText}</span>
                    </div>
                    {formatted.titleLine && (
                      <div className="log-title-line">{formatted.titleLine}</div>
                    )}
                    <div className="log-time-line">{formatted.timeLine}</div>
                  </div>
                );
              })}
              
              {/* Load More Button */}
              {logsHasMore && (
                <button
                  onClick={() => fetchLogs(logsOffset, true)}
                  className="load-more-btn"
                  disabled={logsLoading}
                >
                  {logsLoading ? 'Loading...' : 'Load More'}
                </button>
              )}
              
              {logs.length === 0 && !logsLoading && (
                <p className="empty-message">No activity yet.</p>
              )}
            </div>
          )}


          {/* General Settings Tab */}
          {activeTab === 'hints' && currentUserRole === 'admin' && (
            <div className="hint-settings-content">
              <form onSubmit={handleSaveHintSettings}>
                  {/* Social Media Links */}
                  <div className="settings-group">
                    <h4>Social Media Links</h4>
                    
                    {/* Pump.fun */}
                    <div className="form-group">
                      <label htmlFor="pump-fun-url">Pump.fun URL</label>
                      <input
                        type="url"
                        id="pump-fun-url"
                        value={hintSettings.pumpFunUrl}
                        onChange={(e) => setHintSettings({ ...hintSettings, pumpFunUrl: e.target.value })}
                        placeholder="https://pump.fun/..."
                      />
                    </div>

                    {/* X (Twitter) */}
                    <div className="form-group">
                      <label htmlFor="x-username">X (Twitter) Username</label>
                      <input
                        type="text"
                        id="x-username"
                        value={hintSettings.xUsername}
                        onChange={(e) => setHintSettings({ ...hintSettings, xUsername: e.target.value })}
                        placeholder="username (without @)"
                      />
                      <small className="form-hint">Will link to: https://x.com/{hintSettings.xUsername || 'username'}</small>
                    </div>

                    {/* Instagram */}
                    <div className="form-group">
                      <label htmlFor="instagram-username">Instagram Username</label>
                      <input
                        type="text"
                        id="instagram-username"
                        value={hintSettings.instagramUsername}
                        onChange={(e) => setHintSettings({ ...hintSettings, instagramUsername: e.target.value })}
                        placeholder="username (without @)"
                      />
                      <small className="form-hint">Will link to: https://instagram.com/{hintSettings.instagramUsername || 'username'}</small>
                    </div>

                    {/* TikTok */}
                    <div className="form-group">
                      <label htmlFor="tiktok-username">TikTok Username</label>
                      <input
                        type="text"
                        id="tiktok-username"
                        value={hintSettings.tiktokUsername}
                        onChange={(e) => setHintSettings({ ...hintSettings, tiktokUsername: e.target.value })}
                        placeholder="username (without @)"
                      />
                      <small className="form-hint">Will link to: https://tiktok.com/@{hintSettings.tiktokUsername || 'username'}</small>
                    </div>
                  </div>

                  {/* Buy Button Configuration */}
                  <div className="settings-group">
                    <h4>Buy Button Configuration</h4>
                    <div className="form-group">
                      <label htmlFor="buy-button-url">Buy Button URL</label>
                      <input
                        type="url"
                        id="buy-button-url"
                        value={hintSettings.buyButtonUrl}
                        onChange={(e) => setHintSettings({ ...hintSettings, buyButtonUrl: e.target.value })}
                        placeholder="https://pump.fun/..."
                      />
                      <small className="form-hint">Used for "BUY $PING" button in hint modal</small>
                    </div>
                  </div>

                  {/* Wallet & Token Configuration */}
                  <div className="settings-group">
                    <h4>Wallet & Token Configuration</h4>
                    <div className="form-group">
                      <label htmlFor="treasury-wallet-hints">Treasury Wallet Address</label>
                      <input
                        type="text"
                        id="treasury-wallet-hints"
                        value={hintSettings.treasuryWallet}
                        onChange={(e) => setHintSettings({ ...hintSettings, treasuryWallet: e.target.value })}
                        placeholder="Solana wallet address (receives 50%)"
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="burn-wallet-hints">Burn Wallet Address</label>
                      <input
                        type="text"
                        id="burn-wallet-hints"
                        value={hintSettings.burnWallet}
                        onChange={(e) => setHintSettings({ ...hintSettings, burnWallet: e.target.value })}
                        placeholder="Solana wallet address (receives 50% for manual burning)"
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="ping-token-mint-hints">$PING Token Mint Address</label>
                      <input
                        type="text"
                        id="ping-token-mint-hints"
                        value={hintSettings.pingTokenMint}
                        onChange={(e) => setHintSettings({ ...hintSettings, pingTokenMint: e.target.value })}
                        placeholder="SPL Token mint address for $PING"
                      />
                    </div>
                  </div>

                  <button type="submit" className="save-btn">
                    Save General Settings
                  </button>
              </form>
            </div>
          )}

          {/* Access Control Tab */}
          {activeTab === 'access' && currentUserRole === 'admin' && (
            <div className="access-control-content">
              {/* New User Form */}
              {showNewUserForm && (
                <div className="new-user-form">
                  <form onSubmit={handleCreateUser}>
                    <div className="form-group">
                      <label htmlFor="new-username">Username *</label>
                      <input
                        type="text"
                        id="new-username"
                        value={newUserForm.username}
                        onChange={(e) => setNewUserForm({...newUserForm, username: e.target.value})}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="new-password">Password *</label>
                      <input
                        type="password"
                        id="new-password"
                        value={newUserForm.password}
                        onChange={(e) => setNewUserForm({...newUserForm, password: e.target.value})}
                        required
                        minLength={6}
                      />
                      <small className="form-hint">Minimum 6 characters</small>
                    </div>
                    <div className="form-group">
                      <label htmlFor="new-role">Role *</label>
                      <select
                        id="new-role"
                        value={newUserForm.role}
                        onChange={(e) => setNewUserForm({...newUserForm, role: e.target.value as 'admin' | 'editor'})}
                      >
                        <option value="editor">Editor</option>
                        <option value="admin">Admin</option>
                      </select>
                      <small className="form-hint">
                        <strong>Editor:</strong> Can manage PINGs only<br/>
                        <strong>Admin:</strong> Full access including user management
                      </small>
                    </div>
                    <div className="form-actions">
                      <button type="submit" className="save-btn">Create User</button>
                      <button type="button" onClick={() => setShowNewUserForm(false)} className="cancel-btn">Cancel</button>
                    </div>
                  </form>
                </div>
              )}

              {/* Admin Users List */}
              <div className="admin-users-list">
                {adminUsers.map((user) => (
                  <div key={user.id} className="user-item">
                    <div className="user-info">
                      <strong>{user.username}</strong>
                      <div className="role-toggle">
                        <button
                          className={`role-option ${user.role === 'editor' ? 'active' : ''}`}
                          onClick={() => handleUpdateRole(user.id, 'editor')}
                        >
                          Editor
                        </button>
                        <button
                          className={`role-option ${user.role === 'admin' ? 'active' : ''}`}
                          onClick={() => handleUpdateRole(user.id, 'admin')}
                        >
                          Admin
                        </button>
                      </div>
                    </div>
                    <div className="user-actions">
                      <button 
                        onClick={() => handleDeleteUser(user.id)} 
                        className="action-icon-btn"
                        aria-label="Delete User"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}
                {adminUsers.length === 0 && (
                  <p className="empty-message">No users found.</p>
                )}
                
                {/* Add New User Card - At Bottom */}
                {!showNewUserForm && (
                  <div className="add-user-card" onClick={() => setShowNewUserForm(true)}>
                    <h3>+ Add New User</h3>
                    <p>Click to create a new admin user</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Footer: Drag Handle + Tabs Combined */}
      <div className="mobile-footer">
        {/* Drag Handle */}
        <div className="mobile-drag-handle" onClick={() => {
          setDrawerExpanded(!drawerExpanded);
        }}>
          <div className="handle-bar"></div>
        </div>

        {/* Mobile Tabs */}
        <div className="admin-tabs mobile-tabs" ref={mobileTabsRef}>
          <button 
            className={`tab-btn ${activeTab === 'active' ? 'active' : ''}`}
            onClick={(e) => handleTabClick('active', e)}
            onTouchStart={(e) => handleTabClick('active', e)}
          >
            Active PINGs
          </button>
          <button 
            className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
            onClick={(e) => handleTabClick('history', e)}
            onTouchStart={(e) => handleTabClick('history', e)}
          >
            Claimed History
          </button>
          <button 
            className={`tab-btn ${activeTab === 'activity' ? 'active' : ''}`}
            onClick={(e) => handleTabClick('activity', e)}
            onTouchStart={(e) => handleTabClick('activity', e)}
          >
            Recent Activity
          </button>
          {currentUserRole === 'admin' && (
            <>
              <button 
                className={`tab-btn ${activeTab === 'access' ? 'active' : ''}`}
                onClick={(e) => handleTabClick('access', e)}
                onTouchStart={(e) => handleTabClick('access', e)}
              >
                Access Control
              </button>
              <button 
                className={`tab-btn ${activeTab === 'hints' ? 'active' : ''}`}
                onClick={(e) => handleTabClick('hints', e)}
                onTouchStart={(e) => handleTabClick('hints', e)}
              >
                General Settings
              </button>
            </>
          )}
        </div>
      </div>

    </div>
    </>
  );
}

// AdminPage no longer needs its own ToastProvider wrapper since App.tsx wraps everything
export default AdminPage;

