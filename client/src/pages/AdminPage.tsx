/// <reference types="vite/client" />
import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Hotspot, AdminLog } from '../types';
import { getToken, setToken, removeToken, setUsername, getUsername, getAuthHeaders } from '../utils/auth';
import { formatDate } from '../utils/time';
import 'leaflet/dist/leaflet.css';
import './AdminPage.css';

// Fix for default marker icon
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

// Component to handle map clicks
function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (e) => {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function AdminPage() {
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
    description: '',
    lat: 40.7128,
    lng: -74.0060,
    prize: '',
    startDate: '',
    endDate: '',
    active: true,
    imageUrl: '',
  });

  const [markerPosition, setMarkerPosition] = useState<[number, number]>([40.7128, -74.0060]);

  useEffect(() => {
    if (getToken()) {
      setIsAuthenticated(true);
      fetchHotspots();
      fetchLogs();
    }
  }, []);

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

  // Handle map click to set coordinates
  const handleMapClick = (lat: number, lng: number) => {
    setMarkerPosition([lat, lng]);
    setFormData({ ...formData, lat, lng });
  };

  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    });

    // Update marker if lat/lng changed manually
    if (name === 'lat' || name === 'lng') {
      const lat = name === 'lat' ? parseFloat(value) : formData.lat;
      const lng = name === 'lng' ? parseFloat(value) : formData.lng;
      if (!isNaN(lat) && !isNaN(lng)) {
        setMarkerPosition([lat, lng]);
      }
    }
  };

  // Edit hotspot
  const handleEdit = (hotspot: Hotspot) => {
    setSelectedHotspot(hotspot);
    setFormData({
      title: hotspot.title,
      description: hotspot.description,
      lat: hotspot.lat,
      lng: hotspot.lng,
      prize: hotspot.prize || '',
      startDate: hotspot.startDate.slice(0, 16), // Format for datetime-local
      endDate: hotspot.endDate.slice(0, 16),
      active: hotspot.active,
      imageUrl: hotspot.imageUrl || '',
    });
    setMarkerPosition([hotspot.lat, hotspot.lng]);
  };

  // Save hotspot (create or update)
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const method = selectedHotspot ? 'PUT' : 'POST';
      const url = selectedHotspot 
        ? `${API_URL}/api/hotspots/${selectedHotspot.id}`
        : `${API_URL}/api/hotspots`;

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          ...formData,
          lat: parseFloat(formData.lat.toString()),
          lng: parseFloat(formData.lng.toString()),
        }),
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
    setFormData({
      title: '',
      description: '',
      lat: 40.7128,
      lng: -74.0060,
      prize: '',
      startDate: '',
      endDate: '',
      active: true,
      imageUrl: '',
    });
    setMarkerPosition([40.7128, -74.0060]);
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
      {/* Top bar */}
      <div className="admin-header">
        <h2>🗺️ Admin Dashboard</h2>
        <div className="user-info">
          <span>Welcome, {getUsername()}</span>
          <button onClick={handleLogout} className="logout-btn">Logout</button>
        </div>
      </div>

      {/* Activity feed */}
      <div className="activity-feed">
        <h3>Recent Activity</h3>
        <div className="log-list">
          {logs.slice(0, 10).map((log) => (
            <div key={log.id} className="log-item">
              <span className="log-action">{log.action}</span>
              <span className="log-details">{log.details || `${log.entity} ${log.entityId}`}</span>
              <span className="log-time">{formatDate(log.timestamp)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="admin-content">
        {/* Hotspots list */}
        <div className="hotspots-sidebar">
          <h3>Hotspots ({hotspots.length})</h3>
          <div className="hotspot-list">
            {hotspots.map((hotspot) => (
              <div key={hotspot.id} className="hotspot-item">
                <div className="hotspot-info">
                  <span className={`status-dot ${hotspot.active ? 'active' : 'inactive'}`}></span>
                  <strong>{hotspot.title}</strong>
                </div>
                <div className="hotspot-actions">
                  <button onClick={() => handleEdit(hotspot)} className="edit-btn">Edit</button>
                  <button onClick={() => handleDelete(hotspot.id)} className="delete-btn">Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Map for selecting coordinates */}
        <div className="map-section">
          <h3>Select Location</h3>
          <p className="map-hint">Click on the map to set hotspot coordinates</p>
          <MapContainer 
            center={markerPosition} 
            zoom={13} 
            className="admin-map"
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            <MapClickHandler onMapClick={handleMapClick} />
            <Marker position={markerPosition} />
          </MapContainer>
        </div>

        {/* Form */}
        <div className="form-section">
          <h3>{selectedHotspot ? 'Edit Hotspot' : 'Create Hotspot'}</h3>
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

            <div className="form-group">
              <label htmlFor="description">Description *</label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                rows={4}
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

            <div className="form-group">
              <label htmlFor="prize">Prize</label>
              <input
                type="text"
                id="prize"
                name="prize"
                value={formData.prize}
                onChange={handleInputChange}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="startDate">Start Date *</label>
                <input
                  type="datetime-local"
                  id="startDate"
                  name="startDate"
                  value={formData.startDate}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="endDate">End Date *</label>
                <input
                  type="datetime-local"
                  id="endDate"
                  name="endDate"
                  value={formData.endDate}
                  onChange={handleInputChange}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="imageUrl">Image URL</label>
              <input
                type="url"
                id="imageUrl"
                name="imageUrl"
                value={formData.imageUrl}
                onChange={handleInputChange}
              />
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
                {selectedHotspot ? 'Update' : 'Create'} Hotspot
              </button>
              {selectedHotspot && (
                <button type="button" onClick={handleCancel} className="cancel-btn">
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default AdminPage;

