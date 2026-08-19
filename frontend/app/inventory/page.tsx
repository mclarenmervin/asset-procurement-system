"use client";
import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { Shell } from "../_components";
export default function Inventory() {
  const [tab, setTab] = useState("stock"),
    [data, setData] = useState<any>({
      warehouses: [],
      grns: [],
      batches: [],
      ledger: [],
      notes: [],
      options: {
        products: [],
        warehouses: [],
        purchaseOrders: [],
        batches: [],
      },
      locations: [],
    }),
    [form, setForm] = useState(""),
    [error, setError] = useState("");
  async function load() {
    try {
      const [warehouses, grns, batches, ledger, notes, options, locations] =
        await Promise.all([
          api("/inventory/warehouses"),
          api("/inventory/grns"),
          api("/inventory/batches"),
          api("/inventory/ledger"),
          api("/inventory/notes"),
          api("/inventory/options"),
          api("/locations"),
        ]);
      setData({ warehouses, grns, batches, ledger, notes, options, locations });
    } catch (e: any) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
  }, []);
  async function save(path: string, body: any) {
    try {
      await api(path, { method: "POST", body: JSON.stringify(body) });
      setForm("");
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  }
  return (
    <Shell title="Stores & Material Inventory">
      <div className="tabs">
        {[
          ["stock", "Stock"],
          ["grn", "Goods Receipts"],
          ["notes", "Issue & Return"],
          ["warehouses", "Warehouses"],
          ["ledger", "Ledger"],
        ].map(([k, v]) => (
          <button
            key={k}
            className={tab === k ? "active" : ""}
            onClick={() => {
              setTab(k);
              setForm("");
            }}
          >
            {v}
          </button>
        ))}
      </div>
      {error && <p className="error">{error}</p>}
      {tab === "stock" && <Stock batches={data.batches} />}{" "}
      {tab === "grn" && (
        <>
          <Bar
            title="Goods Receipt & Inspection"
            action={() => setForm("grn")}
          />
          {form === "grn" && (
            <GrnForm
              options={data.options}
              save={(b: any) => save("/inventory/grns", b)}
              close={() => setForm("")}
            />
          )}
          <Grns
            rows={data.grns}
            inspect={(g: any) => setForm(g.id)}
            save={save}
          />
        </>
      )}
      {tab === "notes" && (
        <>
          <Bar
            title="Material Issue & Return Notes"
            action={() => setForm("note")}
          />
          {form === "note" && (
            <NoteForm
              options={data.options}
              save={(b: any) => save("/inventory/notes", b)}
              close={() => setForm("")}
            />
          )}
          <Notes
            rows={data.notes}
            post={(id: string) => save("/inventory/notes/" + id + "/post", {})}
          />
        </>
      )}
      {tab === "warehouses" && (
        <>
          <Bar
            title="Warehouses and Bins"
            action={() => setForm("warehouse")}
          />
          {form === "warehouse" && (
            <WarehouseForm
              locations={data.locations}
              save={(b: any) => save("/inventory/warehouses", b)}
              close={() => setForm("")}
            />
          )}
          <Warehouses
            rows={data.warehouses}
            addBin={async (id: string) => {
              const name = prompt("Bin name");
              const code = prompt("Bin code");
              if (name && code)
                await save(`/inventory/warehouses/${id}/bins`, { name, code });
            }}
          />
        </>
      )}
      {tab === "ledger" && <Ledger rows={data.ledger} />}
    </Shell>
  );
}
function Bar({ title, action }: any) {
  return (
    <div className="sectionHead section">
      <h3>{title}</h3>
      <button className="btn" onClick={action}>
        + Create
      </button>
    </div>
  );
}
function WarehouseForm({ locations, save, close }: any) {
  const [f, set] = useState({ name: "", code: "", locationId: "" });
  return (
    <Form submit={() => save(f)} close={close}>
      <Input
        l="Warehouse name"
        v={f.name}
        set={(v: string) => set({ ...f, name: v })}
      />
      <Input l="Code" v={f.code} set={(v: string) => set({ ...f, code: v })} />
      <Select
        l="Linked location"
        v={f.locationId}
        set={(v: string) => set({ ...f, locationId: v })}
        rows={locations}
        label="name"
      />
    </Form>
  );
}
function GrnForm({ options, save, close }: any) {
  const [f, set] = useState<any>({
    grnNumber: "GRN-" + new Date().getFullYear() + "-",
    purchaseOrderId: "",
    warehouseId: "",
    invoiceNumber: "",
    receiptDate: new Date().toISOString().slice(0, 10),
    items: [
      {
        productId: "",
        receivedQty: 1,
        batchNumber: "",
        expiryDate: "",
        binId: "",
      },
    ],
  });
  return (
    <Form submit={() => save(f)} close={close}>
      <Input
        l="GRN number"
        v={f.grnNumber}
        set={(v: string) => set({ ...f, grnNumber: v })}
      />
      <Select
        l="Approved PO"
        v={f.purchaseOrderId}
        set={(v: string) => set({ ...f, purchaseOrderId: v })}
        rows={options.purchaseOrders}
        label="poNumber"
      />
      <Select
        l="Warehouse"
        v={f.warehouseId}
        set={(v: string) => set({ ...f, warehouseId: v })}
        rows={options.warehouses}
        label="name"
      />
      <Input
        l="Invoice number"
        v={f.invoiceNumber}
        set={(v: string) => set({ ...f, invoiceNumber: v })}
      />
      <Input
        l="Receipt date"
        type="date"
        v={f.receiptDate}
        set={(v: string) => set({ ...f, receiptDate: v })}
      />
      <div className="lineItems">
        <b>Received item</b>
        <div className="line">
          <select
            required
            className="input"
            value={f.items[0].productId}
            onChange={(e) =>
              set({
                ...f,
                items: [{ ...f.items[0], productId: e.target.value }],
              })
            }
          >
            <option value="">Product…</option>
            {options.products.map((p: any) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <input
            required
            type="number"
            min="1"
            className="input"
            placeholder="Received qty"
            value={f.items[0].receivedQty}
            onChange={(e) =>
              set({
                ...f,
                items: [{ ...f.items[0], receivedQty: e.target.value }],
              })
            }
          />
          <input
            required
            className="input"
            placeholder="Batch number"
            value={f.items[0].batchNumber}
            onChange={(e) =>
              set({
                ...f,
                items: [{ ...f.items[0], batchNumber: e.target.value }],
              })
            }
          />
          <input
            type="date"
            className="input"
            value={f.items[0].expiryDate}
            onChange={(e) =>
              set({
                ...f,
                items: [{ ...f.items[0], expiryDate: e.target.value }],
              })
            }
          />
          <select
            className="input"
            value={f.items[0].binId}
            onChange={(e) =>
              set({
                ...f,
                items: [{ ...f.items[0], binId: e.target.value }],
              })
            }
          >
            <option value="">No bin</option>
            {(options.warehouses.find((w: any) => w.id === f.warehouseId)?.bins || []).map(
              (bin: any) => (
                <option key={bin.id} value={bin.id}>
                  {bin.code} · {bin.name}
                </option>
              ),
            )}
          </select>
        </div>
      </div>
    </Form>
  );
}
function NoteForm({ options, save, close }: any) {
  const [f, set] = useState<any>({
    noteNumber: "SN-" + new Date().getFullYear() + "-",
    type: "ISSUE",
    warehouseId: "",
    recipient: "",
    remarks: "",
    items: [{ productId: "", batchId: "", quantity: 1 }],
  });
  function batch(id: string) {
    const b = options.batches.find((x: any) => x.id === id);
    set({
      ...f,
      warehouseId: b?.warehouseId || "",
      items: [{ ...f.items[0], batchId: id, productId: b?.productId || "" }],
    });
  }
  return (
    <Form submit={() => save(f)} close={close}>
      <Input
        l="Note number"
        v={f.noteNumber}
        set={(v: string) => set({ ...f, noteNumber: v })}
      />
      <label>
        Type
        <select
          className="input"
          value={f.type}
          onChange={(e) => set({ ...f, type: e.target.value })}
        >
          <option>ISSUE</option>
          <option>RETURN</option>
        </select>
      </label>
      <Select
        l="Batch / available stock"
        v={f.items[0].batchId}
        set={batch}
        rows={options.batches}
        label={(x: any) =>
          `${x.product.name} · ${x.batchNumber} · ${x.quantity} available`
        }
      />
      <Input
        l="Quantity"
        type="number"
        v={f.items[0].quantity}
        set={(v: string) =>
          set({ ...f, items: [{ ...f.items[0], quantity: v }] })
        }
      />
      <Input
        l="Recipient / department"
        v={f.recipient}
        set={(v: string) => set({ ...f, recipient: v })}
      />
      <Input
        l="Remarks"
        v={f.remarks}
        set={(v: string) => set({ ...f, remarks: v })}
      />
    </Form>
  );
}
function Form({ children, submit, close }: any) {
  return (
    <form
      className="card section workflowForm"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {children}
      <div className="formActions">
        <button type="button" className="ghost" onClick={close}>
          Cancel
        </button>
        <button className="btn">Save</button>
      </div>
    </form>
  );
}
function Input({ l, v, set, type = "text" }: any) {
  return (
    <label>
      {l}
      <input
        required={
          !["Invoice number", "Remarks", "Recipient / department"].includes(l)
        }
        type={type}
        min={type === "number" ? 1 : undefined}
        className="input"
        value={v}
        onChange={(e) => set(e.target.value)}
      />
    </label>
  );
}
function Select({ l, v, set, rows, label }: any) {
  return (
    <label>
      {l}
      <select
        required
        className="input"
        value={v}
        onChange={(e) => set(e.target.value)}
      >
        <option value="">Select…</option>
        {rows.map((x: any) => (
          <option key={x.id} value={x.id}>
            {typeof label === "function" ? label(x) : x[label]}
          </option>
        ))}
      </select>
    </label>
  );
}
function Stock({ batches }: any) {
  return (
    <div className="card tableWrap">
      <table className="table">
        <thead>
          <tr>
            <th>Material</th>
            <th>Batch</th>
            <th>Warehouse / Bin</th>
            <th>Expiry</th>
            <th>Available</th>
          </tr>
        </thead>
        <tbody>
          {batches.map((b: any) => (
            <tr key={b.id}>
              <td>
                {b.product.name}
                <br />
                <span className="muted">{b.product.sku}</span>
              </td>
              <td>{b.batchNumber}</td>
              <td>
                {b.warehouse.name}
                {b.bin ? " / " + b.bin.code : ""}
              </td>
              <td>{date(b.expiryDate)}</td>
              <td>
                <b>{b.quantity}</b>
              </td>
            </tr>
          ))}
          {!batches.length && <Empty n={5} />}
        </tbody>
      </table>
    </div>
  );
}
function Grns({ rows, inspect, save }: any) {
  return (
    <div className="card section tableWrap">
      <table className="table">
        <thead>
          <tr>
            <th>GRN</th>
            <th>PO / Vendor</th>
            <th>Warehouse</th>
            <th>Items</th>
            <th>Status</th>
            <th>Inspection</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((g: any) => (
            <tr key={g.id}>
              <td>
                {g.grnNumber}
                <br />
                <span className="muted">{date(g.receiptDate)}</span>
              </td>
              <td>
                {g.purchaseOrder.poNumber}
                <br />
                {g.purchaseOrder.vendor.name}
              </td>
              <td>{g.warehouse?.name}</td>
              <td>
                {g.items.map((i: any) => (
                  <div key={i.id}>
                    {i.product?.name || i.productName}: {i.receivedQty} received
                    / {i.acceptedQty} accepted
                  </div>
                ))}
              </td>
              <td>
                <span className="badge">{g.status}</span>
              </td>
              <td>
                {g.status === "INSPECTION_PENDING" && (
                  <div className="rowActions">
                    <button
                      onClick={() =>
                        save(`/inventory/grns/${g.id}/inspect`, {
                          items: g.items.map((i: any) => ({
                            id: i.id,
                            acceptedQty: i.receivedQty,
                            rejectedQty: 0,
                            remarks: "Accepted after inspection",
                          })),
                        })
                      }
                    >
                      Accept all
                    </button>
                    <button
                      className="danger"
                      onClick={() => {
                        const rejected = Number(
                          prompt("Rejected quantity for first item", "0"),
                        );
                        if (Number.isFinite(rejected))
                          save(`/inventory/grns/${g.id}/inspect`, {
                            items: g.items.map((i: any, n: number) => ({
                              id: i.id,
                              acceptedQty: n
                                ? i.receivedQty
                                : i.receivedQty - rejected,
                              rejectedQty: n ? 0 : rejected,
                            })),
                          });
                      }}
                    >
                      Record rejection
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
          {!rows.length && <Empty n={6} />}
        </tbody>
      </table>
    </div>
  );
}
function Notes({ rows, post }: any) {
  return (
    <div className="card tableWrap">
      <table className="table">
        <thead>
          <tr>
            <th>Note</th>
            <th>Type</th>
            <th>Warehouse</th>
            <th>Recipient</th>
            <th>Items</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((n: any) => (
            <tr key={n.id}>
              <td>{n.noteNumber}</td>
              <td>{n.type}</td>
              <td>{n.warehouse.name}</td>
              <td>{n.recipient || "—"}</td>
              <td>
                {n.items.map((i: any) => (
                  <div key={i.id}>
                    {i.product.name} × {i.quantity}
                  </div>
                ))}
              </td>
              <td>
                <span className="badge">{n.status}</span>
              </td>
              <td>
                {n.status === "DRAFT" && (
                  <button className="btn" onClick={() => post(n.id)}>
                    Post
                  </button>
                )}
              </td>
            </tr>
          ))}
          {!rows.length && <Empty n={7} />}
        </tbody>
      </table>
    </div>
  );
}
function Warehouses({ rows, addBin }: any) {
  return (
    <div className="card tableWrap">
      <table className="table">
        <thead>
          <tr>
            <th>Code</th>
            <th>Warehouse</th>
            <th>Location</th>
            <th>Bins</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((w: any) => (
            <tr key={w.id}>
              <td>{w.code}</td>
              <td>{w.name}</td>
              <td>{w.location?.name || "—"}</td>
              <td>
                {w.bins.map((b: any) => (
                  <span className="badge bin" key={b.id}>
                    {b.code}
                  </span>
                ))}
              </td>
              <td>
                <button className="ghost" onClick={() => addBin(w.id)}>
                  + Bin
                </button>
              </td>
            </tr>
          ))}
          {!rows.length && <Empty n={5} />}
        </tbody>
      </table>
    </div>
  );
}
function Ledger({ rows }: any) {
  return (
    <div className="card tableWrap">
      <table className="table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Type</th>
            <th>Material</th>
            <th>Warehouse</th>
            <th>Batch</th>
            <th>Change</th>
            <th>Balance</th>
            <th>Reference</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t: any) => (
            <tr key={t.id}>
              <td>{new Date(t.createdAt).toLocaleString()}</td>
              <td>
                <span className="badge">{t.type}</span>
              </td>
              <td>{t.product.name}</td>
              <td>{t.warehouse.name}</td>
              <td>{t.batch?.batchNumber || "—"}</td>
              <td className={t.quantity < 0 ? "negative" : "positive"}>
                {t.quantity > 0 ? "+" : ""}
                {t.quantity}
              </td>
              <td>{t.balanceAfter}</td>
              <td>{t.referenceType || "—"}</td>
            </tr>
          ))}
          {!rows.length && <Empty n={8} />}
        </tbody>
      </table>
    </div>
  );
}
function Empty({ n }: any) {
  return (
    <tr>
      <td colSpan={n} className="empty">
        No records yet.
      </td>
    </tr>
  );
}
function date(v: any) {
  return v ? new Date(v).toLocaleDateString() : "—";
}
