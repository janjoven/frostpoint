// Free OpenStreetMap vector tiles from OpenFreeMap (no key). Override with VITE_MAP_STYLE to switch provider,
// for example to a self-hosted PMTiles style, without touching the components.
export const MAP_STYLE: string = (import.meta as any).env?.VITE_MAP_STYLE || "https://tiles.openfreemap.org/styles/liberty";
export const DEFAULT_CENTER = { lat: 12.3667, lng: 123.6167 }; // Masbate City
