// Standalone /scorecard-planner password — SEPARATE from the main site gate.
// The PLANNER_PASSWORD env var (Vercel project settings) takes precedence.
// The fallback is a placeholder only; set the real value in Vercel.
export const PLANNER_PASSWORD = process.env.PLANNER_PASSWORD || "PlannerTemp2027!!";
