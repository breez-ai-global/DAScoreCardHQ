import { NextResponse } from "next/server";
import { put, list } from "@vercel/blob";

export const dynamic = "force-dynamic";

async function loadReport(id) {
  const { blobs } = await list({ prefix: `reports/${id}` });
  if (!blobs.length) return null;
  const res = await fetch(blobs[0].url, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

export async function GET(request) {
  const id = request.nextUrl.searchParams.get("id");
  try {
    if (id) {
      const report = await loadReport(id);
      if (!report) return NextResponse.json({ error: "not found" }, { status: 404 });
      return NextResponse.json(report);
    }
    const { blobs } = await list({ prefix: "reports/" });
    const reports = await Promise.all(
      blobs.map((b) => fetch(b.url, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null))
    );
    const ok = reports.filter(Boolean).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    return NextResponse.json(ok);
  } catch (e) {
    return NextResponse.json({ error: "storage not configured", detail: String(e?.message || e) }, { status: 503 });
  }
}

export async function POST(request) {
  try {
    const report = await request.json();
    if (!report?.id || !report?.driver?.name) {
      return NextResponse.json({ error: "invalid report" }, { status: 400 });
    }
    report.createdAt = report.createdAt || new Date().toISOString();
    await put(`reports/${report.id}.json`, JSON.stringify(report), {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    return NextResponse.json({ ok: true, id: report.id });
  } catch (e) {
    return NextResponse.json({ error: "storage not configured", detail: String(e?.message || e) }, { status: 503 });
  }
}
