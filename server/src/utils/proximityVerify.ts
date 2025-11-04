/**
 * Proximity verification utilities for location-based claiming
 */

interface ProximityValidationResult {
  valid: boolean;
  distance: number; // Distance in meters
  error?: string;
  suspicious?: boolean;
  suspiciousReason?: string;
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param lat1 Latitude of first point
 * @param lng1 Longitude of first point
 * @param lat2 Latitude of second point
 * @param lng2 Longitude of second point
 * @returns Distance in meters
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
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
}

/**
 * Validate coordinates are within valid ranges
 * @param lat Latitude
 * @param lng Longitude
 * @returns true if valid, false otherwise
 */
function validateCoordinates(lat: number, lng: number): boolean {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    !isNaN(lat) &&
    !isNaN(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/**
 * Check for unrealistic movement speed
 * @param prevLat Previous latitude
 * @param prevLng Previous longitude
 * @param prevTime Previous timestamp (ms)
 * @param currLat Current latitude
 * @param currLng Current longitude
 * @param currTime Current timestamp (ms)
 * @returns true if movement is suspicious, false otherwise
 */
function checkUnrealisticMovement(
  prevLat: number,
  prevLng: number,
  prevTime: number,
  currLat: number,
  currLng: number,
  currTime: number
): boolean {
  const timeDiff = (currTime - prevTime) / 1000; // Convert to seconds
  if (timeDiff <= 0) return true; // Invalid time difference

  const distance = calculateDistance(prevLat, prevLng, currLat, currLng);
  const speedMps = distance / timeDiff; // Meters per second
  const speedKph = speedMps * 3.6; // Convert to km/h

  // Maximum reasonable speed: 200 km/h (for vehicles)
  // This is generous to allow for GPS inaccuracies and fast travel
  return speedKph > 200;
}

/**
 * Validate a proximity claim
 * @param userLat User's claimed latitude
 * @param userLng User's claimed longitude
 * @param hotspot Hotspot object with lat, lng, proximityRadius, and claimType
 * @param history Optional proximity check history for pattern analysis
 * @returns Validation result with distance and any errors
 */
export function validateProximityClaim(
  userLat: number,
  userLng: number,
  hotspot: {
    lat: number;
    lng: number;
    proximityRadius: number | null;
    claimType: string;
  },
  history?: Array<{
    lat: number;
    lng: number;
    timestamp: number;
    ip?: string;
  }>
): ProximityValidationResult {
  // Validate coordinates
  if (!validateCoordinates(userLat, userLng)) {
    return {
      valid: false,
      distance: 0,
      error: 'Invalid coordinates provided',
      suspicious: true,
    };
  }

  if (!validateCoordinates(hotspot.lat, hotspot.lng)) {
    return {
      valid: false,
      distance: 0,
      error: 'Invalid hotspot coordinates',
      suspicious: true,
    };
  }

  // Check if this is a proximity claim
  if (hotspot.claimType !== 'proximity') {
    return {
      valid: false,
      distance: 0,
      error: 'This hotspot does not use proximity claiming',
    };
  }

  // Get proximity radius (default 5m if not set)
  const radius = hotspot.proximityRadius || 5;

  // Calculate distance
  const distance = calculateDistance(userLat, userLng, hotspot.lat, hotspot.lng);

  // Check if within radius
  if (distance > radius) {
    return {
      valid: false,
      distance: Math.round(distance * 10) / 10, // Round to 1 decimal place
      error: `You must be within ${radius} meters to claim this ping. You are ${Math.round(distance * 10) / 10} meters away.`,
    };
  }

  // Check for suspicious movement patterns if history is available
  if (history && history.length > 0) {
    const mostRecent = history[history.length - 1];
    const now = Date.now();

    // Check for unrealistic movement
    if (
      checkUnrealisticMovement(
        mostRecent.lat,
        mostRecent.lng,
        mostRecent.timestamp,
        userLat,
        userLng,
        now
      )
    ) {
      return {
        valid: false,
        distance: Math.round(distance * 10) / 10,
        error: 'Suspicious movement detected. Please try again.',
        suspicious: true,
        suspiciousReason: 'Unrealistic movement speed',
      };
    }
  }

  // Valid claim
  return {
    valid: true,
    distance: Math.round(distance * 10) / 10,
  };
}

