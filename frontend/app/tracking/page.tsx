"use client";
import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { usePermission } from "../../lib/rbac";
import { Shell } from "../_components";
import { FilterBar, filterRows, unique } from "../_filters";

const blankDevice = {
  deviceUid: "",
  name: "",
  model: "",
  protocol: "HTTPS",
  simNumber: "",
  status: "ACTIVE",
  batteryThreshold: 20,
  offlineAfterMinutes: 30,
  speedLimitKph: "",
};
const blankFence = {
  name: "",
  latitude: "20.2961",
  longitude: "85.8245",
  radiusMeters: 500,
  assetId: "",
  active: true,
};
export default function Tracking() {
  const mayManage = usePermission("tracking.manage");
  const [data, setData] = useState<any>({
      devices: [],
      geofences: [],
      alerts: [],
      assets: [],
    }),
    [tab, setTab] = useState("live"),
    [query, setQuery] = useState(""),
    [status, setStatus] = useState(""),
    [deviceForm, setDeviceForm] = useState<any>(null),
    [fenceForm, setFenceForm] = useState<any>(null),
    [credentials, setCredentials] = useState<any>(null),
    [simulator, setSimulator] = useState<any>(null),
    [history, setHistory] = useState<any>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    try {
      setData(await api("/tracking/overview"));
    } catch (e: any) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
  }, []);
  const activeRows =
    tab === "geofences"
      ? data.geofences
      : tab === "alerts"
        ? data.alerts
        : data.devices;
  const stateOf = (row: any) =>
    tab === "alerts"
      ? row.acknowledgedAt
        ? "ACKNOWLEDGED"
        : row.severity
      : tab === "geofences"
        ? row.active
          ? "ACTIVE"
          : "INACTIVE"
        : connection(row);
  const rows = filterRows(activeRows, query, status, stateOf);
  async function post(path: string, body?: any, method = "POST") {
    setBusy(true);
    setError("");
    try {
      const result = await api(path, {
        method,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      await load();
      return result;
    } catch (e: any) {
      setError(e.message);
      throw e;
    } finally {
      setBusy(false);
    }
  }
  async function createDevice(e: React.FormEvent) {
    e.preventDefault();
    try {
      const result = await post("/tracking/devices", deviceForm);
      setCredentials({ deviceId: result.deviceUid, apiKey: result.apiKey });
      setDeviceForm(null);
    } catch {}
  }
  async function createFence(e: React.FormEvent) {
    e.preventDefault();
    try {
      await post("/tracking/geofences", fenceForm);
      setFenceForm(null);
    } catch {}
  }
  async function simulate(e: React.FormEvent) {
    e.preventDefault();
    try {
      await post(`/tracking/devices/${simulator.id}/simulate`, {
        ...simulator,
        recordedAt: new Date().toISOString(),
      });
      setSimulator(null);
    } catch {}
  }
  async function showHistory(device: any) {
    try {
      setHistory({
        device,
        points: await api(`/tracking/devices/${device.id}/history?limit=500`),
      });
    } catch (e: any) {
      setError(e.message);
    }
  }
  return (
    <Shell title="Movable Asset GPS Tracking">
      <div className="trackingMetrics">
        <Metric label="Trackers" value={data.devices.length} />
        <Metric
          label="Online"
          value={
            data.devices.filter((d: any) => connection(d) === "ONLINE").length
          }
          tone="ok"
        />
        <Metric
          label="Open alerts"
          value={data.alerts.filter((a: any) => !a.acknowledgedAt).length}
          tone="bad"
        />
        <Metric
          label="Geofences"
          value={data.geofences.filter((g: any) => g.active).length}
        />
      </div>
      <div className="tabs trackingTabs">
        {[
          ["live", "Live locations"],
          ["devices", "Devices"],
          ["geofences", "Geofences"],
          ["alerts", "Alerts"],
        ].map(([key, label]) => (
          <button
            key={key}
            className={tab === key ? "active" : ""}
            onClick={() => {
              setTab(key);
              setQuery("");
              setStatus("");
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="sectionHead trackingHead">
        <p className="muted">
          Hardware-independent HTTPS telemetry · MQTT adapters can be connected
          later.
        </p>
        <div className="rowActions">
          {mayManage && (
            <button
              className="ghost"
              onClick={() => post("/tracking/scan-offline")}
            >
              Scan offline
            </button>
          )}
          {mayManage && tab === "devices" && (
            <button
              className="btn"
              onClick={() => setDeviceForm({ ...blankDevice })}
            >
              + Register device
            </button>
          )}
          {mayManage && tab === "geofences" && (
            <button
              className="btn"
              onClick={() => setFenceForm({ ...blankFence })}
            >
              + Geofence
            </button>
          )}
        </div>
      </div>
      {error && <p className="error">{error}</p>}
      <FilterBar
        query={query}
        setQuery={setQuery}
        status={status}
        setStatus={setStatus}
        statuses={unique(activeRows.map(stateOf))}
        count={rows.length}
        total={activeRows.length}
      />
      {tab === "live" && (
        <LiveDevices
          rows={rows}
          manage={!!mayManage}
          simulate={setSimulator}
          history={showHistory}
        />
      )}
      {tab === "devices" && (
        <Devices
          rows={rows}
          assets={data.assets}
          manage={!!mayManage}
          post={post}
          credentials={setCredentials}
        />
      )}
      {tab === "geofences" && (
        <Geofences
          rows={rows}
          manage={!!mayManage}
          remove={(id: string) =>
            confirm("Delete this geofence?") &&
            post("/tracking/geofences/" + id, undefined, "DELETE")
          }
        />
      )}
      {tab === "alerts" && (
        <Alerts
          rows={rows}
          manage={!!mayManage}
          acknowledge={(id: string) =>
            post(`/tracking/alerts/${id}/acknowledge`)
          }
        />
      )}
      {deviceForm && (
        <Modal title="Register IoT tracker" close={() => setDeviceForm(null)}>
          <form className="trackingForm" onSubmit={createDevice}>
            <Input
              label="Device ID / IMEI"
              field="deviceUid"
              form={deviceForm}
              set={setDeviceForm}
              required
            />
            <Input
              label="Device name"
              field="name"
              form={deviceForm}
              set={setDeviceForm}
              required
            />
            <Input
              label="Model"
              field="model"
              form={deviceForm}
              set={setDeviceForm}
            />
            <Input
              label="SIM number"
              field="simNumber"
              form={deviceForm}
              set={setDeviceForm}
            />
            <Input
              label="Offline after minutes"
              field="offlineAfterMinutes"
              type="number"
              form={deviceForm}
              set={setDeviceForm}
            />
            <Input
              label="Low battery threshold %"
              field="batteryThreshold"
              type="number"
              form={deviceForm}
              set={setDeviceForm}
            />
            <Input
              label="Speed limit km/h"
              field="speedLimitKph"
              type="number"
              form={deviceForm}
              set={setDeviceForm}
            />
            <button disabled={busy} className="btn">
              Register tracker
            </button>
          </form>
        </Modal>
      )}
      {fenceForm && (
        <Modal
          title="Create circular geofence"
          close={() => setFenceForm(null)}
        >
          <form className="trackingForm" onSubmit={createFence}>
            <Input
              label="Geofence name"
              field="name"
              form={fenceForm}
              set={setFenceForm}
              required
            />
            <Input
              label="Latitude"
              field="latitude"
              type="number"
              form={fenceForm}
              set={setFenceForm}
              required
            />
            <Input
              label="Longitude"
              field="longitude"
              type="number"
              form={fenceForm}
              set={setFenceForm}
              required
            />
            <Input
              label="Radius (metres)"
              field="radiusMeters"
              type="number"
              form={fenceForm}
              set={setFenceForm}
              required
            />
            <label>
              Apply to asset
              <select
                className="input"
                value={fenceForm.assetId}
                onChange={(e) =>
                  setFenceForm({ ...fenceForm, assetId: e.target.value })
                }
              >
                <option value="">All tracked assets</option>
                {data.assets.map((a: any) => (
                  <option key={a.id} value={a.id}>
                    {a.assetTag} · {a.product.name}
                  </option>
                ))}
              </select>
            </label>
            <button disabled={busy} className="btn">
              Create geofence
            </button>
          </form>
        </Modal>
      )}
      {simulator && (
        <Modal
          title={`Simulate ${simulator.name}`}
          close={() => setSimulator(null)}
        >
          <form className="trackingForm" onSubmit={simulate}>
            <Input
              label="Latitude"
              field="latitude"
              type="number"
              form={simulator}
              set={setSimulator}
              required
            />
            <Input
              label="Longitude"
              field="longitude"
              type="number"
              form={simulator}
              set={setSimulator}
              required
            />
            <Input
              label="Speed km/h"
              field="speedKph"
              type="number"
              form={simulator}
              set={setSimulator}
            />
            <Input
              label="Battery %"
              field="batteryPercent"
              type="number"
              form={simulator}
              set={setSimulator}
            />
            <label className="check">
              <input
                type="checkbox"
                checked={!!simulator.motion}
                onChange={(e) =>
                  setSimulator({ ...simulator, motion: e.target.checked })
                }
              />{" "}
              Motion detected
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={!!simulator.tamper}
                onChange={(e) =>
                  setSimulator({ ...simulator, tamper: e.target.checked })
                }
              />{" "}
              Tamper alert
            </label>
            <button disabled={busy} className="btn">
              Send telemetry
            </button>
          </form>
        </Modal>
      )}
      {credentials && (
        <Modal
          title="Save device credentials"
          close={() => setCredentials(null)}
        >
          <div className="credentialBox">
            <p>
              This API key is shown only once. Store it securely for device
              configuration.
            </p>
            <label>
              Device ID<code>{credentials.deviceId}</code>
            </label>
            <label>
              API key<code>{credentials.apiKey}</code>
            </label>
            <button
              className="ghost"
              onClick={() =>
                navigator.clipboard.writeText(
                  `Device ID: ${credentials.deviceId}\nAPI key: ${credentials.apiKey}`,
                )
              }
            >
              Copy credentials
            </button>
          </div>
        </Modal>
      )}
      {history && (
        <Modal
          title={`Route history · ${history.device.name}`}
          close={() => setHistory(null)}
        >
          <div className="historyList">
            {history.points.map((p: any) => (
              <a
                key={p.id}
                target="_blank"
                rel="noreferrer"
                href={mapUrl(p.latitude, p.longitude)}
              >
                <b>{new Date(p.recordedAt).toLocaleString()}</b>
                <span>
                  {p.latitude.toFixed(6)}, {p.longitude.toFixed(6)} ·{" "}
                  {p.speedKph ?? 0} km/h · {p.batteryPercent ?? "—"}%
                </span>
              </a>
            ))}
            {!history.points.length && (
              <p className="empty">No telemetry received yet.</p>
            )}
          </div>
        </Modal>
      )}
    </Shell>
  );
}
function Metric({ label, value, tone = "" }: any) {
  return (
    <div className={`card trackingMetric ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
function LiveDevices({ rows, manage, simulate, history }: any) {
  return (
    <div className="trackingGrid">
      {rows.map((d: any) => (
        <article className="card trackerCard" key={d.id}>
          <div className="sectionHead">
            <span className={`connection ${connection(d).toLowerCase()}`}>
              {connection(d)}
            </span>
            <span className="badge">{d.status}</span>
          </div>
          <h3>{d.asset?.assetTag || d.name}</h3>
          <p>
            {d.asset?.product?.name || "Unassigned tracker"} · {d.deviceUid}
          </p>
          {d.lastLatitude != null ? (
            <>
              <a
                className="coordinate"
                target="_blank"
                rel="noreferrer"
                href={mapUrl(d.lastLatitude, d.lastLongitude)}
              >
                📍 {d.lastLatitude.toFixed(6)}, {d.lastLongitude.toFixed(6)}
              </a>
              <div className="telemetry">
                <span>
                  Speed <b>{d.lastSpeedKph ?? 0} km/h</b>
                </span>
                <span>
                  Battery <b>{d.lastBatteryPercent ?? "—"}%</b>
                </span>
                <span>
                  Updated <b>{ago(d.lastSeenAt)}</b>
                </span>
              </div>
            </>
          ) : (
            <p className="empty">Waiting for first GPS position.</p>
          )}
          <div className="rowActions">
            <button onClick={() => history(d)}>History</button>
            {manage && (
              <button
                onClick={() =>
                  simulate({
                    id: d.id,
                    name: d.name,
                    latitude: d.lastLatitude ?? "20.2961",
                    longitude: d.lastLongitude ?? "85.8245",
                    speedKph: 0,
                    batteryPercent: d.lastBatteryPercent ?? 80,
                    motion: true,
                    tamper: false,
                  })
                }
              >
                Simulate
              </button>
            )}
          </div>
        </article>
      ))}
      {!rows.length && (
        <div className="card empty">No tracking devices registered.</div>
      )}
    </div>
  );
}
function Devices({ rows, assets, manage, post, credentials }: any) {
  return (
    <div className="card tableWrap">
      <table className="table">
        <thead>
          <tr>
            <th>Device</th>
            <th>Assigned asset</th>
            <th>Protocol</th>
            <th>Last seen</th>
            <th>Rules</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((d: any) => (
            <tr key={d.id}>
              <td>
                <b>{d.name}</b>
                <br />
                <span className="mono muted">{d.deviceUid}</span>
              </td>
              <td>
                {manage ? (
                  <select
                    className="input compact"
                    value={d.assetId || ""}
                    onChange={(e) =>
                      post(`/tracking/devices/${d.id}/assign`, {
                        assetId: e.target.value || null,
                      })
                    }
                  >
                    <option value="">Unassigned</option>
                    {assets
                      .filter(
                        (a: any) => !a.trackerDevice || a.id === d.assetId,
                      )
                      .map((a: any) => (
                        <option key={a.id} value={a.id}>
                          {a.assetTag} · {a.product.name}
                        </option>
                      ))}
                  </select>
                ) : (
                  d.asset?.assetTag || "—"
                )}
              </td>
              <td>
                {d.protocol}
                <br />
                <span className={`connection ${connection(d).toLowerCase()}`}>
                  {connection(d)}
                </span>
              </td>
              <td>
                {d.lastSeenAt
                  ? new Date(d.lastSeenAt).toLocaleString()
                  : "Never"}
              </td>
              <td>
                Offline {d.offlineAfterMinutes}m<br />
                Battery ≤ {d.batteryThreshold}%
                {d.speedLimitKph ? (
                  <>
                    <br />
                    Speed &gt; {d.speedLimitKph}
                  </>
                ) : null}
              </td>
              <td>
                {manage && (
                  <div className="rowActions">
                    <button
                      className="ghost"
                      onClick={async () =>
                        credentials(
                          await post(`/tracking/devices/${d.id}/rotate-key`),
                        )
                      }
                    >
                      Rotate key
                    </button>
                    <button
                      className="danger"
                      onClick={() =>
                        confirm(`Delete ${d.name} and its location history?`) &&
                        post(`/tracking/devices/${d.id}`, undefined, "DELETE")
                      }
                    >
                      Delete
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td colSpan={6} className="empty">
                No devices registered.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
function Geofences({ rows, manage, remove }: any) {
  return (
    <div className="trackingGrid">
      {rows.map((g: any) => (
        <article className="card trackerCard" key={g.id}>
          <div className="sectionHead">
            <span className="badge">{g.active ? "ACTIVE" : "INACTIVE"}</span>
            {manage && (
              <button className="dangerLink" onClick={() => remove(g.id)}>
                Delete
              </button>
            )}
          </div>
          <h3>{g.name}</h3>
          <p>{g.asset?.assetTag || "All tracked assets"}</p>
          <a
            className="coordinate"
            target="_blank"
            rel="noreferrer"
            href={mapUrl(g.latitude, g.longitude)}
          >
            📍 {g.latitude.toFixed(6)}, {g.longitude.toFixed(6)}
          </a>
          <p>Radius: {Number(g.radiusMeters).toLocaleString()} metres</p>
        </article>
      ))}
      {!rows.length && (
        <div className="card empty">No geofences configured.</div>
      )}
    </div>
  );
}
function Alerts({ rows, acknowledge, manage }: any) {
  return (
    <div className="noticeList">
      {rows.map((a: any) => (
        <article
          className={`card trackingAlert ${a.severity.toLowerCase()} ${a.acknowledgedAt ? "read" : ""}`}
          key={a.id}
        >
          <div>
            <span className="badge">{a.severity}</span>
            <h3>{a.title}</h3>
            <p>{a.message}</p>
            <span className="muted">
              {a.asset?.assetTag || a.device.name} ·{" "}
              {new Date(a.createdAt).toLocaleString()}
            </span>
          </div>
          <div className="rowActions">
            {a.latitude != null && (
              <a
                className="ghost"
                target="_blank"
                rel="noreferrer"
                href={mapUrl(a.latitude, a.longitude)}
              >
                Map
              </a>
            )}
            {manage && !a.acknowledgedAt && (
              <button className="btn" onClick={() => acknowledge(a.id)}>
                Acknowledge
              </button>
            )}
          </div>
        </article>
      ))}
      {!rows.length && <div className="card empty">No tracking alerts.</div>}
    </div>
  );
}
function Modal({ title, close, children }: any) {
  return (
    <div className="modalBackdrop">
      <section className="card trackingModal">
        <div className="sectionHead">
          <h2>{title}</h2>
          <button className="ghost" onClick={close}>
            Close
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
function Input({
  label,
  field,
  form,
  set,
  type = "text",
  required = false,
}: any) {
  return (
    <label>
      {label}
      <input
        className="input"
        required={required}
        step={type === "number" ? "any" : undefined}
        type={type}
        value={form[field] ?? ""}
        onChange={(e) => set({ ...form, [field]: e.target.value })}
      />
    </label>
  );
}
function connection(d: any) {
  if (d.status !== "ACTIVE") return d.status;
  if (!d.lastSeenAt) return "NEVER SEEN";
  return Date.now() - new Date(d.lastSeenAt).getTime() >
    d.offlineAfterMinutes * 60_000
    ? "OFFLINE"
    : "ONLINE";
}
function ago(value: string) {
  if (!value) return "never";
  const mins = Math.floor((Date.now() - new Date(value).getTime()) / 60000);
  return mins < 1
    ? "just now"
    : mins < 60
      ? `${mins}m ago`
      : `${Math.floor(mins / 60)}h ago`;
}
function mapUrl(lat: number, lon: number) {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=16/${lat}/${lon}`;
}
