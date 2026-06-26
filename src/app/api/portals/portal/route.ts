import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { PORTALS_FI_API_URL } from "~/constants";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const apiKey =
    process.env.PORTALS_API_KEY ?? process.env.NEXT_PUBLIC_PORTALS_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { message: "Server configuration error" },
      { status: 500 },
    );
  }

  const params = Object.fromEntries(request.nextUrl.searchParams.entries());

  if (!params.sender || !params.inputToken || !params.outputToken) {
    return NextResponse.json(
      { message: "Missing required portal parameters" },
      { status: 400 },
    );
  }

  try {
    const response = await axios.get(`${PORTALS_FI_API_URL}/v2/portal`, {
      params: {
        ...params,
        feePercentage: params.feePercentage ?? 0,
        partner: params.partner ?? "0xF066789028fE31D4f53B69B81b328B8218Cc0641",
      },
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      timeout: 30000,
    });

    return NextResponse.json(response.data);
  } catch (error: unknown) {
    console.error("Portals portal proxy error:", error);
    if (axios.isAxiosError(error) && error.response?.data) {
      return NextResponse.json(error.response.data, {
        status: error.response.status,
      });
    }
    return NextResponse.json(
      { message: "Error fetching Portals route" },
      { status: 500 },
    );
  }
}
