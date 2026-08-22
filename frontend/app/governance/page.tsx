"use client";
import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { Shell } from "../_components";
import { FilterBar, filterRows, unique } from "../_filters";
import { usePermission } from "../../lib/rbac";
const roles = [
  "ORG_ADMIN",
  "DEPARTMENT_HEAD",
  "PROCUREMENT_OFFICER",
  "FINANCE",
  "ASSET_MANAGER",
  "STORE_MANAGER",
  "MAINTENANCE",
  "AUDITOR",
];
export default function Governance() {
  const mayAudit = usePermission("audit.view"),
    mayManageWorkflows = usePermission("workflows.manage"),
    mayScan = usePermission("maintenance.manage");
  const [tab, setTab] = useState("notifications"),
    [notifications, setNotifications] = useState<any[]>([]),
    [logs, setLogs] = useState<any[]>([]),
    [workflows, setWorkflows] = useState<any[]>([]),
    [form, setForm] = useState(false),
    [q, setQ] = useState(""),
    [status, setStatus] = useState(""),
    [error, setError] = useState("");
  const activeRows =
    tab === "notifications"
      ? notifications
      : tab === "audit"
        ? logs
        : workflows;
  const statusOf = (row: any) =>
    tab === "notifications"
      ? row.readAt
        ? "READ"
        : "UNREAD"
      : tab === "audit"
        ? row.action
        : row.active
          ? "ACTIVE"
          : "INACTIVE";
  const filteredRows = filterRows(activeRows, q, status, statusOf);
  async function load() {
    try {
      const [n, a, w] = await Promise.all([
        api("/governance/notifications"),
        mayAudit ? api("/governance/audit") : Promise.resolve([]),
        api("/governance/workflows"),
      ]);
      setNotifications(n);
      setLogs(a);
      setWorkflows(w);
    } catch (e: any) {
      setError(e.message);
    }
  }
  useEffect(() => {
    if (mayAudit !== undefined) load();
  }, [mayAudit]);
  async function act(path: string, body?: any, method = "POST") {
    try {
      await api(path, {
        method,
        body: body ? JSON.stringify(body) : undefined,
      });
      setForm(false);
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  }
  return (
    <Shell title="Notifications, Audit & Workflows">
      <div className="tabs">
        {[
          ["notifications", "Notifications"],
          ["audit", "Audit Trail"],
          ["workflows", "Workflow Templates"],
        ]
          .filter(([k]) => k !== "audit" || mayAudit)
          .map(([k, v]) => (
            <button
              key={k}
              className={tab === k ? "active" : ""}
              onClick={() => {
                setTab(k);
                setForm(false);
                setQ("");
                setStatus("");
              }}
            >
              {v}
            </button>
          ))}
      </div>
      {error && <p className="error">{error}</p>}
      <FilterBar
        query={q}
        setQuery={setQ}
        status={status}
        setStatus={setStatus}
        statuses={unique(activeRows.map(statusOf))}
        statusLabel={tab === "audit" ? "All actions" : "All states"}
        count={filteredRows.length}
        total={activeRows.length}
      />
      {tab === "notifications" && (
        <>
          <div className="sectionHead section">
            <div>
              <h3>Alerts & reminders</h3>
              <span className="muted">
                {notifications.filter((n) => !n.readAt).length} unread
              </span>
            </div>
            {mayScan && (
              <button
                className="btn"
                onClick={() => act("/governance/notifications/scan")}
              >
                Scan due dates
              </button>
            )}
          </div>
          <div className="noticeList">
            {filteredRows.map((n: any) => (
              <article
                key={n.id}
                className={`card notice ${n.readAt ? "read" : ""}`}
              >
                <div className={`noticeIcon ${n.type.toLowerCase()}`}>!</div>
                <div>
                  <h3>{n.title}</h3>
                  <p>{n.message}</p>
                  <span className="muted">
                    {new Date(n.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="noticeActions">
                  {n.link && (
                    <a className="ghost" href={n.link}>
                      Open
                    </a>
                  )}
                  {!n.readAt && (
                    <button
                      className="btn"
                      onClick={() =>
                        act(`/governance/notifications/${n.id}/read`)
                      }
                    >
                      Mark read
                    </button>
                  )}
                </div>
              </article>
            ))}
            {!filteredRows.length && (
              <div className="card empty">
                {notifications.length
                  ? "No notifications match the current filters."
                  : "No notifications. Run a due-date scan."}
              </div>
            )}
          </div>
        </>
      )}
      {tab === "audit" && (
        <>
          <div className="card section tableWrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>Entity ID</th>
                  <th>User ID</th>
                  <th>IP address</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((l: any) => (
                  <tr key={l.id}>
                    <td>{new Date(l.createdAt).toLocaleString()}</td>
                    <td>
                      <span className="badge">{l.action}</span>
                    </td>
                    <td>{l.entityType}</td>
                    <td className="mono">{l.entityId || "—"}</td>
                    <td className="mono">{l.userId || "—"}</td>
                    <td>{l.ipAddress || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {tab === "workflows" && (
        <>
          <div className="sectionHead section">
            <h3>Configurable approval chains</h3>
            {mayManageWorkflows && (
              <button className="btn" onClick={() => setForm(true)}>
                + Template
              </button>
            )}
          </div>
          {form && (
            <WorkflowForm
              save={(b: any) => act("/governance/workflows", b)}
              close={() => setForm(false)}
            />
          )}
          <div className="workflowGrid">
            {filteredRows.map((w: any) => (
              <section className="card" key={w.id}>
                <div className="sectionHead">
                  <div>
                    <h3>{w.name}</h3>
                    <span className="muted">
                      {w.entityType} · {w.active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  {mayManageWorkflows && (
                    <button
                      className="dangerLink"
                      onClick={() =>
                        confirm("Delete workflow?") &&
                        act(
                          "/governance/workflows/" + w.id,
                          undefined,
                          "DELETE",
                        )
                      }
                    >
                      Delete
                    </button>
                  )}
                </div>
                <p>{w.description}</p>
                <ol className="steps">
                  {w.steps.map((s: any) => (
                    <li key={s.id}>
                      <b>{s.name}</b>
                      <span>
                        {s.approverRole.replaceAll("_", " ")}
                        {s.minimumAmount
                          ? ` · ≥ ₹${Number(s.minimumAmount).toLocaleString("en-IN")}`
                          : ""}
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
            ))}
            {!workflows.length && (
              <div className="card empty">
                No workflow templates configured.
              </div>
            )}
          </div>
        </>
      )}
    </Shell>
  );
}
function WorkflowForm({ save, close }: any) {
  const [f, set] = useState<any>({
    name: "",
    entityType: "PURCHASE_REQUISITION",
    description: "",
    active: true,
    steps: [
      {
        step: 1,
        name: "Department approval",
        approverRole: "DEPARTMENT_HEAD",
        minimumAmount: "",
      },
    ],
  });
  function change(i: number, k: string, v: any) {
    set({
      ...f,
      steps: f.steps.map((x: any, n: number) =>
        n === i ? { ...x, [k]: v } : x,
      ),
    });
  }
  return (
    <form
      className="card section workflowForm"
      onSubmit={(e) => {
        e.preventDefault();
        save(f);
      }}
    >
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
        Entity type
        <select
          className="input"
          value={f.entityType}
          onChange={(e) => set({ ...f, entityType: e.target.value })}
        >
          <option>PURCHASE_REQUISITION</option>
          <option>PURCHASE_ORDER</option>
          <option>ASSET_TRANSFER</option>
          <option>DISPOSAL</option>
          <option>STOCK_ISSUE</option>
        </select>
      </label>
      <label>
        Description
        <input
          className="input"
          value={f.description}
          onChange={(e) => set({ ...f, description: e.target.value })}
        />
      </label>
      <div className="lineItems">
        <div className="sectionHead">
          <b>Approval steps</b>
          <button
            type="button"
            className="ghost"
            onClick={() =>
              set({
                ...f,
                steps: [
                  ...f.steps,
                  {
                    step: f.steps.length + 1,
                    name: "",
                    approverRole: "ORG_ADMIN",
                    minimumAmount: "",
                  },
                ],
              })
            }
          >
            + Step
          </button>
        </div>
        {f.steps.map((s: any, i: number) => (
          <div className="line workflowLine" key={i}>
            <input
              required
              type="number"
              min="1"
              className="input"
              value={s.step}
              onChange={(e) => change(i, "step", Number(e.target.value))}
            />
            <input
              required
              className="input"
              placeholder="Step name"
              value={s.name}
              onChange={(e) => change(i, "name", e.target.value)}
            />
            <select
              className="input"
              value={s.approverRole}
              onChange={(e) => change(i, "approverRole", e.target.value)}
            >
              {roles.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
            <input
              type="number"
              min="0"
              className="input"
              placeholder="Minimum amount"
              value={s.minimumAmount}
              onChange={(e) => change(i, "minimumAmount", e.target.value)}
            />
          </div>
        ))}
      </div>
      <div className="formActions">
        <button type="button" className="ghost" onClick={close}>
          Cancel
        </button>
        <button className="btn">Save template</button>
      </div>
    </form>
  );
}
