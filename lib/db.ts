import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";

export type SubmissionStatus = "pending" | "approved" | "rejected";

export type SubmissionCategory =
  | "cpu"
  | "gpu"
  | "motherboard"
  | "ram"
  | "storage"
  | "psu"
  | "cooler"
  | "case";

export interface ComponentSubmission {
  id: string;
  status: SubmissionStatus;
  category: SubmissionCategory;
  name: string;
  manufacturer: string;
  price_usd?: number;
  specs: Record<string, any>;
  submitted_by: string;
  submitted_at: string;
  reviewed_at?: string;
  review_note?: string;
}

const SUBMISSIONS_PATH = path.join(process.cwd(), "data", "submissions.json");

const CATEGORY_FILE_MAP: Record<SubmissionCategory, string> = {
  cpu: "cpus.json",
  gpu: "gpus.json",
  motherboard: "motherboards.json",
  ram: "ram.json",
  storage: "storage.json",
  psu: "psus.json",
  cooler: "coolers.json",
  case: "cases.json",
};

function readSubmissions(): ComponentSubmission[] {
  try {
    if (!fs.existsSync(SUBMISSIONS_PATH)) return [];
    return JSON.parse(fs.readFileSync(SUBMISSIONS_PATH, "utf-8"));
  } catch {
    return [];
  }
}

function writeSubmissions(submissions: ComponentSubmission[]): void {
  fs.writeFileSync(
    SUBMISSIONS_PATH,
    JSON.stringify(submissions, null, 2),
    "utf8"
  );
}

export function createSubmission(
  data: Omit<ComponentSubmission, "id" | "status" | "submitted_at">
): ComponentSubmission {
  const submissions = readSubmissions();
  const submission: ComponentSubmission = {
    ...data,
    id: nanoid(12),
    status: "pending",
    submitted_at: new Date().toISOString(),
  };
  submissions.push(submission);
  writeSubmissions(submissions);
  return submission;
}

export function listSubmissions(
  status?: SubmissionStatus
): ComponentSubmission[] {
  const all = readSubmissions();
  if (!status) return all;
  return all.filter((s) => s.status === status);
}

export function getSubmission(id: string): ComponentSubmission | null {
  return readSubmissions().find((s) => s.id === id) ?? null;
}

export function reviewSubmission(
  id: string,
  action: "approved" | "rejected",
  note?: string
): ComponentSubmission | null {
  const submissions = readSubmissions();
  const idx = submissions.findIndex((s) => s.id === id);
  if (idx === -1) return null;

  submissions[idx].status = action;
  submissions[idx].reviewed_at = new Date().toISOString();
  if (note) submissions[idx].review_note = note;

  if (action === "approved") {
    addToCatalog(submissions[idx]);
  }

  writeSubmissions(submissions);
  return submissions[idx];
}

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function addToCatalog(submission: ComponentSubmission): void {
  const catalogDir = path.join(process.cwd(), "data", "catalog");
  const filename = CATEGORY_FILE_MAP[submission.category];
  const filePath = path.join(catalogDir, filename);

  let catalog: any[] = [];
  if (fs.existsSync(filePath)) {
    catalog = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  }

  const component: Record<string, any> = {
    id: `${submission.category}-${slugify(submission.name)}`,
    name: submission.name,
    manufacturer: submission.manufacturer,
    price_usd: submission.price_usd,
    specs: submission.specs,
  };

  const existingIdx = catalog.findIndex((c: any) => c.id === component.id);
  if (existingIdx >= 0) {
    catalog[existingIdx] = component;
  } else {
    catalog.push(component);
  }

  fs.writeFileSync(filePath, JSON.stringify(catalog, null, 2), "utf8");
}
