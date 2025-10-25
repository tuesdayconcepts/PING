import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { usePingPrice } from '../hooks/usePingPrice';
import { sendHintPayment } from '../utils/solana';
import { InvisibleInkReveal } from './InvisibleInkReveal';
import './HintModal.css';

// Mobile detection hook
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth <= 768 || 'ontouchstart' in window);
    };
    
    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);
    
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  return isMobile;
};

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

interface HintModalProps {
  hotspotId: string;
  onClose: () => void;
  onShowDetails: () => void;
}

interface HintState {
  level: number;
  text: string;
  priceUsd: number | null; // null = free
  status: 'locked' | 'unlocked' | 'processing' | 'revealed';
}

export function HintModal({ hotspotId, onClose, onShowDetails }: HintModalProps) {
  const wallet = useWallet();
  const { publicKey, connected } = wallet;
  const { settings, usdToPing, formatPingAmount } = usePingPrice();
  const isMobile = useIsMobile();

  // New state machine
  const [hints, setHints] = useState<HintState[]>([]);
  const [currentHintIndex, setCurrentHintIndex] = useState(0);
  const [walletConnected, setWalletConnected] = useState(false);
  const [hotspot, setHotspot] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCheckmark, setShowCheckmark] = useState(false);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
  const [peekDirection, setPeekDirection] = useState<'left' | 'right' | null>(null);
  const [autoPeekTriggered, setAutoPeekTriggered] = useState<Set<number>>(new Set());
  const [touchUsed, setTouchUsed] = useState(false); // Track if touch was used to prevent click

  // Track wallet connection state
  useEffect(() => {
    console.log('🔗 Wallet connection state changed:', { connected, publicKey: publicKey?.toString() });
    setWalletConnected(connected);
  }, [connected, publicKey]);

  // Auto-peek effect when hint is unlocked
  useEffect(() => {
    const currentHint = hints[currentHintIndex];
    if (currentHint?.status === 'revealed' && !autoPeekTriggered.has(currentHintIndex)) {
      // Mark as triggered
      setAutoPeekTriggered(prev => new Set(prev).add(currentHintIndex));
      
      // Show peek to next hint if available after 1 second delay
      if (currentHintIndex < hints.length - 1) {
        setTimeout(() => {
          setPeekDirection('right');
          setTimeout(() => setPeekDirection(null), 1000); // 1 second peek
        }, 1000); // 1 second delay before peek starts
      }
    }
  }, [hints, currentHintIndex, autoPeekTriggered]);

  // Reset auto-peek on modal close
  useEffect(() => {
    if (!open) {
      setAutoPeekTriggered(new Set());
      setPeekDirection(null);
    }
  }, [open]);

  // Fetch hotspot data on modal open
  useEffect(() => {
    fetchHotspotData();
  }, [hotspotId]);

  // Fetch purchased hints when wallet connects
  useEffect(() => {
    if (hotspot && walletConnected && publicKey) {
      // Small delay to ensure wallet is fully connected
      const timer = setTimeout(() => {
        fetchPurchasedHints();
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [hotspot, walletConnected, publicKey]);

  const fetchHotspotData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_URL}/api/hotspots`);
      const hotspots = await response.json();
      const currentHotspot = hotspots.find((h: any) => h.id === hotspotId);
      
      if (!currentHotspot) {
        throw new Error('Hotspot not found');
      }
      
      setHotspot(currentHotspot);

      // Initialize hints array
      const hintsArray: HintState[] = [
        { 
          level: 1, 
          text: currentHotspot.hint1, 
          priceUsd: currentHotspot.hint1PriceUsd, 
          status: 'unlocked' as const // First hint always unlocked
        },
        { 
          level: 2, 
          text: currentHotspot.hint2, 
          priceUsd: currentHotspot.hint2PriceUsd, 
          status: 'locked' as const 
        },
        { 
          level: 3, 
          text: currentHotspot.hint3, 
          priceUsd: currentHotspot.hint3PriceUsd, 
          status: 'locked' as const 
        },
      ].filter((h) => h.text); // Only show hints that exist

      setHints(hintsArray);
    } catch (err) {
      console.error('Failed to fetch hotspot data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load hotspot');
    } finally {
      setLoading(false);
    }
  };

  const fetchPurchasedHints = async () => {
    if (!publicKey) return;

    try {
      const response = await fetch(
        `${API_URL}/api/hints/${hotspotId}/purchased?wallet=${publicKey.toString()}`
      );
      const data = await response.json();

      // Update hints status based on purchased data
      setHints(prevHints => 
        prevHints.map(hint => {
          const purchased = data[`hint${hint.level}`]?.purchased;
          return {
            ...hint,
            status: purchased ? 'revealed' : hint.status
          };
        })
      );
    } catch (err) {
      console.error('Failed to fetch purchased hints:', err);
    }
  };

  const updateHintStatus = (hintLevel: number, status: HintState['status']) => {
    setHints(prevHints => 
      prevHints.map(hint => 
        hint.level === hintLevel ? { ...hint, status } : hint
      )
    );
  };

  const handleUnlock = async (hintLevel: number) => {
    const hint = hints.find(h => h.level === hintLevel);
    if (!hint) return;
    
    // Update status to processing
    updateHintStatus(hintLevel, 'processing');
    
    try {
      // If free (priceUsd === null)
      if (hint.priceUsd === null) {
        await recordFreePurchase(hintLevel);
        updateHintStatus(hintLevel, 'revealed');
        showCheckmarkAnimation();
        return;
      }
      
      // If paid
      if (!settings) {
        throw new Error('Hint system not configured');
      }
      
      const pingAmount = usdToPing(hint.priceUsd);
      if (!pingAmount) {
        throw new Error('Unable to calculate PING amount');
      }
      
      const txSignature = await sendHintPayment(
        wallet,
        settings.treasuryWallet,
        settings.burnWallet,
        pingAmount,
        settings.pingTokenMint
      );
      
      await recordPaidPurchase(hintLevel, txSignature, pingAmount);
      updateHintStatus(hintLevel, 'revealed');
      showCheckmarkAnimation();
      
    } catch (error) {
      // Revert to unlocked on error
      updateHintStatus(hintLevel, 'unlocked');
      setError(error instanceof Error ? error.message : 'Unlock failed');
    }
  };

  const recordFreePurchase = async (hintLevel: number) => {
    const response = await fetch(`${API_URL}/api/hints/purchase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hotspotId,
        walletAddress: publicKey?.toString() || 'anonymous',
        hintLevel,
        txSignature: null,
        paidAmount: 0,
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to record free purchase');
    }
  };

  const recordPaidPurchase = async (hintLevel: number, txSignature: string, paidAmount: number) => {
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
      throw new Error(data.error || 'Failed to record paid purchase');
    }
  };

  const showCheckmarkAnimation = () => {
    setShowCheckmark(true);
    setTimeout(() => setShowCheckmark(false), 2000);
  };

  // Navigation handlers
  const canGoBack = currentHintIndex > 0;
  const canGoForward = currentHintIndex < hints.length - 1;

  const handlePrevious = () => {
    if (canGoBack) setCurrentHintIndex(currentHintIndex - 1);
  };

  const handleNext = () => {
    if (canGoForward) setCurrentHintIndex(currentHintIndex + 1);
  };

  // Handle peek zone clicks (desktop only)
  const handlePeekClick = (direction: 'left' | 'right', e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (direction === 'left') {
      handlePrevious();
    } else {
      handleNext();
    }
  };

  // Calculate slider transform with peek support
  const getSliderTransform = () => {
    const baseTransform = -currentHintIndex * 100;
    const gapOffset = currentHintIndex * 15; // 15px gap between slides
    
    if (peekDirection === 'left') {
      // Peek left: move slider right to show more of previous slide
      return `translateX(calc(${baseTransform}% + 20% - ${gapOffset}px))`;
    } else if (peekDirection === 'right') {
      // Peek right: move slider left to show more of next slide
      return `translateX(calc(${baseTransform}% - 20% - ${gapOffset}px))`;
    }
    
    return `translateX(calc(${baseTransform}% - ${gapOffset}px))`;
  };

  // Touch gesture handlers for mobile swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.targetTouches[0];
    setTouchStart(touch.clientX);
    setTouchEnd(touch.clientX); // Initialize touchEnd to prevent NaN
    setTouchUsed(true); // Mark that touch was used
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const touch = e.targetTouches[0];
    setTouchEnd(touch.clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50; // Reduced threshold for easier swiping
    const isRightSwipe = distance < -50;
    
    if (isLeftSwipe && canGoForward) {
      // Swiped left - go to next hint
      handleNext();
    }
    
    if (isRightSwipe && canGoBack) {
      // Swiped right - go to previous hint
      handlePrevious();
    }
    
    // Reset values
    setTouchStart(0);
    setTouchEnd(0);
    
    // Reset touch flag after a short delay to allow click prevention
    setTimeout(() => setTouchUsed(false), 100);
  };

  // CTA Logic
  const currentHint = hints[currentHintIndex];
  let ctaText: string;
  let ctaAction: (() => void) | null;
  let ctaDisabled: boolean;

  if (!walletConnected) {
    ctaText = 'CONNECT WALLET';
    ctaAction = null; // WalletMultiButton handles this
    ctaDisabled = false;
  } else if (currentHint?.status === 'processing') {
    ctaText = 'PROCESSING...';
    ctaAction = null;
    ctaDisabled = true;
  } else if (currentHint?.status === 'locked' || currentHint?.status === 'unlocked') {
    ctaText = 'UNLOCK HINT';
    ctaAction = () => handleUnlock(currentHint.level);
    ctaDisabled = false;
  } else if (currentHint?.status === 'revealed') {
    const hasNextHint = currentHintIndex < hints.length - 1;
    if (hasNextHint) {
      const nextHint = hints[currentHintIndex + 1];
      const nextHintUnlocked = nextHint?.status === 'revealed';
      ctaText = nextHintUnlocked ? 'NEXT HINT' : 'GET MORE!';
      ctaAction = () => setCurrentHintIndex(currentHintIndex + 1);
      ctaDisabled = false;
    } else {
      ctaText = 'ALL HINTS UNLOCKED';
      ctaAction = null;
      ctaDisabled = true;
    }
  } else {
    ctaText = 'ALL HINTS UNLOCKED';
    ctaAction = null;
    ctaDisabled = true;
  }

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

  if (error) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-wrapper">
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={onClose}>
              ✕
            </button>
            <div className="modal-sections">
              <div className="modal-section">
                <div className="hint-error-banner">{error}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!hotspot || hints.length === 0) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-wrapper">
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={onClose}>
              ✕
            </button>
            <div className="modal-sections">
              <div className="modal-section">
                <div className="hint-error-banner">No hints available for this hotspot</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay hint-modal-overlay" onClick={onClose}>
      <div className="modal-wrapper">
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>

          <div className="modal-sections">
            {/* Header Section */}
            <div className="modal-section hint-header-section">
              <h2>Unlock the Secret</h2>
              <p className="hint-subtitle">
                Stuck? Reveal exclusive clues that guide you straight to {hotspot.prize ? `${hotspot.prize} SOL` : 'the treasure'}
              </p>
            </div>

            {/* Hints Slider */}
            <div 
              className="hints-slider-wrapper"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onTouchCancel={() => {
                // Reset on touch cancel to prevent stuck state
                setTouchStart(0);
                setTouchEnd(0);
                setTouchUsed(false);
              }}
            >
              {/* Left peek zone - only show on desktop if there's a previous slide */}
              {!isMobile && canGoBack && currentHintIndex > 0 && (
                <div 
                  className="peek-zone left"
                  onMouseEnter={() => setPeekDirection('left')}
                  onMouseLeave={() => setPeekDirection(null)}
                  onClick={(e) => handlePeekClick('left', e)}
                />
              )}
              
              {/* Right peek zone - only show on desktop if there's a next slide */}
              {!isMobile && canGoForward && currentHintIndex < hints.length - 1 && (
                <div 
                  className="peek-zone right"
                  onMouseEnter={() => setPeekDirection('right')}
                  onMouseLeave={() => setPeekDirection(null)}
                  onClick={(e) => handlePeekClick('right', e)}
                />
              )}
              
              <div className="hints-slider-track" style={{ transform: getSliderTransform() }}>
                {hints.map((hint, index) => {
                  const isCenter = index === currentHintIndex;
                  const revealed = hint.status === 'revealed';
                  
                  return (
                    <div key={hint.level} className={`modal-section hint-slide ${isCenter ? 'center' : 'side'}`}>
                      {/* Price badge (only show if not revealed) */}
                      {!revealed && (
                        <div className="hint-price-text">
                          {hint.priceUsd === null ? (
                            <div className="free-text">FREE</div>
                          ) : (
                            <div className="paid-text">
                              <div className="paid-line-1">UNLOCK FOR</div>
                              <div className="paid-line-2">{formatPingAmount(usdToPing(hint.priceUsd) || 0)} $PING</div>
                              <div className="paid-line-3">USD ${hint.priceUsd.toFixed(2)}</div>
                            </div>
                          )}
                        </div>
                      )}


                      {/* Hint content area */}
                      <div className="hint-content-area">
                        <div className="hint-ink-overlay">
                          <InvisibleInkReveal
                            text={revealed ? hint.text : `Hint ${hint.level}`}
                            revealed={revealed}
                            onRevealComplete={() => {
                              // Animation complete - no state change needed, already marked as revealed
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>


            {/* Error Message */}
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
              
              {ctaText === 'CONNECT WALLET' ? (
                <WalletMultiButton />
              ) : (
                <button
                  className={`hint-cta-btn ${currentHint?.priceUsd === null ? 'free' : 'paid'}`}
                  onClick={ctaAction || undefined}
                  disabled={ctaDisabled}
                >
                  {showCheckmark ? '✓' : ctaText}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}