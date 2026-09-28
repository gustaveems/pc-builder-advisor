import type { Build } from "@/types/build";

export type RgbEcosystem =
  | "asus-aura" // ASUS Aura Sync
  | "msi-mystic" // MSI Mystic Light
  | "gigabyte-fusion" // Gigabyte RGB Fusion
  | "asrock-polychrome" // ASRock Polychrome
  | "corsair-icue" // Corsair iCUE
  | "nzxt-cam" // NZXT CAM
  | "generic-argb" // Generic 5V ARGB (motherboard controlled)
  | "generic-rgb" // Generic 12V RGB (motherboard controlled)
  | "none";

export type RgbVoltage = "5v_argb" | "12v_rgb" | "none";

export interface RgbComponent {
  component: string;
  ecosystem: RgbEcosystem;
  voltage: RgbVoltage;
  requiresHeader: boolean;
  controlledBy: string; // "Motherboard software" or brand name
}

export interface RgbIssue {
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
  affectedComponents: string[];
  solution: string;
}

export interface RgbHubRecommendation {
  name: string;
  type: "argb" | "rgb" | "universal";
  supports: RgbEcosystem[];
  price: string;
  reason: string;
}

export interface RgbAnalysis {
  components: RgbComponent[];
  dominantEcosystem: RgbEcosystem;
  ecosystems: RgbEcosystem[];
  issues: RgbIssue[];
  headerUsage: {
    argb5v: { available: number; needed: number };
    rgb12v: { available: number; needed: number };
  };
  recommendations: RgbHubRecommendation[];
  softwareNeeded: string[];
  summary: string;
  canSyncAll: boolean;
}

/**
 * Analyze RGB compatibility for a build
 */
export function analyzeRgbCompatibility(build: Build): RgbAnalysis | null {
  const { components } = build;
  const motherboard = components.motherboard;
  const cooler = components.cooler;
  const ram = components.ram;
  const pcCase = components.case;
  const gpu = components.gpu;

  const rgbComponents: RgbComponent[] = [];
  const issues: RgbIssue[] = [];
  const recommendations: RgbHubRecommendation[] = [];
  const softwareNeeded: string[] = [];

  // Get motherboard RGB ecosystem
  const moboEcosystem = getMotherboardEcosystem(motherboard);
  const moboSoftware = getEcosystemSoftware(moboEcosystem);

  // Motherboard headers
  const argbHeaders = motherboard?.specs?.headers?.argb_5v ?? 0;
  const rgbHeaders = motherboard?.specs?.headers?.rgb_12v ?? 0;

  let argbNeeded = 0;
  let rgbNeeded = 0;

  // Cooler RGB
  if (cooler?.specs?.rgb_type && cooler.specs.rgb_type !== "none") {
    const coolerEcosystem = getComponentEcosystem(cooler.manufacturer);
    const voltage = cooler.specs.rgb_type as RgbVoltage;

    rgbComponents.push({
      component: `CPU Cooler (${cooler.name})`,
      ecosystem: coolerEcosystem,
      voltage,
      requiresHeader: true,
      controlledBy:
        coolerEcosystem === moboEcosystem
          ? moboSoftware
          : getEcosystemSoftware(coolerEcosystem),
    });

    if (voltage === "5v_argb") argbNeeded += 1;
    if (voltage === "12v_rgb") rgbNeeded += 1;

    if (
      coolerEcosystem !== moboEcosystem &&
      coolerEcosystem !== "generic-argb" &&
      coolerEcosystem !== "generic-rgb"
    ) {
      issues.push({
        severity: "warning",
        title: "RGB Ecosystem Mismatch (Cooler vs Motherboard)",
        description: `Cooler uses ${getEcosystemSoftware(
          coolerEcosystem
        )} but motherboard uses ${moboSoftware}. You'll need separate software to control cooler RGB.`,
        affectedComponents: [cooler.name, motherboard?.name ?? "Motherboard"],
        solution: `Control cooler RGB through ${getEcosystemSoftware(
          coolerEcosystem
        )}, motherboard RGB through ${moboSoftware}.`,
      });

      const sw = getEcosystemSoftware(coolerEcosystem);
      if (!softwareNeeded.includes(sw) && sw !== "None") {
        softwareNeeded.push(sw);
      }
    }
  }

  // RAM RGB (doesn't consume headers but may use its own software)
  if (ram?.specs && (ram.specs as any).rgb_type && (ram.specs as any).rgb_type !== "none") {
    const rgbType = (ram.specs as any).rgb_type as RgbVoltage;
    const ramEcosystem = getComponentEcosystem(ram.manufacturer);

    rgbComponents.push({
      component: `RAM (${ram.name})`,
      ecosystem: ramEcosystem,
      voltage: rgbType,
      requiresHeader: false,
      controlledBy:
        ramEcosystem === moboEcosystem
          ? moboSoftware
          : getEcosystemSoftware(ramEcosystem),
    });

    if (ramEcosystem !== moboEcosystem && ramEcosystem !== "generic-argb") {
      const sw = getEcosystemSoftware(ramEcosystem);
      issues.push({
        severity: "info",
        title: "RAM RGB Separate Ecosystem",
        description: `RAM RGB controlled by ${sw}, separate from motherboard's ${moboSoftware}.`,
        affectedComponents: [ram.name, motherboard?.name ?? "Motherboard"],
        solution: `Use ${sw} for RAM lighting, ${moboSoftware} for motherboard.`,
      });
      if (!softwareNeeded.includes(sw) && sw !== "None") {
        softwareNeeded.push(sw);
      }
    }
  }

  // Case RGB (fans / strips)
  if (pcCase?.specs && (pcCase.specs as any).rgb_type && (pcCase.specs as any).rgb_type !== "none") {
    const voltage = (pcCase.specs as any).rgb_type as RgbVoltage;
    const caseEcosystem = getComponentEcosystem(pcCase.manufacturer);
    const rgbFans = (pcCase.specs as any).rgb_fans ?? 0;

    if (rgbFans > 0) {
      rgbComponents.push({
        component: `Case RGB Fans (${pcCase.name})`,
        ecosystem: caseEcosystem,
        voltage,
        requiresHeader: true,
        controlledBy:
          caseEcosystem === moboEcosystem
            ? moboSoftware
            : getEcosystemSoftware(caseEcosystem),
      });

      // Assume daisy-chaining so count headers conservatively (up to 3 fans per header)
      const headersNeededForFans = Math.max(1, Math.ceil(rgbFans / 3));
      if (voltage === "5v_argb") argbNeeded += headersNeededForFans;
      if (voltage === "12v_rgb") rgbNeeded += headersNeededForFans;

      if (
        caseEcosystem !== moboEcosystem &&
        caseEcosystem !== "generic-argb" &&
        caseEcosystem !== "generic-rgb"
      ) {
        const sw = getEcosystemSoftware(caseEcosystem);
        if (!softwareNeeded.includes(sw) && sw !== "None") {
          softwareNeeded.push(sw);
        }
      }
    }
  }

  // GPU RGB (usually vendor-controlled, no header usage)
  if (gpu) {
    const gpuEcosystem = getComponentEcosystem(gpu.manufacturer);
    const sw = getEcosystemSoftware(gpuEcosystem);

    rgbComponents.push({
      component: `Graphics Card (${gpu.name})`,
      ecosystem: gpuEcosystem,
      voltage: "none",
      requiresHeader: false,
      controlledBy: sw,
    });

    if (
      gpuEcosystem !== moboEcosystem &&
      gpuEcosystem !== "generic-argb" &&
      sw !== "None"
    ) {
      if (!softwareNeeded.includes(sw)) {
        softwareNeeded.push(sw);
      }
    }
  }

  // Header availability checks
  if (argbNeeded > argbHeaders) {
    issues.push({
      severity: "critical",
      title: "Insufficient 5V ARGB Headers",
      description: `Need ${argbNeeded} 5V ARGB headers but motherboard only has ${argbHeaders}. RGB components won't all connect directly.`,
      affectedComponents: rgbComponents
        .filter((c) => c.voltage === "5v_argb")
        .map((c) => c.component),
      solution: `Add a 5V ARGB hub/splitter to expand ${argbHeaders} header(s) to ${argbNeeded}+ device connections.`,
    });

    recommendations.push({
      name: "5V ARGB Hub/Splitter",
      type: "argb",
      supports: ["generic-argb"],
      price: "$15–30",
      reason: `Expand ${argbHeaders} ARGB header(s) to support ${argbNeeded} ARGB devices.`,
    });
  }

  if (rgbNeeded > rgbHeaders) {
    issues.push({
      severity: "critical",
      title: "Insufficient 12V RGB Headers",
      description: `Need ${rgbNeeded} 12V RGB headers but motherboard only has ${rgbHeaders}. RGB components won't all connect directly.`,
      affectedComponents: rgbComponents
        .filter((c) => c.voltage === "12v_rgb")
        .map((c) => c.component),
      solution: `Add a 12V RGB hub/splitter to expand ${rgbHeaders} header(s) to ${rgbNeeded}+ device connections.`,
    });

    recommendations.push({
      name: "12V RGB Hub/Splitter",
      type: "rgb",
      supports: ["generic-rgb"],
      price: "$12–25",
      reason: `Expand ${rgbHeaders} RGB header(s) to support ${rgbNeeded} RGB devices.`,
    });
  }

  // Voltage mismatches
  const has5v = rgbComponents.some((c) => c.voltage === "5v_argb");
  const has12v = rgbComponents.some((c) => c.voltage === "12v_rgb");

  if (has5v && has12v) {
    issues.push({
      severity: "warning",
      title: "Mixed RGB Voltages",
      description:
        "Build has both 5V ARGB and 12V RGB components. These cannot share headers or hubs.",
      affectedComponents: rgbComponents.map((c) => c.component),
      solution:
        "Use separate headers (and hubs) for 5V ARGB and 12V RGB. Never connect 12V RGB to a 5V ARGB header (will damage LEDs).",
    });
  }

  // Add motherboard software to list
  if (!softwareNeeded.includes(moboSoftware) && moboSoftware !== "None") {
    softwareNeeded.push(moboSoftware);
  }

  // Ecosystems in play
  const ecosystems = Array.from(
    new Set(
      rgbComponents
        .map((c) => c.ecosystem)
        .filter((e) => e !== "none")
    )
  );

  const dominantEcosystem: RgbEcosystem =
    moboEcosystem !== "none" && ecosystems.some((e) => e === moboEcosystem)
      ? moboEcosystem
      : ecosystems[0] ?? moboEcosystem;

  const canSyncAll =
    ecosystems.length <= 1 ||
    ecosystems.every(
      (e) =>
        e === moboEcosystem || e === "generic-argb" || e === "generic-rgb"
    );

  const summary = generateRgbSummary(rgbComponents, ecosystems, canSyncAll, issues);

  if (rgbComponents.length === 0) {
    return null;
  }

  return {
    components: rgbComponents,
    dominantEcosystem,
    ecosystems,
    issues,
    headerUsage: {
      argb5v: { available: argbHeaders, needed: argbNeeded },
      rgb12v: { available: rgbHeaders, needed: rgbNeeded },
    },
    recommendations,
    softwareNeeded,
    summary,
    canSyncAll,
  };
}

/**
 * Get motherboard RGB ecosystem
 */
function getMotherboardEcosystem(motherboard: Build["components"]["motherboard"]): RgbEcosystem {
  if (!motherboard) return "generic-argb";

  const manufacturer = motherboard.manufacturer.toLowerCase();

  if (manufacturer.includes("asus")) return "asus-aura";
  if (manufacturer.includes("msi")) return "msi-mystic";
  if (manufacturer.includes("gigabyte")) return "gigabyte-fusion";
  if (manufacturer.includes("asrock")) return "asrock-polychrome";

  return "generic-argb";
}

/**
 * Get component RGB ecosystem
 */
function getComponentEcosystem(manufacturer?: string): RgbEcosystem {
  if (!manufacturer) return "generic-argb";

  const mfg = manufacturer.toLowerCase();

  if (mfg.includes("asus")) return "asus-aura";
  if (mfg.includes("msi")) return "msi-mystic";
  if (mfg.includes("gigabyte")) return "gigabyte-fusion";
  if (mfg.includes("asrock")) return "asrock-polychrome";
  if (mfg.includes("corsair")) return "corsair-icue";
  if (mfg.includes("nzxt")) return "nzxt-cam";

  return "generic-argb";
}

/**
 * Get software name for ecosystem
 */
function getEcosystemSoftware(ecosystem: RgbEcosystem): string {
  const software: Record<RgbEcosystem, string> = {
    "asus-aura": "ASUS Aura Sync",
    "msi-mystic": "MSI Mystic Light",
    "gigabyte-fusion": "Gigabyte RGB Fusion",
    "asrock-polychrome": "ASRock Polychrome RGB",
    "corsair-icue": "Corsair iCUE",
    "nzxt-cam": "NZXT CAM",
    "generic-argb": "Motherboard RGB software",
    "generic-rgb": "Motherboard RGB software",
    none: "None",
  };

  return software[ecosystem];
}

/**
 * Generate RGB summary
 */
function generateRgbSummary(
  components: RgbComponent[],
  ecosystems: RgbEcosystem[],
  canSyncAll: boolean,
  issues: RgbIssue[]
): string {
  if (components.length === 0) {
    return "No RGB components in this build.";
  }

  if (canSyncAll && issues.length === 0) {
    return "All RGB components are compatible and can be synchronized through a single ecosystem.";
  }

  if (canSyncAll && issues.length > 0) {
    return "RGB components are ecosystem-compatible, but you may need additional hubs/splitters for header counts.";
  }

  const criticalIssues = issues.filter((i) => i.severity === "critical").length;
  if (criticalIssues > 0) {
    return `${criticalIssues} critical RGB issue${
      criticalIssues !== 1 ? "s" : ""
    } detected. Additional hardware or changes are required for full compatibility.`;
  }

  if (ecosystems.length > 1) {
    return `RGB components use ${ecosystems.length} different ecosystems. You'll likely need multiple software suites to control all lighting.`;
  }

  return "RGB setup has some caveats. Review the issues and recommendations for best results.";
}

/**
 * Get color for ecosystem (badge / dot background)
 */
export function getEcosystemColor(ecosystem: RgbEcosystem): string {
  const colors: Record<RgbEcosystem, string> = {
    "asus-aura": "bg-purple-500",
    "msi-mystic": "bg-red-500",
    "gigabyte-fusion": "bg-orange-500",
    "asrock-polychrome": "bg-blue-500",
    "corsair-icue": "bg-yellow-500",
    "nzxt-cam": "bg-pink-500",
    "generic-argb": "bg-green-500",
    "generic-rgb": "bg-green-500",
    none: "bg-zinc-400",
  };

  return colors[ecosystem];
}

