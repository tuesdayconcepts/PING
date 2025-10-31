// Push notification utilities for PWA
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

// Check if app is running in iOS standalone mode (PWA)
export const isIOSStandalone = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  // Check for iOS standalone mode
  const isStandalone = (window.navigator as any).standalone === true;
  const isDisplayModeStandalone = window.matchMedia('(display-mode: standalone)').matches;
  
  return isStandalone || isDisplayModeStandalone;
};

// Check if app is running in Android standalone mode
export const isAndroidStandalone = (): boolean => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches && !isIOSStandalone();
};

// Check if notifications are supported
export const isNotificationSupported = (): boolean => {
  if (typeof window === 'undefined') return false;
  return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
};

// Get current notification permission status
export const getNotificationPermission = (): NotificationPermission => {
  if (!isNotificationSupported()) return 'denied';
  return Notification.permission;
};

// Request notification permission
export const requestNotificationPermission = async (): Promise<NotificationPermission> => {
  if (!isNotificationSupported()) {
    throw new Error('Notifications are not supported in this browser');
  }
  
  const permission = await Notification.requestPermission();
  return permission;
};

// Register service worker
export const registerServiceWorker = async (): Promise<ServiceWorkerRegistration | null> => {
  if (!('serviceWorker' in navigator)) {
    console.warn('[Push] Service workers are not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });
    
    console.log('[Push] Service Worker registered:', registration.scope);
    
    // Wait for service worker to be ready
    await navigator.serviceWorker.ready;
    
    return registration;
  } catch (error) {
    console.error('[Push] Service Worker registration failed:', error);
    return null;
  }
};

// Get VAPID public key from backend
export const getVapidPublicKey = async (): Promise<string | null> => {
  try {
    const response = await fetch(`${API_URL}/api/push/vapid-public-key`);
    if (!response.ok) {
      throw new Error('Failed to get VAPID public key');
    }
    const data = await response.json();
    return data.publicKey || null;
  } catch (error) {
    console.error('[Push] Error getting VAPID public key:', error);
    return null;
  }
};

// Subscribe to push notifications
export const subscribeToPush = async (
  registration: ServiceWorkerRegistration,
  userType: 'user' | 'admin',
  userId?: string
): Promise<PushSubscription | null> => {
  try {
    // Get VAPID public key
    const vapidPublicKey = await getVapidPublicKey();
    if (!vapidPublicKey) {
      throw new Error('VAPID public key not available');
    }

    // Convert VAPID key to Uint8Array
    const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);

    // Subscribe to push notifications
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });

    // Send subscription to backend
    const subscriptionData = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: arrayBufferToBase64(subscription.getKey('p256dh')!),
        auth: arrayBufferToBase64(subscription.getKey('auth')!),
      },
      userType,
      userId: userId || null,
    };

    const response = await fetch(`${API_URL}/api/push/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subscriptionData),
    });

    if (!response.ok) {
      throw new Error('Failed to register subscription');
    }

    console.log('[Push] Successfully subscribed to push notifications');
    return subscription;
  } catch (error) {
    console.error('[Push] Error subscribing to push notifications:', error);
    return null;
  }
};

// Unsubscribe from push notifications
export const unsubscribeFromPush = async (
  registration: ServiceWorkerRegistration
): Promise<boolean> => {
  try {
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      return true; // Already unsubscribed
    }

    // Get subscription endpoint
    const endpoint = subscription.endpoint;

    // Unsubscribe from push manager
    await subscription.unsubscribe();

    // Notify backend
    await fetch(`${API_URL}/api/push/unsubscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint }),
    });

    console.log('[Push] Successfully unsubscribed from push notifications');
    return true;
  } catch (error) {
    console.error('[Push] Error unsubscribing from push notifications:', error);
    return false;
  }
};

// Check if user is already subscribed
export const isSubscribed = async (
  registration: ServiceWorkerRegistration
): Promise<boolean> => {
  try {
    const subscription = await registration.pushManager.getSubscription();
    return subscription !== null;
  } catch (error) {
    console.error('[Push] Error checking subscription status:', error);
    return false;
  }
};

// Helper: Convert base64 URL to Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  
  return outputArray;
}

// Helper: Convert ArrayBuffer to base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

