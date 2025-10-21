import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { usePingPrice } from '../hooks/usePingPrice';
import { sendHintPayment } from '../utils/solana';
import { InvisibleInkReveal } from './InvisibleInkReveal';
import './HintModal.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

interface HintModalProps {
  hotspotId: string;
  onClose: () => void;
  onShowDetails: () => void;
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

export function HintModal({ hotspotId, onClose, onShowDetails }: HintModalProps) {
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
          isFree, // Include free hint flag
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

  // Find the first unpurchased hint
  const nextHint = hints.find((h) => !purchasedHints[`hint${h.level}` as keyof PurchasedHints]?.purchased);

  // Determine CTA text and action
  let ctaText = 'ALL HINTS UNLOCKED';
  let ctaAction = null;
  let ctaDisabled = true;

  if (nextHint) {
    const needsPreviousHint = nextHint.level > 1 && 
      !purchasedHints[`hint${nextHint.level - 1}` as keyof PurchasedHints]?.purchased;

    if (needsPreviousHint) {
      ctaText = `UNLOCK HINT ${nextHint.level - 1} FIRST`;
      ctaDisabled = true;
    } else if (nextHint.free) {
      ctaText = 'REVEAL HINT';
      ctaAction = () => handlePurchase(nextHint.level, true);
      ctaDisabled = false;
    } else if (!connected) {
      // Will show WalletMultiButton instead
      ctaText = 'CONNECT_WALLET';
      ctaDisabled = false;
    } else {
      ctaText = 'UNLOCK HINT';
      ctaAction = () => handlePurchase(nextHint.level, false);
      ctaDisabled = false;
    }
  }

  // Render slider cards (hybrid of single + slider)
  const renderHintCards = () => {
    const currentHintIndex = hints.findIndex((h) => h === nextHint);
    const centerIndex = currentHintIndex === -1 ? hints.length - 1 : currentHintIndex; // Last if all unlocked

    return (
      <div className="slider-cards-container">
        <div className="slider-track" style={{ transform: `translateX(calc(-${centerIndex * 100}% - ${centerIndex * 16}px))` }}>
          {hints.map((hint) => {
            const purchased = purchasedHints[`hint${hint.level}` as keyof PurchasedHints]?.purchased;
            const hintText = purchasedHints[`hint${hint.level}` as keyof PurchasedHints]?.text || hint.text;
            const pingAmount = hint.free ? 0 : (hint.price ? usdToPing(hint.price) : null);
            const needsPreviousHint = hint.level > 1 && 
              !purchasedHints[`hint${hint.level - 1}` as keyof PurchasedHints]?.purchased;
            const isCenter = hint === nextHint || (purchased && !nextHint);

            return (
              <div 
                key={hint.level} 
                className={`hint-card slider ${purchased ? 'unlocked' : 'locked'} ${isCenter ? 'center' : ''} ${needsPreviousHint ? 'disabled' : ''}`}
              >
                <div className="hint-card-header">
                  <div className="hint-title">
                    Hint {hint.level} of {hints.length}
                  </div>
                  {/* Combined free badge and price */}
                  {!purchased && (
                    <div className="hint-price-badge">
                      {hint.free ? (
                        <span className="free-badge">FREE</span>
                      ) : (
                        <div className="price-badge">
                          <span className="price-usd">${hint.price?.toFixed(2)}</span>
                          {pingAmount && (
                            <span className="price-ping">{formatPingAmount(pingAmount)} $PING</span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {purchased ? (
                  <InvisibleInkReveal text={hintText || ''} revealed={true} />
                ) : (
                  <div className="hint-locked-content">
                    {needsPreviousHint ? (
                      <p className="hint-requirement">Unlock Hint {hint.level - 1} first</p>
                    ) : (
                      <InvisibleInkReveal text={hint.text} revealed={false} />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };


  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-wrapper">
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>

          <div className="modal-sections">
            {/* Header Section - Enhanced Messaging */}
            <div className="modal-section hint-header-section">
              <h2>Unlock the Secret</h2>
              <p className="hint-subtitle">
                Stuck? Reveal exclusive clues that guide you straight to {hotspot.prize ? `${hotspot.prize} SOL` : 'the treasure'}
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="hint-error-banner">
                {error}
              </div>
            )}

            {/* Hints Container - Slider Layout */}
            <div className="modal-section hints-container">
              {hints.length === 0 ? (
                <p className="no-hints">No hints available for this hotspot</p>
              ) : (
                renderHintCards()
              )}
            </div>

            {/* Action Buttons Section */}
            <div className="modal-section hint-actions">
              <button className="details-btn" onClick={onShowDetails}>
                PING DETAILS
              </button>
              
              {ctaText === 'CONNECT_WALLET' ? (
                <WalletMultiButton />
              ) : (
                <button
                  className={`hint-cta-btn ${nextHint && !nextHint.free ? 'paid' : 'free'}`}
                  onClick={ctaAction || undefined}
                  disabled={ctaDisabled || purchasing !== null}
                >
                  {purchasing !== null ? 'PROCESSING...' : ctaText}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
