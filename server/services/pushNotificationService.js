const admin = require('firebase-admin');
const UserPushToken = require('../models/chat/UserPushToken');

let firebaseApp = null;

function initFirebase() {
  if (firebaseApp) return firebaseApp;

  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log('✅ Firebase Admin SDK initialized for Push Notifications (env var)');
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      firebaseApp = admin.initializeApp({
        credential: admin.credential.applicationDefault()
      });
      console.log('✅ Firebase Admin SDK initialized for Push Notifications (default credentials)');
    } else {
      console.warn('⚠️ Firebase credentials not configured. Push notifications will be logged only.');
    }
  } catch (err) {
    console.error('❌ Failed to initialize Firebase Admin SDK:', err.message);
  }
  return firebaseApp;
}

/**
 * Send push notification to target user IDs
 * @param {Array<string>} userIds - Recipient user IDs
 * @param {Object} payload - { title, body, data }
 */
async function sendPushNotification(userIds, payload) {
  if (!userIds || userIds.length === 0) return;

  try {
    const stringUserIds = userIds.map(String);
    const tokenDocs = await UserPushToken.find({ user: { $in: stringUserIds } }).lean();

    if (!tokenDocs || tokenDocs.length === 0) {
      return;
    }

    const tokens = tokenDocs.map((t) => t.token);

    if (!admin.apps || !admin.apps.length) {
      initFirebase();
    }

    if (!admin.apps || !admin.apps.length) {
      console.log(`[Push Notification Mock] Would send to ${tokens.length} tokens:`, {
        title: payload.title,
        body: payload.body,
        data: payload.data
      });
      return;
    }

    const finalData = {
      type: 'chat_message',
      ...(payload.data || {}),
      title: payload.title,
      body: payload.body,
    };

    const dataPayload = Object.fromEntries(
      Object.entries(finalData).filter(([_, v]) => v != null).map(([k, v]) => [k, String(v)])
    );

    const message = {
      tokens: tokens,
      notification: {
        title: String(payload.title),
        body: String(payload.body)
      },
      data: dataPayload,
      android: {
        priority: 'high',
        notification: {
          channelId: 'messages',
          sound: 'default',
          defaultVibrateTimings: true,
          notificationCount: 1,
          visibility: 'public'
        }
      },
      apns: {
        headers: {
          'apns-priority': '10',
          'apns-push-type': 'alert'
        },
        payload: {
          aps: {
            alert: {
              title: String(payload.title),
              body: String(payload.body)
            },
            sound: 'default',
            badge: 1
          }
        }
      }
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    
    // Clean up expired or invalid tokens
    if (response.failureCount > 0) {
      const failedTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const errCode = resp.error?.code;
          if (
            errCode === 'messaging/invalid-registration-token' ||
            errCode === 'messaging/registration-token-not-registered' ||
            errCode === 'messaging/invalid-argument'
          ) {
            failedTokens.push(tokens[idx]);
          }
        }
      });
      if (failedTokens.length > 0) {
        await UserPushToken.deleteMany({ token: { $in: failedTokens } });
        console.log(`🧹 Cleaned up ${failedTokens.length} invalid push tokens`);
      }
    }
  } catch (error) {
    console.error('❌ Error sending push notification:', error.message);
  }
}

module.exports = {
  initFirebase,
  sendPushNotification
};
