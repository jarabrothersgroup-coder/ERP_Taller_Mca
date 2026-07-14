/**
 * Onboarding Check Slug API Route — Proxy to backend.
 *
 * GET /api/onboarding/check/:slug — Check if slug is available
 */

import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:4000";

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;

    const res = await fetch(`${BACKEND_URL}/api/onboarding/check/${slug}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(data, { status: res.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Onboarding check slug error:", error);
    return NextResponse.json(
      { error: "Error al verificar el slug" },
      { status: 500 }
    );
  }
}
