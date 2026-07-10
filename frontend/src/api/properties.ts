import { api } from './client';
import { LeadMatch, Property, PropertyVoiceDraft } from '../types';
import { MatchMeta } from './leads';

interface ListParams {
  q?: string;
  propertyType?: string;
  listingType?: string;
  available?: boolean;
}

export const propertiesApi = {
  list: (params: ListParams = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '') qs.set(k, String(v));
    });
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return api.get<{ count: number; total: number; properties: Property[] }>(`/properties${suffix}`);
  },

  // Transcribe a spoken property description into draft form fields (not saved).
  draftFromVoice: (recording: { part: unknown; fileName: string }) => {
    const form = new FormData();
    form.append('audio', recording.part as Blob, recording.fileName);
    return api.upload<{ draft: PropertyVoiceDraft }>('/properties/voice', form);
  },

  get: (id: string) => api.get<{ property: Property }>(`/properties/${id}`),

  create: (data: Partial<Property>) => api.post<{ property: Property }>('/properties', data),

  update: (id: string, data: Partial<Property>) =>
    api.put<{ property: Property }>(`/properties/${id}`, data),

  remove: (id: string) => api.delete<{ message: string }>(`/properties/${id}`),

  matchingLeads: (
    propertyId: string,
    params: { page?: number; limit?: number; radiusKm?: number } = {}
  ) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => v != null && qs.set(k, String(v)));
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return api.get<MatchMeta & { leads: LeadMatch[] }>(`/properties/${propertyId}/leads${suffix}`);
  },
};
