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
          <img src="/logo/ping-logo.svg" alt="PING" className="ticket-logo" />
          <h2 className="ticket-title">CERTIFICATE OF DISCOVERY</h2>
          <div className="ticket-divider"></div>
          
          <div className="ticket-details">
            <div className="ticket-row">
              <span className="ticket-label">Claimed By:</span>
              <span className="ticket-value">{twitterHandle || 'Anonymous Hunter'}</span>
            </div>
            <div className="ticket-row">
              <span className="ticket-label">Prize Won:</span>
              <span className="ticket-value prize-highlight">{prize}</span>
            </div>
            <div className="ticket-row">
              <span className="ticket-label">Location:</span>
              <span className="ticket-value">{location}</span>
            </div>
            <div className="ticket-row">
              <span className="ticket-label">Claimed On:</span>
              <span className="ticket-value">{formatDate(claimedAt)}</span>
            </div>
          </div>

          <div className="ticket-divider"></div>
          <div className="ticket-footer">
            <span className="ticket-id">Certificate ID: {claimId.slice(0, 8).toUpperCase()}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

