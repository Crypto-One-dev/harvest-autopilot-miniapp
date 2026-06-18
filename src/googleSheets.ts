import { google } from "googleapis";
import { AnalyticsData } from "./types";

const getPrivateKey = () => {
  const key = process.env.GOOGLE_PRIVATE_KEY;
  if (!key) {
    console.error("GOOGLE_PRIVATE_KEY is not set");
    return "";
  }
  try {
    // Handle both formats: with literal \n and with actual newlines
    return key.includes("\\n") ? key.replace(/\\n/g, "\n") : key;
  } catch (error) {
    console.error("Error processing GOOGLE_PRIVATE_KEY:", error);
    return "";
  }
};

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL || "",
    private_key: getPrivateKey(),
    project_id: process.env.GOOGLE_PROJECT_ID || "",
  },
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({ version: "v4", auth });

async function getSheetName(spreadsheetId: string) {
  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId,
  });

  if (!spreadsheet.data.sheets?.[0]) {
    throw new Error("No sheets found");
  }

  return spreadsheet.data.sheets[0].properties?.title;
}

export async function writeAnalyticsToSheet(
  spreadsheetId: string,
  data: AnalyticsData,
): Promise<void> {
  try {
    const sheetName = await getSheetName(spreadsheetId);
    if (!sheetName) throw new Error("Sheet name not found");

    const values = [
      [
        data.action,
        data.tokenSymbol,
        data.tokenAddress,
        data.amount,
        data.vaultAddress || "",
        data.vaultSymbol || "",
        data.txHash,
        data.chainId,
        data.walletAddress,
        data.timestamp,
      ],
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheetName}!A:J`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values,
      },
    });

    console.log("Analytics data appended successfully");
  } catch (error) {
    console.error("Error writing analytics to sheet:", error);
    throw error;
  }
}
