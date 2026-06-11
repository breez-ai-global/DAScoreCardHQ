import "./globals.css";

export const metadata = {
  title: "DA Scorecard HQ — Breez Global Logistics",
  description: "Driver performance scorecard for Breez Global Logistics LLC",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
