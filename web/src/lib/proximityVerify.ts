/**
 * Proximity verification (ported from legacy server).
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function validateCoordPair(lat: number, lng: number): boolean {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    !Number.isNaN(lat) &&
    !Number.isNaN(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

function checkUnrealisticMovement(
  prevLat: number,
  prevLng: number,
  prevTime: number,
  currLat: number,
  currLng: number,
  currTime: number
): boolean {
  const timeDiff = (currTime - prevTime) / 1000;
  if (timeDiff <= 0) return true;
  const distance = calculateDistance(prevLat, prevLng, currLat, currLng);
  const speedKph = (distance / timeDiff) * 3.6;
  return speedKph > 200;
}

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
): {
  valid: boolean;
  distance: number;
  error?: string;
  suspicious?: boolean;
  suspiciousReason?: string;
} {
  if (!validateCoordPair(userLat, userLng)) {
    return { valid: false, distance: 0, error: "Invalid coordinates provided", suspicious: true };
  }
  if (!validateCoordPair(hotspot.lat, hotspot.lng)) {
    return { valid: false, distance: 0, error: "Invalid hotspot coordinates", suspicious: true };
  }
  if (hotspot.claimType !== "proximity") {
    return { valid: false, distance: 0, error: "This hotspot does not use proximity claiming" };
  }
  const radius = hotspot.proximityRadius || 5;
  const distance = calculateDistance(userLat, userLng, hotspot.lat, hotspot.lng);
  if (distance > radius) {
    return {
      valid: false,
      distance: Math.round(distance * 10) / 10,
      error: `You must be within ${radius} meters to claim this ping. You are ${Math.round(distance * 10) / 10} meters away.`,
    };
  }
  if (history && history.length > 0) {
    const mostRecent = history[history.length - 1]!;
    const now = Date.now();
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
        error: "Suspicious movement detected. Please try again.",
        suspicious: true,
        suspiciousReason: "Unrealistic movement speed",
      };
    }
  }
  return { valid: true, distance: Math.round(distance * 10) / 10 };
}
