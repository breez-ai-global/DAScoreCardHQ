import "./globals.css";
import { ScopeProvider } from "../components/ScopeProvider";
import { listScopes, weekTitle } from "../lib/aggregate";

export const metadata = {
  title: "DA Scorecard HQ — Breez Global Logistics",
  description: "Driver performance scorecard for Breez Global Logistics LLC",
};

export const viewport = { width: "device-width", initialScale: 1 };

const themeInit = `(function(){try{if(localStorage.getItem("bgl_theme")==="light")document.documentElement.dataset.theme="light"}catch(e){}})()`;

export default function RootLayout({ children }) {
  let scopes = ["all"];
  let labels = {};
  try {
    scopes = listScopes();
    for (const s of scopes) if (s !== "all") labels[s] = weekTitle(s);
  } catch {}
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>
        <ScopeProvider scopes={scopes} labels={labels}>
          {children}
        </ScopeProvider>
      </body>
    </html>
  );
}
