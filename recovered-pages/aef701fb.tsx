"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ArrowLeft, Send, CheckCircle } from "lucide-react";
import Link from "next/link";

type Category = "cpu" | "gpu" | "motherboard" | "ram" | "storage" | "psu" | "cooler" | "case";

interface SpecField {
  key: string;
  label: string;
  type: "text" | "number" | "boolean" | "select";
  options?: string[];
  required?: boolean;
}

const CATEGORY_SPECS: Record<Category, SpecField[]> = {
  cpu: [
    { key: "socket", label: "Socket", type: "text", required: true },
    { key: "cores", label: "Cores", type: "number", required: true },
    { key: "threads", label: "Threads", type: "number", required: true },
    { key: "base_clock_ghz", label: "Base Clock (GHz)", type: "number", required: true },
    { key: "boost_clock_ghz", label: "Boost Clock (GHz)", type: "number" },
    { key: "tdp_w", label: "TDP (W)", type: "number", required: true },
    { key: "memory_type", label: "Memory Type", type: "select", options: ["DDR4", "DDR5"], required: true },
    { key: "pcie_version", label: "PCIe Version", type: "select", options: ["3.0", "4.0", "5.0"] },
    { key: "has_igpu", label: "Has iGPU", type: "boolean" },
  ],
  gpu: [
    { key: "vram_gb", label: "VRAM (GB)", type: "number", required: true },
    { key: "tdp_w", label: "TDP (W)", type: "number", required: true },
    { key: "length_mm", label: "Length (mm)", type: "number", required: true },
    { key: "thickness_slots", label: "Thickness (slots)", type: "number" },
    { key: "pcie_version", label: "PCIe Version", type: "select", options: ["3.0", "4.0", "5.0"] },
  ],
  motherboard: [
    { key: "socket", label: "Socket", type: "text", required: true },
    { key: "chipset", label: "Chipset", type: "text", required: true },
    { key: "form_factor", label: "Form Factor", type: "select", options: ["ATX", "Micro-ATX", "Mini-ITX", "E-ATX"], required: true },
    { key: "memory_type", label: "Memory Type", type: "select", options: ["DDR4", "DDR5"], required: true },
    { key: "ram_slots", label: "RAM Slots", type: "number" },
    { key: "max_ram_gb", label: "Max RAM (GB)", type: "number" },
    { key: "m2_slots", label: "M.2 Slots", type: "number" },
    { key: "sata_ports", label: "SATA Ports", type: "number" },
    { key: "pcie_version", label: "PCIe Version", type: "select", options: ["3.0", "4.0", "5.0"] },
    { key: "has_bios_flashback", label: "BIOS Flashback", type: "boolean" },
  ],
  ram: [
    { key: "memory_type", label: "Memory Type", type: "select", options: ["DDR4", "DDR5"], required: true },
    { key: "capacity_gb", label: "Capacity (GB)", type: "number", required: true },
    { key: "speed_mhz", label: "Speed (MHz)", type: "number", required: true },
    { key: "modules", label: "Number of Sticks", type: "number", required: true },
    { key: "latency", label: "CAS Latency (e.g. CL16)", type: "text" },
  ],
  storage: [
    { key: "interface", label: "Interface", type: "select", options: ["NVMe", "SATA"], required: true },
    { key: "form_factor", label: "Form Factor", type: "select", options: ["M.2 2280", "2.5\" SATA", "3.5\" SATA"], required: true },
    { key: "capacity_gb", label: "Capacity (GB)", type: "number", required: true },
    { key: "read_speed_mb_s", label: "Read Speed (MB/s)", type: "number" },
    { key: "write_speed_mb_s", label: "Write Speed (MB/s)", type: "number" },
  ],
  psu: [
    { key: "wattage_w", label: "Wattage (W)", type: "number", required: true },
    { key: "efficiency", label: "Efficiency", type: "select", options: ["80+ Bronze", "80+ Silver", "80+ Gold", "80+ Platinum", "80+ Titanium"], required: true },
    { key: "form_factor", label: "Form Factor", type: "select", options: ["ATX", "SFX", "SFX-L"] },
    { key: "modular", label: "Modularity", type: "select", options: ["Non-modular", "Semi-modular", "Fully modular"] },
    { key: "pcie_5_ready", label: "PCIe 5.0 Ready", type: "boolean" },
  ],
  cooler: [
    { key: "type", label: "Type", type: "select", options: ["Air", "AIO"], required: true },
    { key: "tdp_rating_w", label: "TDP Rating (W)", type: "number" },
    { key: "radiator_size_mm", label: "Radiator Size (mm, AIO only)", type: "number" },
    { key: "height_mm", label: "Height (mm, Air only)", type: "number" },
  ],
  case: [
    { key: "form_factor", label: "Form Factor", type: "select", options: ["ATX", "Micro-ATX", "Mini-ITX", "E-ATX"], required: true },
    { key: "max_gpu_length_mm", label: "Max GPU Length (mm)", type: "number", required: true },
    { key: "max_cooler_height_mm", label: "Max Cooler Height (mm)", type: "number", required: true },
    { key: "drive_bays_2_5", label: "2.5\" Drive Bays", type: "number" },
    { key: "drive_bays_3_5", label: "3.5\" Drive Bays", type: "number" },
    { key: "expansion_slots", label: "Expansion Slots", type: "number" },
    { key: "max_psu_form_factor", label: "Max PSU Form Factor", type: "select", options: ["ATX", "SFX", "SFX-L"] },
  ],
};

const CATEGORIES: { value: Category; label: string }[] = [
  { value: "cpu", label: "CPU" },
  { value: "gpu", label: "GPU" },
  { value: "motherboard", label: "Motherboard" },
  { value: "ram", label: "RAM" },
  { value: "storage", label: "Storage" },
  { value: "psu", label: "PSU" },
  { value: "cooler", label: "Cooler" },
  { value: "case", label: "Case" },
];

export default function SubmitComponentPage() {
  const [category, setCategory] = useState<Category>("cpu");
  const [name, setName] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [price, setPrice] = useState("");
  const [submittedBy, setSubmittedBy] = useState("");
  const [specs, setSpecs] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  function updateSpec(key: string, value: any) {
    setSpecs((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/admin/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          name,
          manufacturer,
          price_usd: price ? Number(price) : undefined,
          specs,
          submitted_by: submittedBy || "anonymous",
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Submission failed");
      }

      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <CheckCircle className="mx-auto h-16 w-16 text-green-500" />
        <h1 className="mt-6 text-2xl font-bold">Component Submitted</h1>
        <p className="mt-3 text-zinc-600 dark:text-zinc-400">
          Your submission is pending review. Once approved, it will appear in the component catalog.
        </p>
        <div className="mt-8 flex gap-4 justify-center">
          <Button
            onClick={() => {
              setSubmitted(false);
              setName("");
              setManufacturer("");
              setPrice("");
              setSpecs({});
            }}
          >
            Submit Another
          </Button>
          <Button as="link" href="/build" variant="outline">
            Back to Builder
          </Button>
        </div>
      </div>
    );
  }

  const specFields = CATEGORY_SPECS[category];

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link
        href="/build"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Builder
      </Link>

      <h1 className="text-3xl font-bold">Submit a Component</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Can&apos;t find a part in our catalog? Submit it here and we&apos;ll review it.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        {/* Category */}
        <div>
          <label className="block text-sm font-medium mb-1.5">Category *</label>
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value as Category);
              setSpecs({});
            }}
            className="w-full rounded-lg border border-zinc-300 bg-background px-3 py-2.5 dark:border-zinc-700"
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        {/* Basic info */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium mb-1.5">Component Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Intel Core i7-14700K"
              className="w-full rounded-lg border border-zinc-300 bg-background px-3 py-2.5 dark:border-zinc-700"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Manufacturer *</label>
            <input
              type="text"
              required
              value={manufacturer}
              onChange={(e) => setManufacturer(e.target.value)}
              placeholder="e.g. Intel"
              className="w-full rounded-lg border border-zinc-300 bg-background px-3 py-2.5 dark:border-zinc-700"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium mb-1.5">Price (USD)</label>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="e.g. 399"
              className="w-full rounded-lg border border-zinc-300 bg-background px-3 py-2.5 dark:border-zinc-700"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Your Name / Email</label>
            <input
              type="text"
              value={submittedBy}
              onChange={(e) => setSubmittedBy(e.target.value)}
              placeholder="Optional"
              className="w-full rounded-lg border border-zinc-300 bg-background px-3 py-2.5 dark:border-zinc-700"
            />
          </div>
        </div>

        {/* Dynamic specs */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Specifications</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {specFields.map((field) => (
              <div key={field.key}>
                <label className="block text-sm font-medium mb-1.5">
                  {field.label}
                  {field.required && " *"}
                </label>
                {field.type === "select" ? (
                  <select
                    required={field.required}
                    value={specs[field.key] ?? ""}
                    onChange={(e) => updateSpec(field.key, e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 bg-background px-3 py-2.5 dark:border-zinc-700"
                  >
                    <option value="">Select...</option>
                    {field.options?.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                ) : field.type === "boolean" ? (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!specs[field.key]}
                      onChange={(e) => updateSpec(field.key, e.target.checked)}
                      className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700"
                    />
                    <span className="text-sm text-zinc-600 dark:text-zinc-400">Yes</span>
                  </label>
                ) : (
                  <input
                    type={field.type}
                    required={field.required}
                    value={specs[field.key] ?? ""}
                    onChange={(e) =>
                      updateSpec(
                        field.key,
                        field.type === "number"
                          ? e.target.value ? Number(e.target.value) : ""
                          : e.target.value
                      )
                    }
                    className="w-full rounded-lg border border-zinc-300 bg-background px-3 py-2.5 dark:border-zinc-700"
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
            {error}
          </div>
        )}

        <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
          <Send className="mr-2 h-4 w-4" />
          {submitting ? "Submitting..." : "Submit Component"}
        </Button>
      </form>
    </div>
  );
}
