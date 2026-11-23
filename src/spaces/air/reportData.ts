import { useAppStore } from "@/app/store";
import { type AirState } from "./store";
import {
  aggregate,
  covers,
  distance,
  filteredAia,
  normal,
  observationDates,
  paired,
  stackSite,
} from "./model";
import { sampleSoil } from "./soil";
export async function airReport(s: AirState) {
  if (!s.data) throw Error("Dati non disponibili");
  const d = s.data,
    m =
      d.municipalities.features.find(
        (f) => String(f.properties.istat) === s.municipalityId,
      ) ?? d.municipalities.features[0]!,
    station = d.stations.find((st) => st.id === s.stationId),
    comparison = d.stations.find((st) => st.id === s.compareId),
    dates = observationDates(d).filter((date) => date <= s.date),
    soil =
      station && s.world
        ? await sampleSoil(station.coordinates, s.world)
        : null;
  const app = useAppStore.getState();
  return {
    schema: "friulview-air-study-v1",
    createdAt: new Date().toISOString(),
    dataSnapshot: d.snapshot,
    availability: {
      archiveError: s.error,
      planningError: s.contextError,
      worldcoverManifestError: s.worldError,
      worldcoverTileError: s.worldTileError,
    },
    referenceYear: 2023,
    map: {
      layers: { ...s.layers },
      opacity: { ...s.opacity },
      basemap: app.basemap,
      view3D: app.view3D,
      pollutant: s.poll,
      sector: s.sector,
      parameter: s.measure,
    },
    inventory: {
      municipality: m.properties.name,
      istat: m.properties.istat,
      referenceYear: 2023,
      pollutant: s.poll,
      sector: s.sector,
      unit: "t/anno",
      ...aggregate(m, s.poll, s.sector),
      rawSectors: m.properties.sectors,
      geometry: m.geometry,
    },
    observations: {
      parameter: s.measure,
      unit: "µg/m³",
      statistic:
        s.measure === "no2"
          ? "maximum hourly value within each day"
          : "daily mean",
      periodEnd: s.date,
      seriesA: {
        stationId: station?.id,
        name: station?.name,
        coordinates: station?.coordinates,
        rows: dates.map(
          (date) =>
            station?.series[s.measure]?.find((r) => r.date === date) ?? {
              date,
              value: null,
              valid: false,
              raw: null,
              reason: "Nessuna osservazione disponibile",
            },
        ),
      },
      seriesB: {
        stationId: comparison?.id,
        name: comparison?.name,
        coordinates: comparison?.coordinates,
        rows: dates.map(
          (date) =>
            comparison?.series[s.measure]?.find((r) => r.date === date) ?? {
              date,
              value: null,
              valid: false,
              raw: null,
              reason: "Nessuna osservazione disponibile",
            },
        ),
      },
      paired: paired(station, comparison, s.measure, dates, s.date),
    },
    sme: {
      date: s.stackDate,
      unit: "mg/Nm³",
      rows: d.sme,
      locationIsAdministrativeAIA: true,
      coordinates: stackSite(d),
    },
    context: {
      aia: {
        records: filteredAia(d, s.aiaCategory, s.aiaQuery, s.aiaMunicipality),
        category: s.aiaCategory,
        query: s.aiaQuery,
        municipality: s.aiaMunicipality,
        selectedId: s.aiaId,
        meaning: "Density of administrative records, not emissions",
      },
      land: {
        selectedZone: s.zone,
        worldcoverReferenceYear: s.world?.referenceYear,
        worldcoverSourceSha256: s.world?.sourceSha256,
        notes:
          "Planning destinations and observed cover are distinct. Dates of validity belong to each record.",
      },
    },
    territoryInsights: {
      meaning: "Descriptive context, not causal attribution or exposure",
      municipality: {
        industrialPlanningRecords:
          s.context?.industrialZones.features.filter(
            (f) =>
              normal(f.properties.municipality) === normal(m.properties.name),
          ).length ?? null,
        commercialPlanningRecords:
          s.context?.commercialZones.features.filter(
            (f) =>
              normal(f.properties.municipality) === normal(m.properties.name),
          ).length ?? null,
        aiaRecords: d.aia.features.filter(
          (f) =>
            normal(f.properties.municipality) === normal(m.properties.name),
        ).length,
      },
      station: {
        worldcoverPoint: soil,
        industrialPlanningRecords: station
          ? (s.context?.industrialZones.features
              .filter((f) => covers(f.geometry, station.coordinates))
              .map((f) => f.properties.id) ?? null)
          : null,
        commercialPlanningRecords: station
          ? (s.context?.commercialZones.features
              .filter((f) => covers(f.geometry, station.coordinates))
              .map((f) => f.properties.id) ?? null)
          : null,
        aiaWithin1000m: station
          ? d.aia.features
              .filter(
                (f) =>
                  distance(station.coordinates, f.geometry.coordinates) <= 1000,
              )
              .map((f) => f.properties.id)
          : [],
      },
    },
    sourceStatus: { ...d.sourceStatus, ...s.context?.sourceStatus },
    sources: [...d.sources, ...(s.context?.sources ?? [])],
    limitations: [
      "Annual emission estimates and daily ambient statistics have different units and meanings.",
      "The API does not expose the official validation stage; insufficient data remain missing.",
      "No wind simulation, causal attribution, spatial interpolation or exposure estimate.",
    ],
  };
}
export function csvCell(value: unknown) {
  if (typeof value === "number")
    return Number.isFinite(value) ? String(value).replace(".", ",") : "";
  const s = String(value ?? "");
  return (
    '"' + (/^[=+\-@\t\r]/.test(s) ? "'" : "") + s.replace(/"/g, '""') + '"'
  );
}
