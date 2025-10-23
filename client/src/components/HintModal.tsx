import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { usePingPrice } from '../hooks/usePingPrice';
import { sendHintPayment } from '../utils/solana';
import { InvisibleInkReveal } from './InvisibleInkReveal';
import './HintModal.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
// Removed REVEAL_DURATION - no longer needed with simplified logic

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
  const { settings, usdToPing, formatPingAmount, pingPrice, loading: priceLoading } = usePingPrice();
  
  const [purchasedHints, setPurchasedHints] = useState<PurchasedHints | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hotspot, setHotspot] = useState<any>(null);
  const [justPurchased, setJustPurchased] = useState<number | null>(null); // Track just-purchased hint to show it
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0); // Manual navigation control
  const [showNavigation, setShowNavigation] = useState(true); // Control navigation visibility
  const [revealingHint, setRevealingHint] = useState<number | null>(null); // Track which hint is currently revealing

  // Fetch hotspot data and purchased hints
  useEffect(() => {
    fetchHotspotAndPurchases();
  }, [hotspotId, publicKey]);

  // Debug logging for state changes
  useEffect(() => {
    console.log('🔍 Debug - Wallet connected:', connected);
    console.log('🔍 Debug - Public key:', publicKey?.toString());
    console.log('🔍 Debug - Purchased hints:', purchasedHints);
    console.log('🔍 Debug - Revealing hint:', revealingHint);
    console.log('🔍 Debug - Just purchased:', justPurchased);
  }, [connected, publicKey, purchasedHints, revealingHint, justPurchased]);


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
        console.log('🔍 API Response - Purchased hints:', data);
        
        // TEMPORARY FIX: Backend fix may not be deployed yet
        // Force hint1 to unpurchased if it's not free
        if (currentHotspot && !currentHotspot.firstHintFree && data.hint1?.purchased) {
          console.log('🔧 Backend still returning purchased=true for paid hint, fixing...');
          data.hint1 = { purchased: false };
        }
        
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
          if (!pingPrice) {
            throw new Error('$PING price is not loaded yet. Please wait a moment and try again.');
          }
          throw new Error('Unable to calculate $PING price. Please try again.');
        }

        if (!settings.pingTokenMint) {
          throw new Error('$PING token mint address not configured. Please contact support.');
        }

        if (!settings.treasuryWallet) {
          throw new Error('Treasury wallet address not configured. Please contact support.');
        }

        if (!settings.burnWallet) {
          throw new Error('Burn wallet address not configured. Please contact support.');
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

      // Update purchased hints with the new hint text immediately (but still hidden)
      setPurchasedHints((prev) => ({
        ...prev!,
        [`hint${hintLevel}`]: {
          purchased: true,
          text: result.hintText,
        },
      }));
      
      // Set just purchased to keep card visible
      setJustPurchased(hintLevel);
      setShowNavigation(false); // Hide navigation initially
      
      // Start reveal animation after purchase is processed (only for paid hints)
      if (!isFree) {
        setRevealingHint(hintLevel);
      }
      
      // Keep processing state for 2 seconds total
      setTimeout(() => {
        setPurchasing(null);
      }, 2000);
    } catch (err) {
      console.error('Purchase failed:', err);
      setError(err instanceof Error ? err.message : 'Purchase failed');
      setPurchasing(null); // Clear processing state on error
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

  // Determine which hint to show centered
  let centerIndex: number;
  if (justPurchased !== null) {
    // Keep just-purchased hint centered until user clicks "GET MORE!"
    centerIndex = hints.findIndex((h) => h.level === justPurchased);
  } else if (currentSlideIndex >= 0 && currentSlideIndex < hints.length) {
    // Use manual slide index if set
    centerIndex = currentSlideIndex;
  } else {
    // Show next unpurchased hint, or last hint if all purchased
    const currentHintIndex = hints.findIndex((h) => h === nextHint);
    centerIndex = currentHintIndex === -1 ? hints.length - 1 : currentHintIndex;
  }
  
  // Calculate how many hints are unlocked (purchased and not currently revealing)
  const unlockedCount = hints.filter((h) => 
    purchasedHints[`hint${h.level}` as keyof PurchasedHints]?.purchased && 
    revealingHint !== h.level
  ).length;
  
  // Max index user can navigate to (unlocked hints + 1 for current locked)
  const maxNavigableIndex = Math.min(unlockedCount, hints.length - 1);
  
  // Check if current centered hint needs previous hint unlocked
  const currentHint = hints[centerIndex];
  const currentHintNeedsPrevious = currentHint && currentHint.level > 1 && 
    !purchasedHints[`hint${currentHint.level - 1}` as keyof PurchasedHints]?.purchased;
  
  // Debug logging for navigation state
  console.log('🧭 Debug - Center index:', centerIndex);
  console.log('🧭 Debug - Current hint:', currentHint);
  console.log('🧭 Debug - Unlocked count:', unlockedCount);
  console.log('🧭 Debug - Current hint needs previous:', currentHintNeedsPrevious);
  console.log('🧭 Debug - Show navigation:', showNavigation);
  
  // Navigation handlers - only allow navigation within unlocked + current locked
  // BUT: disable arrows if user just purchased (must use CTA to advance first)
  const canGoBack = centerIndex > 0 && justPurchased === null && showNavigation && revealingHint === null;
  const canGoForward = centerIndex < maxNavigableIndex && 
    justPurchased === null && 
    !purchasing && 
    showNavigation && 
    revealingHint === null && 
    unlockedCount > 0 &&
    !currentHintNeedsPrevious; // Prevent navigation if current hint needs previous hint unlocked
  
  const handlePrevious = () => {
    if (canGoBack) {
      setCurrentSlideIndex(centerIndex - 1);
      setJustPurchased(null);
    }
  };
  
  const handleNext = () => {
    if (canGoForward) {
      setCurrentSlideIndex(centerIndex + 1);
      setJustPurchased(null);
    }
  };

  // Determine CTA text and action
  let ctaText = 'ALL HINTS UNLOCKED';
  let ctaAction = null;
  let ctaDisabled = true;

  if (justPurchased !== null && nextHint) {
    // Just purchased a hint, show "GET MORE!" to advance
    ctaText = 'GET MORE!';
    ctaAction = () => {
      setJustPurchased(null);
      setCurrentSlideIndex(centerIndex + 1); // Advance to next hint
    };
    ctaDisabled = false;
  } else if (purchasing !== null) {
    // Currently processing a purchase
    ctaText = 'PROCESSING...';
    ctaDisabled = true;
  } else if (nextHint) {
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
    } else if (priceLoading || !pingPrice) {
      ctaText = 'LOADING PRICE...';
      ctaDisabled = true;
    } else {
      ctaText = 'UNLOCK HINT';
      ctaAction = () => handlePurchase(nextHint.level, false);
      ctaDisabled = false;
    }
  }

  return (
    <div className="modal-overlay hint-modal-overlay" onClick={onClose}>
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

            {/* Hints Slider - Each hint is its own modal-section */}
            {hints.length === 0 ? (
              <div className="modal-section">
                <p className="no-hints">No hints available for this hotspot</p>
              </div>
            ) : (
              <div className="hints-slider-wrapper">
                {/* Navigation Arrows */}
                {canGoBack && (
                  <button className="slider-nav prev" onClick={handlePrevious} aria-label="Previous hint">
                    ‹
                  </button>
                )}
                {canGoForward && (
                  <button className="slider-nav next" onClick={handleNext} aria-label="Next hint">
                    ›
                  </button>
                )}
                
                <div className="hints-slider-track" style={{ transform: `translateX(calc(-${centerIndex * 100}% - ${centerIndex * 15}px))` }}>
                  {hints.map((hint, index) => {
                    const purchased = purchasedHints[`hint${hint.level}` as keyof PurchasedHints]?.purchased;
                    const hintText = purchasedHints[`hint${hint.level}` as keyof PurchasedHints]?.text || hint.text;
                    const pingAmount = hint.free ? 0 : (hint.price && pingPrice ? usdToPing(hint.price) : null);
                    const needsPreviousHint = hint.level > 1 && 
                      !purchasedHints[`hint${hint.level - 1}` as keyof PurchasedHints]?.purchased;
                    const isCenter = index === centerIndex; // Check if this is the centered slide

                    return (
                      <div 
                        key={hint.level} 
                        className={`modal-section hint-slide ${isCenter ? 'center' : 'side'} ${needsPreviousHint ? 'disabled' : ''}`}
                      >
                        {/* Price text floating in center */}
                        {!purchased && !revealingHint && (
                          <div className="hint-price-text">
                            {hint.free ? (
                              <span className="free-text">FREE HINT</span>
                            ) : (
                              <div className="paid-text">
                                <div className="paid-line-1">UNLOCK FOR</div>
                                <div className="paid-line-2">{formatPingAmount(pingAmount || 0)} $PING</div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Hint title at middle bottom */}
                        <div className="hint-title">
                          Hint {hint.level} of {hints.length}
                        </div>

                        {/* Hint content area - canvas renders everything */}
                        <div className="hint-content-area">
                          {/* Canvas handles both particles and text rendering */}
                          {!needsPreviousHint && (
                            <div className="hint-ink-overlay">
                              <InvisibleInkReveal 
                                text={purchased ? hintText : 'Hint will be revealed after purchase'} 
                                revealed={hint.free ? purchased : revealingHint === hint.level}
                                onRevealComplete={() => {
                                  // Animation complete - show navigation after reveal
                                  setShowNavigation(true);
                                  setRevealingHint(null); // Clear revealing state
                                }}
                              />
                            </div>
                          )}

                          {/* Requirement message for locked hints */}
                          {needsPreviousHint && (
                            <div className="hint-locked-content">
                              <p className="hint-requirement">Unlock Hint {hint.level - 1} first</p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Error Message - positioned under hints-slider-wrapper */}
            {error && (
              <div className="hint-error-banner">
                {error}
              </div>
            )}

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
