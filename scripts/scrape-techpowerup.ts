/**
 * TechPowerUp GPU scraper
 *
 * Scrapes GPU metadata from https://www.techpowerup.com/gpu-specs/
 * and writes normalized JSON matching the catalog GPU schema.
 *
 * Usage:
 *   node scripts/scrapers/techpowerup-gpu-scraper.js [--pages N] [--since YYYY]
 *
 * Notes:
 * - Respect TechPowerUp's terms of use; add delays between requests.
 * - Desktop GPUs only by default.
 */

const fs = require("fs");
const path = require("path");
const axios = require("axios");
const cheerio = require("cheerio");

const OUTPUT_PATH = path.join(
  __dirname,
  "../data-sources/techpowerup-gpus.json"
);

const args = process.argv.slice(2);
const maxPagesArg = args.indexOf("--pages");
const sinceArg = args.indexOf("--since");

const MAX_PAGES = maxPagesArg !== -1 ? parseInt(args[maxPagesArg + 1], 10) : 15;
const SINCE_YEAR = sinceArg !== -1 ? args[sinceArg + 1] : "2020";

const BASE_URL = `https://www.techpowerup.com/gpu-specs/?mobile=No&released=${SINCE_YEAR}-2026&sort=name&page=`;
const REQUEST_DELAY_MS = 1200;
const DETAIL_DELAY_MS = 800;

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function extractBrand(name) {
  if (/geforce|nvidia|rtx|gtx|titan/i.test(name)) return "NVIDIA";
  if (/radeon|amd|rx\s/i.test(name)) return "AMD";
  if (/intel|arc/i.test(name)) return "Intel";
  return "NVIDIA";
}

function parseVramGb(memString) {
  const match = memString.match(/(\d+)\s*(MB|GB)/i);
  if (!match) return 0;
  const value = parseInt(match[1], 10);
  return match[2].toUpperCase() === "MB" ? Math.round(value / 1024) : value;
}

async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function scrapePage(page) {
  const url = `${BASE_URL}${page}`;
  console.log(`Fetching page ${page}: ${url}`);

  const { data } = await axios.get(url, {
    headers: { "User-Agent": USER_AGENT },
    timeout: 15000,
  });

  const $ = cheerio.load(data);
  const rows = $("table.processors tr");
  const gpus = [];

  rows.each((i, row) => {
    const cells = $(row).find("td");
    if (cells.length < 8) return;

    const name = $(cells[0]).text().trim();
    if (!name) return;

    const detailLink = $(cells[0]).find("a").attr("href");
    const chip = $(cells[1]).text().trim();
    const releaseDate = $(cells[2]).text().trim();
    const bus = $(cells[3]).text().trim();
    const memory = $(cells[4]).text().trim();
    const gpuClock = $(cells[5]).text().trim();
    const memClock = $(cells[6]).text().trim();
    const shaders = $(cells[7]).text().trim();

    gpus.push({
      name,
      gpu_chip: chip,
      release_date: releaseDate,
      bus,
      memory_size: memory,
      core_clock: gpuClock,
      memory_clock: memClock,
      shaders,
      detail_url: detailLink ? `https://www.techpowerup.com${detailLink}` : null,
    });
  });

  console.log(`  -> found ${gpus.length} GPUs on page ${page}`);
  return gpus;
}

/**
 * Fetch GPU detail page to get TDP, power connectors, length, slot width.
 */
async function scrapeDetail(gpu) {
  if (!gpu.detail_url) return gpu;

  try {
    const { data } = await axios.get(gpu.detail_url, {
      headers: { "User-Agent": USER_AGENT },
      timeout: 15000,
    });
    const $ = cheerio.load(data);

    $(".gpu-specs-table dl").each((_, dl) => {
      const dt = $(dl).find("dt").text().trim().toLowerCase();
      const dd = $(dl).find("dd").text().trim();

      if (dt.includes("tdp")) gpu.tdp = dd;
      if (dt.includes("slot width")) gpu.slot_width = dd;
      if (dt.includes("length")) gpu.length = dd;
      if (dt.includes("power connector")) gpu.power_connectors = dd;
      if (dt.includes("outputs")) gpu.outputs = dd;
    });
  } catch (err) {
    console.warn(`  ⚠️  Could not fetch detail for ${gpu.name}: ${err.message}`);
  }

  return gpu;
}

/**
 * Normalize a raw scraped GPU to catalog-compatible format.
 */
function normalizeToCatalog(raw) {
  const brand = extractBrand(raw.name);
  const vram = parseVramGb(raw.memory_size || "");
  const tdp = parseInt(raw.tdp || "0", 10) || undefined;
  const length = parseInt(raw.length || "0", 10) || undefined;
  const thickness = parseFloat(raw.slot_width || "2") || 2;
  const shaderCount = parseInt(raw.shaders || "0", 10);

  let tier = 5;
  if (vram >= 24 && shaderCount >= 16000) tier = 10;
  else if (vram >= 16 && shaderCount >= 8000) tier = 8;
  else if (vram >= 12 && shaderCount >= 5000) tier = 7;
  else if (vram >= 8 && shaderCount >= 3000) tier = 6;
  else if (vram >= 8) tier = 5;
  else if (vram >= 6) tier = 4;
  else if (vram >= 4) tier = 3;
  else tier = 2;

  let powerConns = ["8-pin"];
  if (raw.power_connectors) {
    const pc = raw.power_connectors.toLowerCase();
    if (pc.includes("16-pin") || pc.includes("12vhpwr")) powerConns = ["16-pin"];
    else if (pc.includes("3x") && pc.includes("8-pin")) powerConns = ["8-pin", "8-pin", "8-pin"];
    else if (pc.includes("2x") && pc.includes("8-pin")) powerConns = ["8-pin", "8-pin"];
    else if (pc.includes("1x") && pc.includes("6-pin")) powerConns = ["6-pin"];
  }

  return {
    id: `gpu-tpu-${slugify(raw.name)}`,
    name: raw.name,
    manufacturer: brand,
    specs: {
      brand,
      length_mm: length || 280,
      thickness_slots: thickness,
      tdp_w: tdp,
      power_connectors: powerConns,
      pcie_version: raw.bus && raw.bus.includes("5.0") ? "5.0" : "4.0",
      vram_gb: vram || undefined,
      tier,
    },
  };
}

async function scrapeGpuDatabase() {
  const allRawGpus = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    try {
      const pageGpus = await scrapePage(page);
      if (pageGpus.length === 0) {
        console.log(`No results on page ${page}, stopping.`);
        break;
      }
      allRawGpus.push(...pageGpus);
      console.log(`Total GPUs so far: ${allRawGpus.length}`);
      await delay(REQUEST_DELAY_MS);
    } catch (err) {
      console.error(`Error scraping page ${page}:`, err.message);
      break;
    }
  }

  // Optionally fetch detail pages for top GPUs (limited batch)
  const fetchDetails = process.argv.includes("--details");
  if (fetchDetails) {
    const limit = Math.min(allRawGpus.length, 50);
    console.log(`\nFetching detail pages for ${limit} GPUs...`);
    for (let i = 0; i < limit; i++) {
      allRawGpus[i] = await scrapeDetail(allRawGpus[i]);
      await delay(DETAIL_DELAY_MS);
    }
  }

  const normalized = allRawGpus.map(normalizeToCatalog);
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(normalized, null, 2), "utf8");
  console.log(`\n✅ Scraped ${normalized.length} GPUs → ${OUTPUT_PATH}`);
}

scrapeGpuDatabase().catch((err) => {
  console.error("Scrape failed:", err);
  process.exit(1);
});
