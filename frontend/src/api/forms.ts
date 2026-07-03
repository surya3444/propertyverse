import { api } from './client';
import { Form, FormResponse, FormType } from '../types';
import { formShareUrl } from './config';

export const formsApi = {
  list: () => api.get<{ count: number; forms: Form[] }>('/forms'),

  get: (id: string) => api.get<{ form: Form }>(`/forms/${id}`),

  create: (data: { type: FormType; title?: string; description?: string }) =>
    api.post<{ form: Form }>('/forms', data),

  update: (id: string, data: Partial<Form>) => api.put<{ form: Form }>(`/forms/${id}`, data),

  remove: (id: string) => api.delete<{ message: string }>(`/forms/${id}`),

  responses: (id: string) =>
    api.get<{ count: number; total: number; responses: FormResponse[] }>(`/forms/${id}/responses`),

  // The public, shareable URL for a form.
  shareUrl: (publicId: string) => formShareUrl(publicId),
};
