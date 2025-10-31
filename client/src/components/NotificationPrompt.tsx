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
      if (permission === 'granted') {
        const registration = await registerServiceWorker();
        if (registration) {
          await subscribeToPush(registration, userType, userId);
          showToast('Notifications enabled!', 'success');
        }
      } else {
        showToast('Notification permission denied', 'error');
      }
      setShowPrompt(false);
      if (onDismiss) onDismiss();
    } catch (error) {
      console.error('[Push] Error enabling notifications:', error);
      showToast('Failed to enable notifications', 'error');
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
    <div className="notification-prompt-overlay">
      <div className="notification-prompt">
        <div className="notification-prompt-header">
          <h3>Enable Notifications</h3>
          <button className="notification-prompt-close" onClick={handleLater}>×</button>
        </div>
        <div className="notification-prompt-body">
          <p>
            {userType === 'user' 
              ? 'Get notified when new PINGs are available!'
              : 'Get notified when claims need approval and other admin events.'}
          </p>
        </div>
        <div className="notification-prompt-actions">
          <button 
            className="notification-prompt-later" 
            onClick={handleLater}
            disabled={isRequesting}
          >
            Do it later
          </button>
          <button 
            className="notification-prompt-enable" 
            onClick={handleEnable}
            disabled={isRequesting}
          >
            {isRequesting ? 'Enabling...' : 'Enable Notifications'}
          </button>
        </div>
      </div>
    </div>
  );
};

