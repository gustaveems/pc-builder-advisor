/**
 * Universal dataset importer
 *
 * Handles CSV and JSON imports from various sources (PCPartPicker exports,
 * community datasets, manufacturer spec sheets) and normalizes them to the
 * catalog schema.
 *
 * Usage:
 *   npx ts-node scripts/import-dataset.ts --source <path> --category <cpu|gpu|...> [--format csv|json] [--merge]
 */

import fs from "fs";
import path from "path";
import csv from "csv-parser";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type Category =
  | "cpu"
  | "gpu"
  | "motherboard"
  | "ram"
  | "storage"
  | "psu"
  | "cooler"
  | "case";

const CATALOG_DIR = path.join(__dirname, "../data/catalog");

const CATEGORY_FILE_MAP: Record<Category, string> = {
  cpu: "cpus.json",
  gpu: "gpus.json",
  motherboard: "motherboards.json",
  ram: "ram.json",
  storage: "storage.json",
  psu: "psus.json",
  cooler: "coolers.json",
  case: "cases.json",
};

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// ─── Normalizers per category ───────────────────────────────────────────────

function normalizeCpu(raw: Record<string, any>): any {
  const name = raw.name || raw.Name || raw["CPU Name"] || "";
  const manufacturer = name.includes("Intel") ? "Intel" : "AMD";

  const socket =
    raw.socket || raw.Socket || inferCpuSocket(name) || "Unknown";
  const cores = parseInt(raw.cores || raw.Cores || raw["# of Cores"] || "0");
  const threads = parseInt(
    raw.threads || raw.Threads || raw["# of Threads"] || "0"
  );
  const baseClock = parseFloat(
    raw.base_clock_ghz || raw["Base Clock"] || raw.base_clock || "0"
  );
  const boostClock = parseFloat(
    raw.boost_clock_ghz || raw["Turbo Clock"] || raw.turbo_clock || "0"
  );
  const tdp = parseInt(raw.tdp_w || raw.TDP || raw.tdp || "0");
  const price =
    parsePrice(raw.price_usd || raw.price || raw["Price (USD)"] || "") || undefined;

  const memType = determineMemoryType(socket);
  const pcieVer = determinePcieVersion(socket);

  return {
    id: raw.id || `cpu-${slugify(name)}`,
    name,
    manufacturer,
    price_usd: price,
    specs: {
      brand: manufacturer,
      socket,
      cores: cores || undefined,
      threads: threads || undefined,
      base_clock_ghz: baseClock || undefined,
      boost_clock_ghz: boostClock || undefined,
      tdp_w: tdp || undefined,
      max_mem_speed_mhz: parseInt(raw.max_mem_speed_mhz || "0") || undefined,
      memory_type: memType,
      pcie_version: pcieVer,
      has_igpu: raw.has_igpu === true || raw.has_igpu === "Yes" || raw.has_igpu === "true",
      tier: parseInt(raw.tier || "0") || estimateCpuTier(cores, boostClock, tdp),
    },
  };
}

function normalizeGpu(raw: Record<string, any>): any {
  const name = raw.name || raw.Name || "";
  const manufacturer = name.match(/nvidia|geforce|rtx|gtx/i)
    ? "NVIDIA"
    : name.match(/amd|radeon|rx/i)
      ? "AMD"
      : "NVIDIA";

  const vram = parseVram(
    raw.vram_gb || raw.memory_size || raw["Memory Size"] || ""
  );
  const tdp = parseInt(raw.tdp_w || raw.TDP || raw.tdp || "0");
  const length = parseInt(raw.length_mm || raw.length || "0");
  const thickness = parseFloat(raw.thickness_slots || raw.slot_width || "2");
  const price =
    parsePrice(raw.price_usd || raw.price || raw["Price"] || "") || undefined;

  return {
    id: raw.id || `gpu-${slugify(name)}`,
    name,
    manufacturer,
    price_usd: price,
    specs: {
      brand: manufacturer,
      length_mm: length || 280,
      thickness_slots: thickness || 2,
      tdp_w: tdp || undefined,
      power_connectors: parsePowerConnectorArray(
        raw.power_connectors || raw["Power Connectors"] || ""
      ),
      pcie_version: raw.pcie_version || "4.0",
      vram_gb: vram || undefined,
      tier: parseInt(raw.tier || "0") || estimateGpuTier(vram, tdp),
    },
  };
}

function normalizeMotherboard(raw: Record<string, any>): any {
  const name = raw.name || raw.Name || "";
  return {
    id: raw.id || `mobo-${slugify(name)}`,
    name,
    manufacturer: raw.manufacturer || extractBoardManufacturer(name),
    price_usd: parsePrice(raw.price_usd || raw.price || ""),
    specs: {
      socket: raw.socket || raw.Socket || "",
      chipset: raw.chipset || raw.Chipset || "",
      form_factor: normalizeFormFactor(
        raw.form_factor || raw["Form Factor"] || "ATX"
      ),
      memory_type: (raw.memory_type || "DDR4").toUpperCase(),
      ram_slots: parseInt(raw.ram_slots || "4"),
      max_ram_gb: parseInt(raw.max_ram_gb || "128"),
      m2_slots: parseInt(raw.m2_slots || "1"),
      sata_ports: parseInt(raw.sata_ports || "4"),
      pcie_version: raw.pcie_version || "4.0",
      has_bios_flashback: raw.has_bios_flashback === true,
    },
  };
}

function normalizeRam(raw: Record<string, any>): any {
  const name = raw.name || raw.Name || "";
  return {
    id: raw.id || `ram-${slugify(name)}`,
    name,
    manufacturer: raw.manufacturer || extractRamManufacturer(name),
    price_usd: parsePrice(raw.price_usd || raw.price || ""),
    specs: {
      memory_type: (raw.memory_type || "DDR4").toUpperCase(),
      capacity_gb: parseInt(raw.capacity_gb || raw.capacity || "16"),
      speed_mhz: parseInt(raw.speed_mhz || raw.speed || "3200"),
      modules: parseInt(raw.modules || raw.sticks || "2"),
      latency: raw.latency || raw.cas_latency || "CL16",
    },
  };
}

function normalizeStorage(raw: Record<string, any>): any {
  const name = raw.name || raw.Name || "";
  const iface = raw.interface || raw.type || "NVMe";
  return {
    id: raw.id || `storage-${slugify(name)}`,
    name,
    manufacturer: raw.manufacturer || extractStorageManufacturer(name),
    price_usd: parsePrice(raw.price_usd || raw.price || ""),
    specs: {
      interface: iface === "m2" || iface === "nvme" ? "NVMe" : "SATA",
      form_factor: determineStorageFormFactor(iface),
      capacity_gb: parseInt(raw.capacity_gb || raw.capacity || "1000"),
      read_speed_mb_s: parseInt(raw.read_speed_mb_s || raw.read_speed || "0") || undefined,
      write_speed_mb_s: parseInt(raw.write_speed_mb_s || raw.write_speed || "0") || undefined,
    },
  };
}

function normalizePsu(raw: Record<string, any>): any {
  const name = raw.name || raw.Name || "";
  return {
    id: raw.id || `psu-${slugify(name)}`,
    name,
    manufacturer: raw.manufacturer || extractPsuManufacturer(name),
    price_usd: parsePrice(raw.price_usd || raw.price || ""),
    specs: {
      wattage_w: parseInt(raw.wattage_w || raw.wattage || "650"),
      efficiency: normalizeEfficiency(
        raw.efficiency || raw.rating || "80+ Gold"
      ),
      form_factor: raw.form_factor || "ATX",
      modular: raw.modular || "Fully modular",
      pcie_5_ready: raw.pcie_5_ready === true,
    },
  };
}

function normalizeCooler(raw: Record<string, any>): any {
  const name = raw.name || raw.Name || "";
  return {
    id: raw.id || `cooler-${slugify(name)}`,
    name,
    manufacturer: raw.manufacturer || extractCoolerManufacturer(name),
    price_usd: parsePrice(raw.price_usd || raw.price || ""),
    specs: {
      type: raw.type === "AIO" || raw.radiator_size_mm ? "AIO" : "Air",
      tdp_rating_w: parseInt(raw.tdp_rating_w || "0") || undefined,
      radiator_size_mm: parseInt(raw.radiator_size_mm || "0") || undefined,
      height_mm: parseInt(raw.height_mm || "0") || undefined,
      sockets: raw.sockets || ["LGA1700", "AM5"],
    },
  };
}

function normalizeCase(raw: Record<string, any>): any {
  const name = raw.name || raw.Name || "";
  return {
    id: raw.id || `case-${slugify(name)}`,
    name,
    manufacturer: raw.manufacturer || extractCaseManufacturer(name),
    price_usd: parsePrice(raw.price_usd || raw.price || ""),
    specs: {
      form_factor: normalizeFormFactor(
        raw.form_factor || raw["Form Factor"] || "ATX"
      ),
      max_gpu_length_mm: parseInt(raw.max_gpu_length_mm || "350"),
      max_cooler_height_mm: parseInt(
        raw.max_cooler_height_mm || raw.max_cpu_cooler_height_mm || "160"
      ),
      drive_bays_2_5: parseInt(raw.drive_bays_2_5 || "2"),
      drive_bays_3_5: parseInt(raw.drive_bays_3_5 || "2"),
      expansion_slots: parseInt(raw.expansion_slots || "7"),
      max_psu_form_factor: raw.max_psu_form_factor || "ATX",
    },
  };
}

const NORMALIZERS: Record<Category, (raw: Record<string, any>) => any> = {
  cpu: normalizeCpu,
  gpu: normalizeGpu,
  motherboard: normalizeMotherboard,
  ram: normalizeRam,
  storage: normalizeStorage,
  psu: normalizePsu,
  cooler: normalizeCooler,
  case: normalizeCase,
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function parsePrice(v: any): number | undefined {
  if (typeof v === "number") return v;
  if (!v) return undefined;
  const cleaned = String(v).replace(/[$,]/g, "").trim();
  const num = parseFloat(cleaned);
  return Number.isFinite(num) && num > 0 ? Math.round(num) : undefined;
}

function parseVram(v: any): number {
  if (typeof v === "number") return v;
  const match = String(v).match(/(\d+)\s*GB/i);
  return match ? parseInt(match[1], 10) : 0;
}

function parsePowerConnectorArray(v: any): string[] {
  if (Array.isArray(v)) return v;
  if (!v) return ["8-pin"];
  const str = String(v);
  if (str.includes("16-pin") || str.includes("12VHPWR")) return ["16-pin"];
  const eightPinCount = (str.match(/8-pin/gi) || []).length;
  if (eightPinCount >= 2) return ["8-pin", "8-pin"];
  if (eightPinCount === 1) return ["8-pin"];
  return ["8-pin"];
}

function normalizeFormFactor(ff: string): string {
  const lower = ff.toLowerCase();
  if (lower.includes("e-atx") || lower.includes("eatx")) return "E-ATX";
  if (lower.includes("micro") || lower.includes("matx")) return "Micro-ATX";
  if (lower.includes("mini") || lower.includes("itx")) return "Mini-ITX";
  return "ATX";
}

function normalizeEfficiency(e: string): string {
  const lower = e.toLowerCase();
  if (lower.includes("titanium")) return "80+ Titanium";
  if (lower.includes("platinum")) return "80+ Platinum";
  if (lower.includes("gold")) return "80+ Gold";
  if (lower.includes("silver")) return "80+ Silver";
  return "80+ Bronze";
}

function inferCpuSocket(name: string): string {
  if (/13\d{3}|14\d{3}|12\d{3}/i.test(name)) return "LGA1700";
  if (/Arrow Lake|Core Ultra [2579]|265|285/i.test(name)) return "LGA1851";
  if (/7\d{3}X|9\d{3}X|7600|7700|7800|7900|7950|9[3-9]\d{2}/i.test(name))
    return "AM5";
  if (/5\d{3}X?|3\d{3}X?/i.test(name) && name.includes("Ryzen"))
    return "AM4";
  return "Unknown";
}

function determineMemoryType(socket: string): string {
  if (["LGA1851", "AM5"].includes(socket)) return "DDR5";
  if (socket === "LGA1700") return "DDR5";
  return "DDR4";
}

function determinePcieVersion(socket: string): string {
  if (["LGA1851", "AM5"].includes(socket)) return "5.0";
  if (socket === "LGA1700") return "5.0";
  return "4.0";
}

function estimateCpuTier(cores: number, boost: number, tdp: number): number {
  let score = 0;
  if (cores >= 16) score += 40;
  else if (cores >= 12) score += 30;
  else if (cores >= 8) score += 25;
  else if (cores >= 6) score += 20;
  else score += 10;

  if (boost >= 5.5) score += 30;
  else if (boost >= 5.0) score += 25;
  else if (boost >= 4.5) score += 20;
  else score += 10;

  if (tdp >= 125) score += 30;
  else if (tdp >= 95) score += 25;
  else if (tdp >= 65) score += 20;
  else score += 15;

  return Math.max(1, Math.min(10, Math.ceil(score / 10)));
}

function estimateGpuTier(vram: number, tdp: number): number {
  let score = 0;
  if (vram >= 24) score += 50;
  else if (vram >= 16) score += 40;
  else if (vram >= 12) score += 30;
  else if (vram >= 8) score += 20;
  else score += 10;

  if (tdp >= 400) score += 50;
  else if (tdp >= 300) score += 40;
  else if (tdp >= 250) score += 30;
  else if (tdp >= 150) score += 20;
  else score += 10;

  return Math.max(1, Math.min(10, Math.ceil(score / 10)));
}

function extractBoardManufacturer(name: string): string {
  for (const m of ["ASUS", "MSI", "Gigabyte", "ASRock", "EVGA", "Biostar"])
    if (name.includes(m)) return m;
  return "Generic";
}

function extractRamManufacturer(name: string): string {
  for (const m of ["Corsair", "G.Skill", "Kingston", "Crucial", "TeamGroup", "Patriot"])
    if (name.includes(m)) return m;
  return "Generic";
}

function extractStorageManufacturer(name: string): string {
  for (const m of ["Samsung", "WD", "Western Digital", "Seagate", "Crucial", "Kingston", "Sabrent", "SK Hynix", "ADATA"])
    if (name.includes(m)) return m;
  return "Generic";
}

function extractPsuManufacturer(name: string): string {
  for (const m of ["Corsair", "EVGA", "Seasonic", "be quiet!", "Thermaltake", "Cooler Master", "NZXT", "Super Flower", "MSI"])
    if (name.includes(m)) return m;
  return "Generic";
}

function extractCoolerManufacturer(name: string): string {
  for (const m of ["Noctua", "Corsair", "be quiet!", "NZXT", "Cooler Master", "DeepCool", "Arctic", "Thermalright", "Lian Li"])
    if (name.includes(m)) return m;
  return "Generic";
}

function extractCaseManufacturer(name: string): string {
  for (const m of ["Fractal", "NZXT", "Corsair", "Lian Li", "Phanteks", "be quiet!", "Cooler Master", "Meshify", "Thermaltake"])
    if (name.includes(m)) return m;
  return "Generic";
}

function determineStorageFormFactor(iface: string): string {
  const lower = iface.toLowerCase();
  if (lower === "nvme" || lower === "m2" || lower === "m.2") return "M.2 2280";
  if (lower.includes("3.5")) return '3.5" SATA';
  return '2.5" SATA';
}

// ─── File I/O ───────────────────────────────────────────────────────────────

function readCsvFile(filePath: string): Promise<Record<string, any>[]> {
  return new Promise((resolve, reject) => {
    const results: Record<string, any>[] = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (row: Record<string, any>) => results.push(row))
      .on("end", () => resolve(results))
      .on("error", reject);
  });
}

function readJsonFile(filePath: string): any[] {
  const raw = fs.readFileSync(filePath, "utf-8");
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [];
}

function mergeById(existing: any[], incoming: any[]): any[] {
  const map = new Map<string, any>();
  for (const item of existing) map.set(item.id, item);
  for (const item of incoming) map.set(item.id, { ...map.get(item.id), ...item });
  return Array.from(map.values());
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    console.log(
      "Usage: npx ts-node scripts/import-dataset.ts --source <path> --category <cpu|gpu|...> [--format csv|json] [--merge]"
    );
    process.exit(0);
  }
  const sourceIdx = args.indexOf("--source");
  const categoryIdx = args.indexOf("--category");
  const formatIdx = args.indexOf("--format");
  const shouldMerge = args.includes("--merge");

  if (sourceIdx === -1 || categoryIdx === -1) {
    console.error(
      "Usage: npx ts-node scripts/import-dataset.ts --source <path> --category <cpu|gpu|...> [--format csv|json] [--merge]"
    );
    process.exit(1);
  }

  const sourcePath = path.resolve(args[sourceIdx + 1]);
  const category = args[categoryIdx + 1] as Category;
  const format = formatIdx !== -1 ? args[formatIdx + 1] : sourcePath.endsWith(".csv") ? "csv" : "json";

  if (!NORMALIZERS[category]) {
    console.error(`Unknown category: ${category}. Valid: ${Object.keys(NORMALIZERS).join(", ")}`);
    process.exit(1);
  }

  if (!fs.existsSync(sourcePath)) {
    console.error(`Source file not found: ${sourcePath}`);
    process.exit(1);
  }

  console.log(`📥 Importing ${category} data from ${sourcePath} (${format})`);

  const rawData = format === "csv" ? await readCsvFile(sourcePath) : readJsonFile(sourcePath);
  console.log(`  Read ${rawData.length} raw entries`);

  const normalizer = NORMALIZERS[category];
  const normalized = rawData
    .map((row) => {
      try {
        return normalizer(row);
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  console.log(`  Normalized ${normalized.length} entries`);

  const catalogFile = path.join(CATALOG_DIR, CATEGORY_FILE_MAP[category]);

  if (shouldMerge && fs.existsSync(catalogFile)) {
    const existing = readJsonFile(catalogFile);
    const merged = mergeById(existing, normalized);
    fs.writeFileSync(catalogFile, JSON.stringify(merged, null, 2), "utf8");
    console.log(
      `✅ Merged: ${existing.length} existing + ${normalized.length} incoming = ${merged.length} total → ${CATEGORY_FILE_MAP[category]}`
    );
  } else {
    fs.writeFileSync(catalogFile, JSON.stringify(normalized, null, 2), "utf8");
    console.log(`✅ Wrote ${normalized.length} entries → ${CATEGORY_FILE_MAP[category]}`);
  }
}

main().catch((err) => {
  console.error("Import failed:", err);
  process.exit(1);
});
