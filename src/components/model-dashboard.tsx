"use client";

import { useEffect, useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { OnPremModel } from "@/lib/models";
import { isFree, modeLabel } from "@/lib/models";

type ModelRow = OnPremModel & { isNew?: boolean };

type ApiShape = {
  fetchedAt: string | null;
  live: boolean;
  error: string | null;
  count: number;
  previousCount: number;
  models: ModelRow[];
};

const REFRESH_S = 60;

function fmtTokens(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)} B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)} M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)} K`;
  return String(n);
}

// Relative time: seconds → minutes → hours; used in two spots (header and footer), so one helper
// keeps them in lockstep.
function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  return `${Math.floor(m / 60)} h ago`;
}

export default function ModelDashboard() {
  const [data, setData] = useState<ApiShape | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [copyFailed, setCopyFailed] = useState(false);
  const [fetchFailed, setFetchFailed] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/models", { cache: "no-store" });
      if (res.ok) {
        setData((await res.json()) as ApiShape);
        setUpdatedAt(new Date());
        setFetchFailed(false);
        setFetchError(null);
      } else {
        // HTTP-level failure (gateway down, 5xx): keep the snapshot on screen but say why.
        setFetchFailed(true);
        setFetchError(`The model list could not be refreshed (HTTP ${res.status}).`);
      }
    } catch {
      setFetchFailed(true);
      setFetchError("The model list could not be refreshed (network error).");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      await load();
    };
    tick();
    const t = setInterval(() => {
      if (alive) load();
    }, REFRESH_S * 1000);
    // "Updated …" ages between refreshes: a 10 s clock re-renders the relative time.
    const ageClock = setInterval(() => {
      if (alive) setUpdatedAt((d) => (d ? new Date(d) : d));
    }, 10_000);
    return () => {
      alive = false;
      clearInterval(t);
      clearInterval(ageClock);
    };
  }, [load]);

  const copy = (id: string) => {
    navigator.clipboard
      ?.writeText(id)
      .then(() => {
        setCopied(id);
        setTimeout(() => setCopied(null), 1500);
      })
      .catch(() => {
        // Clipboard denied (permissions, insecure context): say so instead of a false "Copied".
        setCopied(null);
        setCopyFailed(true);
        setTimeout(() => setCopyFailed(false), 4000);
      });
  };

  const chat = data?.models.filter((m) => m.mode === "chat") ?? [];
  const embed = data?.models.filter((m) => m.mode !== "chat") ?? [];
  const freeCount = data?.models.filter(isFree).length ?? 0;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      {/* Core task in the first phone screen: the free chat models, no scroll needed */}
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        AMD OnPrem free models
      </h1>
      <p className="mt-1 text-base text-muted-foreground">
        Every free model on the internal gateway, refreshed every {REFRESH_S} seconds.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {fetchFailed ? (
          <Badge variant="destructive">Gateway unreachable — showing the last snapshot</Badge>
        ) : (
          <Badge variant="secondary" aria-live="polite">
            {loading ? "Refreshing…" : `${data?.count ?? 0} models · ${freeCount} free`}
          </Badge>
        )}
        {data && !data.live && !fetchFailed && (
          <Badge variant="destructive">Live fetch failed — showing last snapshot</Badge>
        )}
        <span className="text-base text-muted-foreground" aria-live="polite">
          Updated {timeAgo(data?.fetchedAt ?? null)}
        </span>
        <Button size="sm" variant="outline" onClick={load} className="min-h-11">
          Refresh
        </Button>
      </div>
      {/* A failed fetch is a failure state, not a zero count: the banner stays until the next
          successful refresh, and the badge row above switches to a destructive "last snapshot"
          pill rather than looking like success (Jobs round 1, J1-2). */}
      {fetchFailed && (
        <p role="alert" className="mt-2 text-base text-destructive">
          {fetchError ?? "The gateway could not be reached."}
          {data && (data.count > 0) ? " Showing the last snapshot." : " No data yet — try again shortly."}
        </p>
      )}
      {copyFailed && (
        <p role="alert" className="mt-2 text-base text-destructive">
          The browser refused the copy — select the model id and copy it by hand.
        </p>
      )}

      {loading && !data && <p className="mt-8 text-muted-foreground">Loading models…</p>}

      {data && (
        <>
          {/* Phone: no wide table — each model is a two-line row (name + facts, then Copy). The
              sticky-columns table is unreadable at 375px (Jobs round 2, J2-1); from md up the
              table reads well, so it stays for desktop. */}
          <div className="mt-4 space-y-2 md:hidden">
            <h2 id="chat-models-mobile" className="text-lg font-semibold">
              Chat models ({chat.length})
            </h2>
            {chat.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {m.id}
                    {m.isNew && (
                      <Badge className="ml-2 align-middle" variant="default">
                        new
                      </Badge>
                    )}
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {m.context_length ? `${Math.round(m.context_length / 1000)}K context · ` : ""}
                    {m.capacity ?? "no limit reported"}
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground tabular-nums">
                    7-day tokens: {fmtTokens(m.stats?.total_tokens ?? 0)}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copy(m.id)}
                  aria-label={`Copy model id ${m.id}`}
                  className="min-h-11 min-w-20 shrink-0"
                >
                  {copied === m.id ? "Copied" : "Copy"}
                </Button>
              </div>
            ))}
            <h2 id="other-models-mobile" className="mt-4 text-lg font-semibold">
              Embedding, rerank and decision models ({embed.length})
            </h2>
            {embed.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{m.id}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {modeLabel(m.mode)}
                    {m.expire_on ? ` · expires ${m.expire_on.slice(0, 10)}` : ""}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copy(m.id)}
                  aria-label={`Copy model id ${m.id}`}
                  className="min-h-11 min-w-20 shrink-0"
                >
                  {copied === m.id ? "Copied" : "Copy"}
                </Button>
              </div>
            ))}
          </div>

          {/* Desktop (md+): the full tables with sticky Model and Copy columns. */}
          <div className="hidden md:block">
            <section aria-labelledby="chat-models" className="mt-4">
              <h2 id="chat-models" className="text-lg font-semibold">
                Chat models ({chat.length})
              </h2>
              <div className="mt-3 overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 z-10 min-w-56 bg-background">Model</TableHead>
                      <TableHead>Context</TableHead>
                      <TableHead>Capacity</TableHead>
                      <TableHead className="text-right">7-day tokens</TableHead>
                      <TableHead className="sticky right-0 z-10 w-24 bg-background text-right">Copy</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {chat.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="sticky left-0 z-10 bg-background font-medium">
                          {m.id}
                          {m.isNew && (
                            <Badge className="ml-2 align-middle" variant="default">
                              new
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {m.context_length
                            ? `${Math.round(m.context_length / 1000)}K`
                            : "—"}
                        </TableCell>
                        <TableCell className="text-sm">{m.capacity ?? "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {fmtTokens(m.stats?.total_tokens ?? 0)}
                        </TableCell>
                        <TableCell className="sticky right-0 z-10 bg-background text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => copy(m.id)}
                            aria-label={`Copy model id ${m.id}`}
                            className="min-h-11 min-w-20"
                          >
                            {copied === m.id ? "Copied" : "Copy"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </section>

            <section aria-labelledby="other-models" className="mt-8">
              <h2 id="other-models" className="text-lg font-semibold">
                Embedding, rerank and decision models ({embed.length})
              </h2>
              <div className="mt-3 overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 z-10 min-w-56 bg-background">Model</TableHead>
                      <TableHead>Mode</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead className="sticky right-0 z-10 w-24 bg-background text-right">Copy</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {embed.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="sticky left-0 z-10 bg-background font-medium">{m.id}</TableCell>
                        <TableCell>{modeLabel(m.mode)}</TableCell>
                        <TableCell className="text-sm">
                          {m.expire_on ? m.expire_on.slice(0, 10) : "—"}
                        </TableCell>
                        <TableCell className="sticky right-0 z-10 bg-background text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => copy(m.id)}
                            aria-label={`Copy model id ${m.id}`}
                            className="min-h-11 min-w-20"
                          >
                            {copied === m.id ? "Copied" : "Copy"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </section>
          </div>

          <details className="mt-8 text-base text-muted-foreground">
            <summary className="min-h-11 cursor-pointer text-foreground">How this works</summary>
            <p className="mt-2 max-w-prose">
              The page calls this site&apos;s own <code>/api/models</code> route, which fetches the
              model list straight from the gateway with a server-side key (never sent to your
              browser) and compares it with the previous fetch. A model that appears since the last
              fetch gets the &quot;new&quot; badge, so fresh free models are visible the moment they
              land. Capacity shows the gateway&apos;s own limits for the model: tokens and requests
              per minute, followed by the GPU fleet behind it — replicas and GPU model, e.g.
              &quot;60K TPM, 142 RPM (2 replicas, 2*MI350P)&quot;.
            </p>
          </details>

          <p className="mt-6 text-base text-muted-foreground">
            Fetched {data.fetchedAt ? new Date(data.fetchedAt).toLocaleString("en-US") : "—"} ·{" "}
            {updatedAt ? `page refreshed ${updatedAt.toLocaleTimeString("en-US")}` : ""} · source:
            llm-api.amd.com/OnPrem/models
          </p>
        </>
      )}
    </main>
  );
}
