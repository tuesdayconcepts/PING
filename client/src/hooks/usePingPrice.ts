import { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

interface HintSettings {
  treasuryWallet: string;
  burnWallet: string;
  pingTokenMint: string;
  currentPingPrice: number | null;
}

/**
 * Hook to fetch and track $PING token price and hint settings
 * Polls Jupiter API via backend every 60 seconds
 */
export function usePingPrice() {
  const [pingPrice, setPingPrice] = useState<number | null>(null);
  const [settings, setSettings] = useState<HintSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPriceAndSettings = async () => {
    try {
      const response = await fetch(`${API_URL}/api/hints/settings`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch hint settings');
      }

      const data: HintSettings = await response.json();
      setSettings(data);
      setPingPrice(data.currentPingPrice);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch $PING price:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch price');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchPriceAndSettings();

    // Poll every 60 seconds
    const interval = setInterval(fetchPriceAndSettings, 60000);

    return () => clearInterval(interval);
  }, []);

  /**
   * Convert USD amount to $PING amount based on current price
   */
  const usdToPing = (usdAmount: number): number | null => {
    if (!pingPrice) return null;
    return usdAmount / pingPrice;
  };

  /**
   * Format $PING amount for display
   */
  const formatPingAmount = (amount: number): string => {
    return amount.toFixed(1); // Show 1 decimal place for all amounts
  };

  return {
    pingPrice,
    settings,
    loading,
    error,
    usdToPing,
    formatPingAmount,
  };
}

