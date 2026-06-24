import type { AllocPointData } from "~/types";

const ALLOC_NAME_PREFIXES: { prefix: string; name: string }[] = [
  { prefix: "morphoGF", name: "Morpho - Gauntlet Frontier V2" },
  { prefix: "morphoGC", name: "Morpho - Gauntlet Prime V2" },
  { prefix: "morphoMW", name: "Morpho - Moonwell Flagship V2" },
  { prefix: "morphoSH", name: "Morpho - Steakhouse High Yield V2" },
  { prefix: "morphoAP", name: "Morpho - Alpha Prime V2" },
  { prefix: "morphoYO", name: "Morpho - Yearn OG V2" },
  { prefix: "morphoYP", name: "Morpho - Yearn OG V2" },
  { prefix: "arcadia", name: "Arcadia - Lend" },
  { prefix: "aave", name: "Aave" },
  { prefix: "extrafi", name: "ExtraFi - Lend" },
  { prefix: "compound", name: "Compound V3" },
  { prefix: "fluid", name: "Fluid" },
];

export function formatAllocPointName(hVaultId: string): string {
  if (hVaultId === "Not invested") {
    return "Deployment Buffer";
  }

  const lower = hVaultId.toLowerCase();
  const match = ALLOC_NAME_PREFIXES.find(({ prefix }) =>
    lower.startsWith(prefix.toLowerCase()),
  );

  if (match) return match.name;

  return hVaultId
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export interface AllocationItem {
  id: string;
  name: string;
  pct: number;
}

export function parseAllocationData(
  allocPointData?: AllocPointData[],
): AllocationItem[] {
  if (!allocPointData?.length) return [];

  return allocPointData
    .map((item) => ({
      id: item.hVaultId,
      name: formatAllocPointName(item.hVaultId),
      pct: parseFloat(item.allocPoint) || 0,
    }))
    .sort((a, b) => b.pct - a.pct);
}

export function getBaseExplorerAddressUrl(address: string): string {
  return `https://basescan.org/address/${address}`;
}
