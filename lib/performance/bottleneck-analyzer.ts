import type { CPU, GPU } from "@/types/components";
import type { BuildPreset } from "@/lib/store/types";

export type BottleneckType = "cpu" | "gpu" | "balanced" | "unknown";
export type BottleneckSeverity = "none" | "slight" | "moderate" | "severe";

export interface BottleneckAnalysis {
  type: BottleneckType;
  severity: BottleneckSeverity;
  percentage: number; // 0-100, how much performance is lost
  cpuUtilization: number; // 0-100, expected CPU usage %
  gpuUtilization: number; // 0-100, expected GPU usage %
  recommendation: string;
  idealCpuTier?: number;
  idealGpuTier?: number;
  explanation: string;
}

/**
 * Analyze CPU-GPU bottleneck based on use case
 */
export function analyzeBottleneck(
  cpu: CPU | undefined,
  gpu: GPU | undefined,
  preset: BuildPreset,
  resolution?: "1080p" | "1440p" | "4K"
): BottleneckAnalysis | null {
  if (!cpu || !gpu) return null;

  const cpuTier = cpu.specs?.tier || 5;
  const gpuTier = gpu.specs?.tier || 5;

  // Determine use case type
  const isGaming = preset.includes("gaming");
  const isCreator = preset.includes("creator");
  const isWorkstation = preset.includes("workstation");

  if (isGaming) {
    return analyzeGamingBottleneck(cpuTier, gpuTier, resolution || "1440p");
  } else if (isCreator || isWorkstation) {
    return analyzeCreatorBottleneck(cpuTier, gpuTier, preset);
  } else {
    // General purpose / home office
    return analyzeGeneralBottleneck(cpuTier, gpuTier);
  }
}

/**
 * Gaming bottleneck analysis (resolution-dependent)
 */
function analyzeGamingBottleneck(
  cpuTier: number,
  gpuTier: number,
  resolution: "1080p" | "1440p" | "4K"
): BottleneckAnalysis {
  // Gaming GPU importance by resolution
  const gpuWeight = {
    "1080p": 0.6, // CPU matters more at 1080p
    "1440p": 0.75, // Balanced
    "4K": 0.85, // GPU dominant at 4K
  }[resolution];

  const cpuWeight = 1 - gpuWeight;

  // Calculate ideal tier for balance
  const idealGpuTier = Math.round(cpuTier * (gpuWeight / cpuWeight));
  const idealCpuTier = Math.round(gpuTier * (cpuWeight / gpuWeight));

  // Calculate tier difference
  const tierDiff = gpuTier - cpuTier;
  const absGpuDiff = Math.abs(gpuTier - idealGpuTier);
  const absCpuDiff = Math.abs(cpuTier - idealCpuTier);

  let type: BottleneckType = "balanced";
  let severity: BottleneckSeverity = "none";
  let percentage = 0;
  let cpuUtilization = 80;
  let gpuUtilization = 95;
  let recommendation = "";
  let explanation = "";

  // GPU bottleneck (GPU too weak for CPU)
  if (tierDiff < -1) {
    type = "gpu";

    if (absGpuDiff <= 1) {
      severity = "slight";
      percentage = 5;
      gpuUtilization = 100;
      cpuUtilization = 60;
      recommendation = `Upgrade GPU by 1-2 tiers for better balance at ${resolution}`;
      explanation = `Your CPU is stronger than needed for this GPU. At ${resolution}, the GPU will be maxed out while CPU sits idle. Performance is limited by GPU.`;
    } else if (absGpuDiff <= 2) {
      severity = "moderate";
      percentage = 15;
      gpuUtilization = 100;
      cpuUtilization = 50;
      recommendation = `Consider GPU upgrade (tier ${idealGpuTier}+) to match your CPU's potential`;
      explanation = `Significant GPU bottleneck. Your ${cpuTier > 7 ? "high-end" : "capable"} CPU is underutilized because the GPU can't keep up. You're losing 15%+ performance.`;
    } else {
      severity = "severe";
      percentage = 25;
      gpuUtilization = 100;
      cpuUtilization = 40;
      recommendation = `GPU is severely underpowered. Upgrade to tier ${idealGpuTier}+ or consider lower-tier CPU`;
      explanation = `Major imbalance. Your CPU is much more powerful than needed for this GPU. You're wasting CPU potential and losing ~25% possible performance.`;
    }
  }
  // CPU bottleneck (CPU too weak for GPU)
  else if (tierDiff > 1) {
    type = "cpu";

    // Resolution affects CPU bottleneck severity
    const resolutionMultiplier = {
      "1080p": 1.5, // CPU bottlenecks are worse at 1080p
      "1440p": 1.0, // Balanced
      "4K": 0.6, // CPU matters less at 4K
    }[resolution];

    if (absCpuDiff <= 1) {
      severity = "slight";
      percentage = Math.round(5 * resolutionMultiplier);
      cpuUtilization = 100;
      gpuUtilization = 75;
      recommendation =
        resolution === "1080p"
          ? `At 1080p, consider CPU upgrade for high-refresh gaming`
          : `At ${resolution}, GPU-bound is normal. CPU is acceptable`;
      explanation =
        resolution === "1080p"
          ? `At 1080p, CPU is working hard to feed your GPU. May limit FPS in competitive games.`
          : `At ${resolution}, being GPU-bound is expected. Your CPU is sufficient.`;
    } else if (absCpuDiff <= 2) {
      severity = resolution === "4K" ? "slight" : "moderate";
      percentage = Math.round(15 * resolutionMultiplier);
      cpuUtilization = 100;
      gpuUtilization = 70;
      recommendation =
        resolution === "4K"
          ? `At 4K, CPU bottleneck is minimal. Acceptable balance`
          : `Consider CPU upgrade (tier ${idealCpuTier}+) to unlock full GPU potential at ${resolution}`;
      explanation =
        resolution === "4K"
          ? `At 4K, GPU is the primary bottleneck anyway. CPU is adequate for most games.`
          : `CPU is limiting your GPU's performance at ${resolution}. Losing ~${percentage}% in CPU-heavy games.`;
    } else {
      severity = resolution === "4K" ? "slight" : "severe";
      percentage = Math.round(25 * resolutionMultiplier);
      cpuUtilization = 100;
      gpuUtilization = 60;
      recommendation =
        resolution === "4K"
          ? `Acceptable for 4K gaming, but CPU upgrade would help in esports`
          : `Major CPU bottleneck at ${resolution}. Upgrade to tier ${idealCpuTier}+ CPU urgently`;
      explanation =
        resolution === "4K"
          ? `At 4K, GPU is the main limit, but a better CPU would still improve minimums and esports performance.`
          : `Severe CPU bottleneck. Your GPU is significantly held back. Losing ~${percentage}% performance, especially in CPU-heavy games.`;
    }
  }
  // Balanced
  else {
    type = "balanced";
    severity = "none";
    percentage = 0;
    cpuUtilization = 75;
    gpuUtilization = 95;
    recommendation = `Well-balanced build for ${resolution} gaming`;
    explanation = `CPU and GPU are well-matched for ${resolution} gaming. Both components will be utilized effectively without significant bottlenecking.`;
  }

  return {
    type,
    severity,
    percentage,
    cpuUtilization,
    gpuUtilization,
    recommendation,
    idealCpuTier: type === "cpu" ? idealCpuTier : undefined,
    idealGpuTier: type === "gpu" ? idealGpuTier : undefined,
    explanation,
  };
}

/**
 * Creator/Workstation bottleneck analysis
 */
function analyzeCreatorBottleneck(
  cpuTier: number,
  gpuTier: number,
  preset: BuildPreset
): BottleneckAnalysis {
  // Creator workloads are more CPU-heavy
  const cpuWeight = 0.65;
  const gpuWeight = 0.35;

  const idealGpuTier = Math.round(cpuTier * (gpuWeight / cpuWeight));
  const idealCpuTier = Math.round(gpuTier * (cpuWeight / gpuWeight));

  const tierDiff = gpuTier - cpuTier;

  let type: BottleneckType = "balanced";
  let severity: BottleneckSeverity = "none";
  let percentage = 0;
  let cpuUtilization = 90;
  let gpuUtilization = 60;
  let recommendation = "";
  let explanation = "";

  // CPU bottleneck (most critical for creators)
  if (tierDiff > 2) {
    type = "cpu";
    severity = "moderate";
    percentage = 20;
    cpuUtilization = 100;
    gpuUtilization = 50;
    recommendation = `Upgrade CPU to tier ${idealCpuTier}+ for better rendering and export times`;
    explanation = `Your CPU is the primary bottleneck for creative work. Video exports, renders, and encoding will be significantly slower. GPU is underutilized.`;
  } else if (tierDiff > 1) {
    type = "cpu";
    severity = "slight";
    percentage = 10;
    cpuUtilization = 95;
    gpuUtilization = 55;
    recommendation = `CPU could be stronger for heavy rendering workloads`;
    explanation = `CPU is slightly underpowered for optimal creative performance. Consider upgrading if you do heavy rendering or 4K editing.`;
  }
  // GPU bottleneck (less critical but still important)
  else if (tierDiff < -2) {
    type = "gpu";
    severity = "slight";
    percentage = 10;
    cpuUtilization = 70;
    gpuUtilization = 100;
    recommendation = `GPU upgrade would help with effects, previews, and GPU-accelerated tasks`;
    explanation = `Your CPU is strong, but GPU could be better for GPU-accelerated effects in Premiere/After Effects and real-time previews.`;
  }
  // Balanced
  else {
    type = "balanced";
    severity = "none";
    percentage = 0;
    recommendation = `Well-balanced for creative workloads`;
    explanation = `CPU and GPU are appropriately matched for video editing, rendering, and creative work. CPU provides strong multi-core performance while GPU handles acceleration.`;
  }

  return {
    type,
    severity,
    percentage,
    cpuUtilization,
    gpuUtilization,
    recommendation,
    idealCpuTier: type === "cpu" ? idealCpuTier : undefined,
    idealGpuTier: type === "gpu" ? idealGpuTier : undefined,
    explanation,
  };
}

/**
 * General purpose bottleneck analysis
 */
function analyzeGeneralBottleneck(
  cpuTier: number,
  gpuTier: number
): BottleneckAnalysis {
  const tierDiff = Math.abs(gpuTier - cpuTier);

  if (tierDiff <= 2) {
    return {
      type: "balanced",
      severity: "none",
      percentage: 0,
      cpuUtilization: 50,
      gpuUtilization: 50,
      recommendation: "Balanced build for general use",
      explanation:
        "Your CPU and GPU are reasonably balanced for everyday tasks, web browsing, and productivity work.",
    };
  }

  const type: BottleneckType = gpuTier > cpuTier ? "cpu" : "gpu";

  return {
    type,
    severity: "slight",
    percentage: 5,
    cpuUtilization: type === "cpu" ? 80 : 40,
    gpuUtilization: type === "gpu" ? 80 : 40,
    recommendation: `Consider balancing ${type.toUpperCase()} with rest of build`,
    explanation: `For general use, this imbalance is minor. However, ${
      type === "cpu" ? "CPU-heavy tasks" : "GPU-heavy tasks"
    } may be limited.`,
  };
}

/**
 * Get color for bottleneck severity
 */
export function getBottleneckColor(severity: BottleneckSeverity): string {
  switch (severity) {
    case "none":
      return "text-green-500";
    case "slight":
      return "text-yellow-500";
    case "moderate":
      return "text-orange-500";
    case "severe":
      return "text-red-500";
    default:
      return "text-muted-foreground";
  }
}

/**
 * Get background color for bottleneck severity
 */
export function getBottleneckBgColor(severity: BottleneckSeverity): string {
  switch (severity) {
    case "none":
      return "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800";
    case "slight":
      return "bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800";
    case "moderate":
      return "bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800";
    case "severe":
      return "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800";
    default:
      return "bg-muted border-border";
  }
}

