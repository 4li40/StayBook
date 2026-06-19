import { Checkbox } from "@StayBook/ui/components/checkbox";
import { Input } from "@StayBook/ui/components/input";
import { Label } from "@StayBook/ui/components/label";
import { SlidersHorizontal, X } from "lucide-react";
import { useMemo } from "react";

import { formatCents } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { RoomFilterOptions } from "@/lib/api";

export type RoomFiltersState = {
  priceMin: number | null;
  priceMax: number | null;
  types: string[];
  amenityIds: string[];
  onlyAvailable: boolean;
};

export const defaultRoomFilters: RoomFiltersState = {
  priceMin: null,
  priceMax: null,
  types: [],
  amenityIds: [],
  onlyAvailable: false,
};

export function countActiveFilters(filters: RoomFiltersState): number {
  let count = 0;
  if (filters.priceMin != null) count += 1;
  if (filters.priceMax != null) count += 1;
  if (filters.types.length > 0) count += 1;
  if (filters.amenityIds.length > 0) count += 1;
  if (filters.onlyAvailable) count += 1;
  return count;
}

type RoomFiltersProps = {
  options: RoomFilterOptions;
  filters: RoomFiltersState;
  onChange: (next: RoomFiltersState) => void;
  resultCount: number;
  totalCount: number;
};

export default function RoomFilters({
  options,
  filters,
  onChange,
  resultCount,
  totalCount,
}: RoomFiltersProps) {
  const types = useMemo(
    () => [...options.types].sort((a, b) => a.localeCompare(b)),
    [options.types],
  );
  const amenities = useMemo(
    () =>
      [...options.amenities].sort((a, b) => a.name.localeCompare(b.name)),
    [options.amenities],
  );
  const priceBounds = options.priceBounds;

  const activeCount = countActiveFilters(filters);
  const hasFilters = activeCount > 0;

  function update(patch: Partial<RoomFiltersState>) {
    onChange({ ...filters, ...patch });
  }

  function toggleType(type: string, checked: boolean) {
    const next = checked
      ? Array.from(new Set([...filters.types, type]))
      : filters.types.filter((value) => value !== type);
    update({ types: next });
  }

  function toggleAmenity(id: string, checked: boolean) {
    const next = checked
      ? Array.from(new Set([...filters.amenityIds, id]))
      : filters.amenityIds.filter((value) => value !== id);
    update({ amenityIds: next });
  }

  function setPriceDollars(
    field: "priceMin" | "priceMax",
    raw: string,
  ) {
    const trimmed = raw.trim();
    if (trimmed === "") {
      update({ [field]: null } as Partial<RoomFiltersState>);
      return;
    }
    const dollars = Number(trimmed);
    if (!Number.isFinite(dollars) || dollars < 0) return;
    update({ [field]: Math.round(dollars * 100) } as Partial<RoomFiltersState>);
  }

  function clearAll() {
    onChange(defaultRoomFilters);
  }

  return (
    <aside
      aria-label="Filter rooms"
      className="flex flex-col gap-5 rounded-xl border border-ghost-border bg-card p-5 shadow-[0_8px_28px_rgba(26,43,60,0.04)] lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto"
    >
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <h2 className="font-heading text-lg text-foreground tracking-tight">
            Filters
          </h2>
          {hasFilters ? (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
              {activeCount}
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={clearAll}
          disabled={!hasFilters}
          className={cn(
            "inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground",
            !hasFilters && "cursor-not-allowed opacity-50",
          )}
        >
          <X className="h-3 w-3" aria-hidden="true" />
          Clear all
        </button>
      </header>

      <p className="-mt-2 text-xs text-muted-foreground">
        Showing <span className="font-semibold text-foreground tabular-nums">{resultCount}</span> of{" "}
        <span className="font-semibold text-foreground tabular-nums">{totalCount}</span> rooms
      </p>

      <FilterSection title="Price per night" id="filter-price">
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="filter-price-min" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
              Min ($)
            </Label>
            <Input
              id="filter-price-min"
              type="number"
              min="0"
              inputMode="numeric"
              placeholder={priceBounds.min ? String(Math.floor(priceBounds.min / 100)) : "0"}
              value={filters.priceMin != null ? String(Math.floor(filters.priceMin / 100)) : ""}
              onChange={(event) => setPriceDollars("priceMin", event.target.value)}
              className="h-9 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="filter-price-max" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
              Max ($)
            </Label>
            <Input
              id="filter-price-max"
              type="number"
              min="0"
              inputMode="numeric"
              placeholder={priceBounds.max ? String(Math.ceil(priceBounds.max / 100)) : "—"}
              value={filters.priceMax != null ? String(Math.ceil(filters.priceMax / 100)) : ""}
              onChange={(event) => setPriceDollars("priceMax", event.target.value)}
              className="h-9 text-sm"
            />
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground/80">
          {formatCents(priceBounds.min)} – {formatCents(priceBounds.max)}
        </p>
      </FilterSection>

      <FilterSection title="Room type" id="filter-type">
        {types.length > 0 ? (
          <ul className="flex flex-col gap-1.5">
            {types.map((type) => {
              const checked = filters.types.includes(type);
              return (
                <li key={type}>
                  <label className="flex min-h-7 cursor-pointer items-center gap-2.5 text-sm capitalize">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(value) => toggleType(type, value === true)}
                    />
                    <span>{type}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">No types available.</p>
        )}
      </FilterSection>

      <FilterSection title="Amenities" id="filter-amenities">
        {amenities.length > 0 ? (
          <ul className="flex flex-col gap-1.5">
            {amenities.map((amenity) => {
              const checked = filters.amenityIds.includes(amenity.id);
              return (
                <li key={amenity.id}>
                  <label className="flex min-h-7 cursor-pointer items-center gap-2.5 text-sm">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(value) => toggleAmenity(amenity.id, value === true)}
                    />
                    <span>{amenity.name}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">No amenities listed.</p>
        )}
      </FilterSection>

      <FilterSection title="Availability" id="filter-availability">
        <label className="flex min-h-7 cursor-pointer items-center gap-2.5 text-sm">
          <Checkbox
            checked={filters.onlyAvailable}
            onCheckedChange={(value) =>
              update({ onlyAvailable: value === true })
            }
          />
          <span>Only show available rooms</span>
        </label>
      </FilterSection>
    </aside>
  );
}

function FilterSection({
  title,
  id,
  children,
}: {
  title: string;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={`${id}-heading`} className="flex flex-col gap-2 border-t border-border/60 pt-4 first:border-t-0 first:pt-0">
      <h3
        id={`${id}-heading`}
        className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80"
      >
        {title}
      </h3>
      {children}
    </section>
  );
}
