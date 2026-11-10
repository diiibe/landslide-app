import { isNatureSpace, type Experience } from "./types";
export function MiniMap({ scene }: { scene: Experience }) {
  if (scene.id === "landslides")
    return (
      <img
        src={`${import.meta.env.BASE_URL}images/space-frane.svg`}
        alt="Anteprima della mappatura delle frane"
      />
    );
  if (isNatureSpace(scene.id)) return <img src={`${import.meta.env.BASE_URL}images/space-${scene.id}.svg`} alt={`Anteprima di ${scene.title}`}/>;
  const points = [
    ...scene.perimeter!.coordinates[0]!,
    ...scene.routes.flatMap((r) => r.coordinates),
  ];
  const xs = points.map((p) => p[0]!),
    ys = points.map((p) => p[1]!),
    minX = Math.min(...xs),
    maxX = Math.max(...xs),
    minY = Math.min(...ys),
    maxY = Math.max(...ys);
  const xy = (p: number[]) => [
    14 + ((p[0]! - minX) / (maxX - minX)) * 212,
    102 - ((p[1]! - minY) / (maxY - minY)) * 90,
  ];
  const path = (p: number[][]) => p.map((p) => xy(p).join(",")).join(" ");
  return (
    <svg viewBox="0 0 240 116" aria-hidden="true">
      <defs>
        <pattern
          id={`grid-${scene.id}`}
          width="20"
          height="20"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M20 0H0V20"
            fill="none"
            stroke="currentColor"
            strokeWidth=".4"
            opacity=".16"
          />
        </pattern>
      </defs>
      <rect width="240" height="116" fill={`url(#grid-${scene.id})`} />
      <polygon
        points={path(scene.perimeter!.coordinates[0]!)}
        fill={scene.tone}
        fillOpacity=".06"
        stroke={scene.tone}
        strokeDasharray="3 2"
      />
      {scene.zones.map((z) => (
        <polygon
          key={z.id}
          points={path(z.geometry.coordinates[0]!)}
          fill={z.color}
          fillOpacity=".45"
          stroke={z.color}
          strokeWidth=".6"
        />
      ))}
      {scene.routes.map((r) => (
        <polyline
          key={r.id}
          points={path(r.coordinates)}
          fill="none"
          stroke={scene.tone}
          strokeWidth="1.4"
        />
      ))}
      {scene.sensors.map((s) => {
        const [x, y] = xy(s.coordinates);
        return (
          <circle
            key={s.id}
            cx={x}
            cy={y}
            r="2.2"
            fill={scene.tone}
            stroke="var(--c-surface)"
            strokeWidth=".8"
          />
        );
      })}
    </svg>
  );
}
