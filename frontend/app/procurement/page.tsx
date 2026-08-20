"use client";
import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { Shell } from "../_components";
import { FilterBar, filterRows, unique } from "../_filters";
const emptyItem = {
  productId: "",
  quantity: 1,
  estimatedUnitPrice: "",
  remarks: "",
};
export default function Procurement() {
  const [tab, setTab] = useState("requisitions"),
    [reqs, setReqs] = useState<any[]>([]),
    [rfqs, setRfqs] = useState<any[]>([]),
    [pos, setPos] = useState<any[]>([]),
    [opts, setOpts] = useState<any>({
      products: [],
      vendors: [],
      requisitions: [],
      rfqs: [],
    }),
    [form, setForm] = useState<boolean | "rfq" | "quote">(false),
    [error, setError] = useState(""),
    [query, setQuery] = useState(""),
    [status, setStatus] = useState("");
  const activeRows =
    tab === "requisitions" ? reqs : tab === "rfqs" ? rfqs : pos;
  const filteredRows = filterRows(
    activeRows,
    query,
    status,
    (row: any) => row.status,
  );
  const visibleReqs = tab === "requisitions" ? filteredRows : reqs,
    visibleRfqs = tab === "rfqs" ? filteredRows : rfqs,
    visiblePos = tab === "orders" ? filteredRows : pos;
  async function load() {
    try {
      const [r, f, p, o] = await Promise.all([
        api("/procurement/requisitions"),
        api("/procurement/rfqs"),
        api("/procurement/purchase-orders"),
        api("/procurement/options"),
      ]);
      setReqs(r);
      setRfqs(f);
      setPos(p);
      setOpts(o);
    } catch (e: any) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
  }, []);
  async function act(path: string, body?: any) {
    try {
      await api(path, {
        method: "POST",
        body: body ? JSON.stringify(body) : undefined,
      });
      setForm(false);
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  }
  return (
    <Shell title="Procurement">
      <div className="tabs">
        {[
          ["requisitions", "Requisitions"],
          ["rfqs", "RFQs & Quotations"],
          ["orders", "Purchase Orders"],
        ].map(([k, v]) => (
          <button
            className={tab === k ? "active" : ""}
            key={k}
            onClick={() => {
              setTab(k);
              setForm(false);
              setQuery("");
              setStatus("");
            }}
          >
            {v}
          </button>
        ))}
      </div>
      {error && <p className="error">{error}</p>}
      <FilterBar
        query={query}
        setQuery={setQuery}
        status={status}
        setStatus={setStatus}
        statuses={unique(activeRows.map((row: any) => row.status))}
        count={filteredRows.length}
        total={activeRows.length}
      />
      {tab === "requisitions" && (
        <>
          <Head title="Purchase Requisitions" add={() => setForm(true)} />
          {form && (
            <RequisitionForm
              products={opts.products}
              save={(b: any) => act("/procurement/requisitions", b)}
              close={() => setForm(false)}
            />
          )}
          <div className="card section tableWrap">
            <table className="table">
              <thead>
                <tr>
                  <th>PR Number</th>
                  <th>Requirement</th>
                  <th>Requester</th>
                  <th>Items</th>
                  <th>Needed</th>
                  <th>Status</th>
                  <th>Workflow</th>
                </tr>
              </thead>
              <tbody>
                {visibleReqs.map((r: any) => (
                  <tr key={r.id}>
                    <td>{r.requisitionNumber}</td>
                    <td>
                      <b>{r.title}</b>
                      <br />
                      <span className="muted">{r.justification || "—"}</span>
                    </td>
                    <td>{r.requestedBy.name}</td>
                    <td>
                      {r.items.map((i: any) => (
                        <div key={i.id}>
                          {i.product.name} × {i.quantity}
                        </div>
                      ))}
                    </td>
                    <td>{date(r.neededBy)}</td>
                    <td>
                      <span className="badge">{r.status}</span>
                    </td>
                    <td>
                      <div className="rowActions">
                        {r.status === "DRAFT" && (
                          <button
                            onClick={() =>
                              act(`/procurement/requisitions/${r.id}/submit`)
                            }
                          >
                            Submit
                          </button>
                        )}
                        {r.status === "PENDING_APPROVAL" && (
                          <>
                            <button
                              onClick={() =>
                                act(
                                  `/procurement/requisitions/${r.id}/decision`,
                                  { decision: "APPROVED" },
                                )
                              }
                            >
                              Approve
                            </button>
                            <button
                              className="danger"
                              onClick={() =>
                                act(
                                  `/procurement/requisitions/${r.id}/decision`,
                                  { decision: "REJECTED" },
                                )
                              }
                            >
                              Reject
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {tab === "rfqs" && (
        <>
          <div className="dualHead">
            <Head
              title="RFQs and vendor comparison"
              add={() => setForm("rfq" as any)}
            />
            <button className="ghost" onClick={() => setForm("quote" as any)}>
              + Add quotation
            </button>
          </div>
          {form === "rfq" && (
            <RfqForm
              requisitions={opts.requisitions}
              save={(b: any) => act("/procurement/rfqs", b)}
              close={() => setForm(false)}
            />
          )}{" "}
          {form === "quote" && (
            <QuoteForm
              rfqs={opts.rfqs}
              vendors={opts.vendors}
              save={(b: any) => act("/procurement/quotations", b)}
              close={() => setForm(false)}
            />
          )}
          <div className="section">
            {visibleRfqs.map((r: any) => (
              <section className="card rfq" key={r.id}>
                <div className="sectionHead">
                  <div>
                    <h3>
                      {r.rfqNumber} · {r.title}
                    </h3>
                    <span className="muted">
                      Closes {date(r.closingDate)} ·{" "}
                      {r.requisition?.requisitionNumber || "Direct RFQ"}
                    </span>
                  </div>
                  <span className="badge">{r.status}</span>
                </div>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Quotation</th>
                      <th>Vendor</th>
                      <th>Amount</th>
                      <th>Delivery</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.quotations.map((q: any) => (
                      <tr key={q.id}>
                        <td>{q.quotationNumber}</td>
                        <td>{q.vendor.name}</td>
                        <td>
                          ₹{Number(q.quotedAmount).toLocaleString("en-IN")}
                        </td>
                        <td>{q.deliveryDays ?? "—"} days</td>
                        <td>{q.status}</td>
                        <td>
                          {!["AWARDED", "CANCELLED"].includes(r.status) && (
                            <button
                              className="btn"
                              onClick={() =>
                                act(`/procurement/quotations/${q.id}/select`)
                              }
                            >
                              Select
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {!r.quotations.length && (
                      <tr>
                        <td colSpan={6} className="empty">
                          No quotations received.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </section>
            ))}
          </div>
        </>
      )}
      {tab === "orders" && (
        <>
          <Head title="Purchase Orders" add={() => setForm(true)} />
          {form && (
            <PoForm
              products={opts.products}
              vendors={opts.vendors}
              save={(b: any) => act("/procurement/purchase-orders", b)}
              close={() => setForm(false)}
            />
          )}
          <div className="card section tableWrap">
            <table className="table">
              <thead>
                <tr>
                  <th>PO</th>
                  <th>Date</th>
                  <th>Vendor</th>
                  <th>Items</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Workflow</th>
                </tr>
              </thead>
              <tbody>
                {visiblePos.map((po: any) => (
                  <tr key={po.id}>
                    <td>{po.poNumber}</td>
                    <td>{date(po.poDate)}</td>
                    <td>{po.vendor.name}</td>
                    <td>
                      {po.items.reduce(
                        (n: number, i: any) => n + i.quantity,
                        0,
                      )}
                    </td>
                    <td>₹{Number(po.totalAmount).toLocaleString("en-IN")}</td>
                    <td>
                      <span className="badge">{po.status}</span>
                    </td>
                    <td>
                      {po.status === "DRAFT" && (
                        <div className="rowActions">
                          <button
                            onClick={() =>
                              act(
                                `/procurement/purchase-orders/${po.id}/decision`,
                                { decision: "APPROVED" },
                              )
                            }
                          >
                            Approve
                          </button>
                          <button
                            className="danger"
                            onClick={() =>
                              act(
                                `/procurement/purchase-orders/${po.id}/decision`,
                                { decision: "CANCELLED" },
                              )
                            }
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </td>
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
function Head({ title, add }: any) {
  return (
    <div className="sectionHead section">
      <h3>{title}</h3>
      <button className="btn" onClick={add}>
        + Create
      </button>
    </div>
  );
}
function RequisitionForm({ products, save, close }: any) {
  const [f, set] = useState<any>({
    requisitionNumber: "PR-" + new Date().getFullYear() + "-",
    title: "",
    justification: "",
    neededBy: "",
    items: [{ ...emptyItem }],
  });
  return (
    <form
      className="card section workflowForm"
      onSubmit={(e) => {
        e.preventDefault();
        save(f);
      }}
    >
      <Field l="PR number" n="requisitionNumber" f={f} set={set} />
      <Field l="Title" n="title" f={f} set={set} />
      <Field l="Needed by" n="neededBy" type="date" f={f} set={set} />
      <Field l="Justification" n="justification" f={f} set={set} />
      <LineItems
        f={f}
        set={set}
        products={products}
        price="estimatedUnitPrice"
      />
      <Actions close={close} />
    </form>
  );
}
function RfqForm({ requisitions, save, close }: any) {
  const [f, set] = useState<any>({
    rfqNumber: "RFQ-" + new Date().getFullYear() + "-",
    title: "",
    closingDate: "",
    requisitionId: "",
    status: "OPEN",
  });
  return (
    <form
      className="card section workflowForm"
      onSubmit={(e) => {
        e.preventDefault();
        save(f);
      }}
    >
      <Field l="RFQ number" n="rfqNumber" f={f} set={set} />
      <Field l="Title" n="title" f={f} set={set} />
      <Field l="Closing date" n="closingDate" type="date" f={f} set={set} />
      <Pick
        l="Approved requisition"
        n="requisitionId"
        f={f}
        set={set}
        options={requisitions.map((x: any) => [
          x.id,
          `${x.requisitionNumber} · ${x.title}`,
        ])}
      />
      <Actions close={close} />
    </form>
  );
}
function QuoteForm({ rfqs, vendors, save, close }: any) {
  const [f, set] = useState<any>({
    quotationNumber: "Q-",
    rfqId: "",
    vendorId: "",
    quotedAmount: "",
    deliveryDays: "",
    validityDate: "",
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
      <Field l="Quotation number" n="quotationNumber" f={f} set={set} />
      <Pick
        l="RFQ"
        n="rfqId"
        f={f}
        set={set}
        options={rfqs.map((x: any) => [x.id, `${x.rfqNumber} · ${x.title}`])}
      />
      <Pick
        l="Vendor"
        n="vendorId"
        f={f}
        set={set}
        options={vendors.map((x: any) => [x.id, x.name])}
      />
      <Field l="Quoted amount" n="quotedAmount" type="number" f={f} set={set} />
      <Field l="Delivery days" n="deliveryDays" type="number" f={f} set={set} />
      <Field l="Validity date" n="validityDate" type="date" f={f} set={set} />
      <Field l="Notes" n="notes" f={f} set={set} />
      <Actions close={close} />
    </form>
  );
}
function PoForm({ products, vendors, save, close }: any) {
  const [f, set] = useState<any>({
    poNumber: "PO-" + new Date().getFullYear() + "-",
    poDate: new Date().toISOString().slice(0, 10),
    expectedDeliveryDate: "",
    vendorId: "",
    totalAmount: "",
    status: "DRAFT",
    items: [{ productId: "", quantity: 1, unitPrice: "" }],
  });
  return (
    <form
      className="card section workflowForm"
      onSubmit={(e) => {
        e.preventDefault();
        save(f);
      }}
    >
      <Field l="PO number" n="poNumber" f={f} set={set} />
      <Field l="PO date" n="poDate" type="date" f={f} set={set} />
      <Field
        l="Expected delivery"
        n="expectedDeliveryDate"
        type="date"
        f={f}
        set={set}
      />
      <Pick
        l="Vendor"
        n="vendorId"
        f={f}
        set={set}
        options={vendors.map((x: any) => [x.id, x.name])}
      />
      <Field l="Total amount" n="totalAmount" type="number" f={f} set={set} />
      <LineItems f={f} set={set} products={products} price="unitPrice" />
      <Actions close={close} />
    </form>
  );
}
function LineItems({ f, set, products, price }: any) {
  return (
    <div className="lineItems">
      <div className="sectionHead">
        <b>Items</b>
        <button
          type="button"
          className="ghost"
          onClick={() =>
            set({ ...f, items: [...f.items, { ...emptyItem, [price]: "" }] })
          }
        >
          + Line
        </button>
      </div>
      {f.items.map((it: any, i: number) => (
        <div className="line" key={i}>
          <select
            required
            className="input"
            value={it.productId}
            onChange={(e) => change(i, "productId", e.target.value)}
          >
            <option value="">Product…</option>
            {products.map((p: any) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <input
            required
            min="1"
            type="number"
            className="input"
            placeholder="Quantity"
            value={it.quantity}
            onChange={(e) => change(i, "quantity", e.target.value)}
          />
          <input
            type="number"
            className="input"
            placeholder="Unit price"
            value={it[price]}
            onChange={(e) => change(i, price, e.target.value)}
          />
          <button
            type="button"
            className="dangerLink"
            onClick={() =>
              set({
                ...f,
                items: f.items.filter((_: any, n: number) => n !== i),
              })
            }
          >
            Remove
          </button>
        </div>
      ))}{" "}
    </div>
  );
  function change(i: number, k: string, v: any) {
    set({
      ...f,
      items: f.items.map((x: any, n: number) =>
        n === i ? { ...x, [k]: v } : x,
      ),
    });
  }
}
function Field({ l, n, f, set, type = "text" }: any) {
  return (
    <label>
      {l}
      <input
        required={
          ![
            "justification",
            "notes",
            "neededBy",
            "expectedDeliveryDate",
            "deliveryDays",
            "validityDate",
          ].includes(n)
        }
        type={type}
        step={type === "number" ? "0.01" : undefined}
        className="input"
        value={f[n]}
        onChange={(e) => set({ ...f, [n]: e.target.value })}
      />
    </label>
  );
}
function Pick({ l, n, f, set, options }: any) {
  return (
    <label>
      {l}
      <select
        className="input"
        value={f[n]}
        onChange={(e) => set({ ...f, [n]: e.target.value })}
      >
        <option value="">Select…</option>
        {options.map((o: any) => (
          <option key={o[0]} value={o[0]}>
            {o[1]}
          </option>
        ))}
      </select>
    </label>
  );
}
function Actions({ close }: any) {
  return (
    <div className="formActions">
      <button type="button" className="ghost" onClick={close}>
        Cancel
      </button>
      <button className="btn">Save</button>
    </div>
  );
}
function date(v: any) {
  return v ? new Date(v).toLocaleDateString() : "—";
}
