"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import QRCode from "qrcode";
import { api, download, upload } from "../../../lib/api";
import { Shell } from "../../_components";
import { FilterBar, filterRows } from "../../_filters";
export default function AssetDetail() {
  const { id } = useParams<{ id: string }>(),
    [asset, setAsset] = useState<any>(null),
    [options, setOptions] = useState<any>(null),
    [qr, setQr] = useState(""),
    [move, setMove] = useState({
      toLocationId: "",
      type: "TRANSFER",
      remarks: "",
    }),
    [documentType, setDocumentType] = useState("INVOICE"),
    [file, setFile] = useState<File | null>(null),
    [error, setError] = useState(""),
    [historyQuery, setHistoryQuery] = useState("");
  const historyGroups = [
    asset?.movements || [],
    asset?.documents || [],
    asset?.maintenance || [],
    asset?.complianceRecords || [],
    asset?.assignments || [],
  ];
  const filteredHistory = historyGroups.map((rows) =>
    filterRows(rows, historyQuery),
  );
  const historyTotal = historyGroups.reduce(
      (sum, rows) => sum + rows.length,
      0,
    ),
    historyCount = filteredHistory.reduce((sum, rows) => sum + rows.length, 0);
  async function load() {
    try {
      const [a, o] = await Promise.all([
        api("/assets/" + id),
        api("/assets/options/all"),
      ]);
      setAsset(a);
      setOptions(o);
      setMove((m) => ({ ...m, toLocationId: a.currentLocationId || "" }));
      const appUrl = (
        process.env.NEXT_PUBLIC_APP_URL || window.location.origin
      ).replace(/\/$/, "");
      const assetUrl = `${appUrl}/assets/${a.id}`;
      setQr(
        await QRCode.toDataURL(assetUrl, {
          width: 260,
          margin: 2,
          errorCorrectionLevel: "M",
        }),
      );
    } catch (e: any) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
  }, [id]);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api("/assets/" + id + "/move", {
        method: "POST",
        body: JSON.stringify(move),
      });
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  }
  async function uploadDocument(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("type", documentType);
      await upload(`/documents/assets/${id}`, body);
      setFile(null);
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  }
  async function removeDocument(documentId: string) {
    if (!confirm("Delete this document?")) return;
    try {
      await api(`/documents/${documentId}`, { method: "DELETE" });
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  }
  if (!asset)
    return (
      <Shell
        title="Asset Details"
        back={{ href: "/assets", label: "Asset Registry" }}
      >
        <p>{error || "Loading…"}</p>
      </Shell>
    );
  return (
    <Shell
      title={asset.assetTag}
      back={{ href: "/assets", label: "Asset Registry" }}
    >
      <div className="detailGrid">
        <section className="card">
          <div className="sectionHead">
            <h3>Asset profile</h3>
            <span className="badge">{asset.status}</span>
          </div>
          <dl className="details">
            <D t="Product" v={asset.product?.name} />
            <D t="SKU" v={asset.product?.sku} />
            <D t="Manufacturer" v={asset.product?.manufacturer} />
            <D t="Product description" v={asset.product?.description} />
            <D t="Category" v={asset.category?.name} />
            <D t="Serial number" v={asset.serialNumber} />
            <D t="QR identifier" v={asset.qrValue} />
            <div>
              <dt>Tags</dt>
              <dd>
                <div className="tagList">
                  {asset.tags?.map((tag: string) => (
                    <span className="tagChip" key={tag}>
                      {tag}
                    </span>
                  ))}
                  {!asset.tags?.length && "—"}
                </div>
              </dd>
            </div>
            <D t="Vendor" v={asset.vendor?.name} />
            <D t="Purchase order" v={asset.purchaseOrder?.poNumber} />
            <D
              t="Purchase price"
              v={
                asset.purchasePrice
                  ? `₹${Number(asset.purchasePrice).toLocaleString("en-IN")}`
                  : null
              }
            />
            <D t="Purchase date" v={fmt(asset.purchaseDate)} />
            <D t="Commissioning date" v={fmt(asset.commissioningDate)} />
            <D t="Department" v={asset.department?.name} />
            <D t="Custodian" v={asset.custodian?.name} />
            <D t="Current location" v={asset.currentLocation?.name} />
            <D t="Warranty end" v={fmt(asset.warrantyEndDate)} />
            <D t="Expiry" v={fmt(asset.expiryDate)} />
            <D t="Notes" v={asset.notes} />
          </dl>
        </section>
        <section className="card qrCard">
          <h3>Asset QR label</h3>
          {qr && <img src={qr} alt={`QR for ${asset.assetTag}`} />}
          <strong>{asset.assetTag}</strong>
          <span>{asset.product?.name}</span>
          <small>Scan to view the complete asset record</small>
          <button className="btn noPrint" onClick={() => window.print()}>
            Print label
          </button>
        </section>
      </div>
      <section className="card section noPrint">
        <h3>Filter asset history</h3>
        <FilterBar
          query={historyQuery}
          setQuery={setHistoryQuery}
          count={historyCount}
          total={historyTotal}
        />
      </section>
      <section className="card section noPrint">
        <h3>Record movement</h3>
        {error && <p className="error">{error}</p>}
        <form className="moveForm" onSubmit={submit}>
          <label>
            Movement type
            <select
              className="input"
              value={move.type}
              onChange={(e) => setMove({ ...move, type: e.target.value })}
            >
              {[
                "ISSUE",
                "TRANSFER",
                "RETURN",
                "MAINTENANCE",
                "DISPOSAL",
                "PHYSICAL_VERIFICATION",
              ].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label>
            Destination
            <select
              className="input"
              value={move.toLocationId}
              onChange={(e) =>
                setMove({ ...move, toLocationId: e.target.value })
              }
            >
              <option value="">No location</option>
              {options?.locations.map((x: any) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Remarks
            <input
              className="input"
              value={move.remarks}
              onChange={(e) => setMove({ ...move, remarks: e.target.value })}
            />
          </label>
          <button className="btn">Record movement</button>
        </form>
      </section>
      <section className="card section noPrint">
        <h3>Movement history</h3>
        <div className="tableWrap">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>From</th>
                <th>To</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {filteredHistory[0].map((m: any) => (
                <tr key={m.id}>
                  <td>{new Date(m.movedAt).toLocaleString()}</td>
                  <td>
                    <span className="badge">{m.type}</span>
                  </td>
                  <td>{m.fromLocation?.name || "—"}</td>
                  <td>{m.toLocation?.name || "—"}</td>
                  <td>{m.remarks || "—"}</td>
                </tr>
              ))}
              {!filteredHistory[0].length && (
                <tr>
                  <td colSpan={5} className="empty">
                    No movements match the history filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      <section className="card section noPrint">
        <h3>Documents</h3>
        <form className="documentForm" onSubmit={uploadDocument}>
          <select
            className="input"
            value={documentType}
            onChange={(e) => setDocumentType(e.target.value)}
          >
            {[
              "INVOICE",
              "WARRANTY",
              "INSPECTION",
              "MANUAL",
              "CERTIFICATE",
              "OTHER",
            ].map((type) => (
              <option key={type}>{type}</option>
            ))}
          </select>
          <input
            required
            className="input"
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.doc,.docx"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          <button className="btn">Upload</button>
        </form>
        <table className="table">
          <thead>
            <tr>
              <th>Type</th>
              <th>File</th>
              <th>Size</th>
              <th>Uploaded</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredHistory[1].map((document: any) => (
              <tr key={document.id}>
                <td>{document.type}</td>
                <td>{document.name}</td>
                <td>
                  {document.size
                    ? `${Math.ceil(document.size / 1024)} KB`
                    : "—"}
                </td>
                <td>{new Date(document.uploadedAt).toLocaleString()}</td>
                <td>
                  <div className="rowActions">
                    <button
                      onClick={() => download(document.url, document.name)}
                    >
                      Download
                    </button>
                    <button
                      className="danger"
                      onClick={() => removeDocument(document.id)}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!filteredHistory[1].length && (
              <tr>
                <td colSpan={5} className="empty">
                  No documents match the history filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
      <section className="card section noPrint">
        <h3>Maintenance history</h3>
        <div className="tableWrap">
          <table className="table">
            <thead>
              <tr>
                <th>Ticket</th>
                <th>Type</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Started</th>
                <th>Completed</th>
                <th>Cost</th>
              </tr>
            </thead>
            <tbody>
              {filteredHistory[2].map((record: any) => (
                <tr key={record.id}>
                  <td>{record.ticketNumber}</td>
                  <td>{record.type}</td>
                  <td>
                    <span className="badge">{record.status}</span>
                  </td>
                  <td>{record.priority}</td>
                  <td>{fmt(record.startedAt)}</td>
                  <td>{fmt(record.completedAt)}</td>
                  <td>
                    {record.cost == null
                      ? "—"
                      : `₹${Number(record.cost).toLocaleString("en-IN")}`}
                  </td>
                </tr>
              ))}
              {!filteredHistory[2].length && (
                <tr>
                  <td colSpan={7} className="empty">
                    No maintenance records match the history filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      <section className="card section noPrint">
        <h3>Compliance history</h3>
        <div className="tableWrap">
          <table className="table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Reference</th>
                <th>Provider</th>
                <th>Start</th>
                <th>Due</th>
                <th>Completed</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {filteredHistory[3].map((record: any) => (
                <tr key={record.id}>
                  <td>{record.type}</td>
                  <td>{record.referenceNumber || "—"}</td>
                  <td>{record.providerName || "—"}</td>
                  <td>{fmt(record.startDate)}</td>
                  <td>{fmt(record.dueDate)}</td>
                  <td>{fmt(record.completedDate)}</td>
                  <td>{record.notes || "—"}</td>
                </tr>
              ))}
              {!filteredHistory[3].length && (
                <tr>
                  <td colSpan={7} className="empty">
                    No compliance records match the history filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      <section className="card section noPrint">
        <h3>Disposal record</h3>
        {asset.disposal ? (
          <dl className="details">
            <D t="Status" v={asset.disposal.status} />
            <D t="Method" v={asset.disposal.method} />
            <D t="Reason" v={asset.disposal.reason} />
            <D t="Proposed date" v={fmt(asset.disposal.proposedAt)} />
            <D t="Approved date" v={fmt(asset.disposal.approvedAt)} />
            <D t="Completed date" v={fmt(asset.disposal.completedAt)} />
            <D
              t="Proposed value"
              v={
                asset.disposal.proposedValue == null
                  ? null
                  : `₹${Number(asset.disposal.proposedValue).toLocaleString("en-IN")}`
              }
            />
            <D
              t="Realized value"
              v={
                asset.disposal.realizedValue == null
                  ? null
                  : `₹${Number(asset.disposal.realizedValue).toLocaleString("en-IN")}`
              }
            />
          </dl>
        ) : (
          <p className="empty">No disposal record.</p>
        )}
      </section>
      <section className="card section noPrint">
        <h3>Custody history</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Custodian</th>
              <th>Assigned</th>
              <th>Returned</th>
              <th>Remarks</th>
            </tr>
          </thead>
          <tbody>
            {filteredHistory[4].map((a: any) => (
              <tr key={a.id}>
                <td>
                  {a.user.name}
                  <br />
                  <span className="muted">{a.user.email}</span>
                </td>
                <td>{new Date(a.assignedAt).toLocaleString()}</td>
                <td>
                  {a.returnedAt
                    ? new Date(a.returnedAt).toLocaleString()
                    : "Current"}
                </td>
                <td>{a.remarks || "—"}</td>
              </tr>
            ))}
            {!filteredHistory[4].length && (
              <tr>
                <td colSpan={4} className="empty">
                  No custody assignments match the history filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </Shell>
  );
}
function D({ t, v }: { t: string; v: any }) {
  return (
    <div>
      <dt>{t}</dt>
      <dd>{v || "—"}</dd>
    </div>
  );
}
function fmt(v: any) {
  return v ? new Date(v).toLocaleDateString() : "—";
}
