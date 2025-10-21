import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Lock, Unlock } from 'lucide-react';
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
  const { settings, usdToPing, formatPingAmount } = usePingPrice();
  
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
        // Get price for this hint level (must be configured on hotspot)
        const hintPriceUsd = hintLevel === 1
          ? hotspot.hint1PriceUsd
          : hintLevel === 2
          ? hotspot.hint2PriceUsd
          : hotspot.hint3PriceUsd;
        
        if (!hintPriceUsd) {
          throw new Error('Hint price not configured for this hotspot');
        }

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
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Purchase failed');
      }

      const result = await response.json();

      // Update purchased hints with the new hint text
      setPurchasedHints((prev) => ({
        ...prev!,
        [`hint${hintLevel}`]: {
          purchased: true,
          text: result.hintText,
        },
      }));
    } catch (err) {
      console.error('Purchase failed:', err);
      setError(err instanceof Error ? err.message : 'Purchase failed');
    } finally {
      setPurchasing(null);
    }
  };

  if (loading) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-wrapper">
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={onClose}>
              ✕
            </button>
            <div className="modal-sections">
              <div className="modal-section">
                <div className="hint-loading">Loading hints...</div>
              </div>
            </div>
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
    { level: 1, text: hotspot.hint1, price: hotspot.hint1PriceUsd, free: hotspot.firstHintFree },
    { level: 2, text: hotspot.hint2, price: hotspot.hint2PriceUsd, free: false },
    { level: 3, text: hotspot.hint3, price: hotspot.hint3PriceUsd, free: false },
  ].filter((h) => h.text); // Only show hints that exist

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-wrapper">
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>

          <div className="modal-sections">
            {/* Header Section */}
            <div className="modal-section hint-header-section">
              <h2>Get a Hint</h2>
              <p className="hint-subtitle">Purchase hints to help you find this PING</p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="modal-section hint-error-section">
                <p className="hint-error">{error}</p>
              </div>
            )}

            {/* Wallet Connect Section */}
            {!connected && (
              <div className="modal-section hint-wallet-section">
                <p>Connect your Solana wallet to purchase hints</p>
                <WalletMultiButton />
              </div>
            )}

            {/* Hints List */}
            {hints.length === 0 ? (
              <div className="modal-section">
                <p className="no-hints">No hints available for this hotspot</p>
              </div>
            ) : (
              hints.map((hint) => {
                const purchased = purchasedHints[`hint${hint.level}` as keyof PurchasedHints]?.purchased;
                const hintText = purchasedHints[`hint${hint.level}` as keyof PurchasedHints]?.text;
                const pingAmount = hint.free ? 0 : (hint.price ? usdToPing(hint.price) : null);
                
                // Check if previous hint is required
                const needsPreviousHint = hint.level > 1 && 
                  !purchasedHints[`hint${hint.level - 1}` as keyof PurchasedHints]?.purchased;

                return (
                  <div key={hint.level} className={`modal-section hint-card ${purchased ? 'unlocked' : 'locked'} ${needsPreviousHint ? 'disabled' : ''}`}>
                    <div className="hint-card-header">
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
                      <div className="hint-locked-content">
                        {needsPreviousHint ? (
                          <p className="hint-requirement">Unlock Hint {hint.level - 1} first</p>
                        ) : (
                          <>
                            <div className="hint-price">
                              {hint.free ? (
                                <span className="price-text">Free Hint</span>
                              ) : (
                                <>
                                  <span className="price-usd">${hint.price?.toFixed(2)}</span>
                                  {pingAmount && (
                                    <span className="price-ping">≈ {formatPingAmount(pingAmount)} $PING</span>
                                  )}
                                </>
                              )}
                            </div>
                            <button
                              className="purchase-btn"
                              onClick={() => handlePurchase(hint.level, hint.free || false)}
                              disabled={purchasing !== null || needsPreviousHint}
                            >
                              {purchasing === hint.level ? 'Processing...' : (hint.free ? 'Get Free Hint' : 'Purchase Hint')}
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
        </div>
      </div>
    </div>
  );
}
