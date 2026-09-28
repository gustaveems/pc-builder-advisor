/**
 * PassMark CPU CSV → normalized JSON converter
 *
 * PassMark provides a CPU list CSV export from:
 *   https://www.cpubenchmark.net/CPU_mega_page.html
 *
 * Download that CSV manually as `passmark-cpus.csv` into scripts/data-sources/,
 * then run:
 *
 *   node scripts/scrapers/passmark-cpu-scraper.js
 *
 * Output: `scripts/data-sources/passmark-cpus.json` in catalog-compatible format.
 */

const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");

const INPUT_PATH = path.join(__dirname, "../data-sources/passmark-cpus.csv");
const OUTPUT_PATH = path.join(__dirname, "../data-sources/passmark-cpus.json");

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function parsePrice(value) {
  if (!value) return undefined;
  const cleaned = String(value).replace(/[$,]/g, "").trim();
  const num = parseFloat(cleaned);
  return Number.isFinite(num) && num > 0 ? Math.round(num) : undefined;
}

function inferSocket(name) {
  if (/13\d{3}|14\d{3}|12\d{3}/i.test(name)) return "LGA1700";
  if (/Core Ultra|Arrow Lake|265|285/i.test(name)) return "LGA1851";
  if (/7\d{3}X|9\d{3}X|7600|7700|7800|7900|7950|9[3-9]\d{2}/i.test(name) && name.includes("Ryzen")) return "AM5";
  if (/5\d{3}|3\d{3}/i.test(name) && name.includes("Ryzen")) return "AM4";
  if (/Xeon W-3|Xeon W-2[4-9]/i.test(name)) return "LGA4677";
  if (/EPYC/i.test(name)) return "SP5";
  return "Unknown";
}

function determineMemType(socket) {
  if (["LGA1851", "AM5", "SP5", "LGA4677"].includes(socket)) return "DDR5";
  if (socket === "LGA1700") return "DDR5";
  return "DDR4";
}

function determinePcie(socket) {
  if (["LGA1851", "AM5", "SP5"].includes(socket)) return "5.0";
  if (socket === "LGA1700") return "5.0";
  return "4.0";
}

function estimateTier(cores, boost, tdp) {
  let score = 0;
  if (cores >= 24) score += 40;
  else if (cores >= 16) score += 35;
  else if (cores >= 12) score += 30;
  else if (cores >= 8) score += 25;
  else if (cores >= 6) score += 20;
  else score += 10;

  if (boost >= 5.5) score += 30;
  else if (boost >= 5.0) score += 25;
  else if (boost >= 4.5) score += 20;
  else if (boost >= 4.0) score += 15;
  else score += 10;

  if (tdp >= 125) score += 30;
  else if (tdp >= 95) score += 25;
  else if (tdp >= 65) score += 20;
  else score += 15;

  return Math.max(1, Math.min(10, Math.ceil(score / 10)));
}

function scrape() {
  if (!fs.existsSync(INPUT_PATH)) {
    console.error(
      `Input CSV not found at ${INPUT_PATH}.\nDownload PassMark CPU CSV and place it there first.`
    );
    process.exit(1);
  }

  const cpus = [];

  fs.createReadStream(INPUT_PATH)
    .pipe(csv())
    .on("data", (row) => {
      const name = row["CPU Name"] || row["Name"] || "";
      if (!name) return;

      // Skip very old / server-only CPUs unless interesting
      const socket = inferSocket(name);
      const manufacturer = name.includes("Intel") ? "Intel" : "AMD";

      const cores = parseInt(row["Cores"] || row["# of Cores"] || "0", 10);
      const threads = parseInt(row["Threads"] || row["# of Threads"] || "0", 10);
      const baseClock = parseFloat(row["Base Clock"] || "0");
      const boostClock = parseFloat(row["Turbo Clock"] || "0");
      const tdp = parseInt(row["TDP"] || "0", 10);
      const price = parsePrice(row["Price (USD)"]);

      cpus.push({
        id: `cpu-pm-${slugify(name)}`,
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
          max_mem_speed_mhz: undefined,
          memory_type: determineMemType(socket),
          pcie_version: determinePcie(socket),
          has_igpu: row["Integrated GPU"] === "Yes" || row["iGPU"] === "Yes",
          tier: estimateTier(cores, boostClock, tdp),
        },
      });
    })
    .on("end", () => {
      fs.writeFileSync(OUTPUT_PATH, JSON.stringify(cpus, null, 2), "utf8");
      console.log(`✅ Processed ${cpus.length} CPUs → ${OUTPUT_PATH}`);
    })
    .on("error", (err) => {
      console.error("Error reading CSV:", err);
      process.exit(1);
    });
}

scrape();
