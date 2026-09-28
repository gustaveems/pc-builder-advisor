"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useBuild } from "@/hooks/use-build";
import { PresetCard } from "@/components/builder/PresetCard";
import { PRESET_DEFINITIONS } from "@/lib/presets/definitions";
import { ComponentCard } from "@/components/builder/ComponentCard";
import { StorageManager } from "@/components/builder/StorageManager";
import { LiveStatus } from "@/components/builder/LiveStatus";
import { PowerAnalytics } from "@/components/builder/PowerAnalytics";
import { PartSearch } from "@/components/builder/PartSearch";
import { ManualEntry } from "@/components/builder/ManualEntry";
import { SaveBuildModal } from "@/components/modals/SaveBuildModal";
import { LoadBuildModal } from "@/components/modals/LoadBuildModal";
import { OnboardingTour } from "@/components/onboarding/OnboardingTour";
import { BuildGoalsWizard } from "@/components/wizard/BuildGoalsWizard";
import type { WizardAnswers } from "@/components/wizard/BuildGoalsWizard";
import { generateBaselineBuild } from "@/lib/baseline/build-generator";
import { Button } from "@/components/ui/Button";
import { useRouter } from "next/navigation";
import { checkCompatibility } from "@/lib/compatibility";
import { filterByPreset } from "@/lib/presets/recommendations";
import { X, Save, FolderOpen, Target, Menu } from "lucide-react";
import { TargetSelector } from "@/components/builder/TargetSelector";
import { getTargetById } from "@/lib/presets/targets";
import type { PartCategory, BuildPreset } from "@/lib/store/types";
import type { CPU, GPU, Motherboard, RAM, Storage, PSU, Cooler, Case } from "@/types/components";

type Catalog = {
  cpus: CPU[];
  gpus: GPU[];
  motherboards: Motherboard[];
  ram: RAM[];
  storage: Storage[];
  psus: PSU[];
  coolers: Cooler[];
  cases: Case[];
};

const CARD_ORDER: PartCategory[] = [
  "case",
  "cpu",
  "motherboard",
  "gpu",
  "ram",
  "storage",
  "psu",
  "cooler",
];

const WIZARD_STORAGE_KEY = "pc-build-advisor-hasSeenBuildWizard";

export default function BuildPageClient() {
  const router = useRouter();
  const { selectedParts, preset, targetId, setPreset, setTargetId, removePart, addPart, manualOverrides, importBuild } = useBuild();
  const [showWizard, setShowWizard] = useState(false);
  const [wizardGenerating, setWizardGenerating] = useState(false);
  const [showPresetSelector, setShowPresetSelector] = useState(false);
  const [showTargetSelector, setShowTargetSelector] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [showToolbarMenu, setShowToolbarMenu] = useState(false);
  const [searchCategory, setSearchCategory] = useState<PartCategory | null>(null);
  const [manualCategory, setManualCategory] = useState<PartCategory | null>(null);
  const [catalog, setCatalog] = useState<Catalog | null>(null);

  const hasAnyParts =
    !!selectedParts.case ||
    !!selectedParts.cpu ||
    !!selectedParts.motherboard ||
    !!selectedParts.gpu ||
    !!selectedParts.ram ||
    (selectedParts.storage?.length ?? 0) > 0 ||
    !!selectedParts.psu ||
    !!selectedParts.cooler;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hasSeen = localStorage.getItem(WIZARD_STORAGE_KEY);
    if (!hasSeen && !hasAnyParts) setShowWizard(true);
  }, [hasAnyParts]);

  useEffect(() => {
    setShowPresetSelector(!preset || preset === "custom");
  }, [preset]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "s" && e.key !== "k") return;
      const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform);
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (!mod) return;
      if (e.key === "s") {
        e.preventDefault();
        if (!showSaveModal && !showLoadModal && !showPresetSelector) setShowSaveModal(true);
      }
      if (e.key === "k") {
        e.preventDefault();
        if (catalog && !searchCategory && !showSaveModal && !showLoadModal && !showPresetSelector) {
          setSearchCategory("cpu");
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [catalog, searchCategory, showSaveModal, showLoadModal, showPresetSelector]);

  useEffect(() => {
    fetch("/api/parts")
      .then((r) => r.json())
      .then(setCatalog)
      .catch(console.error);
  }, []);

  const compatResult = useMemo(() => {
    return checkCompatibility(
      {
        cpu: selectedParts.cpu,
        gpu: selectedParts.gpu,
        motherboard: selectedParts.motherboard,
        ram: selectedParts.ram,
        storage: selectedParts.storage ?? [],
        psu: selectedParts.psu,
        cooler: selectedParts.cooler,
        case: selectedParts.case,
      },
      { preset }
    );
  }, [selectedParts, preset]);

  const allIssues = useMemo(() => {
    return [
      ...compatResult.hardFails.map((i) => ({ ...i, severity: "critical" as const })),
      ...compatResult.warnings.map((i) => ({ ...i, severity: "warning" as const })),
      ...compatResult.notes.map((i) => ({ ...i, severity: "info" as const })),
    ];
  }, [compatResult]);

  const corePartsSelected = !!(
    selectedParts.cpu &&
    selectedParts.motherboard &&
    selectedParts.psu &&
    selectedParts.case
  );

  const componentCount = useMemo(() => {
    let n = 0;
    if (selectedParts.case) n++;
    if (selectedParts.cpu) n++;
    if (selectedParts.motherboard) n++;
    if (selectedParts.gpu) n++;
    if (selectedParts.ram) n++;
    n += selectedParts.storage?.length ?? 0;
    if (selectedParts.psu) n++;
    if (selectedParts.cooler) n++;
    return n;
  }, [selectedParts]);

  const totalPriceUsd = useMemo(() => {
    const read = (p: unknown): number => {
      if (!p || typeof p !== "object") return 0;
      const obj = p as { price_usd?: number; specs?: { price_usd?: number } };
      return obj.price_usd ?? obj.specs?.price_usd ?? 0;
    };

    const storageTotal = (selectedParts.storage ?? []).reduce((sum, d) => sum + read(d), 0);
    return (
      read(selectedParts.case) +
      read(selectedParts.cpu) +
      read(selectedParts.motherboard) +
      read(selectedParts.gpu) +
      read(selectedParts.ram) +
      storageTotal +
      read(selectedParts.psu) +
      read(selectedParts.cooler)
    );
  }, [selectedParts]);

  const handleViewResults = () => {
    router.push("/results/current");
  };

  const handleWizardComplete = async (answers: WizardAnswers) => {
    if (typeof window !== "undefined") localStorage.setItem(WIZARD_STORAGE_KEY, "true");
    setShowWizard(false);
    setWizardGenerating(true);

    const presetMap: Record<WizardAnswers["useCase"], BuildPreset> = {
      gaming: "gaming-1080p",
      creator: "creator",
      workstation: "creator",
      "home-office": "budget",
      mixed: "gaming-1080p",
    };
    setPreset(presetMap[answers.useCase]);

    let cat = catalog;
    if (!cat) {
      try {
        const res = await fetch("/api/parts");
        cat = await res.json();
        setCatalog(cat);
      } catch (e) {
        console.error("Failed to load catalog for baseline", e);
        setWizardGenerating(false);
        return;
      }
    }
    if (!cat) {
      setWizardGenerating(false);
      return;
    }

    const baseline = generateBaselineBuild(answers, cat);
    if (baseline.case) addPart("case", baseline.case);
    if (baseline.cpu) addPart("cpu", baseline.cpu);
    if (baseline.motherboard) addPart("motherboard", baseline.motherboard);
    if (baseline.gpu) addPart("gpu", baseline.gpu);
    if (baseline.ram) addPart("ram", baseline.ram);
    for (const drive of baseline.storage ?? []) addPart("storage", drive);
    if (baseline.psu) addPart("psu", baseline.psu);
    if (baseline.cooler) addPart("cooler", baseline.cooler);

    setWizardGenerating(false);
  };

  const handleWizardSkip = () => {
    if (typeof window !== "undefined") localStorage.setItem(WIZARD_STORAGE_KEY, "true");
    setShowWizard(false);
  };

  const formatPresetName = (name: string) =>
    name.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());

  const getParts = useCallback(
    (cat: PartCategory): { id: string; name: string; manufacturer: string }[] => {
      if (!catalog) return [];
      const key =
        cat === "motherboard"
          ? "motherboards"
          : cat === "storage"
            ? "storage"
            : cat === "ram"
              ? "ram"
              : `${cat}s`;
      const raw = ((catalog as Record<string, unknown[]>)[key] ?? []) as { id: string; name: string; manufacturer: string }[];
      const partType = cat as "cpu" | "gpu" | "motherboard" | "ram" | "storage" | "psu" | "cooler" | "case";
      return filterByPreset(preset, partType, raw) as { id: string; name: string; manufacturer: string }[];
    },
    [catalog, preset]
  );

  const renderPartPreview = (part: { name: string; manufacturer?: string }) => (
    <div className="text-sm">
      <p className="font-medium">{part.name}</p>
      {part.manufacturer && <p className="text-zinc-500">{part.manufacturer}</p>}
    </div>
  );

  return (
    <div className="flex min-h-0 flex-1 bg-background">
      <BuildGoalsWizard
        isOpen={showWizard}
        onComplete={handleWizardComplete}
        onSkip={handleWizardSkip}
      />
      {wizardGenerating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="rounded-lg border border-zinc-200 bg-white px-6 py-4 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
            <div className="animate-spin h-8 w-8 border-2 border-foreground border-t-transparent rounded-full mx-auto mb-2" />
            <p className="text-sm text-foreground">Generating your build...</p>
          </div>
        </div>
      )}
      <OnboardingTour />

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-foreground mb-2">
              Select Your Components
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400">
              Choose parts for your build. We'll check compatibility in real-time.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {CARD_ORDER.map((category, index) => {
              if (category === "storage") {
                return (
                  <StorageManager
                    key="storage"
                    issues={allIssues}
                    onAddDrive={() => setSearchCategory("storage")}
                    className="md:col-span-2"
                  />
                );
              }
              const part = selectedParts[category];
              return (
                <ComponentCard
                  key={category}
                  category={category}
                  part={part as never}
                  issues={allIssues}
                  onAdd={() => setSearchCategory(category)}
                  onRemove={() => removePart(category)}
                  onFixIssue={() => setSearchCategory(category)}
                  onManualEntry={
                    category === "case" || category === "cpu"
                      ? () => setManualCategory(category)
                      : undefined
                  }
                  dataTour={index === 0 ? "component-card" : undefined}
                  className={
                    category === "cpu" || category === "gpu" ? "md:col-span-2" : undefined
                  }
                />
              );
            })}
          </div>

          <div className="h-28" />
        </div>
      </div>

      <aside
        className="hidden w-80 shrink-0 border-l border-zinc-200 dark:border-zinc-800 lg:block"
        data-tour="live-status"
      >
        <div className="sticky top-0 h-dvh overflow-y-auto space-y-4 p-6">
          <div className="glass-panel rounded-xl p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-1">
              Price total
            </p>
            <p className="text-2xl font-semibold text-foreground tabular-nums">
              ${totalPriceUsd.toFixed(2)}
            </p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Estimated from selected parts
            </p>
          </div>

          <div className="glass-panel rounded-xl p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-1">
              Use case
            </p>
            <p className="text-sm font-medium text-foreground capitalize">
              {formatPresetName(preset)}
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 w-full text-xs"
              onClick={() => setShowPresetSelector(true)}
            >
              Change preset
            </Button>
          </div>

          <div className="glass-panel rounded-xl p-3">
            <LiveStatus />
          </div>

          <div className="glass-panel rounded-xl p-3">
            <PowerAnalytics />
          </div>

          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2"
              onClick={() => setShowToolbarMenu(!showToolbarMenu)}
            >
              <Menu className="h-4 w-4" />
              More actions
            </Button>
            {showToolbarMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowToolbarMenu(false)}
                  aria-hidden
                />
                <div className="absolute left-0 top-full z-20 mt-1 w-56 rounded-md border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    onClick={() => {
                      setShowLoadModal(true);
                      setShowToolbarMenu(false);
                    }}
                  >
                    <FolderOpen className="h-4 w-4" />
                    Load build
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    onClick={() => {
                      setShowSaveModal(true);
                      setShowToolbarMenu(false);
                    }}
                  >
                    <Save className="h-4 w-4" />
                    Save build
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    onClick={() => {
                      setShowTargetSelector(true);
                      setShowToolbarMenu(false);
                    }}
                  >
                    <Target className="h-4 w-4" />
                    {targetId ? getTargetById(targetId)?.name ?? "Set target" : "Set target"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </aside>

      <div
        className="fixed bottom-0 left-0 right-0 z-30 border-t border-zinc-200 bg-white/95 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/95"
        data-tour="view-results"
      >
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-foreground" />
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                {componentCount}/8 components
              </span>
            </div>
            {compatResult.hardFails.length > 0 && (
              <span className="text-sm font-medium text-red-600 dark:text-red-400">
                {compatResult.hardFails.length} issue{compatResult.hardFails.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          <Button
            size="lg"
            onClick={handleViewResults}
            disabled={!corePartsSelected}
            className="min-w-[180px]"
          >
            View Analysis
          </Button>
        </div>
      </div>

      <SaveBuildModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        build={{
          preset,
          parts: selectedParts,
          manualOverrides: manualOverrides ?? {},
          targetId,
        }}
      />
      <LoadBuildModal
        isOpen={showLoadModal}
        onClose={() => setShowLoadModal(false)}
        onLoad={(build) => {
          importBuild(
            JSON.stringify({
              buildId: build.id,
              preset: build.preset,
              targetId: build.targetId,
              manualOverrides: build.manualOverrides ?? {},
              selectedParts: build.parts,
            })
          );
          setShowLoadModal(false);
        }}
      />
      <TargetSelector
        isOpen={showTargetSelector}
        onClose={() => setShowTargetSelector(false)}
        onSelect={(id) => setTargetId(id)}
        currentTarget={targetId}
      />

      {showPresetSelector && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="relative w-full max-w-3xl rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-foreground">Select Build Preset</h2>
              <button
                type="button"
                onClick={() => setShowPresetSelector(false)}
                className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 hover:text-foreground dark:hover:bg-zinc-800"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
              Choose a preset to filter recommended parts and adjust score weights.
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {PRESET_DEFINITIONS.map((def) => (
                <PresetCard
                  key={def.id}
                  presetId={def.id}
                  selected={preset === def.id}
                  onSelect={() => {
                    setPreset(def.id);
                    setShowPresetSelector(false);
                  }}
                />
              ))}
            </div>
            <div className="mt-6 flex justify-end">
              <Button variant="primary" onClick={() => setShowPresetSelector(false)}>
                Done
              </Button>
            </div>
          </div>
        </div>
      )}

      {searchCategory && catalog && (
        <PartSearch
          category={searchCategory}
          parts={getParts(searchCategory)}
          isOpen={true}
          onClose={() => setSearchCategory(null)}
          onSelect={(p: unknown) => {
            addPart(searchCategory, p as never);
            if (searchCategory !== "storage") setSearchCategory(null);
          }}
          onManualEntry={
            searchCategory === "case" || searchCategory === "cpu"
              ? () => {
                  setSearchCategory(null);
                  setManualCategory(searchCategory);
                }
              : undefined
        }
          renderPartCard={(p) => renderPartPreview(p as { name: string; manufacturer?: string })}
          getPartName={(p) => (p as { name: string }).name}
        />
      )}

      {manualCategory && (
        <ManualEntry
          category={manualCategory}
          isOpen={true}
          onClose={() => setManualCategory(null)}
          onSave={(part) => {
            addPart(manualCategory, part as never);
            setManualCategory(null);
          }}
        />
      )}
    </div>
  );
}
