/**
 * Pricing data providers.
 *
 * Each provider fetches current pricing from a specific source.
 * Add your API keys via environment variables.
 */

export interface PriceResult {
  price_usd: number;
  source: string;
  url?: string;
}

export interface PricingProvider {
  name: string;
  enabled: boolean;
  fetchPrice(componentName: string, category: string): Promise<PriceResult | null>;
  fetchBulkPrices?(
    components: Array<{ id: string; name: string; category: string }>
  ): Promise<Map<string, PriceResult>>;
}

/**
 * PCPartPicker unofficial price lookup.
 * Searches their site and extracts the current lowest price.
 * Requires: axios, cheerio (already in devDeps)
 *
 * NOTE: Respect rate limits. Add delays between requests.
 */
export const pcpartpickerProvider: PricingProvider = {
  name: "PCPartPicker",
  enabled: !!process.env.ENABLE_PCPP_PRICING,

  async fetchPrice(componentName: string, category: string): Promise<PriceResult | null> {
    if (!this.enabled) return null;
    try {
      const axios = await import("axios");
      const cheerio = await import("cheerio");

      const searchUrl = `https://pcpartpicker.com/search/?q=${encodeURIComponent(componentName)}`;
      const { data } = await axios.default.get(searchUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; PCBuildAdvisorBot/0.1)",
        },
        timeout: 10000,
      });

      const $ = cheerio.load(data);
      const priceText = $(".search_results .search_results--price")
        .first()
        .text()
        .trim();

      if (!priceText) return null;

      const price = parseFloat(priceText.replace(/[$,]/g, ""));
      if (!Number.isFinite(price) || price <= 0) return null;

      return { price_usd: Math.round(price), source: "PCPartPicker", url: searchUrl };
    } catch {
      return null;
    }
  },
};

/**
 * Amazon Product Advertising API (PA-API 5.0).
 * Requires: AMAZON_ACCESS_KEY, AMAZON_SECRET_KEY, AMAZON_PARTNER_TAG
 */
export const amazonProvider: PricingProvider = {
  name: "Amazon",
  enabled:
    !!process.env.AMAZON_ACCESS_KEY &&
    !!process.env.AMAZON_SECRET_KEY &&
    !!process.env.AMAZON_PARTNER_TAG,

  async fetchPrice(componentName: string): Promise<PriceResult | null> {
    if (!this.enabled) return null;

    // PA-API 5.0 search + item lookup
    // Full implementation requires AWS Signature v4 signing.
    // This is a placeholder for the structure; see:
    // https://webservices.amazon.com/paapi5/documentation/
    console.log(
      `[Amazon] Would fetch price for: ${componentName} (API keys required)`
    );
    return null;
  },
};

/**
 * Newegg pricing via their search page.
 */
export const neweggProvider: PricingProvider = {
  name: "Newegg",
  enabled: !!process.env.ENABLE_NEWEGG_PRICING,

  async fetchPrice(componentName: string): Promise<PriceResult | null> {
    if (!this.enabled) return null;
    try {
      const axios = await import("axios");
      const cheerio = await import("cheerio");

      const searchUrl = `https://www.newegg.com/p/pl?d=${encodeURIComponent(componentName)}`;
      const { data } = await axios.default.get(searchUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; PCBuildAdvisorBot/0.1)",
        },
        timeout: 10000,
      });

      const $ = cheerio.load(data);
      const priceText = $(".item-container .item-action .price-current")
        .first()
        .text()
        .trim();

      if (!priceText) return null;

      const price = parseFloat(priceText.replace(/[$,\s]/g, ""));
      if (!Number.isFinite(price) || price <= 0) return null;

      return { price_usd: Math.round(price), source: "Newegg", url: searchUrl };
    } catch {
      return null;
    }
  },
};

export const ALL_PROVIDERS: PricingProvider[] = [
  pcpartpickerProvider,
  amazonProvider,
  neweggProvider,
];

export function getEnabledProviders(): PricingProvider[] {
  return ALL_PROVIDERS.filter((p) => p.enabled);
}
