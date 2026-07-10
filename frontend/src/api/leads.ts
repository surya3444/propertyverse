import { api } from './client';
import { Lead, PropertyMatch } from '../types';

// What every matching endpoint returns alongside its rows.
export interface MatchMeta {
  count: number;
  total: number;
  page: number;
  limit: number;
  /** True when both sides had coordinates, so results are distance-ranked. */
  geofenced: boolean;
  radiusKm: number;
}

export const leadsApi = {
  list: (status?: string) =>
    api.get<{ count: number; leads: Lead[] }>(`/leads${status ? `?status=${status}` : ''}`),

  get: (id: string) => api.get<{ lead: Lead }>(`/leads/${id}`),

  create: (data: Partial<Lead>) => api.post<{ lead: Lead }>('/leads', data),

  update: (id: string, data: Partial<Lead>) => api.put<{ lead: Lead }>(`/leads/${id}`, data),

  remove: (id: string) => api.delete<{ message: string }>(`/leads/${id}`),

  matches: (leadId: string, params: { page?: number; limit?: number; radiusKm?: number } = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => v != null && qs.set(k, String(v)));
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return api.get<MatchMeta & { matches: PropertyMatch[] }>(`/leads/${leadId}/matches${suffix}`);
  },

  // Upload a recorded voice note. `recording` comes from the platform recorder:
  // on native `part` is an RN file object, on web it's a Blob.
  createFromVoice: (params: {
    recording: { part: unknown; fileName: string };
    phoneNumber: string;
    clientName?: string;
    transactionType?: string;
  }) => {
    const form = new FormData();
    form.append('audio', params.recording.part as Blob, params.recording.fileName);
    form.append('phoneNumber', params.phoneNumber);
    if (params.clientName) form.append('clientName', params.clientName);
    if (params.transactionType) form.append('transactionType', params.transactionType);
    return api.upload<{ message: string; lead: Lead }>('/leads/voice', form);
  },
};
