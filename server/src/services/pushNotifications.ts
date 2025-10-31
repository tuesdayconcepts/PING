// Push notification service using Web Push API with VAPID keys
import webpush from 'web-push';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// VAPID configuration from environment variables
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@ping.com';

// Initialize web-push with VAPID keys
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
} else {
  console.warn('[Push] VAPID keys not configured. Push notifications will not work.');
}

// Send push notification to a single subscription
export const sendPushNotification = async (
  subscription: {
    endpoint: string;
    keys: {
      p256dh: string;
      auth: string;
    };
  },
  payload: {
    title: string;
    body: string;
    icon?: string;
    badge?: string;
    data?: any;
    tag?: string;
    requireInteraction?: boolean;
  }
): Promise<boolean> => {
  try {
    const pushSubscription = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
    };

    const notificationPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: payload.icon || '/logo/ping-logo.svg',
      badge: payload.badge || '/logo/ping-logo.svg',
      data: payload.data || {},
      tag: payload.tag,
      requireInteraction: payload.requireInteraction || false,
    });

    await webpush.sendNotification(pushSubscription, notificationPayload);
    return true;
  } catch (error: any) {
    console.error('[Push] Error sending notification:', error);
    
    // If subscription is invalid, remove it from database
    if (error.statusCode === 410 || error.statusCode === 404) {
      console.log('[Push] Removing invalid subscription:', subscription.endpoint);
      await prisma.pushSubscription.deleteMany({
        where: { endpoint: subscription.endpoint },
      }).catch((e) => console.error('[Push] Error removing subscription:', e));
    }
    
    return false;
  }
};

// Send push notification to all subscriptions of a specific user type
export const sendPushToUserType = async (
  userType: 'user' | 'admin',
  payload: {
    title: string;
    body: string;
    icon?: string;
    badge?: string;
    data?: any;
    tag?: string;
    requireInteraction?: boolean;
  }
): Promise<{ sent: number; failed: number }> => {
  try {
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userType },
    });

    if (subscriptions.length === 0) {
      console.log(`[Push] No ${userType} subscriptions found`);
      return { sent: 0, failed: 0 };
    }

    console.log(`[Push] Sending notification to ${subscriptions.length} ${userType} subscription(s)`);

    const results = await Promise.allSettled(
      subscriptions.map((sub) =>
        sendPushNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          payload
        )
      )
    );

    const sent = results.filter((r) => r.status === 'fulfilled' && r.value).length;
    const failed = results.length - sent;

    // Update lastUsed timestamp for successful sends
    const successfulEndpoints = subscriptions
      .filter((_, i) => results[i].status === 'fulfilled' && results[i].value)
      .map((s) => s.endpoint);

    if (successfulEndpoints.length > 0) {
      await prisma.pushSubscription.updateMany({
        where: { endpoint: { in: successfulEndpoints } },
        data: { lastUsed: new Date() },
      });
    }

    return { sent, failed };
  } catch (error) {
    console.error('[Push] Error sending notifications to user type:', error);
    return { sent: 0, failed: 0 };
  }
};

// Send push notification to a specific admin user
export const sendPushToAdmin = async (
  adminId: string,
  payload: {
    title: string;
    body: string;
    icon?: string;
    badge?: string;
    data?: any;
    tag?: string;
    requireInteraction?: boolean;
  }
): Promise<boolean> => {
  try {
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId: adminId, userType: 'admin' },
    });

    if (subscriptions.length === 0) {
      console.log(`[Push] No subscriptions found for admin ${adminId}`);
      return false;
    }

    const results = await Promise.allSettled(
      subscriptions.map((sub) =>
        sendPushNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          payload
        )
      )
    );

    const success = results.some((r) => r.status === 'fulfilled' && r.value);
    return success;
  } catch (error) {
    console.error('[Push] Error sending notification to admin:', error);
    return false;
  }
};

// Get VAPID public key
export const getVapidPublicKey = (): string => {
  return VAPID_PUBLIC_KEY;
};

