import type { Build } from "@/types/build";
import type { CPU, GPU, Cooler, Case, PSU } from "@/types/components";

export type NoiseLevel = "silent" | "quiet" | "moderate" | "loud" | "very-loud";
export type NoiseConfidence = "low" | "medium" | "high";

export interface NoiseEstimate {
  minDb: number;
  maxDb: number;
  likelyDb: number; // midpoint
  level: NoiseLevel;
  confidence: NoiseConfidence;
  comparison: string;
}

export interface NoiseContributor {
  component: string;
  contribution: "high" | "medium" | "low";
  reason: string;
  dbRange: string;
}

export interface NoiseAnalysis {
  idle: NoiseEstimate;
  normal: NoiseEstimate; // Gaming or typical workload
  load: NoiseEstimate; // Full stress
  contributors: NoiseContributor[];
  recommendations: string[];
  summary: string;
}

/**
 * Estimate noise levels for a build.
 * Uses honest ranges with coarse-grained confidence, not fake precision.
 */
export function estimateNoise(build: Build): NoiseAnalysis {
  const components = build.components;

  const cpu = components.cpu;
  const gpu = components.gpu;
  const cooler = components.cooler;
  const pcCase = components.case;
  const psu = components.psu;

  const contributors: NoiseContributor[] = [];
  const recommendations: string[] = [];

  // Base noise levels (ambient room)
  let idleMin = 25;
  let idleMax = 30;
  let normalMin = 30;
  let normalMax = 40;
  let loadMin = 40;
  let loadMax = 55;

  let idleConfidence: NoiseConfidence = "medium";
  let normalConfidence: NoiseConfidence = "medium";
  let loadConfidence: NoiseConfidence = "medium";

  // CPU Cooler Impact
  if (cooler) {
    const coolerImpact = analyzeCoolerNoise(cooler, cpu);

    idleMin += coolerImpact.idle.min;
    idleMax += coolerImpact.idle.max;
    normalMin += coolerImpact.normal.min;
    normalMax += coolerImpact.normal.max;
    loadMin += coolerImpact.load.min;
    loadMax += coolerImpact.load.max;

    if (coolerImpact.contributor) {
      contributors.push(coolerImpact.contributor);
    }
    if (coolerImpact.recommendation) {
      recommendations.push(coolerImpact.recommendation);
    }
  } else {
    idleConfidence = "low";
    normalConfidence = "low";
    loadConfidence = "low";
  }

  // GPU Impact
  if (gpu) {
    const gpuImpact = analyzeGpuNoise(gpu);

    // GPU mostly affects load and normal usage
    normalMin += gpuImpact.normal.min;
    normalMax += gpuImpact.normal.max;
    loadMin += gpuImpact.load.min;
    loadMax += gpuImpact.load.max;

    if (gpuImpact.contributor) {
      contributors.push(gpuImpact.contributor);
    }
    if (gpuImpact.recommendation) {
      recommendations.push(gpuImpact.recommendation);
    }
  } else {
    normalConfidence = "low";
    loadConfidence = "low";
  }

  // Case Impact
  if (pcCase) {
    const caseImpact = analyzeCaseNoise(pcCase);

    // Case affects all scenarios
    idleMin += caseImpact.idle.min;
    idleMax += caseImpact.idle.max;
    normalMin += caseImpact.normal.min;
    normalMax += caseImpact.normal.max;
    loadMin += caseImpact.load.min;
    loadMax += caseImpact.load.max;

    if (caseImpact.contributor) {
      contributors.push(caseImpact.contributor);
    }
    if (caseImpact.recommendation) {
      recommendations.push(caseImpact.recommendation);
    }
  }

  // PSU Impact
  if (psu) {
    const psuImpact = analyzePsuNoise(psu, build);

    // PSU mostly affects idle and normal
    idleMin += psuImpact.idle.min;
    idleMax += psuImpact.idle.max;
    normalMin += psuImpact.normal.min;
    normalMax += psuImpact.normal.max;
    loadMin += psuImpact.load.min;
    loadMax += psuImpact.load.max;

    if (psuImpact.contributor) {
      contributors.push(psuImpact.contributor);
    }
  }

  // Generate estimates (rounded, coarse ranges)
  const idleMid = (idleMin + idleMax) / 2;
  const normalMid = (normalMin + normalMax) / 2;
  const loadMid = (loadMin + loadMax) / 2;

  const idle: NoiseEstimate = {
    minDb: Math.round(idleMin),
    maxDb: Math.round(idleMax),
    likelyDb: Math.round(idleMid),
    level: getNoiseLevel(idleMid),
    confidence: idleConfidence,
    comparison: getNoiseComparison(idleMid),
  };

  const normal: NoiseEstimate = {
    minDb: Math.round(normalMin),
    maxDb: Math.round(normalMax),
    likelyDb: Math.round(normalMid),
    level: getNoiseLevel(normalMid),
    confidence: normalConfidence,
    comparison: getNoiseComparison(normalMid),
  };

  const load: NoiseEstimate = {
    minDb: Math.round(loadMin),
    maxDb: Math.round(loadMax),
    likelyDb: Math.round(loadMid),
    level: getNoiseLevel(loadMid),
    confidence: loadConfidence,
    comparison: getNoiseComparison(loadMid),
  };

  const summary = generateNoiseSummary(idle, normal, load);

  return {
    idle,
    normal,
    load,
    contributors,
    recommendations,
    summary,
  };
}

/**
 * Analyze cooler noise contribution
 */
function analyzeCoolerNoise(cooler: Cooler, cpu?: CPU) {
  const cpuTDP = cpu?.specs?.tdp_w || 65;
  const coolerType = cooler.specs?.type;
  const coolerTDP = cooler.specs?.tdp_rating_w || 100;
  const fanCount = cooler.specs?.fan_count || 1;

  let idle = { min: 0, max: 0 };
  let normal = { min: 0, max: 5 };
  let load = { min: 5, max: 15 };
  let contributor: NoiseContributor | undefined;
  let recommendation: string | undefined;

  if (coolerType === "AIO") {
    // AIOs have pump noise at idle
    idle = { min: 2, max: 5 };
    normal = { min: 5, max: 10 };
    load = { min: 10, max: 18 };

    contributor = {
      component: "AIO Cooler",
      contribution: "medium",
      reason: `Pump noise at idle, ${fanCount} fan(s) ramp up under load`,
      dbRange: "25–45 dB depending on fan curve",
    };

    if (fanCount >= 6) {
      recommendation =
        "Large radiator with many fans can be loud under load. Use gentle fan curves.";
    }
  } else if (coolerType === "Air") {
    // Air coolers quieter at idle
    idle = { min: 0, max: 2 };

    // Check if cooler is undersized
    const headroom = ((coolerTDP - cpuTDP) / cpuTDP) * 100;

    if (headroom < 10) {
      // Undersized cooler runs fans harder
      normal = { min: 8, max: 15 };
      load = { min: 15, max: 25 };

      contributor = {
        component: "CPU Cooler",
        contribution: "high",
        reason: "Cooler barely adequate for CPU TDP - fans will run hard under load",
        dbRange: "35–50 dB under load",
      };

      recommendation = "Undersized cooler for CPU. Upgrade for quieter operation.";
    } else if (headroom > 50) {
      // Oversized cooler runs quietly
      normal = { min: 2, max: 6 };
      load = { min: 5, max: 12 };

      contributor = {
        component: "CPU Cooler",
        contribution: "low",
        reason: "High cooling headroom allows fans to run slowly",
        dbRange: "20–35 dB even under load",
      };
    } else {
      // Well-matched cooler
      normal = { min: 4, max: 8 };
      load = { min: 8, max: 16 };

      contributor = {
        component: "CPU Cooler",
        contribution: "medium",
        reason: `${fanCount > 1 ? "Dual-fan" : "Single-fan"} tower cooler with ${
          fanCount ?? 1
        } fan(s)`,
        dbRange: "25–40 dB under load",
      };
    }
  }

  return { idle, normal, load, contributor, recommendation };
}

/**
 * Analyze GPU noise contribution
 */
function analyzeGpuNoise(gpu: GPU) {
  const gpuTDP = gpu.specs?.tdp_w || 150;

  let normal = { min: 5, max: 10 };
  let load = { min: 10, max: 20 };
  let contributor: NoiseContributor | undefined;
  let recommendation: string | undefined;

  // High-end GPUs are typically louder
  if (gpuTDP > 300) {
    normal = { min: 8, max: 15 };
    load = { min: 15, max: 28 };

    contributor = {
      component: "Graphics Card",
      contribution: "high",
      reason: `High TDP GPU (${gpuTDP}W) requires aggressive cooling`,
      dbRange: "35–50 dB under load",
    };

    recommendation =
      "High-power GPU. Consider custom fan curve or undervolting for quieter operation.";
  } else if (gpuTDP > 200) {
    normal = { min: 6, max: 12 };
    load = { min: 12, max: 22 };

    contributor = {
      component: "Graphics Card",
      contribution: "medium",
      reason: `Mid–high TDP GPU (${gpuTDP}W) with dual/triple fans`,
      dbRange: "30–45 dB under load",
    };
  } else {
    normal = { min: 4, max: 8 };
    load = { min: 8, max: 16 };

    contributor = {
      component: "Graphics Card",
      contribution: "low",
      reason: `Lower TDP GPU (${gpuTDP}W) runs relatively quiet`,
      dbRange: "25–38 dB under load",
    };
  }

  return { normal, load, contributor, recommendation };
}

/**
 * Analyze case noise contribution
 */
function analyzeCaseNoise(pcCase: Case) {
  const hasNoiseDampening = pcCase.specs?.noise_dampening || false;
  const hasMeshFront = pcCase.specs?.mesh_front || false;
  const preinstalledFans = pcCase.specs?.preinstalled_fans || 0;

  let idle = { min: 0, max: 0 };
  let normal = { min: 0, max: 0 };
  let load = { min: 0, max: 0 };
  let contributor: NoiseContributor | undefined;
  let recommendation: string | undefined;

  if (hasNoiseDampening) {
    // Sound-dampened cases reduce noise by ~3–5 dB
    idle = { min: -3, max: -2 };
    normal = { min: -4, max: -3 };
    load = { min: -5, max: -3 };

    contributor = {
      component: "Case",
      contribution: "low",
      reason: "Sound-dampening panels reduce overall noise",
      dbRange: "Reduces noise by ~3–5 dB",
    };
  } else if (hasMeshFront) {
    // Mesh cases allow better airflow but don't dampen sound
    normal = { min: 1, max: 2 };
    load = { min: 2, max: 3 };

    contributor = {
      component: "Case",
      contribution: "low",
      reason: "Mesh front allows airflow but doesn't dampen noise",
      dbRange: "Neutral to slightly louder than sealed cases",
    };
  }

  if (preinstalledFans >= 4) {
    normal = { min: 3, max: 5 };
    load = { min: 5, max: 8 };

    recommendation = `Case has ${preinstalledFans} fans. Consider tuning fan curves for quieter operation.`;
  }

  return { idle, normal, load, contributor, recommendation };
}

/**
 * Analyze PSU noise contribution
 */
function analyzePsuNoise(psu: PSU, build: Build) {
  const psuWattage = psu.specs?.wattage_w || 550;
  const estimatedLoad = estimateSystemLoad(build);
  const loadPercentage = (estimatedLoad / psuWattage) * 100;

  let idle = { min: 0, max: 1 };
  let normal = { min: 1, max: 3 };
  let load = { min: 2, max: 5 };
  let contributor: NoiseContributor | undefined;

  if (loadPercentage < 40) {
    // PSU barely working, very quiet or fanless
    idle = { min: 0, max: 1 };
    normal = { min: 1, max: 2 };
    load = { min: 2, max: 4 };

    contributor = {
      component: "Power Supply",
      contribution: "low",
      reason: `Running at ~${Math.round(loadPercentage)}% load – very quiet operation`,
      dbRange: "Nearly silent to quiet",
    };
  } else if (loadPercentage > 75) {
    // PSU working hard
    idle = { min: 1, max: 2 };
    normal = { min: 3, max: 5 };
    load = { min: 5, max: 8 };

    contributor = {
      component: "Power Supply",
      contribution: "medium",
      reason: `Running at ~${Math.round(loadPercentage)}% load – fan ramps up`,
      dbRange: "25–35 dB under load",
    };
  } else {
    contributor = {
      component: "Power Supply",
      contribution: "low",
      reason: `Running at ~${Math.round(loadPercentage)}% load – moderate fan speed`,
      dbRange: "20–30 dB",
    };
  }

  return { idle, normal, load, contributor };
}

/**
 * Estimate system power draw (rough)
 */
function estimateSystemLoad(build: Build): number {
  const cpuTDP = build.components.cpu?.specs?.tdp_w || 65;
  const gpuTDP = build.components.gpu?.specs?.tdp_w || 150;

  // CPU typically uses ~1.2× TDP, GPU uses ~1.3× under load
  const cpuLoad = cpuTDP * 1.2;
  const gpuLoad = gpuTDP * 1.3;
  const otherComponents = 50; // Fans, drives, RGB, etc.

  return cpuLoad + gpuLoad + otherComponents;
}

/**
 * Get noise level category
 */
function getNoiseLevel(db: number): NoiseLevel {
  if (db < 30) return "silent";
  if (db < 35) return "quiet";
  if (db < 45) return "moderate";
  if (db < 55) return "loud";
  return "very-loud";
}

/**
 * Get comparative context for noise level
 */
function getNoiseComparison(db: number): string {
  if (db < 25) return "Barely audible, quieter than a whisper";
  if (db < 30) return "Very quiet, like a library or quiet bedroom";
  if (db < 35) return "Quiet, similar to a refrigerator hum";
  if (db < 40) return "Moderate, like quiet conversation";
  if (db < 45) return "Moderate, like a typical office environment";
  if (db < 50) return "Noticeable, like normal conversation";
  if (db < 55) return "Loud, like a dishwasher";
  return "Very loud, like a vacuum cleaner";
}

/**
 * Generate summary
 */
function generateNoiseSummary(
  idle: NoiseEstimate,
  normal: NoiseEstimate,
  load: NoiseEstimate
): string {
  if (normal.level === "silent" || normal.level === "quiet") {
    return "This build will be very quiet during normal use. Great for noise-sensitive environments.";
  }
  if (normal.level === "moderate") {
    return "This build will be moderately quiet during normal use. Audible but not distracting for most people.";
  }
  if (load.level === "very-loud") {
    return "This build will be quite loud under full load. Consider higher-capacity cooling, quieter fans, or gentler fan curves.";
  }
  return "This build will have average noise levels: noticeable under load but reasonable during normal use.";
}

/**
 * Get color for noise level
 */
export function getNoiseColor(level: NoiseLevel): string {
  switch (level) {
    case "silent":
    case "quiet":
      return "text-green-600 dark:text-green-400";
    case "moderate":
      return "text-yellow-600 dark:text-yellow-400";
    case "loud":
      return "text-orange-600 dark:text-orange-400";
    case "very-loud":
      return "text-red-600 dark:text-red-400";
  }
}

