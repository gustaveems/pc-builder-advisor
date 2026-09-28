/**
 * Pricing update script
 *
 * Updates component pricing from enabled providers.
 *
 * Usage:
 *   npx ts-node scripts/update-pricing.ts [--full]
 *
 * Modes:
 *   (default)  Update top 500 popular components (daily)
 *   --full     Update entire catalog (weekly)
 *
 * Environment variables:
 *   ENABLE_PCPP_PRICING=1     Enable PCPartPicker scraping
 *   ENABLE_NEWEGG_PRICING=1   Enable Newegg scraping
 *   AMAZON_ACCESS_KEY=...     Enable Amazon PA-API
 *   AMAZON_SECRET_KEY=...
 *   AMAZON_PARTNER_TAG=...
 */

import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

type ComponentEntry = { id: string; name: string; category: string };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function loadModules() {
  const root = path.join(__dirname, "..");

  const dataLoaderUrl = pathToFileURL(path.join(root, "lib", "data-loader.ts"));
  const cacheUrl = pathToFileURL(path.join(root, "lib", "pricing", "cache.ts"));
  const providersUrl = pathToFileURL(
    path.join(root, "lib", "pricing", "providers.ts")
  );

  const [{ loadAllComponents }, cache, providers] = await Promise.all([
    import(dataLoaderUrl.href),
    import(cacheUrl.href),
    import(providersUrl.href),
  ]);

  return { loadAllComponents, cache, providers };
}

function flattenComponents(
  components: any
): ComponentEntry[] {
  const flat: ComponentEntry[] = [];

  const categoryMap: Record<string, string> = {
    cpus: "cpu",
    gpus: "gpu",
    motherboards: "motherboard",
    ram: "ram",
    storage: "storage",
    psus: "psu",
    coolers: "cooler",
    cases: "case",
  };

  for (const [key, items] of Object.entries(components)) {
    const category = categoryMap[key] || key;
    for (const item of items as any[]) {
      if (item.id && item.name) {
        flat.push({ id: item.id, name: item.name, category });
      }
    }
  }

  // Keep deterministic ordering; popularity ranking is provider-specific.

  return flat;
}

async function main() {
  const { loadAllComponents, cache, providers } = await loadModules();

  const isFullMode = process.argv.includes("--full");
  const enabledProviders =
    typeof providers.getEnabledProviders === "function"
      ? providers.getEnabledProviders()
      : [];

  console.log("💰 Pricing update script");
  console.log(`  Mode: ${isFullMode ? "FULL catalog" : "Top 500"}`);
  console.log(
    `  Providers enabled: ${enabledProviders.map((p: any) => p.name).join(", ") || "(none)"}`
  );
  console.log(`  Full update needed: ${cache.needsFullUpdate()}`);
  console.log(`  Top update needed: ${cache.needsTopUpdate()}\n`);

  const components = loadAllComponents();
  const flat = flattenComponents(components);

  console.log(`  Total components: ${flat.length}\n`);

  if (enabledProviders.length === 0) {
    console.log("No pricing providers enabled; set env vars to enable.");
    return;
  }

  const limit = isFullMode ? flat.length : 500;
  const toUpdate = flat.slice(0, limit);

  const REQUEST_DELAY_MS = 500;
  const entries: any[] = [];
  let updated = 0;
  let failed = 0;

  for (const component of toUpdate) {
    let found = false;
    for (const provider of enabledProviders) {
      try {
        const result = await provider.fetchPrice(component.name, component.category);
        if (result) {
          entries.push({
            component_id: component.id,
            price_usd: result.price_usd,
            source: result.source,
            fetched_at: new Date().toISOString(),
            url: result.url,
          });
          updated++;
          found = true;
          break;
        }
      } catch {
        // try next provider
      }
    }
    if (!found) failed++;
    await new Promise((r) => setTimeout(r, REQUEST_DELAY_MS));
  }

  if (entries.length > 0) {
    cache.setCachedPrices(entries);
  }
  if (isFullMode) cache.markFullUpdate();
  else cache.markTopUpdate();

  console.log(
    `\n✅ ${isFullMode ? "Full" : "Top"} update: ${updated} updated, ${failed} failed`
  );
}

main().catch((err) => {
  console.error("Pricing update failed:", err);
  process.exit(1);
});
