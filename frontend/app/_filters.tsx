"use client";

export function FilterBar({
  query,
  setQuery,
  status,
  setStatus,
  statuses = [],
  statusLabel = "All statuses",
  count,
  total,
  onClear,
}: {
  query: string;
  setQuery: (value: string) => void;
  status?: string;
  setStatus?: (value: string) => void;
  statuses?: string[];
  statusLabel?: string;
  count: number;
  total: number;
  onClear?: () => void;
}) {
  const active = Boolean(query || status);
  return (
    <div className="filterBar" role="search">
      <input
        className="search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search visible records…"
        aria-label="Search visible records"
      />
      {setStatus && (
        <select
          className="filterSelect"
          value={status || ""}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Filter by status or type"
        >
          <option value="">{statusLabel}</option>
          {statuses.map((value) => (
            <option key={value} value={value}>
              {label(value)}
            </option>
          ))}
        </select>
      )}
      {active && (
        <button
          className="ghost"
          type="button"
          onClick={() => {
            setQuery("");
            setStatus?.("");
            onClear?.();
          }}
        >
          Clear filters
        </button>
      )}
      <span className="filterCount">
        Showing {count} of {total}
      </span>
    </div>
  );
}

export function searchable(row: any) {
  return JSON.stringify(row, (_key, value) =>
    typeof value === "string" || typeof value === "number" ? value : value,
  ).toLowerCase();
}

export function filterRows<T>(
  rows: T[],
  query: string,
  status = "",
  statusOf?: (row: T) => string | undefined,
) {
  const term = query.trim().toLowerCase();
  return rows.filter(
    (row) =>
      (!term || searchable(row).includes(term)) &&
      (!status || statusOf?.(row) === status),
  );
}

export function unique(values: (string | undefined | null)[]) {
  return [...new Set(values.filter(Boolean) as string[])].sort();
}

function label(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
