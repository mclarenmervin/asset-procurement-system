"use client";
import { useEffect, useState } from "react";
import { api, download } from "../../lib/api";
import { Shell } from "../_components";
import { FilterBar, filterRows } from "../_filters";
const exports = [
  ["assets", "Asset Register"],
  ["movements", "Asset Movements"],
  ["procurement", "Purchase Orders"],
  ["stock", "Stock Register"],
  ["maintenance", "Maintenance Register"],
  ["verification", "Verification Results"],
];
export default function Reports() {
  const [d, setD] = useState<any>(null),
    [error, setError] = useState(""),
    [query, setQuery] = useState("");
  useEffect(() => {
    api("/reports/analytics")
      .then(setD)
      .catch((e) => setError(e.message));
  }, []);
  if (!d)
    return (
      <Shell title="Reports & Analytics">
        <p>{error || "Loading analytics…"}</p>
      </Shell>
    );
  const groups = [
    d.assetsByStatus,
    d.assetsByCategory,
    d.assetsByLocation,
    d.purchaseOrders,
    d.stockByProduct,
    d.verification,
    d.vendorSpend,
    d.maintenance,
  ];
  const filtered = groups.map((rows) => filterRows(rows, query));
  const total = groups.reduce((sum, rows) => sum + rows.length, 0),
    count = filtered.reduce((sum, rows) => sum + rows.length, 0);
  return (
    <Shell title="Reports & Analytics">
      <div className="reportTop">
        <span className="muted">
          Generated {new Date(d.generatedAt).toLocaleString()}
        </span>
        <div className="exportMenu">
          {exports.map(([key, label]) => (
            <button
              className="ghost"
              key={key}
              onClick={() => download(`/reports/export/${key}`, `${key}.xlsx`)}
            >
              ↓ {label} · Excel
            </button>
          ))}
        </div>
      </div>
      <div className="reportMetrics">
        <Metric label="Asset value" value={money(d.summary.assetValue)} />
        <Metric label="Tracked assets" value={d.summary.assetCount} />
        <Metric
          label="Open purchase orders"
          value={d.summary.openPurchaseOrders}
        />
        <Metric label="Available stock units" value={d.summary.stockUnits} />
        <Metric
          label="Maintenance cost"
          value={money(d.summary.maintenanceCost)}
        />
        <Metric label="Compliance due ≤60d" value={d.summary.dueCompliance} />
      </div>
      <FilterBar
        query={query}
        setQuery={setQuery}
        count={count}
        total={total}
      />
      <div className="chartGrid">
        <Chart title="Assets by status" rows={filtered[0]} />
        <Chart title="Assets by category" rows={filtered[1]} />
        <Chart title="Assets by location" rows={filtered[2]} />
        <Chart title="Purchase-order status" rows={filtered[3]} />
        <Chart title="Stock by material" rows={filtered[4]} />
        <Chart title="Verification results" rows={filtered[5]} />
      </div>
      <section className="card section">
        <h3>Vendor spend</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Vendor</th>
              <th>Orders</th>
              <th>Total spend</th>
              <th>Share</th>
            </tr>
          </thead>
          <tbody>
            {filtered[6].map((v: any) => (
              <tr key={v.label}>
                <td>{v.label}</td>
                <td>{v.orders}</td>
                <td>{money(v.value)}</td>
                <td>
                  <InlineBar
                    value={v.value}
                    max={Math.max(...d.vendorSpend.map((x: any) => x.value), 1)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="card section">
        <h3>Maintenance cost by type</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Jobs</th>
              <th>Cost</th>
            </tr>
          </thead>
          <tbody>
            {filtered[7].map((m: any) => (
              <tr key={m.label}>
                <td>{m.label}</td>
                <td>{m.value}</td>
                <td>{money(m.cost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </Shell>
  );
}
function Metric({ label, value }: any) {
  return (
    <div className="card">
      <span className="muted">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
function Chart({ title, rows }: any) {
  const max = Math.max(...rows.map((x: any) => x.value), 1);
  return (
    <section className="card chart">
      <h3>{title}</h3>
      {rows.slice(0, 8).map((r: any) => (
        <div className="barRow" key={r.label}>
          <div>
            <span>{String(r.label).replaceAll("_", " ")}</span>
            <b>{r.value}</b>
          </div>
          <InlineBar value={r.value} max={max} />
        </div>
      ))}
      {!rows.length && <p className="muted">No data available.</p>}
    </section>
  );
}
function InlineBar({ value, max }: any) {
  return (
    <div className="barTrack">
      <span style={{ width: `${Math.max(3, (value / max) * 100)}%` }} />
    </div>
  );
}
function money(v: any) {
  return `₹${Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}
