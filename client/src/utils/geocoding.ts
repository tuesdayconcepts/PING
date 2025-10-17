// Reverse geocode coordinates to get location name
export async function getLocationName(lat: number, lng: number): Promise<string> {
  try {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`
    );
    
    if (!response.ok) {
      throw new Error('Geocoding request failed');
    }
    
    const data = await response.json();
    
    if (data.status === 'OK' && data.results && data.results.length > 0) {
      // Try to find a result with locality (city) and administrative_area_level_1 (state)
      for (const result of data.results) {
        const components = result.address_components;
        let city = '';
        let state = '';
        let country = '';
        
        for (const component of components) {
          if (component.types.includes('locality')) {
            city = component.short_name;
          }
          if (component.types.includes('administrative_area_level_1')) {
            state = component.short_name;
          }
          if (component.types.includes('country')) {
            country = component.short_name;
          }
        }
        
        // If we have city and state, return formatted location
        if (city && state) {
          return `${city}, ${state}, ${country}`;
        }
        
        // If we only have city, return with country
        if (city) {
          return `${city}, ${country}`;
        }
      }
      
      // Fallback: use formatted_address but simplify it
      const formatted = data.results[0].formatted_address;
      // Try to extract meaningful parts (e.g., "City, State, Country")
      const parts = formatted.split(',').map(p => p.trim());
      if (parts.length >= 3) {
        // Take last 3 parts (usually City, State, Country)
        return parts.slice(-3).join(', ');
      }
      return formatted;
    }
    
    return 'Unknown Location';
  } catch (error) {
    console.error('Geocoding error:', error);
    return 'Unknown Location';
  }
}

