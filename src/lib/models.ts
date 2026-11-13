export type OnPremModel = {
  id: string;
  mode: string;
  keyName: string;
  context_length: number;
  max_output_tokens: number;
  capabilities: Record<string, boolean>;
  expire_on: string | null;
  capacity: string | null;
  health_rate: {
    percentage: number;
    worst_percentage: number;
    last_usage: string;
    latency: string;
    deployments: number;
  } | null;
  pricing: {
    source: string;
    input_per_million: number;
    output_per_million: number;
    [k: string]: unknown;
  } | null;
  stats: {
    window_hours: number;
    total_requests: number;
    total_tokens: number;
  } | null;
};

export type Snapshot = {
  fetchedAt: string;
  models: OnPremModel[];
};

export const FREE = true; // every OnPrem "Public" pricing row is 0; the API is the check

export function isFree(model: OnPremModel): boolean {
  const p = model.pricing;
  if (!p) return false;
  const perMillion = [
    p.input_per_million,
    p.output_per_million,
    p.cache_read_input_per_million,
    p.cache_creation_input_per_million,
    p.reasoning_per_million,
  ].filter((v) => typeof v === "number") as number[];
  return perMillion.every((v) => v === 0);
}

export function modeLabel(mode: string): string {
  return mode.charAt(0).toUpperCase() + mode.slice(1);
}
