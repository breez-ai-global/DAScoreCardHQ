// Site password. The SITE_PASSWORD env var (Vercel project settings) takes
// precedence; the fallback keeps the gate working without dashboard setup.
export const SITE_PASSWORD = process.env.SITE_PASSWORD || "LetsWork2027!!";
