import { cn } from "../lib/cn";

export type RoomCell = {
  label: string;
  /** Marks this cell as the roof (spans the top, cinnabar fill, triangle). */
  roof?: boolean;
};

const DEFAULT_ROOMS: RoomCell[] = [
  { label: "Roof", roof: true },
  { label: "menu" },
  { label: "II" },
  { label: "III" },
  { label: "IV" },
  { label: "V" },
  { label: "VI" },
];

type RoomsGridProps = {
  rooms?: RoomCell[];
  className?: string;
};

/**
 * Seven-cell grid that fills room-by-room as scroll progress advances.
 * The host JS sets `--lit` on each `.ds-room` and toggles `.ds-room--on`
 * when lit > 0.5. Each room carries a `data-i` so the init script can
 * compute the per-cell threshold from index.
 */
export function RoomsGrid({ rooms = DEFAULT_ROOMS, className }: RoomsGridProps) {
  return (
    <div className={cn("ds-rooms", className)} aria-hidden="true">
      {rooms.map((r, i) => (
        <div
          key={`${r.label}-${i}`}
          className={cn("ds-room", r.roof && "ds-room--roof")}
          data-i={i}
        >
          <span className="ds-room__fill" />
          <span className="ds-room__label">{r.label}</span>
        </div>
      ))}
    </div>
  );
}
