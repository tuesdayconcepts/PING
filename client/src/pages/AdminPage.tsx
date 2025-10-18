/// <reference types="vite/client" />
import { useState, useEffect } from 'react';
import { GoogleMap, useJsApiLoader } from '@react-google-maps/api';
import { LogOut, SquarePen, Copy, Check, Trash2, MapPin, Gift } from 'lucide-react';
import { Hotspot, AdminLog } from '../types';
import { getToken, setToken, removeToken, setUsername, getAuthHeaders } from '../utils/auth';
import { formatDate } from '../utils/time';
import { getLocationName } from '../utils/geocoding';
import { customMapStyles } from '../utils/mapStyles';
import { CustomMarker } from '../components/CustomMarker';
import './AdminPage.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

function AdminPage() {
  // Load Google Maps API
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
  });

  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsernameInput] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  
  // Data state
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [selectedHotspot, setSelectedHotspot] = useState<Hotspot | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    title: '',
    lat: 40.7128,
    lng: -74.0060,
    prize: '' as string | number, // Number for prize amount in SOL
    endDate: '',
    active: true,
    imageUrl: '',
    privateKey: '',
  });

  const [hasExpiration, setHasExpiration] = useState(false);
  const [pendingClaims, setPendingClaims] = useState<Hotspot[]>([]);
  const [activeTab, setActiveTab] = useState<'active' | 'history' | 'activity' | 'access'>('active');
  const [currentUserRole, setCurrentUserRole] = useState<'admin' | 'editor'>('editor'); // Default to editor, will be updated by API
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [drawerExpanded, setDrawerExpanded] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  // Access Control state
  const [adminUsers, setAdminUsers] = useState<Array<{id: string, username: string, role: 'admin' | 'editor', createdAt: string}>>([]);
  const [newUserForm, setNewUserForm] = useState({ username: '', password: '', role: 'editor' as 'admin' | 'editor' });
  const [showNewUserForm, setShowNewUserForm] = useState(false);

  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>({ lat: 40.7128, lng: -74.0060 });
  const [locationNames, setLocationNames] = useState<Record<string, string>>({});
  const [adminMapInstance, setAdminMapInstance] = useState<google.maps.Map | null>(null);

  useEffect(() => {
    if (getToken()) {
      setIsAuthenticated(true);
      fetchHotspots();
      fetchLogs();
      fetchPendingClaims();
      fetchAdminUsers();
    }
  }, []);

  // Poll for pending claims every 10 seconds
  useEffect(() => {
    if (isAuthenticated) {
      const interval = setInterval(fetchPendingClaims, 10000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

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
    try {
      const response = await fetch(`${API_URL}/api/hotspots?admin=true`, {
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        setHotspots(data);
        
        // Fetch location names for all hotspots
        data.forEach(async (hotspot: Hotspot) => {
          const name = await getLocationName(hotspot.lat, hotspot.lng);
          setLocationNames(prev => ({ ...prev, [hotspot.id]: name }));
        });
      }
    } catch (err) {
      console.error('Failed to fetch hotspots:', err);
    }
  };

  // Fetch admin logs
  const fetchLogs = async () => {
    try {
      const response = await fetch(`${API_URL}/api/admin/logs`, {
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        setLogs(data);
      }
    } catch (err) {
      console.error('Failed to fetch logs:', err);
    }
  };

  // Fetch pending claims
  const fetchPendingClaims = async () => {
    try {
      const response = await fetch(`${API_URL}/api/admin/claims`, {
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        setPendingClaims(data);
      }
    } catch (err) {
      console.error('Failed to fetch pending claims:', err);
    }
  };

  // Approve a claim
  const handleApprove = async (hotspotId: string) => {
    if (!confirm('Approve this claim? The private key will be revealed to the user.')) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/hotspots/${hotspotId}/approve`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error('Failed to approve claim');
      }

      alert('Claim approved! Private key revealed to user.');
      fetchPendingClaims();
      fetchHotspots();
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'Failed to approve claim'}`);
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
      alert(error instanceof Error ? error.message : 'Failed to process image');
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
      active: true,
      imageUrl: '',
      privateKey: '',
    });
    setImagePreview(null);
    setHasExpiration(false);
  };

  // Handle map click to set location and open form
  const handleMapClickOpen = (lat: number, lng: number) => {
    // Only update form data, don't move the map center
    setFormData({ ...formData, lat, lng });
    
    // If form is not open, open it in create mode
    if (!formOpen) {
      setFormMode('create');
      setFormOpen(true);
      setSelectedHotspot(null);
    }
  };

  // Edit hotspot
  const handleEdit = (hotspot: Hotspot) => {
    setSelectedHotspot(hotspot);
    setFormMode('edit');
    setFormOpen(true);
    setActiveTab('active'); // Switch to active tab to show form
    
    // Check if endDate is far in future (>50 years = no expiration)
    const endDate = new Date(hotspot.endDate);
    const now = new Date();
    const yearsDiff = (endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 365);
    const hasExpiry = yearsDiff < 50;
    
    setHasExpiration(hasExpiry);
    setFormData({
      title: hotspot.title,
      lat: hotspot.lat,
      lng: hotspot.lng,
      prize: hotspot.prize || '',
      endDate: hasExpiry ? hotspot.endDate.slice(0, 16) : '',
      active: hotspot.active,
      imageUrl: hotspot.imageUrl || '',
      privateKey: '', // Don't populate private key on edit for security
    });
    setImagePreview(hotspot.imageUrl || null);
    // Don't center map when editing - let user keep current view
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
        active: formData.active,
        imageUrl: formData.imageUrl,
        privateKey: formData.privateKey,
      };

      // Only include endDate if expiration toggle is enabled
      if (hasExpiration && formData.endDate) {
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

      // Reset form and refresh
      handleCancel();
      fetchHotspots();
      fetchLogs();
      alert(selectedHotspot ? 'Hotspot updated!' : 'Hotspot created!');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save hotspot');
    }
  };

  // Delete hotspot
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this hotspot?')) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/hotspots/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error('Failed to delete hotspot');
      }

      fetchHotspots();
      fetchLogs();
      if (selectedHotspot?.id === id) {
        handleCancel();
      }
      alert('Hotspot deleted!');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete hotspot');
    }
  };

  // Cancel editing
  const handleCancel = () => {
    setSelectedHotspot(null);
    setFormOpen(false);
    setFormMode('create');
    setHasExpiration(false);
    setImagePreview(null);
    setFormData({
      title: '',
      lat: 40.7128,
      lng: -74.0060,
      prize: '',
      endDate: '',
      active: true,
      imageUrl: '',
      privateKey: '',
    });
    setMapCenter({ lat: 40.7128, lng: -74.0060 });
  };

  // Copy PING URL to clipboard
  const handleCopyUrl = (id: string, url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Fetch admin users
  const fetchAdminUsers = async () => {
    try {
      const response = await fetch(`${API_URL}/api/admin/users`, {
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        setAdminUsers(data.users);
        setCurrentUserRole(data.currentUserRole);
      }
    } catch (err) {
      console.error('Failed to fetch admin users:', err);
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

      alert('User created successfully!');
      setNewUserForm({ username: '', password: '', role: 'editor' });
      setShowNewUserForm(false);
      fetchAdminUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create user');
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

      alert('Role updated successfully!');
      fetchAdminUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update role');
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

      alert('User deleted successfully!');
      fetchAdminUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete user');
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
        <button onClick={handleLogout} className="logout-btn" aria-label="Logout">
          <LogOut size={24} />
        </button>
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
          </GoogleMap>
        )}
      </div>

      {/* Left Sidebar (Desktop) / Bottom Drawer (Mobile) */}
      <div className={`admin-sidebar ${drawerExpanded ? 'expanded' : ''}`}>
        {/* Desktop: Logo and Logout */}
        <div className="sidebar-header">
          <img src="/logo/ping-logo.svg" alt="PING Logo" className="admin-logo" />
          <button onClick={handleLogout} className="logout-btn" aria-label="Logout">
            <LogOut size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="admin-tabs">
          <button 
            className={`tab-btn ${activeTab === 'active' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('active');
              setDrawerExpanded(true); // Expand on mobile when tab clicked
            }}
          >
            Active PINGs
          </button>
          <button 
            className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('history');
              setDrawerExpanded(true);
            }}
          >
            Claimed History
          </button>
          <button 
            className={`tab-btn ${activeTab === 'activity' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('activity');
              setDrawerExpanded(true);
            }}
          >
            Recent Activity
          </button>
          {currentUserRole === 'admin' && (
            <button 
              className={`tab-btn ${activeTab === 'access' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('access');
                setDrawerExpanded(true);
              }}
            >
              Access Control
            </button>
          )}
        </div>

        {/* Mobile drag handle */}
        <div className="drag-handle" onClick={() => setDrawerExpanded(!drawerExpanded)}>
          <div className="handle-bar"></div>
        </div>

        {/* Tab Content */}
        <div className="sidebar-content">
          {/* Active PINGs Tab */}
          {activeTab === 'active' && (
            <div className="active-pings-content">
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
                      className={`hotspot-item ${isActive ? 'active-hotspot' : 'queued-hotspot'} ${hasPendingClaim ? 'pending-claim' : ''}`}
                    >
                      <div className="hotspot-header">
                        <div className="header-title-section">
                          <strong>{hotspot.title}</strong>
                          {locationNames[hotspot.id] && (
                            <div className="hotspot-location">
                              <MapPin size={12} />
                              <span>{locationNames[hotspot.id]}</span>
                            </div>
                          )}
                        </div>
                        <span className={`status-badge ${hasPendingClaim ? 'badge-pending' : (isActive ? 'badge-active' : 'badge-queued')}`}>
                          {hasPendingClaim ? 'Pending Claim' : (isActive ? 'Active' : `Queue #${displayPosition}`)}
                        </span>
                      </div>
                      <div className="hotspot-footer">
                        <p className="hotspot-prize">
                          <Gift size={20} />
                          {hotspot.prize ? `${hotspot.prize} SOL` : 'N/A'}
                        </p>
                        <div className="hotspot-actions">
                          <button onClick={() => handleEdit(hotspot)} className="action-icon-btn" aria-label="Edit PING">
                            <SquarePen size={18} />
                          </button>
                          <button 
                            onClick={() => handleCopyUrl(hotspot.id, nfcUrl)} 
                            className="action-icon-btn"
                            aria-label={copiedId === hotspot.id ? 'Copied!' : 'Copy PING URL'}
                          >
                            {copiedId === hotspot.id ? <Check size={18} /> : <Copy size={18} />}
                          </button>
                          <button onClick={() => handleDelete(hotspot.id)} className="action-icon-btn" aria-label="Delete PING">
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                      
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
                        <div className="inline-form-container" style={{ marginTop: '15px' }}>
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
                                />
                              </div>
                            </div>
                            
                            <div className="form-hint-map">
                              Tip: Click on the map to select location
                            </div>

                            <div className="form-group">
                              <label htmlFor="prize">Prize (SOL)</label>
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
                                required
                              />
                            </div>

                            <div className="form-group">
                              <label htmlFor="privateKey">Solana Private Key (Optional)</label>
                              <input
                                type="password"
                                id="privateKey"
                                name="privateKey"
                                value={formData.privateKey}
                                onChange={handleInputChange}
                                placeholder="Leave blank to keep existing key"
                                autoComplete="new-password"
                              />
                              <small className="form-hint">
                                Only enter a new key if you want to replace the existing one
                              </small>
                            </div>

                            <div className="form-group checkbox">
                              <label>
                                <input
                                  type="checkbox"
                                  checked={hasExpiration}
                                  onChange={(e) => setHasExpiration(e.target.checked)}
                                />
                                Set Expiration Date
                              </label>
                            </div>

                            {hasExpiration && (
                              <div className="form-group">
                                <label htmlFor="endDate">Expiration Date & Time</label>
                                <input
                                  type="datetime-local"
                                  id="endDate"
                                  name="endDate"
                                  value={formData.endDate}
                                  onChange={handleInputChange}
                                  required={hasExpiration}
                                />
                              </div>
                            )}

                            <div className="form-group">
                              <label htmlFor="imageUrl">Image URL (Optional)</label>
                              <input
                                type="url"
                                id="imageUrl"
                                name="imageUrl"
                                value={formData.imageUrl}
                                onChange={handleInputChange}
                                placeholder="https://example.com/image.jpg"
                              />
                            </div>

                            {imagePreview && (
                              <div className="image-preview">
                                <img src={imagePreview} alt="Preview" />
                              </div>
                            )}

                            <div className="form-actions">
                              <button type="submit" className="save-btn">
                                Save Changes
                              </button>
                              <button type="button" className="cancel-btn" onClick={handleCancelForm}>
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
                <div className="inline-form-container">
                  <h4>{formMode === 'edit' ? 'Edit PING' : 'Create New PING'}</h4>
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
                        />
                      </div>
                    </div>
                    
                    <div className="form-hint-map">
                      Tip: Click on the map to select location
                    </div>

                    <div className="form-group">
                      <label htmlFor="prize">Prize (SOL)</label>
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
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="privateKey">Solana Private Key {formMode === 'edit' && '(Optional)'}</label>
                      <input
                        type="password"
                        id="privateKey"
                        name="privateKey"
                        value={formData.privateKey}
                        onChange={handleInputChange}
                        placeholder={formMode === 'edit' ? 'Leave blank to keep existing key' : 'Enter private key (encrypted in database)'}
                        autoComplete="new-password"
                        required={formMode === 'create'}
                      />
                      <small className="form-hint">
                        {formMode === 'edit' 
                          ? 'Only enter a new key if you want to replace the existing one' 
                          : 'This will be encrypted and revealed only when claim is approved'}
                      </small>
                    </div>

                    <div className="form-group checkbox">
                      <label>
                        <input
                          type="checkbox"
                          checked={hasExpiration}
                          onChange={(e) => setHasExpiration(e.target.checked)}
                        />
                        <span>Set expiration date</span>
                      </label>
                    </div>

                    {hasExpiration && (
                      <div className="form-group">
                        <label htmlFor="endDate">Expiration Date & Time *</label>
                        <input
                          type="datetime-local"
                          id="endDate"
                          name="endDate"
                          value={formData.endDate}
                          onChange={handleInputChange}
                          required={hasExpiration}
                        />
                      </div>
                    )}

                    <div className="form-group">
                      <label htmlFor="image">PING Image</label>
                      <input
                        type="file"
                        id="image"
                        accept="image/*"
                        onChange={handleImageChange}
                        className="file-input"
                      />
                      {imagePreview && (
                        <div className="image-preview">
                          <img src={imagePreview} alt="Preview" />
                          <button 
                            type="button" 
                            onClick={() => {
                              setImagePreview(null);
                              setFormData({ ...formData, imageUrl: '' });
                            }}
                            className="remove-image-btn"
                          >
                            ✕ Remove
                          </button>
                        </div>
                      )}
                      <small className="form-hint">Max size: 2MB. Supported: JPG, PNG, GIF, WebP</small>
                    </div>

                    <div className="form-group checkbox">
                      <label>
                        <input
                          type="checkbox"
                          name="active"
                          checked={formData.active}
                          onChange={handleInputChange}
                        />
                        <span>Active</span>
                      </label>
                    </div>

                    <div className="form-actions">
                      <button type="submit" className="save-btn">
                        {formMode === 'edit' ? 'Update' : 'Create'} PING
                      </button>
                      <button type="button" onClick={handleCancel} className="cancel-btn">
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* Claimed History Tab */}
          {activeTab === 'history' && (
            <div className="history-content">
              <h3>📜 Claimed PINGs History</h3>
              {hotspots
                .filter(h => h.claimStatus === 'claimed')
                .map((hotspot) => (
                  <div key={hotspot.id} className="hotspot-item claimed-hotspot">
                    <div className="hotspot-header">
                      <span className="status-badge badge-claimed">CLAIMED</span>
                      <strong>{hotspot.title}</strong>
                    </div>
                    <div className="claim-details">
                      <p><strong>Prize:</strong> {hotspot.prize ? `${hotspot.prize} SOL` : 'N/A'}</p>
                      <p><strong>Claimed by:</strong> {hotspot.claimedBy || 'Unknown'}</p>
                      <p><strong>Claimed at:</strong> {hotspot.claimedAt ? formatDate(hotspot.claimedAt) : 'N/A'}</p>
                      <p><strong>PING URL:</strong> <a href={`${window.location.origin}/ping/${hotspot.id}`} target="_blank" rel="noopener noreferrer">{`${window.location.origin}/ping/${hotspot.id}`}</a></p>
                      {hotspot.tweetUrl && (
                        <p><strong>Tweet:</strong> <a href={hotspot.tweetUrl} target="_blank" rel="noopener noreferrer">View</a></p>
                      )}
                    </div>
                  </div>
                ))}
              {hotspots.filter(h => h.claimStatus === 'claimed').length === 0 && (
                <p className="empty-message">No claimed PINGs yet.</p>
              )}
            </div>
          )}

          {/* Recent Activity Tab */}
          {activeTab === 'activity' && (
            <div className="activity-content">
              <h3>Recent Activity</h3>
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

          {/* Access Control Tab */}
          {activeTab === 'access' && currentUserRole === 'admin' && (
            <div className="access-control-content">
              <h3>Access Control</h3>
              
              {/* Add New User Button */}
              {!showNewUserForm && (
                <div className="add-user-card" onClick={() => setShowNewUserForm(true)}>
                  <div className="plus-icon">+</div>
                  <span>Add New Admin User</span>
                </div>
              )}

              {/* New User Form */}
              {showNewUserForm && (
                <div className="new-user-form">
                  <h4>Create New Admin User</h4>
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
                <h4>Admin Users</h4>
                {adminUsers.map((user) => (
                  <div key={user.id} className="user-item">
                    <div className="user-info">
                      <strong>{user.username}</strong>
                      <span className={`role-badge role-${user.role}`}>
                        {user.role === 'admin' ? 'Admin' : 'Editor'}
                      </span>
                    </div>
                    <div className="user-actions">
                      {user.role === 'editor' ? (
                        <button 
                          onClick={() => handleUpdateRole(user.id, 'admin')} 
                          className="action-btn promote-btn"
                        >
                          Promote to Admin
                        </button>
                      ) : (
                        <button 
                          onClick={() => handleUpdateRole(user.id, 'editor')} 
                          className="action-btn demote-btn"
                        >
                          Demote to Editor
                        </button>
                      )}
                      <button 
                        onClick={() => handleDeleteUser(user.id)} 
                        className="action-btn delete-btn"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
                {adminUsers.length === 0 && (
                  <p className="empty-message">No users found.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AdminPage;

