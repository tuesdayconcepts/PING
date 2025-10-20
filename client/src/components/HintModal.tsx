import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Lock, Unlock, Gift, X } from 'lucide-react';
import { usePingPrice } from '../hooks/usePingPrice';
import { sendHintPayment } from '../utils/solana';
import './HintModal.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

interface HintModalProps {
  hotspotId: string;
  onClose: () => void;
}

interface HintData {
  purchased: boolean;
  text?: string;
}

interface PurchasedHints {
  hint1: HintData;
  hint2: HintData;
  hint3: HintData;
}

export function HintModal({ hotspotId, onClose }: HintModalProps) {
  const wallet = useWallet();
  const { publicKey, connected } = wallet;
  const { pingPrice, settings, usdToPing, formatPingAmount } = usePingPrice();
  
  const [purchasedHints, setPurchasedHints] = useState<PurchasedHints | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hotspot, setHotspot] = useState<any>(null);

  // Fetch hotspot data and purchased hints
  useEffect(() => {
    fetchHotspotAndPurchases();
  }, [hotspotId, publicKey]);

  const fetchHotspotAndPurchases = async () => {
    try {
      // Fetch hotspot data
      const hotspotRes = await fetch(`${API_URL}/api/hotspots`);
      const hotspots = await hotspotRes.json();
      const currentHotspot = hotspots.find((h: any) => h.id === hotspotId);
      
      if (!currentHotspot) {
        throw new Error('Hotspot not found');
      }
      
      setHotspot(currentHotspot);

      // Fetch purchased hints if wallet connected
      if (publicKey) {
        const purchasedRes = await fetch(
          `${API_URL}/api/hints/${hotspotId}/purchased?wallet=${publicKey.toString()}`
        );
        const data = await purchasedRes.json();
        setPurchasedHints(data);
      } else {
        // Not connected, show all as unpurchased
        setPurchasedHints({
          hint1: { purchased: false },
          hint2: { purchased: false },
          hint3: { purchased: false },
        });
      }
    } catch (err) {
      console.error('Failed to fetch hint data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load hints');
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (hintLevel: number, isFree: boolean) => {
    if (!publicKey && !isFree) {
      setError('Please connect your wallet first');
      return;
    }

    if (!settings) {
      setError('Hint system not configured');
      return;
    }

    setPurchasing(hintLevel);
    setError(null);

    try {
      let txSignature = null;
      let paidAmount = 0;

      // Handle paid purchase
      if (!isFree) {
        // Get price for this hint level
        const hintPriceUsd = hintLevel === 1
          ? (hotspot.hint1PriceUsd || settings.defaultHint1Usd)
          : hintLevel === 2
          ? (hotspot.hint2PriceUsd || settings.defaultHint2Usd)
          : (hotspot.hint3PriceUsd || settings.defaultHint3Usd);

        // Calculate $PING amount
        const pingAmount = usdToPing(hintPriceUsd);
        
        if (!pingAmount) {
          throw new Error('Unable to calculate $PING price. Please try again.');
        }

        paidAmount = pingAmount;

        // Send transaction
        txSignature = await sendHintPayment(
          wallet,
          settings.treasuryWallet,
          settings.burnWallet,
          pingAmount,
          settings.pingTokenMint
        );
      }

      // Submit purchase to backend
      const response = await fetch(`${API_URL}/api/hints/purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hotspotId,
          walletAddress: publicKey?.toString() || 'anonymous',
          hintLevel,
          txSignature,
          paidAmount,
          isFree,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Purchase failed');
      }

      const data = await response.json();

      // Update purchased hints with new hint text
      setPurchasedHints((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          [`hint${hintLevel}`]: {
            purchased: true,
            text: data.hint,
          },
        };
      });

    } catch (err) {
      console.error('Purchase failed:', err);
      setError(err instanceof Error ? err.message : 'Purchase failed');
    } finally {
      setPurchasing(null);
    }
  };

  if (loading) {
    return (
      <div className="hint-modal-overlay" onClick={onClose}>
        <div className="hint-modal" onClick={(e) => e.stopPropagation()}>
          <div className="hint-modal-header">
            <h2>Loading hints...</h2>
            <button className="close-btn" onClick={onClose}>
              <X size={24} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!hotspot || !purchasedHints) {
    return null;
  }

  // Determine which hints exist
  const hints = [
    { level: 1, text: hotspot.hint1, price: hotspot.hint1PriceUsd || settings?.defaultHint1Usd, free: hotspot.firstHintFree },
    { level: 2, text: hotspot.hint2, price: hotspot.hint2PriceUsd || settings?.defaultHint2Usd, free: false },
    { level: 3, text: hotspot.hint3, price: hotspot.hint3PriceUsd || settings?.defaultHint3Usd, free: false },
  ].filter((h) => h.text); // Only show hints that exist

  return (
    <div className="hint-modal-overlay" onClick={onClose}>
      <div className="hint-modal" onClick={(e) => e.stopPropagation()}>
        <div className="hint-modal-header">
          <h2>Get a Hint</h2>
          <button className="close-btn" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        {error && (
          <div className="hint-error">
            {error}
          </div>
        )}

        {!connected && (
          <div className="wallet-connect-section">
            <p>Connect your Solana wallet to purchase hints</p>
            <WalletMultiButton />
          </div>
        )}

        <div className="hints-grid">
          {hints.length === 0 ? (
            <p className="no-hints">No hints available for this hotspot</p>
          ) : (
            hints.map((hint) => {
              const purchased = purchasedHints[`hint${hint.level}` as keyof PurchasedHints]?.purchased;
              const hintText = purchasedHints[`hint${hint.level}` as keyof PurchasedHints]?.text;
              const pingAmount = hint.free ? 0 : usdToPing(hint.price || 0);
              
              // Check if previous hint is required
              const needsPreviousHint = hint.level > 1 && 
                !purchasedHints[`hint${hint.level - 1}` as keyof PurchasedHints]?.purchased;

              return (
                <div key={hint.level} className={`hint-card ${purchased ? 'unlocked' : 'locked'} ${needsPreviousHint ? 'disabled' : ''}`}>
                  <div className="hint-header">
                    <div className="hint-title">
                      {purchased ? <Unlock size={20} /> : <Lock size={20} />}
                      <span>Hint {hint.level}</span>
                    </div>
                    {hint.free && !purchased && (
                      <span className="free-badge">FREE</span>
                    )}
                  </div>

                  {purchased ? (
                    <div className="hint-content">
                      <p>{hintText}</p>
                    </div>
                  ) : (
                    <div className="hint-locked">
                      {needsPreviousHint ? (
                        <p className="requirement-text">
                          Unlock Hint {hint.level - 1} first
                        </p>
                      ) : (
                        <>
                          <div className="hint-price">
                            {hint.free ? (
                              <span className="price-free">Free!</span>
                            ) : (
                              <>
                                <span className="price-usd">${hint.price?.toFixed(2)}</span>
                                {pingAmount && (
                                  <span className="price-ping">
                                    {formatPingAmount(pingAmount)} $PING
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                          
                          <button
                            className="purchase-btn"
                            onClick={() => handlePurchase(hint.level, hint.free || false)}
                            disabled={purchasing !== null || (!connected && !hint.free)}
                          >
                            {purchasing === hint.level ? (
                              'Processing...'
                            ) : hint.free ? (
                              'Get Free Hint'
                            ) : !connected ? (
                              'Connect Wallet'
                            ) : (
                              'Purchase Hint'
                            )}
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {hints.length > 0 && (
          <div className="hint-footer">
            <p>Hints unlock progressively - purchase them in order</p>
          </div>
        )}
      </div>
    </div>
  );
}

