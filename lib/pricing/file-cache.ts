import fs from "fs";
import path from "path";

export interface PriceCacheEntry {
  component_id: string;
  price_usd: number;
  source: string;
  fetched_at: string;
  url?: string;
}

export interface PriceCache {
  entries: Record<string, PriceCacheEntry>;
  last_full_update: string;
  last_top_update: string;
}

const CACHE_PATH = path.join(process.cwd(), "data", "pricing-cache.json");
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const FULL_UPDATE_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function ensureCacheFile(): PriceCache {
  if (!fs.existsSync(CACHE_PATH)) {
    const empty: PriceCache = {
      entries: {},
      last_full_update: new Date(0).toISOString(),
      last_top_update: new Date(0).toISOString(),
    };
    fs.writeFileSync(CACHE_PATH, JSON.stringify(empty, null, 2), "utf8");
    return empty;
  }
  return JSON.parse(fs.readFileSync(CACHE_PATH, "utf8"));
}

export function readCache(): PriceCache {
  return ensureCacheFile();
}

export function writeCache(cache: PriceCache): void {
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), "utf8");
}

export function getCachedPrice(componentId: string): PriceCacheEntry | null {
  const cache = readCache();
  const entry = cache.entries[componentId];
  if (!entry) return null;

  const age = Date.now() - new Date(entry.fetched_at).getTime();
  if (age > CACHE_TTL_MS) return null;

  return entry;
}

export function setCachedPrice(entry: PriceCacheEntry): void {
  const cache = readCache();
  cache.entries[entry.component_id] = entry;
  writeCache(cache);
}

export function setCachedPrices(entries: PriceCacheEntry[]): void {
  const cache = readCache();
  for (const entry of entries) {
    cache.entries[entry.component_id] = entry;
  }
  writeCache(cache);
}

export function needsFullUpdate(): boolean {
  const cache = readCache();
  const age = Date.now() - new Date(cache.last_full_update).getTime();
  return age > FULL_UPDATE_INTERVAL_MS;
}

export function needsTopUpdate(): boolean {
  const cache = readCache();
  const age = Date.now() - new Date(cache.last_top_update).getTime();
  return age > CACHE_TTL_MS;
}

export function markFullUpdate(): void {
  const cache = readCache();
  cache.last_full_update = new Date().toISOString();
  writeCache(cache);
}

export function markTopUpdate(): void {
  const cache = readCache();
  cache.last_top_update = new Date().toISOString();
  writeCache(cache);
}

export function getAllCachedPrices(): Record<string, number> {
  const cache = readCache();
  const result: Record<string, number> = {};
  const now = Date.now();

  for (const [id, entry] of Object.entries(cache.entries)) {
    const age = now - new Date(entry.fetched_at).getTime();
    if (age <= CACHE_TTL_MS) {
      result[id] = entry.price_usd;
    }
  }

  return result;
}
