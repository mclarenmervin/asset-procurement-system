"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "../../lib/api";
import { Shell } from "../_components";
export default function Dashboard() {
  const [d, setD] = useState<any>(null);
  useEffect(() => {
    api("/dashboard")
      .then(setD)
      .catch(() => (location.href = "/login"));
  }, []);
  return (
    <Shell title="Operations Dashboard">
      {!d ? (
        <p>Loading...</p>
      ) : (
        <>
          <div className="grid">
            <Card n={d.assets} t="Tracked Assets" href="/assets" />
            <Card n={d.vendors} t="Active Vendors" href="/vendors" />
            <Card n={d.openPurchaseOrders} t="Open POs" href="/procurement" />
            <Card n={d.maintenance} t="Maintenance" href="/maintenance" />
            <Card n={d.expiringSoon} t="Expiring ≤ 90 days" href="/assets" />
          </div>
          <div className="card section tableWrap">
            <h3>Recent Asset Movement</h3>
            <table className="table">
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>Movement</th>
                  <th>From</th>
                  <th>To</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {d.recentMovements.map((m: any) => (
                  <tr key={m.id}>
                    <td>
                      <Link
                        className="tableLink"
                        href={`/assets/${m.asset.id}`}
                      >
                        {m.asset.assetTag}
                      </Link>
                    </td>
                    <td>
                      <span className="badge">{m.type}</span>
                    </td>
                    <td>{m.fromLocation?.name || "—"}</td>
                    <td>{m.toLocation?.name || "—"}</td>
                    <td>{new Date(m.movedAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Shell>
  );
}
function Card({ n, t, href }: { n: any; t: string; href: string }) {
  return (
    <Link href={href} className="card metricCard">
      <div className="muted">{t}</div>
      <div className="metric">{n}</div>
      <span>View details →</span>
    </Link>
  );
}
