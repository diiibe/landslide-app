export interface Suggestion {
  id: string;
  name: string;
  context: string;
  fullName: string;
  lng: number;
  lat: number;
  zoom: number;
  kind: string;
  precision: string;
}
export function geocodingURL(query: string, token: string) {
  const url = new URL("https://api.mapbox.com/search/geocode/v6/forward");
  url.search = new URLSearchParams({
    q: query,
    access_token: token,
    country: "it",
    bbox: "12.3,45.5,13.95,46.65",
    types: "place,locality,neighborhood,street,address",
    language: "it",
    autocomplete: "true",
    limit: "6",
  }).toString();
  return url.href;
}
const record = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" ? (v as Record<string, unknown>) : {};
/** Preserve the provider's house number and reject malformed coordinates. */
export function asSuggestion(value: unknown): Suggestion | null {
  const f = record(value),
    p = record(f.properties),
    geometry = record(f.geometry),
    coordinates = record(p.coordinates);
  const coords = geometry.coordinates;
  if (geometry.type !== "Point" || !Array.isArray(coords) || coords.length < 2) return null;
  const [lng, lat] = coords;
  if (
    typeof lng !== "number" ||
    typeof lat !== "number" ||
    !Number.isFinite(lng) ||
    !Number.isFinite(lat) ||
    Math.abs(lng) > 180 ||
    Math.abs(lat) > 90
  )
    return null;
  const type = p.feature_type,
    name = p.name_preferred ?? p.name,
    id = p.mapbox_id ?? f.id;
  if (
    typeof id !== "string" ||
    typeof name !== "string" ||
    !name.trim() ||
    !["place", "locality", "neighborhood", "street", "address"].includes(
      String(type),
    )
  )
    return null;
  const context =
    typeof p.place_formatted === "string" ? p.place_formatted : "";
  const match = record(p.match_code);
  const precision =
    type !== "address"
      ? ""
      : ["interpolated", "approximate"].includes(String(coordinates.accuracy))
        ? "Posizione stimata"
        : ["unmatched", "plausible"].includes(String(match.address_number))
          ? "Civico proposto · da verificare"
          : !coordinates.accuracy
            ? "Precisione non dichiarata"
            : "";
  return {
    id,
    name,
    context,
    fullName: [name, context].filter(Boolean).join(", "),
    lng,
    lat,
    zoom:
      type === "address"
        ? 17.5
        : type === "street"
          ? 15.5
          : type === "place"
            ? 12
            : 14,
    kind:
      type === "address"
        ? "Indirizzo"
        : type === "street"
          ? "Via"
          : type === "neighborhood"
            ? "Quartiere"
            : "Località",
    precision,
  };
}
