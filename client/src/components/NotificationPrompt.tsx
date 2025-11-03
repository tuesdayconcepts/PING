import { useState, useEffect } from 'react';
import { isIOSStandalone, isNotificationSupported, getNotificationPermission, requestNotificationPermission, registerServiceWorker, subscribeToPush } from '../utils/pushNotifications';
import { useToast } from './Toast';
import './NotificationPrompt.css';

// Note: Incognito mode detection is unreliable across browsers.
// We detect potential incognito mode by checking if permission goes from 'default' 
// to 'denied' immediately without user interaction (Chrome incognito auto-denies notifications).

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
      console.log('[Push] Initial permission check:', permission);
      
      // Don't show if already granted or explicitly denied
      if (permission === 'granted') {
        console.log('[Push] Permission already granted, not showing prompt');
        return false;
      }
      
      if (permission === 'denied') {
        console.log('[Push] Permission already denied, not showing prompt');
        return false;
      }

      // Permission must be 'default' to show prompt
      if (permission !== 'default') {
        return false;
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
      // Note: We'll detect potential incognito mode based on permission behavior
      
      // Check current permission status IMMEDIATELY before requesting (Chrome can be quirky)
      const currentPermissionBefore = getNotificationPermission();
      console.log('[Push] Permission status before request:', currentPermissionBefore);
      
      // If permission is already denied, inform user they need to enable it in browser settings
      if (currentPermissionBefore === 'denied') {
        showToast('Notification permission is blocked. Please enable it in your browser settings and try again. If you\'re in incognito mode, notifications may not be available.', 'error');
        setIsRequesting(false);
        return;
      }
      
      // If permission is already granted, just subscribe (don't request again)
      if (currentPermissionBefore === 'granted') {
        let registration: ServiceWorkerRegistration | null = null;
        try {
          registration = await navigator.serviceWorker.ready;
        } catch (swError) {
          registration = await registerServiceWorker();
        }
        
        if (registration) {
          const subscription = await subscribeToPush(registration, userType, userId);
          if (subscription) {
            showToast('Notifications enabled!', 'success');
            setShowPrompt(false);
            if (onDismiss) onDismiss();
            setIsRequesting(false);
            return;
          }
        }
      }
      
      // Wait for service worker to be ready before requesting permission
      let registration: ServiceWorkerRegistration | null = null;
      try {
        // Check if service worker is already registered
        if ('serviceWorker' in navigator) {
          registration = await navigator.serviceWorker.ready;
        } else {
          // Register service worker first
          registration = await registerServiceWorker();
        }
      } catch (swError) {
        console.warn('[Push] Service worker not ready, attempting registration:', swError);
        registration = await registerServiceWorker();
      }
      
      if (!registration) {
        console.error('[Push] Service worker registration failed');
        showToast('Failed to register service worker. Please refresh the page and try again.', 'error');
        setIsRequesting(false);
        return;
      }
      
      // Small delay to ensure we're in user gesture context (Chrome requirement)
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Double-check permission hasn't changed (Chrome can be quirky)
      const permissionCheck = getNotificationPermission();
      if (permissionCheck === 'denied') {
        showToast('Notification permission is blocked. Please enable it in your browser settings.', 'error');
        setIsRequesting(false);
        return;
      }
      
      // Now request permission (must be called in response to user gesture)
      const permission = await requestNotificationPermission();
      console.log('[Push] Permission result:', permission);
      
      // Re-check permission status after request (some browsers may have async issues)
      const currentPermission = getNotificationPermission();
      console.log('[Push] Current permission status:', currentPermission);
      
      // Handle granted permission
      if (permission === 'granted' || currentPermission === 'granted') {
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
        // Permission was denied - check if it was immediately denied (possible incognito)
        const immediatelyDenied = currentPermissionBefore === 'default' && (permission === 'denied' || currentPermission === 'denied');
        
        if (immediatelyDenied) {
          // If permission was 'default' but immediately became 'denied' without user interaction,
          // it's likely incognito mode or browser auto-blocking
          showToast('Notification permission was blocked. If you\'re in incognito mode, notifications may not be available. Please try in a regular browser window.', 'error');
        } else if (currentPermissionBefore === 'default') {
          // This is a new denial after user interaction - user just denied it
          showToast('Notification permission denied. You can enable it later in your browser settings.', 'error');
        } else {
          // Was already denied before
          showToast('Notification permission is blocked. Please enable it in your browser settings.', 'error');
        }
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

