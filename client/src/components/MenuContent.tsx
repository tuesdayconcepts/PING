import { useState } from 'react';
import { X } from 'lucide-react';
import { AboutSection } from './menu/AboutSection';
import { HowItWorksSection } from './menu/HowItWorksSection';
import { SocialSection } from './menu/SocialSection';
import { TermsSection } from './menu/TermsSection';
import { PrivacySection } from './menu/PrivacySection';
import './MenuContent.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export type MenuSection = 'about' | 'how-it-works' | 'social' | 'terms' | 'privacy' | null;

interface MenuContentProps {
  socialSettings: {
    pumpFunUrl: string;
    pumpFunEnabled: boolean;
    xUsername: string;
    xEnabled: boolean;
    instagramUsername: string;
    instagramEnabled: boolean;
    tiktokUsername: string;
    tiktokEnabled: boolean;
  };
  onClose: () => void;
}

export function MenuContent({ socialSettings, onClose }: MenuContentProps) {
  const [activeSection, setActiveSection] = useState<MenuSection>(null);

  const handleSectionClick = (section: MenuSection) => {
    setActiveSection(section);
  };

  const handleBack = () => {
    setActiveSection(null);
  };

  // Main menu items
  if (!activeSection) {
    return (
      <div className="menu-overlay-content">
        <div className="menu-main-menu">
          <button className="menu-close-btn" onClick={onClose} aria-label="Close menu">
            <X size={24} />
          </button>
          
          <h2 className="menu-title">PING</h2>
          
          <nav className="menu-nav">
            <button 
              className="menu-item"
              onClick={() => handleSectionClick('about')}
            >
              About Us
            </button>
            <button 
              className="menu-item"
              onClick={() => handleSectionClick('how-it-works')}
            >
              How It Works
            </button>
            <button 
              className="menu-item"
              onClick={() => handleSectionClick('social')}
            >
              Social
            </button>
            <button 
              className="menu-item"
              onClick={() => handleSectionClick('terms')}
            >
              Terms of Use
            </button>
            <button 
              className="menu-item"
              onClick={() => handleSectionClick('privacy')}
            >
              Privacy Policy
            </button>
          </nav>
        </div>
      </div>
    );
  }

  // Section content
  return (
    <div className="menu-overlay-content">
      <div className="menu-content-panel">
        <button className="menu-back-btn" onClick={handleBack}>
          ← Back
        </button>
        
        {activeSection === 'about' && <AboutSection />}
        {activeSection === 'how-it-works' && <HowItWorksSection />}
        {activeSection === 'social' && <SocialSection socialSettings={socialSettings} />}
        {activeSection === 'terms' && <TermsSection />}
        {activeSection === 'privacy' && <PrivacySection />}
      </div>
    </div>
  );
}
