"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api, download } from "../../lib/api";
import { Shell } from "../_components";
import { FilterBar, filterRows, unique } from "../_filters";
import { downloadAssetTemplate, parseAssetCsv } from "./csv";
const blank: any = {
  assetTag: "",
  serialNumber: "",
  tags: "",
  status: "IN_STOCK",
  purchasePrice: "",
  purchaseDate: "",
  commissioningDate: "",
  warrantyEndDate: "",
  expiryDate: "",
  notes: "",
  productId: "",
  categoryId: "",
  vendorId: "",
  purchaseOrderId: "",
  departmentId: "",
  currentLocationId: "",
  custodianId: "",
};
export default function Assets() {
  const [rows, setRows] = useState<any[]>([]),
    [options, setOptions] = useState<any>(null),
    [q, setQ] = useState(""),
    [status, setStatus] = useState(""),
    [category, setCategory] = useState(""),
    [form, setForm] = useState<any>(blank),
    [editing, setEditing] = useState<any>(null),
    [open, setOpen] = useState(false),
    [error, setError] = useState(""),
    [importErrors, setImportErrors] = useState<any[]>([]),
    [importing, setImporting] = useState(false),
    [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  async function load() {
    try {
      const [assets, opts] = await Promise.all([
        api("/assets"),
        api("/assets/options/all"),
      ]);
      setRows(assets);
      setOptions(opts);
    } catch (e: any) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
  }, []);
  function edit(row?: any) {
    const value = row
      ? {
          ...blank,
          ...row,
          tags: (row.tags || []).join(", "),
          purchasePrice: row.purchasePrice || "",
          purchaseDate: date(row.purchaseDate),
          commissioningDate: date(row.commissioningDate),
          warrantyEndDate: date(row.warrantyEndDate),
          expiryDate: date(row.expiryDate),
        }
      : { ...blank };
    setEditing(row || null);
    setForm(value);
    setError("");
    setOpen(true);
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/assets" + (editing ? "/" + editing.id : ""), {
        method: editing ? "PUT" : "POST",
        body: JSON.stringify({
          ...form,
          tags: String(form.tags || "")
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
        }),
      });
      setOpen(false);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function remove(row: any) {
    if (!confirm(`Delete asset ${row.assetTag} and its movement history?`))
      return;
    try {
      await api("/assets/" + row.id, { method: "DELETE" });
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  }
  async function importCsv(file?: File) {
    if (!file) return;
    setImporting(true);
    setError("");
    setImportErrors([]);
    try {
      const rows = parseAssetCsv(await file.text());
      if (!rows.length)
        throw new Error("The CSV does not contain any asset rows");
      const result = await api("/assets/import", {
        method: "POST",
        body: JSON.stringify({ rows }),
      });
      await load();
      alert(
        `${result.imported} asset${result.imported === 1 ? "" : "s"} imported successfully.`,
      );
    } catch (e: any) {
      setError(e.message || "Asset import failed");
      setImportErrors(e.errors || []);
    } finally {
      setImporting(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }
  const opts = (name: string, label = (x: any) => x.name) =>
    (options?.[name] || []).map((x: any) => (
      <option key={x.id} value={x.id}>
        {label(x)}
      </option>
    ));
  const visibleRows = filterRows(rows, q, status, (row) => row.status).filter(
    (row) => !category || row.categoryId === category,
  );
  return (
    <Shell title="Asset Registry">
      <div className="sectionHead">
        <div />
        <div className="assetToolbar">
          <button className="ghost" onClick={downloadAssetTemplate}>
            CSV template
          </button>
          <button
            className="ghost"
            onClick={() =>
              download("/reports/export/assets", "asset-register.csv")
            }
          >
            Export CSV
          </button>
          <button
            className="ghost"
            disabled={importing}
            onClick={() => fileInput.current?.click()}
          >
            {importing ? "Importing…" : "Import CSV"}
          </button>
          <input
            ref={fileInput}
            className="fileInput"
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => importCsv(event.target.files?.[0])}
          />
          <button className="btn" onClick={() => edit()}>
            + Add asset
          </button>
        </div>
      </div>
      <FilterBar
        query={q}
        setQuery={setQ}
        status={status}
        setStatus={setStatus}
        statuses={unique(rows.map((row) => row.status))}
        secondary={category}
        setSecondary={setCategory}
        secondaryOptions={(options?.categories || []).map((item: any) => ({
          value: item.id,
          label: item.name,
        }))}
        count={visibleRows.length}
        total={rows.length}
      />
      {error && <p className="error">{error}</p>}
      {!!importErrors.length && (
        <div className="card importErrors">
          <strong>Fix these rows and import the file again:</strong>
          <ul>
            {importErrors.slice(0, 20).map((item, index) => (
              <li key={`${item.row}-${index}`}>
                Row {item.row}
                {item.assetTag ? ` (${item.assetTag})` : ""}: {item.message}
              </li>
            ))}
          </ul>
          {importErrors.length > 20 && (
            <p>And {importErrors.length - 20} more errors.</p>
          )}
        </div>
      )}
      {open && (
        <form className="card section assetForm" onSubmit={save}>
          <div className="sectionHead">
            <h3>{editing ? "Edit asset" : "Register asset"}</h3>
            <button
              type="button"
              className="ghost"
              onClick={() => setOpen(false)}
            >
              Close
            </button>
          </div>
          <div className="crudForm">
            <Field
              n="assetTag"
              l="Asset tag"
              required
              form={form}
              set={setForm}
            />
            <Field
              n="serialNumber"
              l="Serial number"
              form={form}
              set={setForm}
            />
            <Field
              n="tags"
              l="Tags (comma separated)"
              form={form}
              set={setForm}
            />
            <Select n="status" l="Status" form={form} set={setForm}>
              {[
                "IN_STOCK",
                "IN_USE",
                "UNDER_MAINTENANCE",
                "TRANSFER_PENDING",
                "EXPIRED",
                "DISPOSED",
                "LOST",
              ].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </Select>
            <Select
              n="categoryId"
              l="Category"
              required
              form={form}
              set={setForm}
            >
              {opts("categories")}
            </Select>
            <Select
              n="productId"
              l="Product"
              required
              form={form}
              set={setForm}
            >
              {opts("products")}
            </Select>
            <Select n="vendorId" l="Vendor" form={form} set={setForm}>
              {opts("vendors")}
            </Select>
            <Select n="departmentId" l="Department" form={form} set={setForm}>
              {opts("departments")}
            </Select>
            <Select
              n="currentLocationId"
              l="Current location"
              form={form}
              set={setForm}
            >
              {opts("locations")}
            </Select>
            <Select n="custodianId" l="Custodian" form={form} set={setForm}>
              {opts("users", (x) => `${x.name} · ${x.email}`)}
            </Select>
            <Select
              n="purchaseOrderId"
              l="Purchase order"
              form={form}
              set={setForm}
            >
              {opts("purchaseOrders", (x) => x.poNumber)}
            </Select>
            <Field
              n="purchasePrice"
              l="Purchase price"
              type="number"
              form={form}
              set={setForm}
            />
            <Field
              n="purchaseDate"
              l="Purchase date"
              type="date"
              form={form}
              set={setForm}
            />
            <Field
              n="commissioningDate"
              l="Commissioning date"
              type="date"
              form={form}
              set={setForm}
            />
            <Field
              n="warrantyEndDate"
              l="Warranty end"
              type="date"
              form={form}
              set={setForm}
            />
            <Field
              n="expiryDate"
              l="Expiry date"
              type="date"
              form={form}
              set={setForm}
            />
            <Field n="notes" l="Notes" form={form} set={setForm} />
            <div className="formActions">
              <button disabled={busy} className="btn">
                {busy ? "Saving…" : editing ? "Update asset" : "Create asset"}
              </button>
            </div>
          </div>
        </form>
      )}
      <div className="card section tableWrap">
        <table className="table">
          <thead>
            <tr>
              <th>Asset</th>
              <th>Product</th>
              <th>Category</th>
              <th>Tags</th>
              <th>Department</th>
              <th>Location</th>
              <th>Custodian</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((a) => (
              <tr key={a.id}>
                <td>
                  <Link className="tableLink" href={"/assets/" + a.id}>
                    {a.assetTag}
                  </Link>
                  <br />
                  <span className="muted">{a.serialNumber || "No serial"}</span>
                </td>
                <td>
                  <Link className="assetNameLink" href={"/assets/" + a.id}>
                    {a.product.name}
                  </Link>
                </td>
                <td>{a.category?.name || "—"}</td>
                <td>
                  <div className="tagList">
                    {a.tags?.map((tag: string) => (
                      <span className="tagChip" key={tag}>
                        {tag}
                      </span>
                    ))}
                    {!a.tags?.length && <span className="muted">—</span>}
                  </div>
                </td>
                <td>{a.department?.name || "—"}</td>
                <td>{a.currentLocation?.name || "—"}</td>
                <td>{a.custodian?.name || "—"}</td>
                <td>
                  <span className="badge">{a.status}</span>
                </td>
                <td>
                  <div className="rowActions">
                    <Link
                      className="viewIconButton"
                      href={"/assets/" + a.id}
                      aria-label={`View ${a.assetTag}`}
                      title="View asset details"
                    >
                      <EyeIcon />
                    </Link>
                    <button onClick={() => edit(a)}>Edit</button>
                    <button className="danger" onClick={() => remove(a)}>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!visibleRows.length && (
              <tr>
                <td colSpan={9} className="empty">
                  {rows.length
                    ? "No assets match the current filters."
                    : "No assets registered."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
function Field({ n, l, form, set, type = "text", required = false }: any) {
  return (
    <label>
      {l}
      <input
        required={required}
        type={type}
        step={type === "number" ? "0.01" : undefined}
        className="input"
        value={form[n] ?? ""}
        onChange={(e) => set({ ...form, [n]: e.target.value })}
      />
    </label>
  );
}
function Select({ n, l, form, set, children, required = false }: any) {
  return (
    <label>
      {l}
      <select
        required={required}
        className="input"
        value={form[n] ?? ""}
        onChange={(e) => set({ ...form, [n]: e.target.value })}
      >
        <option value="">Select…</option>
        {children}
      </select>
    </label>
  );
}
function date(value: any) {
  return value ? new Date(value).toISOString().slice(0, 10) : "";
}
function EyeIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.75" />
    </svg>
  );
}
