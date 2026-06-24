import { useState, useEffect } from "react";
import axios from "axios";
import type { HarvestVaultData } from "~/types";

interface VaultsData {
  [vaultId: string]: HarvestVaultData;
}

interface UseVaultsDataReturn {
  vaultsData: VaultsData | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

// Cache duration in milliseconds (2 hours)
const CACHE_DURATION = 2 * 60 * 60 * 1000;

// Module-level cache and tracking variables
let cachedData: VaultsData | null = null;
let lastFetchTime = 0;
let fetchPromise: Promise<void> | null = null;
let activeSubscribers = 0;

export function useVaultsData(): UseVaultsDataReturn {
  const [vaultsData, setVaultsData] = useState<VaultsData | null>(cachedData);
  const [loading, setLoading] = useState(!cachedData);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = async () => {
    // If there's already a fetch in progress, wait for it to complete
    if (fetchPromise) {
      return fetchPromise;
    }

    try {
      setLoading(true);
      setError(null);

      // Create a new promise for this fetch operation
      fetchPromise = (async () => {
        try {
          const response = await axios.get("/api/vaults");

          if (!response.data?.base) {
            throw new Error("No data received from Harvest API");
          }

          // Update cache
          cachedData = response.data.base;
          lastFetchTime = Date.now();

          setVaultsData(response.data.base);
          setError(null);
        } catch (err) {
          console.error("Error fetching Harvest data:", err);
          setError(
            err instanceof Error
              ? err
              : new Error("Failed to fetch Harvest data"),
          );
        } finally {
          setLoading(false);
          // Clear the fetch promise so new requests can be made
          fetchPromise = null;
        }
      })();

      return fetchPromise;
    } catch (err) {
      console.error("Error in fetchData:", err);
      // If something went wrong with the promise setup itself
      fetchPromise = null;
      throw err;
    }
  };

  useEffect(() => {
    // Increment the subscriber count
    activeSubscribers++;

    const now = Date.now();

    // If we have cached data and it's not expired, use it
    if (cachedData && now - lastFetchTime < CACHE_DURATION) {
      setVaultsData(cachedData);
      setLoading(false);
    } else if (!fetchPromise) {
      // If there's no active fetch and the cache is expired, fetch new data
      fetchData();
    } else {
      // If there's an active fetch, wait for it to complete
      fetchPromise.then(() => {
        setVaultsData(cachedData);
        setLoading(false);
      });
    }

    // Set up periodic refresh, but only if this is the first subscriber
    let intervalId: NodeJS.Timeout | null = null;
    if (activeSubscribers === 1) {
      intervalId = setInterval(() => {
        const currentTime = Date.now();
        if (currentTime - lastFetchTime >= CACHE_DURATION && !fetchPromise) {
          fetchData();
        }
      }, 60000); // Check every minute if refresh is needed
    }

    return () => {
      // Decrement the subscriber count
      activeSubscribers--;

      // Clear the interval if this was the last subscriber
      if (intervalId && activeSubscribers === 0) {
        clearInterval(intervalId);
      }
    };
  }, []);

  return { vaultsData, loading, error, refetch: fetchData };
}

export type { HarvestVaultData, VaultsData };
