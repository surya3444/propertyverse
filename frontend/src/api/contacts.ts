import { api } from './client';
import { Activity, Contact, ContactRole, Lead, Property } from '../types';

export const contactsApi = {
  list: (params?: { role?: ContactRole; q?: string }) => {
    const qs = new URLSearchParams();
    if (params?.role) qs.set('role', params.role);
    if (params?.q) qs.set('q', params.q);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return api.get<{ count: number; contacts: Contact[] }>(`/contacts${suffix}`);
  },

  get: (id: string) =>
    api.get<{ contact: Contact; properties: Property[]; requirements: Lead[]; activities: Activity[] }>(
      `/contacts/${id}`
    ),

  create: (data: Partial<Contact> & { role?: ContactRole }) =>
    api.post<{ contact: Contact }>('/contacts', data),

  update: (id: string, data: Partial<Contact>) =>
    api.put<{ contact: Contact }>(`/contacts/${id}`, data),

  remove: (id: string) => api.delete<{ message: string }>(`/contacts/${id}`),
};
