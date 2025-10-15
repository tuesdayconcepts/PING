import React from 'react';
import './GoldenTicket.css';

interface GoldenTicketProps {
  claimedAt: string;
  prize: string;
  location: string;
  claimId: string;
  twitterHandle?: string;
}

export const GoldenTicket: React.FC<GoldenTicketProps> = ({
  claimedAt,
  prize,
  location,
  claimId,
  twitterHandle
}) => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="golden-ticket" id="golden-ticket-canvas">
      <div className="ticket-border">
        <div className="ticket-content">
          {/* PING Logo Section */}
          <div className="ticket-logo-section">
            <img src="/logo/ping-logo.svg" alt="PING" className="ticket-logo" />
            <div className="ticket-logo-text">PING</div>
          </div>

          {/* Title Section */}
          <div className="ticket-title-section">
            <h2 className="ticket-title">PROOF OF CLAIM</h2>
          </div>

          {/* Claim Details Section */}
          <div className="ticket-details">
            <div className="ticket-row">
              <span className="ticket-icon">👤</span>
              <span className="ticket-label">CLAIMANT:</span>
              <span className="ticket-value">{twitterHandle || 'Anonymous Hunter'}</span>
            </div>
            <div className="ticket-row">
              <span className="ticket-icon">📅</span>
              <span className="ticket-label">DATE:</span>
              <span className="ticket-value">{formatDate(claimedAt).split(' ')[0]}</span>
            </div>
            <div className="ticket-row">
              <span className="ticket-icon">📍</span>
              <span className="ticket-label">LOCATION:</span>
              <span className="ticket-value">{location}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

