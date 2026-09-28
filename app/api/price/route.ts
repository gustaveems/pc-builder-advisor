import { NextRequest, NextResponse } from "next/server";
import { getPrice } from "@/lib/pricing";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const name = searchParams.get("name");
  const category = searchParams.get("category");

  if (!id || !name || !category) {
    return NextResponse.json(
      { error: "Missing required params: id, name, category" },
      { status: 400 }
    );
  }

  try {
    const price = await getPrice(id, name, category);
    if (!price) {
      return NextResponse.json(
        { error: "No pricing data available", id },
        { status: 404 }
      );
    }
    return NextResponse.json(price);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Pricing lookup failed" },
      { status: 500 }
    );
  }
}
