import fs from "fs";
import path from "path";

// Simple file-based loader for server-side use (API routes, scripts).
// Tries catalog first, then falls back to seed data.

// Prefer seed data by default. Only use catalog when USE_CATALOG === "true".
const USE_CATALOG = process.env.USE_CATALOG === "true";
const catalogDir = path.join(process.cwd(), "data", "catalog");
const seedDir = path.join(process.cwd(), "data", "seed");

function safeReadJson(filePath: string): unknown {
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw);
}

/**
 * Load JSON array from catalog or seed.
 * - Prefer catalog when USE_CATALOG is true and file exists with >0 entries.
 * - Otherwise fall back to seed.
 */
function loadJSONFile<T = any>(filename: string): T[] {
  try {
    if (USE_CATALOG) {
      const catalogPath = path.join(catalogDir, filename);
      if (fs.existsSync(catalogPath)) {
        const parsed = safeReadJson(catalogPath) as T[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          console.log(
            `✅ Loaded ${parsed.length} items from catalog/${filename}`
          );
          return parsed;
        }
        console.warn(
          `⚠️  catalog/${filename} is empty, falling back to seed/${filename}`
        );
      }
    }

    const seedPath = path.join(seedDir, filename);
    if (fs.existsSync(seedPath)) {
      const parsed = safeReadJson(seedPath) as T[];
      if (Array.isArray(parsed)) {
        console.log(
          `⚠️  Loaded ${parsed.length} items from seed/${filename} (catalog missing or empty)`
        );
        return parsed;
      }
    }

    console.error(`❌ File not found or invalid: ${filename}`);
    return [];
  } catch (err) {
    console.error(`❌ Error loading ${filename}:`, err);
    return [];
  }
}

export function loadCPUs() {
  return loadJSONFile("cpus.json");
}

export function loadGPUs() {
  return loadJSONFile("gpus.json");
}

export function loadMotherboards() {
  return loadJSONFile("motherboards.json");
}

export function loadRAM() {
  return loadJSONFile("ram.json");
}

export function loadStorage() {
  return loadJSONFile("storage.json");
}

export function loadPSUs() {
  return loadJSONFile("psus.json");
}

export function loadCoolers() {
  return loadJSONFile("coolers.json");
}

export function loadCases() {
  return loadJSONFile("cases.json");
}

export function loadAllComponents() {
  const components = {
    cpus: loadCPUs(),
    gpus: loadGPUs(),
    motherboards: loadMotherboards(),
    ram: loadRAM(),
    storage: loadStorage(),
    psus: loadPSUs(),
    coolers: loadCoolers(),
    cases: loadCases(),
  };

  const total = Object.values(components).reduce(
    (sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0),
    0
  );

  console.log("\n📦 Component catalog loaded");
  console.log(`  CPUs: ${components.cpus.length}`);
  console.log(`  GPUs: ${components.gpus.length}`);
  console.log(`  Motherboards: ${components.motherboards.length}`);
  console.log(`  RAM: ${components.ram.length}`);
  console.log(`  Storage: ${components.storage.length}`);
  console.log(`  PSUs: ${components.psus.length}`);
  console.log(`  Coolers: ${components.coolers.length}`);
  console.log(`  Cases: ${components.cases.length}`);
  console.log(`  TOTAL: ${total} components\n`);

  return components;
}

