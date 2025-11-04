/**
 * useProximityDetector Hook
 * Tracks user location and calculates distance to hotspot
 * Provides visual feedback for proximity-based pings
 */

import { useState, useEffect, useRef } from 'react';

interface UseProximityDetectorOptions {
  hotspotLat: number;
  hotspotLng: number;
  proximityRadius: number; // Claim radius in meters
  enabled: boolean;
}

interface ProximityDetectorResult {
  distance: number | null;
  locationPermission: PermissionState;
  locationError: string | null;
  distanceColor: string;
  formattedDistance: string;
  isWithinRadius: boolean;
  userLocation: { lat: number; lng: number } | null;
}

export const useProximityDetector = ({
  hotspotLat,
  hotspotLng,
  proximityRadius,
  enabled,
}: UseProximityDetectorOptions): ProximityDetectorResult => {
  const [distance, setDistance] = useState<number | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationPermission, setLocationPermission] = useState<PermissionState>('prompt');
  const [locationError, setLocationError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);

  // Calculate distance using Haversine formula
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371000; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lng2 - lng1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  };

  // Check location permission
  useEffect(() => {
    if ('permissions' in navigator) {
      navigator.permissions.query({ name: 'geolocation' as PermissionName }).then((result) => {
        setLocationPermission(result.state);
        result.onchange = () => {
          setLocationPermission(result.state);
        };
      });
    }
  }, []);

  // Watch user location when enabled
  useEffect(() => {
    if (!enabled) {
      // Stop watching if disabled
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setDistance(null);
      setUserLocation(null);
      return;
    }

    // Check if geolocation is supported
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser');
      setDistance(null);
      return;
    }

    // Request location permission and start watching
    const options: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 5000, // Accept cached position up to 5 seconds old
    };

    const successCallback = (position: GeolocationPosition) => {
      const userLat = position.coords.latitude;
      const userLng = position.coords.longitude;
      const calculatedDistance = calculateDistance(userLat, userLng, hotspotLat, hotspotLng);
      
      setUserLocation({ lat: userLat, lng: userLng });
      setDistance(calculatedDistance);
      setLocationError(null);
    };

    const errorCallback = (error: GeolocationPositionError) => {
      let errorMessage = 'Unable to get your location';
      
      switch (error.code) {
        case error.PERMISSION_DENIED:
          errorMessage = 'Location permission denied. Please enable location access.';
          setLocationPermission('denied');
          break;
        case error.POSITION_UNAVAILABLE:
          errorMessage = 'Location information unavailable.';
          break;
        case error.TIMEOUT:
          errorMessage = 'Location request timed out.';
          break;
      }
      
      setLocationError(errorMessage);
      setDistance(null);
      setUserLocation(null);
    };

    // Start watching position
    watchIdRef.current = navigator.geolocation.watchPosition(
      successCallback,
      errorCallback,
      options
    );

    // Cleanup on unmount or when disabled
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [enabled, hotspotLat, hotspotLng, proximityRadius]);

  // Get distance color coding
  const getDistanceColor = (): string => {
    if (distance === null) return '#ffffff';
    if (distance <= proximityRadius) return '#4ade80'; // Green - within claim radius
    if (distance <= 20) return '#fbbf24'; // Yellow - close (within 20m)
    return '#ef4444'; // Red - far (>20m)
  };

  // Format distance display
  const formatDistance = (): string => {
    if (distance === null) return 'Unknown';
    if (distance < 1) return '< 1m';
    if (distance < 1000) return `${Math.round(distance)}m`;
    return `${(distance / 1000).toFixed(2)}km`;
  };

  return {
    distance,
    locationPermission,
    locationError,
    distanceColor: getDistanceColor(),
    formattedDistance: formatDistance(),
    isWithinRadius: distance !== null && distance <= proximityRadius,
    userLocation,
  };
};

