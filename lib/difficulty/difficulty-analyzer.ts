import type { BuildInput } from "@/lib/compatibility/types";

export type DifficultyLevel = "beginner" | "intermediate" | "advanced" | "expert";

export interface DifficultyFactor {
  factor: string;
  impact: number; // +1 to +5 (difficulty added)
  reason: string;
  category: "form-factor" | "cooling" | "cable-mgmt" | "compatibility" | "parts-count";
}

export interface DifficultyRating {
  score: number; // 1-10
  level: DifficultyLevel;
  estimatedTimeMinutes: number;
  factors: DifficultyFactor[];
  warnings: string[];
  tips: string[];
  summary: string;
}

/**
 * Calculate build difficulty rating
 */
export function calculateBuildDifficulty(build: BuildInput): DifficultyRating {
  const factors: DifficultyFactor[] = [];
  let baseScore = 2; // Start at "easy"
  const warnings: string[] = [];
  const tips: string[] = [];

  // Form Factor Complexity
  const formFactor = build.case?.specs?.form_factor;
  if (formFactor === "Mini-ITX") {
    const impact = 3;
    factors.push({
      factor: "Mini-ITX Form Factor",
      impact,
      reason:
        "Tight space constraints require careful cable management and component ordering",
      category: "form-factor",
    });
    baseScore += impact;
    warnings.push("Mini-ITX builds require patience and precise cable routing");
    tips.push(
      "Install PSU and motherboard standoffs first, then plan cable routing before installing components"
    );
  } else if (formFactor === "Micro-ATX") {
    const impact = 1;
    factors.push({
      factor: "Micro-ATX Form Factor",
      impact,
      reason: "Slightly tighter than ATX but still manageable",
      category: "form-factor",
    });
    baseScore += impact;
  }

  // Cooling Complexity
  const cooler = build.cooler;
  if (cooler?.specs?.type === "AIO") {
    const radiatorSize = cooler.specs.radiator_size_mm ?? 0;
    let impact = 2;

    if (radiatorSize >= 360) {
      impact = 3;
      warnings.push("Large radiators require careful case compatibility planning");
    }

    factors.push({
      factor: "AIO Liquid Cooler",
      impact,
      reason: "Requires radiator mounting, fan installation, and pump header connection",
      category: "cooling",
    });
    baseScore += impact;
    tips.push("Test radiator fit before final installation. Mount radiator with fans first.");
  } else if (cooler?.specs?.type === "Air") {
    const height = cooler.specs.height_mm || 0;
    if (height > 160) {
      const impact = 1;
      factors.push({
        factor: "Large Tower Cooler",
        impact,
        reason: "Tall cooler may interfere with RAM or case panel",
        category: "cooling",
      });
      baseScore += impact;
      tips.push("Install RAM before installing large tower cooler");
    }
  }

  // GPU Length/Size
  const gpu = build.gpu;
  const gpuLength = gpu?.specs?.length_mm || 0;
  const caseMaxGpu = build.case?.specs?.max_gpu_length_mm || 999;

  if (gpuLength > 320) {
    const impact = 1;
    factors.push({
      factor: "Large Graphics Card",
      impact,
      reason: "Long GPU may require cable management planning",
      category: "parts-count",
    });
    baseScore += impact;
  }

  if (gpuLength > caseMaxGpu - 20) {
    warnings.push("GPU fit is very tight - verify clearances before installation");
    tips.push("Install GPU last after confirming all cables are routed");
  }

  // Cable Management
  const psuModular = build.psu?.specs?.modular;
  if (psuModular === "Non-modular") {
    const impact = 2;
    factors.push({
      factor: "Non-Modular PSU",
      impact,
      reason: "Excess cables must be managed/hidden, more challenging in small cases",
      category: "cable-mgmt",
    });
    baseScore += impact;
    tips.push(
      "Plan cable routing before installing PSU. Use cable ties to bundle unused cables."
    );
  } else if (psuModular === "Semi-modular") {
    const impact = 1;
    factors.push({
      factor: "Semi-Modular PSU",
      impact,
      reason: "Some fixed cables require management",
      category: "cable-mgmt",
    });
    baseScore += impact;
  }

  // Multiple Storage Drives
  const storageCount = build.storage?.length || 0;
  if (storageCount > 2) {
    const impact = 1;
    factors.push({
      factor: `${storageCount} Storage Drives`,
      impact,
      reason: "Multiple drives require additional cable routing and mounting",
      category: "parts-count",
    });
    baseScore += impact;
  }

  // M.2 / NVMe installation
  if (build.storage?.some((s) => s.specs?.interface === "NVMe")) {
    tips.push("Install M.2 drives before installing GPU - easier access to M.2 slots");
  }

  // RGB Complexity
  const hasRGB =
    (cooler?.specs?.rgb_type && cooler.specs.rgb_type !== "none") ||
    // RAM/case may or may not have rgb_type depending on dataset; treat presence as signal
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((build.ram as any)?.specs?.rgb_type &&
      (build.ram as any).specs.rgb_type !== "none") ||
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((build.case as any)?.specs?.rgb_type &&
      (build.case as any).specs.rgb_type !== "none");

  if (hasRGB) {
    const impact = 1;
    factors.push({
      factor: "RGB Components",
      impact,
      reason: "Additional RGB/ARGB headers and software configuration required",
      category: "parts-count",
    });
    baseScore += impact;
    tips.push("Connect RGB cables to correct headers (12V RGB vs 5V ARGB)");
  }

  // Tight Clearances (CPU cooler)
  const coolerHeight = cooler?.specs?.height_mm || 0;
  const caseMaxCooler = build.case?.specs?.max_cooler_height_mm || 999;

  if (coolerHeight > caseMaxCooler - 5) {
    const impact = 1;
    factors.push({
      factor: "Tight Cooler Clearance",
      impact,
      reason: "Cooler fits with minimal clearance - requires careful installation",
      category: "compatibility",
    });
    baseScore += impact;
    warnings.push("CPU cooler clearance is tight - install with care");
  }

  // High TDP CPU
  const cpuTDP = build.cpu?.specs?.tdp_w || 0;
  if (cpuTDP > 125) {
    tips.push(
      "High TDP CPU: Apply thermal paste carefully and ensure cooler mounting pressure is even"
    );
  }

  // First-time builder bonus tips
  tips.push("Install I/O shield before motherboard");
  tips.push("Connect all motherboard headers (power, reset, USB, audio) before closing case");
  tips.push("Don't forget the 4/8-pin CPU power connector (top-left of motherboard)");

  // Cap score at 10
  const finalScore = Math.min(10, Math.max(1, Math.round(baseScore)));

  // Determine level
  let level: DifficultyLevel;
  if (finalScore <= 3) level = "beginner";
  else if (finalScore <= 5) level = "intermediate";
  else if (finalScore <= 7) level = "advanced";
  else level = "expert";

  // Estimate assembly time
  let baseTime = 90; // 1.5 hours for standard ATX build

  if (formFactor === "Mini-ITX") baseTime += 60;
  else if (formFactor === "Micro-ATX") baseTime += 15;

  if (cooler?.specs?.type === "AIO") baseTime += 30;
  if (psuModular === "Non-modular") baseTime += 20;
  if (storageCount > 2) baseTime += 10 * (storageCount - 2);
  if (hasRGB) baseTime += 15;

  const estimatedTimeMinutes = Math.round(baseTime);

  // Generate summary
  const summary = generateSummary(level, finalScore, formFactor, cooler?.specs?.type);

  return {
    score: finalScore,
    level,
    estimatedTimeMinutes,
    factors,
    warnings,
    tips,
    summary,
  };
}

function generateSummary(
  level: DifficultyLevel,
  score: number,
  formFactor?: string,
  coolerType?: string
): string {
  if (level === "beginner") {
    return "This is a beginner-friendly build with standard components and good clearances. Perfect for first-time builders.";
  } else if (level === "intermediate") {
    return `Moderately challenging build${
      formFactor === "Mini-ITX" ? " due to compact size" : ""
    }${coolerType === "AIO" ? " with liquid cooling" : ""}. Recommended for builders with some experience.`;
  } else if (level === "advanced") {
    return `Challenging build requiring careful planning${
      formFactor === "Mini-ITX" ? " in a small form factor" : ""
    }. Best suited for experienced builders.`;
  } else {
    return `Very challenging build${
      formFactor === "Mini-ITX" ? " in mini-ITX form factor" : ""
    }${coolerType === "AIO" ? " with liquid cooling" : ""}. Requires expert-level skills and patience.`;
  }
}

/**
 * Get color for difficulty level
 */
export function getDifficultyColor(level: DifficultyLevel): string {
  switch (level) {
    case "beginner":
      return "text-green-600 dark:text-green-400";
    case "intermediate":
      return "text-yellow-600 dark:text-yellow-400";
    case "advanced":
      return "text-orange-600 dark:text-orange-400";
    case "expert":
      return "text-red-600 dark:text-red-400";
  }
}

/**
 * Get badge variant for difficulty level
 */
export function getDifficultyBadgeVariant(
  level: DifficultyLevel
): "success" | "warning" | "error" | "outline" {
  switch (level) {
    case "beginner":
      return "success";
    case "intermediate":
      return "warning";
    case "advanced":
      return "warning";
    case "expert":
      return "error";
  }
}

