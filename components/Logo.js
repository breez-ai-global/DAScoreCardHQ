// Renders the company logo from /public. Drop in logo.png to override the
// bundled SVG fallback (the build script prefers logo.png when present).
import logoManifest from "../lib/logo-manifest.json";

export default function Logo({ size = 40 }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={logoManifest.src}
      alt="Breez Global Logistics"
      width={size}
      height={size}
      style={{ borderRadius: "50%", objectFit: "cover", display: "block" }}
    />
  );
}
