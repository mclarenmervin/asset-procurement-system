"use client";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { FilterBar, filterRows } from "./_filters";
export type Field = {
  name: string;
  label: string;
  type?: "text" | "number" | "email" | "password" | "select";
  required?: boolean;
  options?: { value: string; label: string }[];
};
export function Crud({
  title,
  endpoint,
  fields,
  columns,
  onChanged,
}: {
  title: string;
  endpoint: string;
  fields: Field[];
  columns: {
    key: string;
    label: string;
    render?: (row: any) => React.ReactNode;
  }[];
  onChanged?: () => void;
}) {
  const [rows, setRows] = useState<any[]>([]),
    [editing, setEditing] = useState<any>(null),
    [form, setForm] = useState<Record<string, any>>({}),
    [error, setError] = useState(""),
    [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [query, setQuery] = useState("");
  const visibleRows = filterRows(rows, query);
  async function load() {
    try {
      setRows(await api(endpoint));
    } catch (e: any) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
  }, [endpoint]);
  function begin(row?: any) {
    const next: any = {};
    fields.forEach((f) => (next[f.name] = row?.[f.name] ?? ""));
    setForm(next);
    setEditing(row || null);
    setError("");
    setOpen(true);
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body: any = { ...form };
      fields
        .filter((f) => f.type === "number")
        .forEach((f) => (body[f.name] = Number(body[f.name] || 0)));
      if (editing && body.password === "") delete body.password;
      await api(endpoint + (editing ? "/" + editing.id : ""), {
        method: editing ? "PUT" : "POST",
        body: JSON.stringify(body),
      });
      setOpen(false);
      await load();
      onChanged?.();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function remove(row: any) {
    if (!confirm(`Delete ${row.name || row.code || "this record"}?`)) return;
    try {
      await api(endpoint + "/" + row.id, { method: "DELETE" });
      await load();
      onChanged?.();
    } catch (e: any) {
      setError(e.message);
    }
  }
  return (
    <section className="card section">
      <div className="sectionHead">
        <h3>{title}</h3>
        <button className="btn" onClick={() => begin()}>
          + Add
        </button>
      </div>
      {error && <p className="error">{error}</p>}
      <FilterBar
        query={query}
        setQuery={setQuery}
        count={visibleRows.length}
        total={rows.length}
      />
      {open && (
        <form className="crudForm" onSubmit={save}>
          {fields.map((f) => (
            <label key={f.name}>
              {f.label}
              {f.type === "select" ? (
                <select
                  required={f.required}
                  className="input"
                  value={form[f.name] ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, [f.name]: e.target.value })
                  }
                >
                  <option value="">Select…</option>
                  {f.options?.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  required={f.required}
                  type={f.type || "text"}
                  className="input"
                  value={form[f.name] ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, [f.name]: e.target.value })
                  }
                />
              )}
            </label>
          ))}
          <div className="formActions">
            <button
              type="button"
              className="ghost"
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>
            <button disabled={busy} className="btn">
              {busy ? "Saving…" : editing ? "Update" : "Create"}
            </button>
          </div>
        </form>
      )}
      <div className="tableWrap">
        <table className="table">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key}>{c.label}</th>
              ))}
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr key={row.id}>
                {columns.map((c) => (
                  <td key={c.key}>
                    {c.render ? c.render(row) : row[c.key] || "—"}
                  </td>
                ))}
                <td>
                  <div className="rowActions">
                    <button onClick={() => begin(row)}>Edit</button>
                    <button className="danger" onClick={() => remove(row)}>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!visibleRows.length && (
              <tr>
                <td colSpan={columns.length + 1} className="empty">
                  {rows.length
                    ? "No records match the current filters."
                    : "No records yet. Select Add to create one."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
