/// <reference types="vite/client" />
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useMemo, useEffect } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl } from '@solana/web3.js';
import MapPage from './pages/MapPage';
import AdminPage from './pages/AdminPage';
import LoadingPreview from './pages/LoadingPreview';
import { ToastProvider } from './components/Toast';
import './App.css';

// Import Solana wallet adapter default styles
import '@solana/wallet-adapter-react-ui/styles.css';

// Component to handle iOS PWA path restoration
function PWAPathHandler() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Detect if app is in standalone mode (launched from home screen)
    const isStandalone = 
      (window.navigator as any).standalone === true ||
      window.matchMedia('(display-mode: standalone)').matches;

    // If in standalone mode and at root, check for stored path
    if (isStandalone && location.pathname === '/') {
      const storedPath = sessionStorage.getItem('pwa_last_path');
      if (storedPath && storedPath !== '/') {
        // Restore the stored path
        navigate(storedPath, { replace: true });
        return;
      }
    }

    // Always store current path (if not root) for future home screen launches
    if (location.pathname !== '/') {
      sessionStorage.setItem('pwa_last_path', location.pathname + location.search);
    }
  }, [location.pathname, navigate]);

  return null;
}

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
      <WalletProvider wallets={wallets} autoConnect={true}>
        <WalletModalProvider>
          <ToastProvider>
            <Router>
              <PWAPathHandler />
              <Routes>
                <Route path="/" element={<MapPage />} />
                <Route path="/ping/:id" element={<MapPage />} />
                <Route path="/share/:shareToken" element={<MapPage />} />
                <Route path="/admin" element={<AdminPage />} />
                <Route path="/loading-preview" element={<LoadingPreview />} />
              </Routes>
            </Router>
          </ToastProvider>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

export default App;
