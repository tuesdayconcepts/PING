/// <reference types="vite/client" />
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl } from '@solana/web3.js';
import MapPage from './pages/MapPage';
import AdminPage from './pages/AdminPage';
import './App.css';

// Import Solana wallet adapter default styles
import '@solana/wallet-adapter-react-ui/styles.css';

function App() {
  // Solana network configuration (mainnet-beta for production)
  const network = WalletAdapterNetwork.Mainnet;
  const endpoint = useMemo(() => clusterApiUrl(network), [network]);

  // Initialize wallet adapters
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
    ],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect={false}>
        <WalletModalProvider>
          <Router>
            <Routes>
              <Route path="/" element={<MapPage />} />
              <Route path="/ping/:id" element={<MapPage />} />
              <Route path="/admin" element={<AdminPage />} />
            </Routes>
          </Router>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

export default App;
