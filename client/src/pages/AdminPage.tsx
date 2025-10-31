/// <reference types="vite/client" />
import { useState, useEffect, useRef } from 'react';
import { GoogleMap, useJsApiLoader } from '@react-google-maps/api';
import { LogOut, SquarePen, Check, Trash2, MapPin, Gift, X, ImageUp, LocateFixed, Link as LinkIcon, Wallet as WalletIcon, KeyRound } from 'lucide-react';
import { Hotspot, AdminLog } from '../types';
import { getToken, setToken, removeToken, setUsername, getAuthHeaders } from '../utils/auth';
import { formatDate } from '../utils/time';
import { customMapStyles } from '../utils/mapStyles';
import { CustomMarker } from '../components/CustomMarker';
import { HotspotSkeletonList } from '../components/HotspotSkeleton';
import { ToastProvider, useToast } from '../components/Toast';
import './AdminPage.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

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
  });

  const [pendingClaims, setPendingClaims] = useState<Hotspot[]>([]);
  const [activeTab, setActiveTab] = useState<'active' | 'history' | 'activity' | 'access' | 'hints'>('active');
  const [currentUserRole, setCurrentUserRole] = useState<'admin' | 'editor'>('editor'); // Default to editor, will be updated by API
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [drawerExpanded, setDrawerExpanded] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedWalletId, setCopiedWalletId] = useState<string | null>(null);
  const [copiedPrivateId, setCopiedPrivateId] = useState<string | null>(null);
  const [formClosing, setFormClosing] = useState(false);
  const [previewMarker, setPreviewMarker] = useState<{ lat: number; lng: number } | null>(null);
  const [showingPrivateKeyId, setShowingPrivateKeyId] = useState<string | null>(null);
  const [privateKeyData, setPrivateKeyData] = useState<Record<string, string>>({});
  const privateKeyTextareaRef = useRef<HTMLTextAreaElement>(null);
  
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

  // Auto-select private key textarea when expanded
  useEffect(() => {
    if (showingPrivateKeyId && privateKeyTextareaRef.current) {
      setTimeout(() => {
        privateKeyTextareaRef.current?.focus();
        privateKeyTextareaRef.current?.select();
      }, 100);
    }
  }, [showingPrivateKeyId]);

  useEffect(() => {
    if (getToken()) {
      setIsAuthenticated(true);
      
      // Load data sequentially with priority to avoid overwhelming server
      const loadData = async () => {
        // 1. Load critical data first (main content)
        await fetchHotspots();
        
        // 2. Load secondary data in parallel
        await Promise.all([
          fetchLogs(),
          fetchAdminUsers(),
          fetchHintSettings()
        ]);
        
        // 3. Load polling data last (will refresh via interval anyway)
        fetchPendingClaims();
      };
      
      loadData();
    }
  }, []);

  // Poll for pending claims every 30 seconds (reduced from 10s)
  useEffect(() => {
    if (isAuthenticated) {
      const interval = setInterval(fetchPendingClaims, 30000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

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
          const activePing = data.find((h: Hotspot) => h.claimStatus === 'unclaimed' && h.queuePosition === 1);
          if (activePing && adminMapInstance) {
            // Use smooth pan animation instead of instant center
            adminMapInstance.panTo({ lat: activePing.lat, lng: activePing.lng });
          } else if (activePing) {
            // Fallback if map not loaded yet
            setMapCenter({ lat: activePing.lat, lng: activePing.lng });
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

  // Fetch admin logs
  const fetchLogs = async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout
      
      const response = await fetch(`${API_URL}/api/admin/logs`, {
        headers: getAuthHeaders(),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        setLogs(data);
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        console.warn('Logs fetch timed out');
      } else {
        console.error('Failed to fetch logs:', err);
      }
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
    setFormMode('create');
    setFormOpen(true);
    setSelectedHotspot(null);
    // Reset form when opening new create form
    setFormData({
      title: '',
      lat: mapCenter.lat,
      lng: mapCenter.lng,
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
    });
    setImagePreview(null);
    
    // Scroll to create form after state updates - use requestAnimationFrame
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        createFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  };

  // Handle map click to set location and open form
  const handleMapClickOpen = (lat: number, lng: number) => {
    // Show preview marker immediately
    setPreviewMarker({ lat, lng });
    
    // Center map on clicked location with smooth animation
    if (adminMapInstance) {
      adminMapInstance.panTo({ lat, lng });
    } else {
      // Fallback if map instance not ready
      setMapCenter({ lat, lng });
    }
    
    // Only update form data, don't move the map center
    setFormData({ ...formData, lat, lng });
    
    // Always switch to active tab and expand drawer (map click works from any tab)
    setActiveTab('active');
    setDrawerExpanded(true);
    
    // If form is not open, open it in create mode
    if (!formOpen) {
      setFormMode('create');
      setFormOpen(true);
      setSelectedHotspot(null);
      
      // Scroll to create form after state updates - use requestAnimationFrame
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          createFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      });
    }
  };

  // Edit hotspot
  const handleEdit = (hotspot: Hotspot) => {
    setSelectedHotspot(hotspot);
    setFormMode('edit');
    setFormOpen(true);
    setActiveTab('active'); // Switch to active tab to show form
    setDrawerExpanded(true); // Expand drawer on mobile
    
    // Show preview marker at hotspot location
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

    try {
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

  // Center map on active ping
  const centerOnActivePing = () => {
    const activePing = hotspots.find(h => h.claimStatus === 'unclaimed' && h.queuePosition === 1);
    if (activePing && adminMapInstance) {
      // Use smooth pan animation
      adminMapInstance.panTo({ lat: activePing.lat, lng: activePing.lng });
      adminMapInstance.setZoom(15); // Zoom in for better view
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
        <div className="login-container">
          <div className="login-card">
            <h2>🔐 Admin Login</h2>
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
    <div className="admin-page">
      {/* Mobile Top Bar (logo + logout) */}
      <div className="mobile-top-bar">
        <img src="/logo/ping-logo.svg" alt="PING Logo" className="admin-logo" />
        <div className="header-actions">
          <button onClick={centerOnActivePing} className="center-btn" aria-label="Center on Active PING">
            <LocateFixed size={24} />
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
            {/* Show markers only for active and queued (unclaimed) hotspots */}
            {hotspots
              .filter(hotspot => hotspot.claimStatus !== 'claimed')
              .sort((a, b) => (a.queuePosition || 0) - (b.queuePosition || 0)) // Sort by queue position
              .map((hotspot, index) => (
                <CustomMarker
                  key={hotspot.id}
                  position={{ lat: hotspot.lat, lng: hotspot.lng }}
                  isActive={index === 0} // First in queue is active
                  onClick={() => handleEdit(hotspot)} // Open edit form on click
                  map={adminMapInstance || undefined}
                />
              ))}
            
            {/* Preview marker for create/edit mode */}
            {previewMarker && (
              <CustomMarker
                position={previewMarker}
                isActive={false}
                onClick={() => {}} // No action on preview marker
                map={adminMapInstance || undefined}
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
            <button onClick={centerOnActivePing} className="center-btn" aria-label="Center on Active PING">
              <LocateFixed size={24} />
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
                    .sort((a, b) => (a.queuePosition || 0) - (b.queuePosition || 0))
                    .map((hotspot, index) => {
                  const nfcUrl = `${window.location.origin}/ping/${hotspot.id}`;
                  const isActive = index === 0; // First item is active
                  const displayPosition = index + 1; // Display position: 1, 2, 3, etc.
                  const pendingClaim = pendingClaims.find(claim => claim.id === hotspot.id);
                  const hasPendingClaim = !!pendingClaim;
                  
                  return (
                    <div 
                      key={hotspot.id}
                      id={`hotspot-${hotspot.id}`}
                      data-hotspot-id={hotspot.id}
                      className={`hotspot-item ${isActive ? 'active-hotspot' : 'queued-hotspot'} ${hasPendingClaim ? 'pending-claim' : ''}`}
                      style={{ animationDelay: `${index * 0.1}s` }}
                    >
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
                        <span className={`status-badge ${hasPendingClaim ? 'badge-pending' : (isActive ? 'badge-active' : 'badge-queued')}`}>
                          {hasPendingClaim ? 'Pending' : (isActive ? 'Active' : `Queue #${displayPosition}`)}
                        </span>
                      </div>
                      <div className="hotspot-footer">
                        <p className="hotspot-prize">
                          <Gift size={20} />
                          {hotspot.prize ? `${hotspot.prize} SOL` : 'N/A'}
                        </p>
                        {/* Funding summary removed from footer per request */}
                        <div className="hotspot-actions">
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
                              <button type="submit" className="save-btn" disabled={isSelectedPending}>
                                Save Changes
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

              {/* Add New PING Card / Inline Form - Only show for create mode */}
              {!formOpen || formMode === 'edit' ? (
                <div className="add-ping-card" onClick={handleOpenForm}>
                  <div className="plus-icon">+</div>
                  <span>Add New PING</span>
                </div>
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
                      <button type="submit" className="save-btn">
                        Create PING
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
              {hotspotsLoading ? (
                <HotspotSkeletonList count={1} />
              ) : (
                hotspots
                  .filter(h => h.claimStatus === 'claimed')
                  .sort((a, b) => {
                    // Sort by claimedAt date, most recent first
                    const dateA = a.claimedAt ? new Date(a.claimedAt).getTime() : 0;
                    const dateB = b.claimedAt ? new Date(b.claimedAt).getTime() : 0;
                    return dateB - dateA;
                  })
                  .map((hotspot, index) => (
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
                        {hotspot.prizePublicKey && (
                          <p>
                            <strong>Balance:</strong> {walletBalances[hotspot.prizePublicKey] !== undefined ? `${walletBalances[hotspot.prizePublicKey].toFixed(1)} SOL` : '—'}
                            <button 
                              className="action-icon-btn" 
                              style={{ marginLeft: 8, verticalAlign: 'baseline' }} 
                              onClick={() => hotspot.prizePublicKey && fetchWalletBalance(hotspot.prizePublicKey)}
                              aria-label="Refresh balance"
                            >
                              ↻
                            </button>
                          </p>
                        )}
                        <p>
                          <strong>Funding:</strong> {(hotspot.fundStatus || 'pending').toUpperCase()}
                          {hotspot.fundedAt && (
                            <> · {formatDate(hotspot.fundedAt)}</>
                          )}
                          {hotspot.fundTxSig && (
                            <> · <a href={`https://solscan.io/tx/${hotspot.fundTxSig}`} target="_blank" rel="noopener noreferrer">tx</a></>
                          )}
                        </p>
                        {/* admin-only actions moved to footer as icon */}
                      </div>

                      {/* Bottom footer-like section */}
                      <div className="hotspot-footer">
                        <p className="hotspot-prize">
                          <Gift size={20} />
                          {hotspot.prize ? `${hotspot.prize} SOL` : 'N/A'}
                        </p>
                        <div className="hotspot-actions">
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
                              onClick={async () => {
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
                              className="action-icon-btn"
                              aria-label={showingPrivateKeyId === hotspot.id ? 'Hide Private Key' : 'Show Private Key'}
                            >
                              {showingPrivateKeyId === hotspot.id ? <Check size={18} /> : <KeyRound size={18} />}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Private key expansion (admin only) */}
                      {currentUserRole === 'admin' && showingPrivateKeyId === hotspot.id && privateKeyData[hotspot.id] && (
                        <div className="private-key-expansion">
                          <div className="private-key-expansion-content">
                            <p style={{ marginBottom: '10px', fontSize: '0.9rem', color: '#ccc' }}>
                              Private Key (base58) — Tap and hold to select, then copy:
                            </p>
                            <textarea
                              ref={privateKeyTextareaRef}
                              value={privateKeyData[hotspot.id]}
                              readOnly
                              className="private-key-textarea-expanded"
                              onClick={(e) => {
                                (e.target as HTMLTextAreaElement).select();
                              }}
                              onFocus={(e) => {
                                e.target.select();
                              }}
                            />
                            <div className="private-key-expansion-buttons">
                              <button
                                className="private-key-close-btn"
                                onClick={() => setShowingPrivateKeyId(null)}
                              >
                                Close
                              </button>
                              <button
                                className="private-key-copy-expanded-btn"
                                onClick={async () => {
                                  if (privateKeyTextareaRef.current) {
                                    privateKeyTextareaRef.current.select();
                                    try {
                                      await navigator.clipboard.writeText(privateKeyData[hotspot.id]);
                                      setCopiedPrivateId(hotspot.id);
                                      setTimeout(() => setCopiedPrivateId(null), 1500);
                                      showToast('Private key copied', 'success');
                                    } catch (e) {
                                      showToast('Text selected - tap to copy manually', 'info');
                                    }
                                  }
                                }}
                              >
                                Copy to Clipboard
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
              {!hotspotsLoading && hotspots.filter(h => h.claimStatus === 'claimed').length === 0 && (
                <p className="empty-message">No claimed PINGs yet.</p>
              )}
            </div>
          )}

          {/* Recent Activity Tab */}
          {activeTab === 'activity' && (
            <div className="activity-content">
              {logs.map((log) => (
                <div key={log.id} className="log-item">
                  <span className="log-action">{log.action}</span>
                  <span className="log-details">{log.details || `${log.entity} ${log.entityId}`}</span>
                  <span className="log-time">{formatDate(log.timestamp)}</span>
                </div>
              ))}
              {logs.length === 0 && (
                <p className="empty-message">No activity yet.</p>
              )}
            </div>
          )}


          {/* General Settings Tab */}
          {activeTab === 'hints' && currentUserRole === 'admin' && (
            <div className="hint-settings-content">
              <h3>General Settings</h3>
              <form onSubmit={handleSaveHintSettings}>
                  {/* Social Media Links */}
                  <div className="settings-group">
                    <h4>Social Media Links</h4>
                    
                    {/* Pump.fun */}
                    <div className="toggle-field">
                      <div className="toggle-label">
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
                      </div>
                      <label className="toggle-switch">
                        <input
                          type="checkbox"
                          checked={hintSettings.pumpFunEnabled}
                          onChange={(e) => setHintSettings({ ...hintSettings, pumpFunEnabled: e.target.checked })}
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>

                    {/* X (Twitter) */}
                    <div className="toggle-field">
                      <div className="toggle-label">
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
                      </div>
                      <label className="toggle-switch">
                        <input
                          type="checkbox"
                          checked={hintSettings.xEnabled}
                          onChange={(e) => setHintSettings({ ...hintSettings, xEnabled: e.target.checked })}
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>

                    {/* Instagram */}
                    <div className="toggle-field">
                      <div className="toggle-label">
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
                      </div>
                      <label className="toggle-switch">
                        <input
                          type="checkbox"
                          checked={hintSettings.instagramEnabled}
                          onChange={(e) => setHintSettings({ ...hintSettings, instagramEnabled: e.target.checked })}
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>

                    {/* TikTok */}
                    <div className="toggle-field">
                      <div className="toggle-label">
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
                      <label className="toggle-switch">
                        <input
                          type="checkbox"
                          checked={hintSettings.tiktokEnabled}
                          onChange={(e) => setHintSettings({ ...hintSettings, tiktokEnabled: e.target.checked })}
                        />
                        <span className="toggle-slider"></span>
                      </label>
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
  );
}

// Wrap AdminPage with ToastProvider
const AdminPageWithToast = () => {
  return (
    <ToastProvider>
      <AdminPage />
    </ToastProvider>
  );
};

export default AdminPageWithToast;

