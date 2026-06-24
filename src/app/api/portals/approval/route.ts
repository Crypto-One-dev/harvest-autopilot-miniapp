import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { PORTALS_FI_API_URL } from "~/constants";

export const runtime = "nodejs";

const NATIVE_ETH = "0x0000000000000000000000000000000000000000";
const NATIVE_ETH_ALT = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

function isNativeEthInputToken(inputToken: string | null): boolean {
  if (!inputToken) return false;
  const address = inputToken.split(":").pop()?.toLowerCase() ?? "";
  return address === NATIVE_ETH || address === NATIVE_ETH_ALT;
}

export async function GET(request: NextRequest) {
  const sender = request.nextUrl.searchParams.get("sender");
  const inputToken = request.nextUrl.searchParams.get("inputToken");
  const inputAmount = request.nextUrl.searchParams.get("inputAmount") ?? "0";

  if (!sender || !inputToken) {
    return NextResponse.json(
      { message: "Missing sender or inputToken parameter" },
      { status: 400 },
    );
  }

  if (isNativeEthInputToken(inputToken)) {
    return NextResponse.json({
      context: { allowance: inputAmount },
    });
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
    const response = await axios.get(`${PORTALS_FI_API_URL}/v2/approval`, {
      params: { sender, inputToken, inputAmount },
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      timeout: 10000,
    });

    return NextResponse.json(response.data);
  } catch (error: unknown) {
    console.error("Portals approval proxy error:", error);
    return NextResponse.json(
      { message: "Error fetching Portals approval data" },
      { status: 500 },
    );
  }
}
