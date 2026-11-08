import type { RequestParameters, ResourceType } from "maplibre-gl";

/** Adapt Mapbox protocol URLs to their public HTTP API paths for MapLibre. */
export function rewriteMapboxUrl(
  url: string,
  resourceType: ResourceType | undefined,
  token: string | undefined,
): RequestParameters {
  if (!url.startsWith("mapbox://") || !token) return { url };
  const tail = url.slice("mapbox://".length);
  const sep = (u: string) =>
    (u.includes("?") ? "&" : "?") + `access_token=${token}`;
  let target: string;
  if (tail.startsWith("sprites/")) {
    const m = tail.match(/^sprites\/([^?]+?)(@\dx)?(\.\w+)?(\?.*)?$/);
    if (!m) return { url };
    const [, path, ratio = "", ext = "", query = ""] = m;
    target = `https://api.mapbox.com/styles/v1/${path}/sprite${ratio}${ext}${query}`;
  } else if (tail.startsWith("fonts/")) {
    const path = tail.startsWith("fonts/v1/")
      ? tail
      : tail.replace(/^fonts\//, "fonts/v1/");
    target = `https://api.mapbox.com/${path}`;
  } else if (
    resourceType === "Source" ||
    /^[a-z0-9._-]+(\.[a-z0-9._-]+)*(,[a-z0-9._-]+)*(\?|$)/i.test(tail)
  ) {
    const [path, query = ""] = tail.split("?", 2);
    target = `https://api.mapbox.com/v4/${path}.json?secure${query ? "&" + query : ""}`;
  } else if (tail.startsWith("tiles/")) {
    target = `https://api.mapbox.com/v4/${tail.slice("tiles/".length)}`;
  } else {
    target = `https://api.mapbox.com/v4/${tail}`;
  }
  return { url: target + sep(target) };
}
