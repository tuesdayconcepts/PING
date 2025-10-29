import './MenuSections.css';

export function TermsSection() {
  return (
    <div className="menu-section">
      <div className="menu-section-header">
        <p className="menu-section-subtitle">
          Please read these terms carefully before participating.
        </p>
      </div>
      <div className="menu-legal-content">
        <section>
          <h3>No Guarantee of Reward</h3>
          <p>
            PINGs may be claimed by others before you arrive. There is no guarantee that any 
            specific PING will be available when you reach its location. Participation does not 
            guarantee a prize.
          </p>
        </section>

        <section>
          <h3>NFC Card Required</h3>
          <p>
            You must physically find and tap the NFC card at the location to claim a PING. 
            The map marker is only an indicator of the general area. The actual NFC card must 
            be located and tapped to proceed with the claim process.
          </p>
        </section>

        <section>
          <h3>Twitter Verification</h3>
          <p>
            You must post proof of your discovery on Twitter/X as part of the claim process. 
            Claims without proper social verification will not be approved.
          </p>
        </section>

        <section>
          <h3>Admin Approval</h3>
          <p>
            All claims are subject to review and approval by PING administrators. Approval 
            decisions are final and not subject to appeal. The approval process may take 
            several minutes.
          </p>
        </section>

        <section>
          <h3>SOL Prize Terms</h3>
          <p>
            Private keys for SOL prizes are final. There are no refunds, exchanges, or 
            substitutions. Once a private key is revealed upon approval, you are responsible 
            for securing it. Lost or compromised keys cannot be recovered.
          </p>
        </section>

        <section>
          <h3>Liability Waiver</h3>
          <p>
            PING is not responsible for any injuries, travel costs, property damage, or failed 
            claims. Participation is at your own risk. You agree to hold PING harmless from any 
            claims arising from your participation.
          </p>
        </section>

        <section>
          <h3>Age Requirement</h3>
          <p>
            You must be 18 years of age or the age of majority in your jurisdiction to 
            participate. Minors are not permitted to claim prizes.
          </p>
        </section>

        <section>
          <h3>Prohibited Activities</h3>
          <p>
            The use of bots, scripts, automated tools, or any method to circumvent the physical 
            requirement of finding the NFC card is strictly prohibited. Violators will be banned 
            and may face legal action.
          </p>
        </section>

        <section>
          <h3>Property Rights</h3>
          <p>
            You must respect private property and local laws. Trespassing is prohibited. PING is 
            not responsible if accessing a location requires illegal activity.
          </p>
        </section>

        <section>
          <h3>NFC Card Condition</h3>
          <p>
            PING team is not responsible if the NFC card is damaged, moved, stolen, or missing. 
            If you cannot locate the card at the indicated area, the PING may be unavailable.
          </p>
        </section>
      </div>
    </div>
  );
}
