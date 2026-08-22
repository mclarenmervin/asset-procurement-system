import Link from "next/link";
export default function Home() {
  const features = [
    [
      "01",
      "Procure with confidence",
      "Track vendors, orders, receipts and inspections from one workflow.",
    ],
    [
      "02",
      "Know where everything is",
      "Keep current custody and an immutable location movement ledger.",
    ],
    [
      "03",
      "Stay audit-ready",
      "Preserve approvals, documents, maintenance and verification history.",
    ],
  ];
  return (
    <main className="landing">
      <header className="landingNav">
        <div className="brand">
          AssetFlow<small>ENTERPRISE MANAGEMENT</small>
        </div>
        <div className="navActions">
          <Link className="ghost" href="/login">
            Sign in
          </Link>
          <Link className="btn" href="/signup">
            Get started
          </Link>
        </div>
      </header>
      <section className="hero">
        <div>
          <span className="eyebrow">ONE SYSTEM · COMPLETE TRACEABILITY</span>
          <h1>Control every asset, purchase and material movement.</h1>
          <p>
            Connect procurement, vendors, stores, locations, maintenance and
            audit history in one secure workspace built for complex
            organizations.
          </p>
          <div className="heroActions">
            <Link className="btn large" href="/signup">
              Create your workspace
            </Link>
            <Link className="ghost large" href="/login">
              Open demo
            </Link>
          </div>
        </div>
        <div className="heroPanel">
          <div className="pulse">LIVE OPERATIONS</div>
          <strong>₹24.8 Cr</strong>
          <span>Assets under management</span>
          <div className="miniGrid">
            <div>
              <b>12,480</b>
              <span>Assets</span>
            </div>
            <div>
              <b>98.4%</b>
              <span>Verified</span>
            </div>
            <div>
              <b>36</b>
              <span>Open POs</span>
            </div>
            <div>
              <b>14</b>
              <span>Due alerts</span>
            </div>
          </div>
        </div>
      </section>
      <section className="features">
        {features.map(([n, t, d]) => (
          <article key={n}>
            <span>{n}</span>
            <h3>{t}</h3>
            <p>{d}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
