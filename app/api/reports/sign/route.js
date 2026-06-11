import { NextResponse } from "next/server";
import { put, list } from "@vercel/blob";

export const dynamic = "force-dynamic";

// Public endpoint: the DA signs from the share link (report ids are unguessable).
export async function POST(request) {
  try {
    const { id, name } = await request.json();
    if (!id || !name || name.trim().length < 2) {
      return NextResponse.json({ error: "name required" }, { status: 400 });
    }
    const { blobs } = await list({ prefix: `reports/${id}` });
    if (!blobs.length) return NextResponse.json({ error: "not found" }, { status: 404 });
    const report = await fetch(blobs[0].url, { cache: "no-store" }).then((r) => r.json());
    if (report.da?.signedAt) {
      return NextResponse.json({ error: "already signed", report }, { status: 409 });
    }
    report.da = { name: name.trim(), signedAt: new Date().toISOString() };
    await put(`reports/${id}.json`, JSON.stringify(report), {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    return NextResponse.json({ ok: true, report });
  } catch (e) {
    return NextResponse.json({ error: "storage not configured", detail: String(e?.message || e) }, { status: 503 });
  }
}
