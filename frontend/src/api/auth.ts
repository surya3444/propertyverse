import { api } from './client';
import { User } from '../types';

interface AuthResponse {
  message: string;
  token: string;
  user: User;
}

export const authApi = {
  register: (data: { name: string; email: string; password: string; phone?: string }) =>
    api.post<AuthResponse>('/auth/register', data),

  login: (data: { email: string; password: string }) =>
    api.post<AuthResponse>('/auth/login', data),

  me: () => api.get<{ user: User }>('/auth/me'),
};
