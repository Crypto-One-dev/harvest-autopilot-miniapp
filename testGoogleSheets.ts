import "dotenv/config";
import { writeAnalyticsToSheet } from "./src/googleSheets";

async function testWriteAnalyticsToSheet() {
  const spreadsheetId = "1N7nsUtZtcyX2x3uSW7PHz9lWGfU1rqL9kRLsy9-wTNA"; // Replace with your actual spreadsheet ID
  const testData = {
    action: "test_action",
    tokenSymbol: "TEST",
    tokenAddress: "0x1234567890123456789012345678901234567890",
    amount: "100",
    vaultAddress: "0x1234567890123456789012345678901234567890",
    vaultSymbol: "test_vault",
    txHash: "0x00000",
    chainId: 1,
    walletAddress: "0x1234567890123456789012345678901234567890",
    timestamp: new Date().toISOString(),
  };

  try {
    await writeAnalyticsToSheet(spreadsheetId, testData);
    console.log("Test passed: Data written successfully");
  } catch (error) {
    console.error("Test failed:", error);
  }
}

testWriteAnalyticsToSheet();
