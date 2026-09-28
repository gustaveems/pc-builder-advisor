"use client";

import { Plus, HardDrive, Database, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useBuild } from "@/hooks/use-build";
import { useCurrency } from "@/hooks/useCurrency";
import type { Storage as StorageType } from "@/types/components";

interface StorageManagerProps {
  issues: { id: string; severity: string; title?: string; affectedParts?: string[] }[];
  onAddDrive: () => void;
  className?: string;
}

export function StorageManager({ issues, onAddDrive, className }: StorageManagerProps) {
  const { selectedParts, removePart } = useBuild();
  const { format: formatPrice } = useCurrency();
  const drives = selectedParts.storage ?? [];

  const totalCapacity = drives.reduce(
    (sum, d) => sum + (d.specs?.capacity_gb ?? 0),
    0
  );
  const totalPrice = drives.reduce(
    (sum, d) => sum + (d.price_usd ?? 0),
    0
  );

  const driveIssues = (drive: StorageType) =>
    issues.filter(
      (i) =>
        Array.isArray(i.affectedParts) && i.affectedParts.includes(drive.id)
    );

  return (
    <div className={`bento-card rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/50 ${className ?? ""}`}>
      <div className="flex items-center justify-between border-b border-zinc-200 p-4 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
            <HardDrive className="h-5 w-5 text-foreground" />
          </div>
          <div>
            <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Storage
            </h3>
            {drives.length > 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {drives.length} drive{drives.length !== 1 ? "s" : ""} •{" "}
                {totalCapacity}GB total
              </p>
            ) : (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                No drives added
              </p>
            )}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={onAddDrive}>
          <Plus className="mr-1 h-4 w-4" />
          Add Drive
        </Button>
      </div>

      <div className="p-4">
        {drives.length === 0 ? (
          <div className="py-8 text-center">
            <Database className="mx-auto mb-3 h-12 w-12 text-zinc-400 opacity-50" />
            <p className="mb-3 text-sm text-zinc-500 dark:text-zinc-400">
              No storage drives added yet
            </p>
            <Button variant="outline" size="sm" onClick={onAddDrive}>
              Add Your First Drive
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {drives.map((drive, index) => {
              const isNvme = drive.specs?.interface === "NVMe";
              const issuesForDrive = driveIssues(drive);

              return (
                <div
                  key={`${drive.id}-${index}`}
                  className="group relative flex items-start gap-3 rounded-lg border border-zinc-200 bg-zinc-50/50 p-3 transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900/30 dark:hover:border-zinc-700"
                >
                  <div className="mt-1 shrink-0">
                    {isNvme ? (
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <span className="text-lg">⚡</span>
                      </div>
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-200 dark:bg-zinc-700">
                        <span className="text-lg">💿</span>
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="mb-1 truncate font-medium text-foreground">
                      {drive.name}
                    </div>
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      <Badge variant="outline" className="text-xs">
                        {drive.specs?.capacity_gb}GB
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {drive.specs?.interface === "NVMe" ? "M.2 NVMe" : "SATA"}
                      </Badge>
                      {drive.specs?.form_factor && (
                        <Badge variant="outline" className="text-xs">
                          {drive.specs.form_factor}
                        </Badge>
                      )}
                    </div>
                    {(drive.specs?.read_speed_mb_s ?? drive.specs?.write_speed_mb_s) && (
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">
                        {drive.specs?.read_speed_mb_s != null && (
                          <>Read: {drive.specs.read_speed_mb_s} MB/s</>
                        )}
                        {drive.specs?.read_speed_mb_s != null &&
                          drive.specs?.write_speed_mb_s != null &&
                          " • "}
                        {drive.specs?.write_speed_mb_s != null && (
                          <>Write: {drive.specs.write_speed_mb_s} MB/s</>
                        )}
                      </div>
                    )}
                    {issuesForDrive.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {issuesForDrive.slice(0, 2).map((issue, i) => (
                          <div
                            key={i}
                            className={`text-xs ${
                              issue.severity === "critical"
                                ? "text-red-500"
                                : issue.severity === "warning"
                                  ? "text-amber-500"
                                  : "text-blue-500"
                            }`}
                          >
                            {issue.severity === "critical" ? "✗" : "⚠"}{" "}
                            {issue.title ?? issue.id}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-2">
                    {drive.price_usd != null && (
                      <div className="font-semibold text-foreground">
                        {formatPrice(drive.price_usd)}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => removePart("storage", index)}
                      className="rounded p-1.5 text-red-500 transition-colors hover:bg-red-500/10 hover:text-red-600"
                      title="Remove drive"
                      aria-label="Remove drive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {drives.length > 0 && (
          <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-800">
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500 dark:text-zinc-400">
                Total Storage:
              </span>
              <span className="font-medium text-foreground">
                {totalCapacity}GB
              </span>
            </div>
            {totalPrice > 0 && (
              <div className="mt-1 flex justify-between text-sm">
                <span className="text-zinc-500 dark:text-zinc-400">
                  Total Cost:
                </span>
                <span className="font-medium text-foreground">
                  {formatPrice(totalPrice)}
                </span>
              </div>
            )}
          </div>
        )}

        {drives.length === 1 &&
          (drives[0].specs?.capacity_gb ?? 0) < 500 && (
            <div className="mt-4 rounded-md border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950/30">
              <p className="text-xs text-blue-800 dark:text-blue-200">
                💡 Consider adding a larger secondary drive for games or media
                storage
              </p>
            </div>
          )}
      </div>
    </div>
  );
}
