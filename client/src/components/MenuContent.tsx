import { useState } from 'react';
import { AboutSection } from './menu/AboutSection';
import { HowItWorksSection } from './menu/HowItWorksSection';
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
    setExpanded((prev) => {
      // If clicking the same item, toggle it; otherwise close all and open the clicked one
      if (prev[key]) {
        // Close if already open
        return { ...prev, [key]: false };
      } else {
        // Close all others and open the clicked one
        return {
          about: false,
          'how-it-works': false,
          terms: false,
          privacy: false,
          [key]: true,
        };
      }
    });
  };

  // Build social links array
  const socialLinks = [];
  if (socialSettings.pumpFunEnabled && socialSettings.pumpFunUrl) {
    socialLinks.push({
      name: 'Pump.fun',
      url: socialSettings.pumpFunUrl,
      icon: '🚀',
    });
  }
  if (socialSettings.xEnabled && socialSettings.xUsername) {
    socialLinks.push({
      name: 'X',
      url: `https://x.com/${socialSettings.xUsername}`,
      icon: '𝕏',
    });
  }
  if (socialSettings.instagramEnabled && socialSettings.instagramUsername) {
    socialLinks.push({
      name: 'Instagram',
      url: `https://instagram.com/${socialSettings.instagramUsername}`,
      icon: '📷',
    });
  }
  if (socialSettings.tiktokEnabled && socialSettings.tiktokUsername) {
    socialLinks.push({
      name: 'TikTok',
      url: `https://tiktok.com/@${socialSettings.tiktokUsername}`,
      icon: '🎵',
    });
  }

  return (
    <div className="menu-overlay-content">
      <div className="menu-main-menu">
        {/* Main accordion nav - only About and How It Works */}
        {!expanded['terms'] && !expanded['privacy'] && (
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
            </div>
          </nav>
        )}

        {/* Legal nav - Terms and Privacy get their own nav area */}
        {(expanded['terms'] || expanded['privacy']) && (
          <nav className="menu-nav-legal">
            <div className="menu-accordion">
              {expanded['terms'] && (
                <div className="menu-accordion-item open">
                  <button className="menu-item" onClick={() => toggle('terms')}>Terms of Use</button>
                  <div className="menu-accordion-content">
                    <TermsSection />
                  </div>
                </div>
              )}

              {expanded['privacy'] && (
                <div className="menu-accordion-item open">
                  <button className="menu-item" onClick={() => toggle('privacy')}>Privacy Policy</button>
                  <div className="menu-accordion-content">
                    <PrivacySection />
                  </div>
                </div>
              )}
            </div>
          </nav>
        )}

        {/* Footer with socials, terms, and privacy - always visible at the bottom */}
        <div className="menu-social-footer">
          {socialLinks.length > 0 && (
            <div className="menu-social-links">
              {socialLinks.map((link, index) => (
                <a
                  key={index}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="menu-social-link"
                >
                  <span className="menu-social-icon">{link.icon}</span>
                  <span>{link.name}</span>
                </a>
              ))}
            </div>
          )}
          <div className="menu-footer-links">
            <button 
              className="menu-footer-link"
              onClick={() => toggle('terms')}
            >
              Terms of Use
            </button>
            <button 
              className="menu-footer-link"
              onClick={() => toggle('privacy')}
            >
              Privacy Policy
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
