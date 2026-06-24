const NATIVE_ETH_ADDRESS = "0x0000000000000000000000000000000000000000";
const NATIVE_ETH_ADDRESS_ALT = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

export function isNativeEthAddress(address?: string | null): boolean {
  if (!address) return false;
  const normalized = address.toLowerCase();
  return (
    normalized === NATIVE_ETH_ADDRESS || normalized === NATIVE_ETH_ADDRESS_ALT
  );
}

export function isNativeEthToken(token: {
  address?: string | null;
  symbol?: string | null;
}): boolean {
  return isNativeEthAddress(token.address);
}
