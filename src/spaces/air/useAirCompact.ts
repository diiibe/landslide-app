import { useEffect, useState } from "react";
export function useAirCompact() {
  const query = "(max-width:768px), (max-height:500px) and (pointer:coarse)",
    [compact, setCompact] = useState(
      () => window.matchMedia?.(query).matches ?? false,
    );
  useEffect(() => {
    const media = window.matchMedia?.(query);
    if (!media) return;
    const change = () => setCompact(media.matches);
    media.addEventListener?.("change", change);
    return () => media.removeEventListener?.("change", change);
  }, []);
  return compact;
}
