"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import {
  analyzeBottleneck,
  getBottleneckColor,
  getBottleneckBgColor,
} from "@/lib/performance/bottleneck-analyzer";
import type { CPU, GPU } from "@/types/components";
import type { BuildPreset } from "@/lib/store/types";

interface BottleneckVisualizerProps {
  cpu: CPU;
  gpu: GPU;
  preset: BuildPreset;
  defaultResolution?: "1080p" | "1440p" | "4K";
}

export function BottleneckVisualizer({
  cpu,
  gpu,
  preset,
  defaultResolution = "1440p",
}: BottleneckVisualizerProps) {
  const [resolution, setResolution] = useState(defaultResolution);
  const [cpuTierAdjustment, setCpuTierAdjustment] = useState(0);
  const [gpuTierAdjustment, setGpuTierAdjustment] = useState(0);

  const baseCpuTier = cpu.specs?.tier || 5;
  const baseGpuTier = gpu.specs?.tier || 5;

  // Calculate with adjustments for preview
  const effectiveCpuTier = Math.max(1, Math.min(10, baseCpuTier + cpuTierAdjustment));
  const effectiveGpuTier = Math.max(1, Math.min(10, baseGpuTier + gpuTierAdjustment));

  // Create temporary objects for analysis
  const previewCpu: CPU = {
    ...cpu,
    specs: { ...cpu.specs, tier: effectiveCpuTier },
  };
  const previewGpu: GPU = {
    ...gpu,
    specs: { ...gpu.specs, tier: effectiveGpuTier },
  };

  const analysis = analyzeBottleneck(
    previewCpu,
    previewGpu,
    preset,
    preset.includes("gaming") ? resolution : undefined
  );

  if (!analysis) return null;

  const isPreview = cpuTierAdjustment !== 0 || gpuTierAdjustment !== 0;

  return (
    <div className="border border-border rounded-lg bg-card overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-border bg-muted/30">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-foreground">
            Bottleneck Analysis
          </h3>
          {analysis.type === "balanced" ? (
            <Badge variant="success">
              <CheckCircle className="h-3 w-3 mr-1" />
              Balanced
            </Badge>
          ) : (
            <Badge
              variant={
                analysis.severity === "slight"
                  ? "warning"
                  : analysis.severity === "moderate"
                    ? "warning"
                    : "error"
              }
            >
              <AlertTriangle className="h-3 w-3 mr-1" />
              {analysis.type.toUpperCase()} Bottleneck
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {isPreview ? "Preview with adjustments" : "Current build analysis"}
        </p>
      </div>

      {/* Resolution Selector (for gaming builds) */}
      {preset.includes("gaming") && (
        <div className="p-4 border-b border-border bg-muted/20">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Target Resolution:</span>
            <div className="flex gap-2">
              {(["1080p", "1440p", "4K"] as const).map((res) => (
                <button
                  key={res}
                  type="button"
                  onClick={() => setResolution(res)}
                  className={`px-3 py-1 rounded text-sm transition-colors ${
                    resolution === res
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/70"
                  }`}
                >
                  {res}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Visual Chart */}
      <div className="p-6">
        <div className="mb-6">
          <div className="relative h-64 border border-border rounded-lg overflow-hidden bg-gradient-to-r from-red-50 via-yellow-50 via-green-50 via-yellow-50 to-red-50 dark:from-red-950/20 dark:via-yellow-950/20 dark:via-green-950/20 dark:via-yellow-950/20 dark:to-red-950/20">
            {/* Grid lines */}
            <div className="absolute inset-0 grid grid-cols-10">
              {Array.from({ length: 11 }).map((_, i) => (
                <div key={i} className="border-r border-border/30 last:border-0" />
              ))}
            </div>

            {/* Center balanced line */}
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-green-500 z-10" />
            <div className="absolute left-1/2 top-2 -translate-x-1/2 text-xs font-medium text-green-700 dark:text-green-400">
              Balanced
            </div>

            {/* CPU Axis */}
            <div className="absolute left-0 right-0 top-1/3 h-px bg-border z-0" />
            <div className="absolute left-2 top-1/3 -translate-y-1/2 text-xs text-muted-foreground bg-background px-1">
              CPU Tier
            </div>

            {/* GPU Axis */}
            <div className="absolute left-0 right-0 top-2/3 h-px bg-border z-0" />
            <div className="absolute left-2 top-2/3 -translate-y-1/2 text-xs text-muted-foreground bg-background px-1">
              GPU Tier
            </div>

            {/* CPU Position */}
            <div
              className="absolute top-1/3 -translate-y-1/2 transition-all duration-300"
              style={{ left: `${(effectiveCpuTier / 10) * 100}%` }}
            >
              <div className="relative">
                <div
                  className={`w-4 h-4 rounded-full border-2 ${
                    analysis.type === "cpu"
                      ? "bg-red-500 border-red-700"
                      : "bg-blue-500 border-blue-700"
                  }`}
                />
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-medium whitespace-nowrap">
                  CPU: {effectiveCpuTier}
                </div>
              </div>
            </div>

            {/* GPU Position */}
            <div
              className="absolute top-2/3 -translate-y-1/2 transition-all duration-300"
              style={{ left: `${(effectiveGpuTier / 10) * 100}%` }}
            >
              <div className="relative">
                <div
                  className={`w-4 h-4 rounded-full border-2 ${
                    analysis.type === "gpu"
                      ? "bg-red-500 border-red-700"
                      : "bg-purple-500 border-purple-700"
                  }`}
                />
                <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs font-medium whitespace-nowrap">
                  GPU: {effectiveGpuTier}
                </div>
              </div>
            </div>

            {/* Ideal tier indicators */}
            {analysis.idealCpuTier && (
              <div
                className="absolute top-1/3 -translate-y-1/2 transition-all duration-300 opacity-50"
                style={{ left: `${(analysis.idealCpuTier / 10) * 100}%` }}
              >
                <div className="w-3 h-3 rounded-full border-2 border-dashed border-blue-500" />
                <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-xs text-blue-600 dark:text-blue-400 whitespace-nowrap">
                  Ideal: {analysis.idealCpuTier}
                </div>
              </div>
            )}
            {analysis.idealGpuTier && (
              <div
                className="absolute top-2/3 -translate-y-1/2 transition-all duration-300 opacity-50"
                style={{ left: `${(analysis.idealGpuTier / 10) * 100}%` }}
              >
                <div className="w-3 h-3 rounded-full border-2 border-dashed border-purple-500" />
                <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-xs text-purple-600 dark:text-purple-400 whitespace-nowrap">
                  Ideal: {analysis.idealGpuTier}
                </div>
              </div>
            )}
          </div>

          {/* Tier Scale Labels */}
          <div className="flex justify-between text-xs text-muted-foreground mt-2">
            <span>Low Tier (1)</span>
            <span>Mid Tier (5)</span>
            <span>High Tier (10)</span>
          </div>
        </div>

        {/* Utilization Bars */}
        <div className="space-y-4 mb-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-foreground">CPU Utilization</span>
              <span className="text-sm text-muted-foreground">
                {analysis.cpuUtilization}%
              </span>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  analysis.cpuUtilization >= 95
                    ? "bg-red-500"
                    : analysis.cpuUtilization >= 80
                      ? "bg-yellow-500"
                      : "bg-blue-500"
                }`}
                style={{ width: `${analysis.cpuUtilization}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-foreground">GPU Utilization</span>
              <span className="text-sm text-muted-foreground">
                {analysis.gpuUtilization}%
              </span>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  analysis.gpuUtilization >= 95
                    ? "bg-red-500"
                    : analysis.gpuUtilization >= 80
                      ? "bg-yellow-500"
                      : "bg-purple-500"
                }`}
                style={{ width: `${analysis.gpuUtilization}%` }}
              />
            </div>
          </div>
        </div>

        {/* Analysis Result */}
        <div className={`p-4 rounded-lg border ${getBottleneckBgColor(analysis.severity)}`}>
          <div className="flex items-start gap-3">
            {analysis.severity === "none" ? (
              <CheckCircle
                className={`h-5 w-5 mt-0.5 ${getBottleneckColor(analysis.severity)}`}
              />
            ) : (
              <AlertTriangle
                className={`h-5 w-5 mt-0.5 ${getBottleneckColor(analysis.severity)}`}
              />
            )}
            <div className="flex-1">
              <div className="font-medium text-foreground mb-1">
                {analysis.recommendation}
              </div>
              <p className="text-sm text-muted-foreground">{analysis.explanation}</p>
              {analysis.percentage > 0 && (
                <div className="mt-2 text-xs font-medium">
                  Estimated performance loss: ~{analysis.percentage}%
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Interactive Preview Sliders */}
        <div className="mt-6 pt-6 border-t border-border">
          <div className="mb-4">
            <h4 className="text-sm font-semibold text-foreground mb-3">
              Preview Upgrades
            </h4>
            <p className="text-xs text-muted-foreground mb-4">
              Drag sliders to see how tier changes affect balance
            </p>
          </div>

          {/* CPU Slider */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-muted-foreground">
                CPU Tier Adjustment
              </label>
              <span className="text-sm font-medium text-foreground">
                {cpuTierAdjustment > 0 ? "+" : ""}
                {cpuTierAdjustment}
                {cpuTierAdjustment !== 0 && ` (Tier ${effectiveCpuTier})`}
              </span>
            </div>
            <input
              type="range"
              min="-3"
              max="3"
              step="1"
              value={cpuTierAdjustment}
              onChange={(e) => setCpuTierAdjustment(parseInt(e.target.value, 10))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>-3 tiers</span>
              <span>0</span>
              <span>+3 tiers</span>
            </div>
          </div>

          {/* GPU Slider */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-muted-foreground">
                GPU Tier Adjustment
              </label>
              <span className="text-sm font-medium text-foreground">
                {gpuTierAdjustment > 0 ? "+" : ""}
                {gpuTierAdjustment}
                {gpuTierAdjustment !== 0 && ` (Tier ${effectiveGpuTier})`}
              </span>
            </div>
            <input
              type="range"
              min="-3"
              max="3"
              step="1"
              value={gpuTierAdjustment}
              onChange={(e) => setGpuTierAdjustment(parseInt(e.target.value, 10))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>-3 tiers</span>
              <span>0</span>
              <span>+3 tiers</span>
            </div>
          </div>

          {/* Reset Button */}
          {isPreview && (
            <button
              type="button"
              onClick={() => {
                setCpuTierAdjustment(0);
                setGpuTierAdjustment(0);
              }}
              className="mt-4 text-sm text-primary hover:underline"
            >
              Reset to current build
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

