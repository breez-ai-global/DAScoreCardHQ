import "./globals.css";

export const metadata = {
  title: "DA Scorecard HQ — Breez Global Logistics",
  description: "Driver performance scorecard for Breez Global Logistics LLC",
};

export const viewport = { width: "device-width", initialScale: 1 };

const themeInit = `(function(){try{if(localStorage.getItem("bgl_theme")==="light")document.documentElement.dataset.theme="light"}catch(e){}})()`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
