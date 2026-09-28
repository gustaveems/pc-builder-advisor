"use client";

import { useState, useRef, useEffect } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import {
  MoreVertical,
  Edit,
  Trash2,
  Info,
  ChevronDown,
  ChevronUp,
  Cpu,
  Gpu,
  CircuitBoard,
  MemoryStick,
  HardDrive,
  Zap,
  Fan,
  Box,
  Plus,
  Pencil,
} from "lucide-react";
import type { PartCategory, PartByCategory } from "@/lib/store/types";
import type { PCComponent } from "@/lib/store/types";
import { useCurrency } from "@/hooks/useCurrency";
import { SpecificationTable } from "./SpecificationTable";

const CATEGORY_META: Record<
  PartCategory,
  { label: string; icon: React.ElementType }
> = {
  cpu: { label: "Processor", icon: Cpu },
  gpu: { label: "Graphics Card", icon: Gpu },
  motherboard: { label: "Motherboard", icon: CircuitBoard },
  ram: { label: "Memory", icon: MemoryStick },
  storage: { label: "Storage", icon: HardDrive },
  psu: { label: "Power Supply", icon: Zap },
  cooler: { label: "Cooler", icon: Fan },
  case: { label: "Case", icon: Box },
};

function getPartStatus(
  part: PCComponent | undefined,
  issues: { severity: string; affectedParts?: string[] }[]
): "ok" | "warning" | "error" {
  if (!part) return "ok";
  const partIssues = issues.filter(
    (i) =>
      Array.isArray(i.affectedParts) && i.affectedParts.includes(part.id)
  );
  const hasCritical = partIssues.some((i) => i.severity === "critical");
  const hasWarning = partIssues.some((i) => i.severity === "warning");
  if (hasCritical) return "error";
  if (hasWarning) return "warning";
  return "ok";
}

function getKeySpec(
  category: PartCategory,
  part: PCComponent | undefined
): string | null {
  if (!part?.specs) return null;
  const s = part.specs as Record<string, unknown>;
  switch (category) {
    case "cpu":
      return `${s.cores ?? "?"} cores, ${s.base_clock_ghz ?? "?"} GHz`;
    case "gpu":
      return `${s.vram_gb ?? "?"}GB, ${s.length_mm ?? "?"}mm`;
    case "motherboard":
      return `${s.chipset ?? "?"}, ${s.form_factor ?? "?"}`;
    case "ram":
      return `${s.capacity_gb ?? "?"}GB ${String(s.memory_type ?? "?").toUpperCase()}, ${s.speed_mhz ?? "?"} MHz`;
    case "storage":
      return `${s.capacity_gb ?? "?"}GB ${String(s.interface ?? "?").toUpperCase()}`;
    case "psu":
      return `${s.wattage_w ?? "?"}W, ${s.efficiency ?? "?"}`;
    case "cooler":
      if (s.type === "AIO" && s.radiator_size_mm)
        return `AIO, ${s.radiator_size_mm}mm`;
      return `Air, ${s.tdp_rating_w ?? "?"}W TDP`;
    case "case":
      return `${s.form_factor ?? "?"}, ${s.max_gpu_length_mm ?? "?"}mm GPU`;
    default:
      return null;
  }
}

function getPrice(part: { price_usd?: number; specs?: { price_usd?: number } } | undefined): number | undefined {
  if (!part) return undefined;
  return part.price_usd ?? (part.specs as { price_usd?: number } | undefined)?.price_usd;
}

interface ComponentCardProps {
  category: PartCategory;
  part: PartByCategory[PartCategory] | undefined;
  issues: { id: string; severity: string; title?: string; affectedParts?: string[] }[];
  onAdd: () => void;
  onRemove: () => void;
  onManualEntry?: () => void;
  storageCount?: number;
  onFixIssue?: (category: PartCategory) => void;
  /** Optional: for onboarding tour target */
  dataTour?: string;
  className?: string;
}

export function ComponentCard({
  category,
  part,
  issues,
  onAdd,
  onRemove,
  onManualEntry,
  storageCount,
  onFixIssue,
  dataTour,
  className,
}: ComponentCardProps) {
  const [showActions, setShowActions] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { format: formatPrice } = useCurrency();

  const meta = CATEGORY_META[category];
  const Icon = meta.icon;
  const status = getPartStatus(part as PCComponent | undefined, issues);
  const keySpec = getKeySpec(category, part as PCComponent | undefined);
  const price = getPrice(part as { price_usd?: number; specs?: { price_usd?: number } } | undefined);
  const manufacturer = ((part as { manufacturer?: string } | undefined)?.manufacturer ?? "").toLowerCase();

  const glow =
    (category === "cpu" || category === "gpu") && manufacturer.includes("intel")
      ? "#3b82f6" // blue
      : (category === "cpu" || category === "gpu") && manufacturer.includes("amd")
        ? "#ef4444" // red
        : "transparent";

  const partIssues = part
    ? issues.filter(
        (i) =>
          Array.isArray(i.affectedParts) && i.affectedParts.includes((part as { id: string }).id)
      )
    : [];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    }
    if (showMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showMenu]);

  const actionsVisible = showActions || !part;

  return (
    <div
      data-tour={dataTour}
      style={{ ["--glow" as never]: glow }}
      className={cn(
        "bento-card group relative rounded-lg border bg-white transition-all dark:bg-zinc-900/50",
        "border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700",
        status === "error" && "border-l-4 border-l-red-500",
        status === "warning" && "border-l-4 border-l-amber-500",
        className
      )}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
            <Icon className="h-5 w-5 text-foreground" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="mb-0.5 flex items-center gap-2">
              <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                {meta.label}
              </h3>
              {status !== "ok" && (
                <Badge
                  variant={
                    status === "error" ? "error" : "warning"
                  }
                  className="text-xs"
                >
                  {status === "error" ? "✗" : "⚠"}
                </Badge>
              )}
              {part && status === "ok" && (
                <Badge variant="success" className="text-xs">
                  ✓
                </Badge>
              )}
            </div>

            {part ? (
              <>
                <p className="truncate font-medium text-foreground">
                  {(part as { name: string }).name}
                  {category === "storage" &&
                    storageCount != null &&
                    storageCount > 1 && (
                      <span className="ml-1 text-zinc-500">
                        ({storageCount} drives)
                      </span>
                    )}
                </p>
                {keySpec && (
                  <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">
                    {keySpec}
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                No {meta.label.toLowerCase()} selected
              </p>
            )}
          </div>

          {price != null && (
            <div className="shrink-0 text-right">
              <span className="font-semibold text-foreground">
                {formatPrice(price)}
              </span>
            </div>
          )}

          <div
            className={cn(
              "flex shrink-0 items-center transition-opacity",
              actionsVisible ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            )}
          >
            {part ? (
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  className="rounded-md p-2 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  onClick={() => setShowMenu(!showMenu)}
                  aria-label="Actions"
                >
                  <MoreVertical className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
                </button>

                {showMenu && (
                  <div className="absolute right-0 top-full z-10 mt-1 w-40 rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      onClick={() => {
                        setShowMenu(false);
                        onAdd();
                      }}
                    >
                      <Edit className="h-4 w-4" />
                      Change
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      onClick={() => {
                        setShowMenu(false);
                        setShowDetails(true);
                      }}
                    >
                      <Info className="h-4 w-4" />
                      View specs
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                      onClick={() => {
                        setShowMenu(false);
                        onRemove();
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                      Remove
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={onAdd}>
                <Plus className="mr-1 h-4 w-4" />
                Add
              </Button>
            )}
          </div>
        </div>

        {partIssues.length > 0 && (
          <div className="mt-3 space-y-1 border-t border-zinc-200 pt-3 dark:border-zinc-700">
            {partIssues.slice(0, 2).map((issue, i) => (
              <div
                key={i}
                className="flex items-start gap-2 text-xs text-zinc-600 dark:text-zinc-400"
              >
                <span
                  className={
                    issue.severity === "critical"
                      ? "text-red-500"
                      : issue.severity === "warning"
                        ? "text-amber-500"
                        : "text-blue-500"
                  }
                >
                  {issue.severity === "critical"
                    ? "✗"
                    : issue.severity === "warning"
                      ? "⚠"
                      : "ℹ"}
                </span>
                <span className="flex-1">{issue.title ?? issue.id}</span>
              </div>
            ))}
            {partIssues.length > 2 && (
              <button
                type="button"
                className="text-xs font-medium text-foreground hover:underline"
                onClick={() => onFixIssue?.(category)}
              >
                +{partIssues.length - 2} more issues
              </button>
            )}
            {partIssues.length <= 2 && onFixIssue && (
              <button
                type="button"
                className="text-xs font-medium text-foreground hover:underline"
                onClick={() => onFixIssue(category)}
              >
                Fix this →
              </button>
            )}
          </div>
        )}

        {part && (
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="mt-3 flex w-full items-center justify-center gap-2 text-sm text-foreground transition-colors hover:text-zinc-600 dark:hover:text-zinc-300"
          >
            <Info className="h-4 w-4" />
            <span>{showDetails ? "Hide" : "View"} Details</span>
            {showDetails ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
        )}

        {onManualEntry && (
          <button
            type="button"
            onClick={onManualEntry}
            className="mt-3 flex items-center gap-1 text-xs text-zinc-500 transition-colors hover:text-foreground dark:text-zinc-400 dark:hover:text-foreground"
          >
            <Pencil className="h-3.5 w-3.5" />
            Enter manually instead
          </button>
        )}
      </div>

      {part && (
        <div
          className={cn(
            "grid transition-[grid-template-rows] duration-200 ease-out",
            showDetails ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          )}
        >
          <div className="overflow-hidden">
            <div className="border-t border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-700 dark:bg-zinc-900/30">
              <h4 className="mb-3 text-sm font-semibold text-foreground">
                Specifications
              </h4>
              <SpecificationTable
                specs={(part as { specs?: Record<string, unknown> }).specs ?? {}}
                category={category}
              />
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-700">
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  {(part as { manufacturer?: string }).manufacturer && (
                    <>Manufacturer: {(part as { manufacturer: string }).manufacturer}</>
                  )}
                </span>
                <a
                  href={`https://www.google.com/search?q=${encodeURIComponent((part as { name: string }).name + " review")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-foreground underline-offset-2 hover:underline"
                >
                  Search for reviews →
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
