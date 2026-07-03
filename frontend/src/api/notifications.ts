import { api } from './client';
import { AppNotification } from '../types';

export const notificationsApi = {
  list: (unreadOnly = false) =>
    api.get<{ count: number; total: number; unreadCount: number; notifications: AppNotification[] }>(
      `/notifications${unreadOnly ? '?unread=true' : ''}`
    ),

  markRead: (id: string) => api.put<{ notification: AppNotification }>(`/notifications/${id}/read`),

  markAllRead: () => api.put<{ message: string }>('/notifications/read-all'),

  // Web Push (VAPID) — self-hosted browser push, no Firebase.
  vapidPublicKey: () => api.get<{ publicKey: string | null }>('/notifications/vapid-public-key'),

  subscribeWebPush: (subscription: unknown) =>
    api.post<{ message: string }>('/notifications/subscribe', { subscription }),

  // FCM device token (optional native path).
  registerPushToken: (token: string, platform: 'android' | 'ios' | 'web') =>
    api.post<{ message: string }>('/notifications/push-tokens', { token, platform }),
};
