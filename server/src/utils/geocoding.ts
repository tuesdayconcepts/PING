import fetch from 'node-fetch';

export async function getLocationName(lat: number, lng: number): Promise<string | null> {
  try {
    const apiKey = process.env.GOOGLE_GEOCODING_API_KEY;
    if (!apiKey) {
      console.warn('GOOGLE_GEOCODING_API_KEY not found in environment variables');
      return null;
    }

    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`
    );

    if (!response.ok) {
      console.error('Geocoding API error:', response.status, response.statusText);
      return null;
    }

    const data = await response.json() as any;

    if (data.status !== 'OK' || !data.results || data.results.length === 0) {
      console.warn('No geocoding results found for coordinates:', lat, lng);
      return null;
    }

    // Extract the most relevant location name
    const result = data.results[0];
    const addressComponents = result.address_components || [];
    
    // Try to get a city-level location name
    let locationName = null;
    
    // Look for locality, administrative_area_level_1, or country
    for (const component of addressComponents) {
      if (component.types.includes('locality') || 
          component.types.includes('administrative_area_level_1') ||
          component.types.includes('country')) {
        locationName = component.long_name;
        break;
      }
    }
    
    // Fallback to formatted address if no specific component found
    if (!locationName) {
      locationName = result.formatted_address;
    }

    return locationName;
  } catch (error) {
    console.error('Error fetching location name:', error);
    return null;
  }
}
