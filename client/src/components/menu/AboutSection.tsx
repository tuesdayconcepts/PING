import { useEffect, useState } from 'react';
import { MapPin, Gift, HelpCircle, Award } from 'lucide-react';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import './MenuSections.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
const SOLANA_RPC = import.meta.env.VITE_SOLANA_RPC_URL;

interface WalletStats {
  treasuryBalance: number | null;
  burnBalance: number | null;
}

export function AboutSection() {
  const [walletStats, setWalletStats] = useState<WalletStats>({
    treasuryBalance: null,
    burnBalance: null,
  });

  useEffect(() => {
    const fetchWalletBalances = async () => {
      try {
        // Fetch settings to get wallet addresses
        const settingsRes = await fetch(`${API_URL}/api/hints/settings`);
        const settings = await settingsRes.json();
        
        if (!settings.treasuryWallet || !settings.burnWallet || !SOLANA_RPC) {
          return;
        }

        const connection = new Connection(SOLANA_RPC, 'confirmed');
        
        // Fetch SOL balances
        const treasuryPubkey = new PublicKey(settings.treasuryWallet);
        const burnPubkey = new PublicKey(settings.burnWallet);
        
        const [treasuryBalance, burnBalance] = await Promise.all([
          connection.getBalance(treasuryPubkey),
          connection.getBalance(burnPubkey),
        ]);

        setWalletStats({
          treasuryBalance: treasuryBalance / LAMPORTS_PER_SOL,
          burnBalance: burnBalance / LAMPORTS_PER_SOL,
        });
      } catch (err) {
        console.error('Failed to fetch wallet balances:', err);
      }
    };

    fetchWalletBalances();
  }, []);

  return (
    <div className="menu-section">
      <div className="menu-section-header">
        <p className="menu-section-subtitle">
          Ping is the world's first real world, NFC-powered crypto scavenger hunt. Find hidden locations, claim SOL, and join the digital treasure hunt revolution!
        </p>
      </div>

      {/* Stats Section */}
      <div className="menu-stats-grid">
        {(walletStats.treasuryBalance !== null || walletStats.burnBalance !== null) && (
          <>
            {walletStats.treasuryBalance !== null && (
              <div className="menu-stat-card">
                <div className="menu-stat-label">Treasury Wallet</div>
                <div className="menu-stat-value">
                  {walletStats.treasuryBalance.toFixed(2)} SOL
                </div>
              </div>
            )}
            {walletStats.burnBalance !== null && (
              <div className="menu-stat-card">
                <div className="menu-stat-label">Burn Wallet</div>
                <div className="menu-stat-value">
                  {walletStats.burnBalance.toFixed(2)} SOL
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Feature Cards */}
      <div className="menu-features-grid">
        <div className="menu-feature-card">
          <div className="menu-feature-icon">
            <MapPin size={32} />
          </div>
          <h3>Map Exploration</h3>
          <p>Browse active hunts on the map. Each marker hides a treasure.</p>
        </div>

        <div className="menu-feature-card">
          <div className="menu-feature-icon">
            <Gift size={32} />
          </div>
          <h3>Physical NFC Cards</h3>
          <p>PING team hides NFC cards at secret locations. Find it, tap it, claim your prize.</p>
        </div>

        <div className="menu-feature-card">
          <div className="menu-feature-icon">
            <Award size={32} />
          </div>
          <h3>Crypto Prizes</h3>
          <p>Every PING contains real SOL. Find them. Win them. Keep them.</p>
        </div>

        <div className="menu-feature-card">
          <div className="menu-feature-icon">
            <HelpCircle size={32} />
          </div>
          <h3>Progressive Hints</h3>
          <p>Stuck? Buy hints with $PING. Each hint gets you closer.</p>
        </div>

        <div className="menu-feature-card">
          <div className="menu-feature-icon">
            <Award size={32} />
          </div>
          <h3>Certificate of Victory</h3>
          <p>Earn your golden certificate. Share your win and prove you found it first.</p>
        </div>
      </div>
    </div>
  );
}
