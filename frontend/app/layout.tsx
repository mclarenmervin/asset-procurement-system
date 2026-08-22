import "./globals.css";
import "./landing.css";
import "./crud.css";
import "./assets/assets.css";
import "./procurement/procurement.css";
import "./inventory/inventory.css";
import "./maintenance/maintenance.css";
import "./governance/governance.css";
import "./verification/verification.css";
import "./reports/reports.css";
import "./tracking/tracking.css";
import "./theme.css";
export const metadata = {
  title: "AssetFlow | Enterprise Asset Lifecycle Management",
  description:
    "Unified asset, procurement, inventory, maintenance and governance operations.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
