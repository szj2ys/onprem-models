import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { OnPremModel, Snapshot } from "@/lib/models";

// The key stays server-side (amd-settings.md "Secrets"); the browser never sees it.
// AMD_LLM_API_KEY is injected into the process env by the harness credential store
// (`credentials.py run AMD_LLM_API_KEY -- npm start`) or read from .env.local.
const API_URL = "https://llm-api.amd.com/OnPrem/models";
const KEY = process.env.AMD_LLM_API_KEY;
// Snapshots survive restarts in ./data and keep "new model" detection honest across deploys.
const DATA_DIR = path.join(process.cwd(), "data");
const SNAPSHOTS = path.join(DATA_DIR, "snapshots.json");
const MAX_SNAPSHOTS = 400;

async function loadSnapshots(): Promise<Snapshot[]> {
  try {
    const raw = await fs.readFile(SNAPSHOTS, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveSnapshot(snap: Snapshot): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const all = await loadSnapshots();
  all.push(snap);
  await fs.writeFile(SNAPSHOTS, JSON.stringify(all.slice(-MAX_SNAPSHOTS)), "utf-8");
}

async function fetchLive(): Promise<Snapshot> {
  const res = await fetch(API_URL, {
    headers: { "Ocp-Apim-Subscription-Key": KEY as string },
    cache: "no-store",
  });
  if (!res.ok) {
    throw Object.assign(new Error(`OnPrem API ${res.status}`), { status: res.status });
  }
  const body = (await res.json()) as { data: OnPremModel[] };
  return { fetchedAt: new Date().toISOString(), models: body.data };
}

export async function GET() {
  const snapshots = await loadSnapshots();
  const previous = snapshots[snapshots.length - 1] ?? null;
  let live: Snapshot | null = null;
  let error: string | null = null;

  if (!KEY) {
    error = "AMD_LLM_API_KEY is not set in the server environment";
  } else {
    try {
      live = await fetchLive();
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }

  const source = live ?? previous;
  if (live && (!previous || previous.models.length !== live.models.length ||
      live.models.some((m, i) => previous.models[i]?.id !== m.id))) {
    await saveSnapshot(live);
  }

  const known = new Set((previous?.models ?? []).map((m) => m.id));
  const models = (source?.models ?? []).map((m) => ({
    ...m,
    isNew: live ? !known.has(m.id) : false,
  }));

  return NextResponse.json(
    {
      fetchedAt: source?.fetchedAt ?? null,
      live: Boolean(live),
      error,
      count: models.length,
      previousCount: previous?.models.length ?? 0,
      models,
    },
    // A failed gateway call is a 502 to the browser, so the page's failure state fires
    // (Jobs round 2, J2-2): a 200 with live:false read as success.
    { status: error ? 502 : 200, headers: { "Cache-Control": "no-store" } },
  );
}
