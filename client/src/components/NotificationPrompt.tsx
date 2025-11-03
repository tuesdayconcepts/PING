import { useState, useEffect } from 'react';
import { isIOSStandalone, isNotificationSupported, getNotificationPermission, requestNotificationPermission, registerServiceWorker, subscribeToPush } from '../utils/pushNotifications';
import { useToast } from './Toast';
import './NotificationPrompt.css';

interface NotificationPromptProps {
  userType: 'user' | 'admin';
  userId?: string; // Admin ID if admin type
  onDismiss?: () => void;
}

export const NotificationPrompt: React.FC<NotificationPromptProps> = ({ userType, userId, onDismiss }) => {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    // Check if we should show the prompt
    const shouldShow = async () => {
      if (!isNotificationSupported()) {
        return false;
      }

      const permission = getNotificationPermission();
      if (permission !== 'default') {
        return false; // Already granted or denied
      }

      // Check localStorage for "do it later" flag
      const laterFlag = localStorage.getItem(`notification-prompt-later-${userType}`);
      if (laterFlag) {
        const timestamp = parseInt(laterFlag, 10);
        const hoursSince = (Date.now() - timestamp) / (1000 * 60 * 60);
        if (hoursSince < 24) {
          return false; // Don't show if dismissed less than 24 hours ago
        }
      }

      // For iOS users, only show in PWA mode
      if (userType === 'user') {
        const isIOS = isIOSStandalone();
        if (!isIOS) {
          // Android/regular browser - show on page load
          return true;
        }
        // iOS - only show in standalone mode
        return isIOS;
      }

      // Admin - show on page load
      return true;
    };

    shouldShow().then((show) => {
      setShowPrompt(show);
    });
  }, [userType]);

  const handleEnable = async () => {
    setIsRequesting(true);
    try {
      const permission = await requestNotificationPermission();
      console.log('[Push] Permission result:', permission);
      
      // Re-check permission status after request (some browsers may have async issues)
      const currentPermission = getNotificationPermission();
      console.log('[Push] Current permission status:', currentPermission);
      
      if (permission === 'granted' || currentPermission === 'granted') {
        const registration = await registerServiceWorker();
        if (!registration) {
          console.error('[Push] Service worker registration failed');
          showToast('Failed to register service worker. Please try again.', 'error');
          setIsRequesting(false);
          return;
        }
        
        const subscription = await subscribeToPush(registration, userType, userId);
        if (!subscription) {
          console.error('[Push] Failed to subscribe to push notifications');
          showToast('Failed to subscribe to notifications. Please try again.', 'error');
          setIsRequesting(false);
          return;
        }
        
        showToast('Notifications enabled!', 'success');
        setShowPrompt(false);
        if (onDismiss) onDismiss();
      } else if (permission === 'denied' || currentPermission === 'denied') {
        // Only show error if explicitly denied
        showToast('Notification permission denied', 'error');
        setShowPrompt(false);
        if (onDismiss) onDismiss();
      } else {
        // Permission is 'default' - user dismissed dialog, don't show error
        // Just close the prompt silently
        setShowPrompt(false);
        if (onDismiss) onDismiss();
      }
    } catch (error) {
      console.error('[Push] Error enabling notifications:', error);
      showToast('Failed to enable notifications', 'error');
      setShowPrompt(false);
      if (onDismiss) onDismiss();
    } finally {
      setIsRequesting(false);
    }
  };

  const handleLater = () => {
    // Store timestamp in localStorage
    localStorage.setItem(`notification-prompt-later-${userType}`, Date.now().toString());
    setShowPrompt(false);
    if (onDismiss) onDismiss();
  };

  if (!showPrompt) return null;

  return (
    <div className="notification-prompt-overlay" onClick={handleLater}>
      <div className="notification-prompt" onClick={(e) => e.stopPropagation()}>
        {/* Close button - positioned absolutely */}
        <button className="notification-prompt-close" onClick={handleLater}>✕</button>
        
        <div className="notification-prompt-sections">
          {/* Combined Header and Body section */}
          <div className="notification-prompt-header-section">
            <h3>ENABLE ALERTS</h3>
            <p>
              Get push notifications when pings are claimed, treasury wallet runs low on funds, and other time sensitive events.
            </p>
          </div>
          
          {/* Actions section */}
          <div className="notification-prompt-actions">
            <button 
              className="notification-prompt-enable" 
              onClick={handleEnable}
              disabled={isRequesting}
            >
              {isRequesting ? 'Enabling...' : 'ENABLE ALERTS'}
            </button>
            <button 
              className="notification-prompt-later" 
              onClick={handleLater}
              disabled={isRequesting}
            >
              LATER
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

