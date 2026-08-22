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
        <div className="brand landingBrand">
          <span className="brandMark">AF</span>
          <span>
            AssetFlow<small>ENTERPRISE OPERATIONS</small>
          </span>
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
          <span className="eyebrow">
            BUILT FOR LARGE-SCALE PUBLIC ENTERPRISE
          </span>
          <h1>One command centre for every asset and operation.</h1>
          <p>
            Unify procurement, custody, inventory, maintenance, GPS tracking and
            audit assurance in one secure platform designed for complex
            organizations.
          </p>
          <div className="heroActions">
            <Link className="btn large" href="/signup">
              Explore the platform
            </Link>
            <Link className="ghost large" href="/login">
              Sign in to demo
            </Link>
          </div>
        </div>
        <div className="heroPanel">
          <div className="panelTop">
            <div className="pulse">
              <i /> LIVE OPERATIONS
            </div>
            <span>22 AUG 2026</span>
          </div>
          <strong>₹24.8 Cr</strong>
          <span>Asset value under governance</span>
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
      <section className="trustStrip">
        <span>Unified governance</span>
        <span>Role-based access</span>
        <span>Complete audit trail</span>
        <span>IoT ready</span>
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
