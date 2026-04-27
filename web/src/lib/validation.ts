export const validateCoordinates = (lat: number, lng: number): boolean =>
  lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;

export const roundCoordinate = (coord: number): number => Math.round(coord * 1_000_000) / 1_000_000;

export const validateDates = (startDate: string, endDate: string): boolean => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  return start < end;
};

export const sanitizeString = (input: string): string => input.trim();
