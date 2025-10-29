import { MapPin, Navigation, CreditCard, Award } from 'lucide-react';
import './MenuSections.css';

export function HowItWorksSection() {
  const steps = [
    {
      icon: MapPin,
      title: 'Explore Active PINGs',
      description: 'Browse the map. Click a marker to see prize details.',
    },
    {
      icon: Navigation,
      title: 'Navigate & Hunt',
      description: 'Get directions to the area. Hunt for the hidden NFC card. Buy hints with $PING if you need help.',
    },
    {
      icon: CreditCard,
      title: 'Tap & Claim',
      description: 'Found the card? Tap it to unlock. Tweet your discovery and wait for approval.',
    },
    {
      icon: Award,
      title: 'Collect & Share',
      description: 'Add the private key to your wallet. Get your certificate and show off your win.',
    },
  ];

  return (
    <div className="menu-section">
      <div className="menu-section-header">
        <p className="menu-section-subtitle">
          From map to prize in simple steps. Ready to hunt?
        </p>
      </div>

      <div className="menu-steps-container">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <div key={index} className="menu-step-card">
              <div className="menu-step-number">{index + 1}</div>
              <div className="menu-step-icon">
                <Icon size={28} />
              </div>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
