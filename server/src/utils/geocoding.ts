import fetch from 'node-fetch';

export async function getLocationName(lat: number, lng: number): Promise<string | null> {
  try {
    const apiKey = process.env.GOOGLE_GEOCODING_API_KEY || process.env.VITE_GOOGLE_GEOCODING_API_KEY;
    if (!apiKey) {
      console.warn('Neither GOOGLE_GEOCODING_API_KEY nor VITE_GOOGLE_GEOCODING_API_KEY found in environment variables');
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

    // Extract detailed location name in "City, State, Country" format
    const result = data.results[0];
    const addressComponents = result.address_components || [];
    
    let city = null;
    let state = null;
    let country = null;
    
    // Extract city, state, and country from address components
    for (const component of addressComponents) {
      if (component.types.includes('locality')) {
        city = component.long_name;
      } else if (component.types.includes('administrative_area_level_1')) {
        state = component.short_name; // Use short name for state (e.g., "NY" instead of "New York")
      } else if (component.types.includes('country')) {
        country = component.long_name;
      }
    }
    
    // Build location name in "City, State, Country" format
    let locationName = null;
    if (city && state && country) {
      locationName = `${city}, ${state}, ${country}`;
    } else if (city && state) {
      locationName = `${city}, ${state}`;
    } else if (city) {
      locationName = city;
    } else {
      // Fallback to formatted address if no specific components found
      locationName = result.formatted_address;
    }

    return locationName;
  } catch (error) {
    console.error('Error fetching location name:', error);
    return null;
  }
}
