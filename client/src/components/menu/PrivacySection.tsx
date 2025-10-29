import './MenuSections.css';

export function PrivacySection() {
  return (
    <div className="menu-section">
      <div className="menu-section-header">
        <p className="menu-section-subtitle">
          Your privacy matters. Here's how we handle your data.
        </p>
      </div>
      <div className="menu-legal-content">
        <section>
          <h3>Location Data</h3>
          <p>
            Location data is only collected when you explicitly enable map directions. This 
            data is used solely to calculate routes and ETAs. Location data is not stored 
            on our servers and is only used locally in your browser.
          </p>
        </section>

        <section>
          <h3>Claim Data</h3>
          <p>
            When you claim a PING, we store the Twitter/X URL you provide for verification 
            purposes. This is required to verify your claim and prevent fraud.
          </p>
        </section>

        <section>
          <h3>Wallet Addresses</h3>
          <p>
            We only interact with your public Solana wallet address when you connect your 
            wallet. We never have access to your private keys. Private keys for prizes are 
            encrypted with AES-256-CBC and stored securely.
          </p>
        </section>

        <section>
          <h3>Session Storage</h3>
          <p>
            Claim sessions are stored locally in your browser's localStorage to allow you 
            to return to the page after refreshing. You can clear this data at any time 
            through your browser settings.
          </p>
        </section>

        <section>
          <h3>No Personal Data</h3>
          <p>
            We do not require accounts, email addresses, or any personal identifying 
            information to use PING. Participation is anonymous.
          </p>
        </section>

        <section>
          <h3>Third-Party Services</h3>
          <p>
            We use third-party services including Twitter for verification, Solana RPC 
            providers for blockchain interactions, and Google Maps for location services. 
            Please review their respective privacy policies.
          </p>
        </section>

        <section>
          <h3>Data Security</h3>
          <p>
            All sensitive data, including encrypted private keys, is protected using industry 
            standard encryption (AES-256-CBC). We take security seriously.
          </p>
        </section>

        <section>
          <h3>Your Rights</h3>
          <p>
            You can clear your local storage at any time. Since we don't collect personal 
            information, there is no account to delete. Simply clear your browser data.
          </p>
        </section>
      </div>
    </div>
  );
}
