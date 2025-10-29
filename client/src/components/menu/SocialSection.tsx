import { ExternalLink } from 'lucide-react';
import './MenuSections.css';

interface SocialSectionProps {
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

export function SocialSection({ socialSettings }: SocialSectionProps) {
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
      name: 'X (Twitter)',
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

  if (socialLinks.length === 0) {
    return (
      <div className="menu-section">
        <div className="menu-section-header">
          <h2>Social Links</h2>
          <p className="menu-section-subtitle">
            No social links configured at this time.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="menu-section">
      <div className="menu-section-header">
        <h2>Social Links</h2>
        <p className="menu-section-subtitle">
          Connect with PING on social media.
        </p>
      </div>

      <div className="menu-social-grid">
        {socialLinks.map((link, index) => (
          <a
            key={index}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="menu-social-card"
          >
            <span className="menu-social-icon">{link.icon}</span>
            <span className="menu-social-name">{link.name}</span>
            <ExternalLink size={18} className="menu-social-external" />
          </a>
        ))}
      </div>
    </div>
  );
}
