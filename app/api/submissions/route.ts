import { NextRequest, NextResponse } from "next/server";
import {
  createSubmission,
  listSubmissions,
  type SubmissionStatus,
  type SubmissionCategory,
} from "@/lib/submissions";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") as SubmissionStatus | null;

  try {
    const submissions = listSubmissions(status ?? undefined);
    return NextResponse.json(submissions);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to list submissions" },
      { status: 500 }
    );
  }
}

const VALID_CATEGORIES: SubmissionCategory[] = [
  "cpu", "gpu", "motherboard", "ram", "storage", "psu", "cooler", "case",
];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { category, name, manufacturer, price_usd, specs, submitted_by } = body;

    if (!category || !VALID_CATEGORIES.includes(category)) {
      return NextResponse.json(
        { error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(", ")}` },
        { status: 400 }
      );
    }

    if (!name || !manufacturer) {
      return NextResponse.json(
        { error: "name and manufacturer are required" },
        { status: 400 }
      );
    }

    if (!specs || typeof specs !== "object") {
      return NextResponse.json(
        { error: "specs object is required" },
        { status: 400 }
      );
    }

    const submission = createSubmission({
      category,
      name,
      manufacturer,
      price_usd: price_usd ? Number(price_usd) : undefined,
      specs,
      submitted_by: submitted_by || "anonymous",
    });

    return NextResponse.json(submission, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create submission" },
      { status: 500 }
    );
  }
}
