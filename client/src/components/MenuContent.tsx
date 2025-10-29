import { useState } from 'react';
import { AboutSection } from './menu/AboutSection';
import { HowItWorksSection } from './menu/HowItWorksSection';
import { SocialSection } from './menu/SocialSection';
import { TermsSection } from './menu/TermsSection';
import { PrivacySection } from './menu/PrivacySection';
import './MenuContent.css';

export type MenuSection = 'about' | 'how-it-works' | 'terms' | 'privacy';

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
}

export function MenuContent({ socialSettings }: MenuContentProps) {
  // Accordion expanded state; About expanded by default
  const [expanded, setExpanded] = useState<Record<MenuSection, boolean>>({
    about: true,
    'how-it-works': false,
    terms: false,
    privacy: false,
  });

  const toggle = (key: MenuSection) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="menu-overlay-content">
      <div className="menu-main-menu">
        <nav className="menu-nav">
          <div className="menu-accordion">
            <div className={`menu-accordion-item ${expanded['about'] ? 'open' : ''}`}>
              <button className="menu-item" onClick={() => toggle('about')}>About Us</button>
              {expanded['about'] && (
                <div className="menu-accordion-content">
                  <AboutSection />
                </div>
              )}
            </div>

            <div className={`menu-accordion-item ${expanded['how-it-works'] ? 'open' : ''}`}>
              <button className="menu-item" onClick={() => toggle('how-it-works')}>How It Works</button>
              {expanded['how-it-works'] && (
                <div className="menu-accordion-content">
                  <HowItWorksSection />
                </div>
              )}
            </div>

            <div className={`menu-accordion-item ${expanded['terms'] ? 'open' : ''}`}>
              <button className="menu-item" onClick={() => toggle('terms')}>Terms of Use</button>
              {expanded['terms'] && (
                <div className="menu-accordion-content">
                  <TermsSection />
                </div>
              )}
            </div>

            <div className={`menu-accordion-item ${expanded['privacy'] ? 'open' : ''}`}>
              <button className="menu-item" onClick={() => toggle('privacy')}>Privacy Policy</button>
              {expanded['privacy'] && (
                <div className="menu-accordion-content">
                  <PrivacySection />
                </div>
              )}
            </div>
          </div>
        </nav>

        {/* Socials footer - always visible at the bottom */}
        <div className="menu-social-footer">
          <SocialSection socialSettings={socialSettings} />
        </div>
      </div>
    </div>
  );
}
