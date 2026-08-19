import './globals.css';
import './landing.css';
import './crud.css';
import './assets/assets.css';
import './procurement/procurement.css';
import './inventory/inventory.css';
import './maintenance/maintenance.css';
import './governance/governance.css';
import './verification/verification.css';
import './reports/reports.css';
export const metadata={title:'AssetFlow Enterprise',description:'Asset, Procurement & Material Management'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
