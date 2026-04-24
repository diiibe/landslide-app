import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import { useAppStore } from "@/app/store";
import { BASEMAP_STYLE, FVG_BOUNDS, FVG_CENTER } from "./style";
import { installPmtilesProtocol } from "./pmtiles-protocol";
import {
  addSusceptibility,
  setSusceptibilityVisible,
  updateSusceptibilityThreshold,
  updateSusceptibilityZones,
} from "./layers/susceptibility";
import { addIffi, setIffiVisible } from "./layers/iffi";
import { addZoneBoundaries, setZoneBoundariesVisible } from "./layers/zones";
import { registerPopups } from "./popups";
import styles from "./MapView.module.css";

export function MapView() {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupsRegistered = useRef(false);

  const basemap = useAppStore((s) => s.basemap);
  const model = useAppStore((s) => s.model);
  const threshold = useAppStore((s) => s.threshold);
  const selectedZones = useAppStore((s) => s.selectedZones);
  const susceptOn = useAppStore((s) => s.layers.susceptibility);
  const iffiOn = useAppStore((s) => s.layers.iffi);
  const zoneBoundariesOn = useAppStore((s) => s.layers.zoneBoundaries);

  // Init map once
  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    installPmtilesProtocol();
    const m = new maplibregl.Map({
      container: ref.current,
      style: BASEMAP_STYLE[basemap],
      center: FVG_CENTER,
      zoom: 8,
      maxBounds: [
        [FVG_BOUNDS[0][0] - 0.5, FVG_BOUNDS[0][1] - 0.5],
        [FVG_BOUNDS[1][0] + 0.5, FVG_BOUNDS[1][1] + 0.5],
      ],
      // Mapbox styles include `name` and other props MapLibre 5 rejects;
      // we skip validation since we trust the Mapbox style URL.
      validateStyle: false,
    });
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
    mapRef.current = m;
    return () => {
      m.remove();
      mapRef.current = null;
      popupsRegistered.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Basemap switch
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    m.setStyle(BASEMAP_STYLE[basemap]);
  }, [basemap]);

  // Add / re-add data layers after style loaded (runs on model + basemap change)
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    const apply = () => {
      addSusceptibility(m, model, threshold, selectedZones);
      addIffi(m, iffiOn);
      addZoneBoundaries(m);
      setZoneBoundariesVisible(m, zoneBoundariesOn);
      if (!popupsRegistered.current) {
        registerPopups(m);
        popupsRegistered.current = true;
      }
    };
    if (m.isStyleLoaded()) apply();
    else m.once("style.load", apply);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, basemap]);

  useEffect(() => {
    if (mapRef.current) updateSusceptibilityThreshold(mapRef.current, threshold);
  }, [threshold]);

  useEffect(() => {
    if (mapRef.current) updateSusceptibilityZones(mapRef.current, selectedZones);
  }, [selectedZones]);

  useEffect(() => {
    if (mapRef.current) setSusceptibilityVisible(mapRef.current, susceptOn);
  }, [susceptOn]);

  useEffect(() => {
    if (mapRef.current) setIffiVisible(mapRef.current, iffiOn);
  }, [iffiOn]);

  useEffect(() => {
    if (mapRef.current) setZoneBoundariesVisible(mapRef.current, zoneBoundariesOn);
  }, [zoneBoundariesOn]);

  // Fly-to triggered by SearchLocality custom event
  useEffect(() => {
    const onFly = (e: Event) => {
      const d = (e as CustomEvent<{ lng: number; lat: number }>).detail;
      mapRef.current?.flyTo({ center: [d.lng, d.lat], zoom: 11, essential: true });
    };
    window.addEventListener("fvg:flyto", onFly);
    return () => window.removeEventListener("fvg:flyto", onFly);
  }, []);

  return <div ref={ref} className={styles.root} aria-label="FVG susceptibility map" />;
}
