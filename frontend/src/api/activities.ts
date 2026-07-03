import { api } from './client';
import { Activity } from '../types';

export type ActivityScope = 'overdue' | 'upcoming' | 'today' | 'past';

interface ListParams {
  scope?: ActivityScope;
  status?: string;
  contactId?: string;
  propertyId?: string;
  from?: string;
  to?: string;
}

export const activitiesApi = {
  list: (params: ListParams = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v) qs.set(k, String(v));
    });
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return api.get<{ count: number; total: number; activities: Activity[] }>(`/activities${suffix}`);
  },

  get: (id: string) => api.get<{ activity: Activity }>(`/activities/${id}`),

  create: (data: Partial<Activity> & { contactId: string }) =>
    api.post<{ activity: Activity }>('/activities', data),

  update: (id: string, data: Partial<Activity>) =>
    api.put<{ activity: Activity }>(`/activities/${id}`, data),

  remove: (id: string) => api.delete<{ message: string }>(`/activities/${id}`),
};
