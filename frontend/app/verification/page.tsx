"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "../../lib/api";
import { Shell } from "../_components";
import { FilterBar, filterRows, unique } from "../_filters";
export default function Verification() {
  const [sessions, setSessions] = useState<any[]>([]),
    [locations, setLocations] = useState<any[]>([]),
    [selected, setSelected] = useState<any>(null),
    [form, setForm] = useState(false),
    [query, setQuery] = useState(""),
    [status, setStatus] = useState(""),
    [error, setError] = useState("");
  const filteredSessions = filterRows(
    sessions,
    query,
    status,
    (row: any) => row.status,
  );
  async function load(id?: string) {
    try {
      const [s, l] = await Promise.all([
        api("/verification/sessions"),
        api("/locations"),
      ]);
      setSessions(s);
      setLocations(l);
      const target = id || selected?.id;
      if (target) setSelected(await api("/verification/sessions/" + target));
    } catch (e: any) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
  }, []);
  async function act(path: string, body?: any) {
    try {
      const row = await api(path, {
        method: "POST",
        body: body ? JSON.stringify(body) : undefined,
      });
      setForm(false);
      await load(row?.sessionId || row?.id || selected?.id);
      return row;
    } catch (e: any) {
      setError(e.message);
    }
  }
  return (
    <Shell title="Physical Asset Verification">
      {error && <p className="error">{error}</p>}
      {selected ? (
        <Session
          session={selected}
          locations={locations}
          back={() => setSelected(null)}
          act={act}
        />
      ) : (
        <>
          <div className="sectionHead">
            <div>
              <h3>Verification sessions</h3>
              <span className="muted">
                Plan a location, scan assets, and close discrepancies.
              </span>
            </div>
            <button className="btn" onClick={() => setForm(true)}>
              + New session
            </button>
          </div>
          {form && (
            <SessionForm
              locations={locations}
              save={(b: any) => act("/verification/sessions", b)}
              close={() => setForm(false)}
            />
          )}
          <FilterBar
            query={query}
            setQuery={setQuery}
            status={status}
            setStatus={setStatus}
            statuses={unique(sessions.map((row) => row.status))}
            count={filteredSessions.length}
            total={sessions.length}
          />
          <div className="sessionGrid">
            {filteredSessions.map((s) => (
              <section className="card" key={s.id}>
                <div className="sectionHead">
                  <span className="badge">{s.status}</span>
                  <span className="muted">
                    {new Date(s.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <h3>{s.name}</h3>
                <p>
                  {s.sessionNumber} · {s.location?.name || "All locations"}
                </p>
                <div className="summaryPills">
                  <span>Scanned {s.summary.total || 0}</span>
                  <span className="ok">Found {s.summary.FOUND || 0}</span>
                  <span className="bad">
                    Missing {s.summary.NOT_FOUND || 0}
                  </span>
                </div>
                <button
                  className="ghost full"
                  onClick={async () =>
                    setSelected(await api("/verification/sessions/" + s.id))
                  }
                >
                  Open session
                </button>
              </section>
            ))}
            {!sessions.length && (
              <div className="card empty">No verification sessions yet.</div>
            )}
          </div>
        </>
      )}
    </Shell>
  );
}
function SessionForm({ locations, save, close }: any) {
  const [f, set] = useState({
    sessionNumber: "PV-" + new Date().getFullYear() + "-",
    name: "",
    locationId: "",
    notes: "",
  });
  return (
    <form
      className="card section workflowForm"
      onSubmit={(e) => {
        e.preventDefault();
        save(f);
      }}
    >
      <label>
        Session number
        <input
          required
          className="input"
          value={f.sessionNumber}
          onChange={(e) => set({ ...f, sessionNumber: e.target.value })}
        />
      </label>
      <label>
        Name
        <input
          required
          className="input"
          value={f.name}
          onChange={(e) => set({ ...f, name: e.target.value })}
        />
      </label>
      <label>
        Location scope
        <select
          className="input"
          value={f.locationId}
          onChange={(e) => set({ ...f, locationId: e.target.value })}
        >
          <option value="">All locations</option>
          {locations.map((l: any) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Notes
        <input
          className="input"
          value={f.notes}
          onChange={(e) => set({ ...f, notes: e.target.value })}
        />
      </label>
      <div className="formActions">
        <button type="button" className="ghost" onClick={close}>
          Cancel
        </button>
        <button className="btn">Create</button>
      </div>
    </form>
  );
}
function Session({ session, locations, back, act }: any) {
  const [code, setCode] = useState(""),
    [result, setResult] = useState("FOUND"),
    [observedLocationId, setLocation] = useState(session.locationId || ""),
    [notes, setNotes] = useState(""),
    [coords, setCoords] = useState<any>({}),
    [camera, setCamera] = useState(false),
    [last, setLast] = useState<any>(null),
    [query, setQuery] = useState(""),
    [status, setStatus] = useState("");
  const filteredRecords = filterRows(
    session.records,
    query,
    status,
    (row: any) => row.result,
  );
  async function scan(e?: React.FormEvent) {
    e?.preventDefault();
    if (!code) return;
    const row = await act(`/verification/sessions/${session.id}/scan`, {
      code,
      result,
      observedLocationId,
      notes,
      ...coords,
    });
    if (row) {
      setLast(row);
      setCode("");
      setNotes("");
      setCamera(false);
    }
  }
  function gps() {
    navigator.geolocation?.getCurrentPosition(
      (p) =>
        setCoords({
          latitude: p.coords.latitude,
          longitude: p.coords.longitude,
        }),
      () => alert("Location permission was not granted"),
    );
  }
  return (
    <>
      <div className="sectionHead">
        <button className="ghost" onClick={back}>
          ← All sessions
        </button>
        <div className="sessionActions">
          {session.status === "PLANNED" && (
            <button
              className="btn"
              onClick={() => act(`/verification/sessions/${session.id}/start`)}
            >
              Start session
            </button>
          )}
          {session.status === "IN_PROGRESS" && (
            <button
              className="btn"
              onClick={() =>
                confirm(
                  "Complete session and mark unscanned expected assets as not found?",
                ) && act(`/verification/sessions/${session.id}/complete`)
              }
            >
              Complete session
            </button>
          )}
        </div>
      </div>
      <section className="card sessionHero">
        <div>
          <span className="badge">{session.status}</span>
          <h2>{session.name}</h2>
          <p>
            {session.sessionNumber} ·{" "}
            {session.location?.name || "All locations"} ·{" "}
            {session.expectedAssets} expected assets
          </p>
        </div>
        <div className="summaryPills largePills">
          {Object.entries(session.summary).map(([k, v]) => (
            <span
              key={k}
              className={k === "FOUND" ? "ok" : k === "total" ? "" : "bad"}
            >
              {k.replaceAll("_", " ")}: {String(v)}
            </span>
          ))}
        </div>
      </section>
      {session.status === "IN_PROGRESS" && (
        <section className="scanLayout">
          <div className="card">
            <div className="sectionHead">
              <h3>Scan asset QR</h3>
              <button className="ghost" onClick={() => setCamera(!camera)}>
                {camera ? "Stop camera" : "Use camera"}
              </button>
            </div>
            {camera && <Camera onCode={setCode} />}
            <form className="scanForm" onSubmit={scan}>
              <label>
                QR value or asset tag
                <input
                  autoFocus
                  required
                  className="input"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="ASSET:ORG-LOCATION-0001"
                />
              </label>
              <label>
                Observed location
                <select
                  className="input"
                  value={observedLocationId}
                  onChange={(e) => setLocation(e.target.value)}
                >
                  <option value="">Unknown</option>
                  {locations.map((l: any) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Condition
                <select
                  className="input"
                  value={result}
                  onChange={(e) => setResult(e.target.value)}
                >
                  {[
                    "FOUND",
                    "DAMAGED",
                    "UNDER_REPAIR",
                    "UNAUTHORIZED_MOVEMENT",
                  ].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
              <label>
                Notes
                <input
                  className="input"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </label>
              <div className="scanButtons">
                <button type="button" className="ghost" onClick={gps}>
                  {coords.latitude ? "GPS captured" : "Capture GPS"}
                </button>
                <button className="btn">Record scan</button>
              </div>
            </form>
            {last && (
              <div
                className={`scanResult ${last.result === "FOUND" ? "ok" : "bad"}`}
              >
                <Link className="tableLink" href={`/assets/${last.asset.id}`}>
                  {last.asset.assetTag}
                </Link>{" "}
                · {last.asset.product.name}
                <span>{last.result.replaceAll("_", " ")}</span>
              </div>
            )}
          </div>
        </section>
      )}
      <section className="card section">
        <h3>Verification records</h3>
        <FilterBar
          query={query}
          setQuery={setQuery}
          status={status}
          setStatus={setStatus}
          statuses={unique(session.records.map((row: any) => row.result))}
          statusLabel="All results"
          count={filteredRecords.length}
          total={session.records.length}
        />
        <div className="tableWrap">
          <table className="table">
            <thead>
              <tr>
                <th>Asset</th>
                <th>Expected</th>
                <th>Observed</th>
                <th>Result</th>
                <th>Scanned</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((r: any) => (
                <tr key={r.id}>
                  <td>
                    <Link className="tableLink" href={`/assets/${r.asset.id}`}>
                      {r.asset.assetTag}
                    </Link>
                    <br />
                    <span className="muted">{r.asset.product.name}</span>
                  </td>
                  <td>{r.asset.currentLocation?.name || "—"}</td>
                  <td>{r.observedLocation?.name || "—"}</td>
                  <td>
                    <span className="badge">{r.result}</span>
                  </td>
                  <td>{new Date(r.scannedAt).toLocaleString()}</td>
                  <td>{r.notes || "—"}</td>
                </tr>
              ))}
              {!session.records.length && (
                <tr>
                  <td className="empty" colSpan={6}>
                    No assets scanned.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
function Camera({ onCode }: { onCode: (code: string) => void }) {
  useEffect(() => {
    let scanner: any;
    let active = true;
    import("html5-qrcode").then(({ Html5QrcodeScanner }) => {
      if (!active) return;
      scanner = new Html5QrcodeScanner(
        "qr-reader",
        { fps: 10, qrbox: { width: 240, height: 240 } },
        false,
      );
      scanner.render(
        (text: string) => {
          onCode(text);
          scanner.pause(true);
        },
        () => {},
      );
    });
    return () => {
      active = false;
      scanner?.clear().catch(() => {});
    };
  }, [onCode]);
  return <div id="qr-reader" className="camera" />;
}
