import { Attribution } from "ox/erc8021";
import type { Hex } from "viem";

const builderCode = process.env.NEXT_PUBLIC_BASE_BUILDER_CODE?.trim();

export const builderDataSuffix: Hex | undefined = builderCode
  ? Attribution.toDataSuffix({
      codes: [builderCode],
    })
  : undefined;

export function getBuilderDataSuffix(): Hex | undefined {
  return builderDataSuffix;
}
