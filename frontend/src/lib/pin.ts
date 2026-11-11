/** Same loose box around the Philippines the server enforces, so a bad pin is caught before submitting. */
export const PH_BOUNDS = (p: { lat: number; lng: number }) => p.lat >= 4.5 && p.lat <= 21.5 && p.lng >= 116 && p.lng <= 127;
