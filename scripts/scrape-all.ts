/**
 * Master scraping orchestrator
 *
 * Runs all scrapers, then triggers the seed-database merge.
 *
 * Usage:
 *   npx ts-node scripts/scrapers/scrape-all.ts [--full]
 *
 * Flags:
 *   --full    Also run the full catalog price update (weekly)
 *   (default) Only runs scrapers + seed merge
 */

import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.join(__dirname, "../..");
const SCRAPERS_DIR = __dirname;

interface ScraperConfig {
  name: string;
  command: string;
  category: "gpu" | "cpu";
  enabled: boolean;
}

const scrapers: ScraperConfig[] = [
  {
    name: "TechPowerUp GPU Scraper",
    command: `node ${path.join(SCRAPERS_DIR, "techpowerup-gpu-scraper.js")} --pages 15`,
    category: "gpu",
    enabled: true,
  },
  {
    name: "PassMark CPU Scraper",
    command: `node ${path.join(SCRAPERS_DIR, "passmark-cpu-scraper.js")}`,
    category: "cpu",
    enabled: true,
  },
];

function runCommand(label: string, cmd: string): boolean {
  console.log(`\n▶ ${label}`);
  console.log(`  $ ${cmd}\n`);
  try {
    execSync(cmd, { cwd: ROOT, stdio: "inherit" });
    return true;
  } catch (err) {
    console.error(`❌ ${label} failed:`, err instanceof Error ? err.message : err);
    return false;
  }
}

async function main() {
  console.log("🔄 Starting scrape-all pipeline\n");

  let scraperResults = 0;

  for (const scraper of scrapers) {
    if (!scraper.enabled) {
      console.log(`⏭  Skipping ${scraper.name} (disabled)`);
      continue;
    }
    const ok = runCommand(scraper.name, scraper.command);
    if (ok) scraperResults++;
  }

  console.log(`\n📊 Scrapers completed: ${scraperResults}/${scrapers.filter((s) => s.enabled).length}`);

  // Run seed-database to merge scraped data into catalog
  console.log("\n🌱 Running seed-database merge...");
  runCommand("Seed Database", `npx ts-node ${path.join(ROOT, "scripts/seed-database.ts")}`);

  console.log("\n✅ Scrape-all pipeline complete!");
}

main().catch((err) => {
  console.error("Pipeline failed:", err);
  process.exit(1);
});
