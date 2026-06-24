import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { PORTALS_FI_API_URL } from "~/constants";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const owner = request.nextUrl.searchParams.get("owner");
  const networks = request.nextUrl.searchParams.get("networks");

  if (!owner || !networks) {
    return NextResponse.json(
      { message: "Missing owner or networks parameter" },
      { status: 400 },
    );
  }

  const apiKey =
    process.env.PORTALS_API_KEY ?? process.env.NEXT_PUBLIC_PORTALS_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { message: "Server configuration error" },
      { status: 500 },
    );
  }

  try {
    const response = await axios.get(`${PORTALS_FI_API_URL}/v2/account`, {
      params: { owner, networks },
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      timeout: 10000,
    });

    return NextResponse.json(response.data);
  } catch (error: unknown) {
    console.error("Portals account proxy error:", error);
    return NextResponse.json(
      { message: "Error fetching Portals account balances" },
      { status: 500 },
    );
  }
}
