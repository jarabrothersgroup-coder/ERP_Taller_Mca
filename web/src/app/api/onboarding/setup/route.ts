/**
 * Onboarding API Route — Proxy to backend onboarding endpoint.
 *
 * POST /api/onboarding/setup — Create tenant with business info
 */

import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:4000";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const res = await fetch(`${BACKEND_URL}/api/onboarding/setup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(data, { status: res.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Onboarding API error:", error);
    return NextResponse.json(
      { error: "Error al conectar con el servidor" },
      { status: 500 }
    );
  }
}
