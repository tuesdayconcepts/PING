// Time utility functions for hotspot status calculations

export function getHotspotStatus(startDate: string, endDate: string): string {
  const now = new Date();
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Check if expired
  if (now > end) {
    return 'Expired';
  }

  // Check if not started yet
  if (now < start) {
    const timeDiff = start.getTime() - now.getTime();
    const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
    if (days > 0) {
      return `Starts in ${days} day${days !== 1 ? 's' : ''}`;
    }
    const hours = Math.floor(timeDiff / (1000 * 60 * 60));
    return `Starts in ${hours} hour${hours !== 1 ? 's' : ''}`;
  }

  // Currently running
  const timeDiff = now.getTime() - start.getTime();
  const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) {
    return `Started ${days}d ${hours}h ago`;
  }
  if (hours > 0) {
    return `Started ${hours}h ${minutes}m ago`;
  }
  return `Started ${minutes}m ago`;
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

// Get time remaining until expiration in "Ends in Xh Xm" format
export function getTimeUntilExpiration(endDate: string): string {
  const now = new Date();
  const end = new Date(endDate);
  const timeDiff = end.getTime() - now.getTime();
  
  // If already expired
  if (timeDiff <= 0) {
    return 'Expired';
  }
  
  const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (days > 0) {
    return `Ends in ${days}d ${hours}h`;
  }
  if (hours > 0) {
    return `Ends in ${hours}h ${minutes}m`;
  }
  return `Ends in ${minutes}m`;
}

// Calculate ETA based on straight-line distance and walking speed
export function calculateETA(
  userLat: number,
  userLng: number,
  destLat: number,
  destLng: number
): string {
  // Haversine formula for distance between two points
  const R = 6371; // Earth's radius in kilometers
  const dLat = (destLat - userLat) * Math.PI / 180;
  const dLng = (destLng - userLng) * Math.PI / 180;
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(userLat * Math.PI / 180) * 
    Math.cos(destLat * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distanceKm = R * c;
  
  // Convert to miles or keep in km based on distance
  const distanceMiles = distanceKm * 0.621371;
  
  // Average walking speed: 5 km/h (3.1 mph)
  const walkingMinutes = Math.round((distanceKm / 5) * 60);
  
  if (walkingMinutes < 1) {
    return "Less than 1 min";
  }
  if (walkingMinutes < 60) {
    return `${walkingMinutes} min walk`;
  }
  
  const hours = Math.floor(walkingMinutes / 60);
  const mins = walkingMinutes % 60;
  return `${hours}h ${mins}m walk`;
}

