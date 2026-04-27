/** Reverse geocode via Google (optional — same env names as legacy server). */
export async function getLocationName(
  lat: number,
  lng: number
): Promise<string | null> {
  try {
    const apiKey =
      process.env.GOOGLE_GEOCODING_API_KEY ||
      process.env.VITE_GOOGLE_GEOCODING_API_KEY;
    if (!apiKey) return null;

    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      status?: string;
      results?: Array<{
        formatted_address?: string;
        address_components?: Array<{
          long_name: string;
          short_name: string;
          types: string[];
        }>;
      }>;
    };
    if (data.status !== "OK" || !data.results?.length) return null;

    const result = data.results[0]!;
    const addressComponents = result.address_components || [];
    let city: string | null = null;
    let state: string | null = null;
    let country: string | null = null;
    for (const c of addressComponents) {
      if (c.types.includes("locality")) city = c.long_name;
      else if (c.types.includes("administrative_area_level_1"))
        state = c.short_name;
      else if (c.types.includes("country")) country = c.short_name;
    }
    if (city && state && country) return `${city}, ${state}, ${country}`;
    if (city && state) return `${city}, ${state}`;
    if (city) return city;
    return result.formatted_address ?? null;
  } catch {
    return null;
  }
}
