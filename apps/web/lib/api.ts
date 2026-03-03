// lib/api.ts
import axios, { AxiosError, AxiosInstance } from 'axios';
import { User, LoginCredentials, UserProfile, ApiError } from '@/types';

// Always use the same-origin /api path so requests go through the Next.js
// rewrite proxy. This ensures LAN devices don't try to reach localhost:3001.
const API_URL = '/api';

// Create axios instance with credentials for HttpOnly cookies
const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Required for HttpOnly cookies
});

// Response interceptor - handle errors
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiError>) => {
    if (error.response?.status === 401) {
      // Redirect to login on auth failure (cookie will be cleared by server on logout)
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  login: async (credentials: LoginCredentials): Promise<{ user: User }> =>
    (await api.post<{ user: User }>('/auth/login', credentials)).data,

  logout: async (): Promise<void> => {
    await api.post('/auth/logout');
  },

  getMe: async (): Promise<User> => (await api.get<User>('/auth/me')).data,

  getProfile: async (): Promise<UserProfile> => {
    const response = await api.get<UserProfile>('/auth/profile');
    return response.data;
  },

  healthCheck: async () => {
    const response = await api.get('/auth/health');
    return response.data;
  },

  register: async (data: { name: string; email: string; password: string; studentId?: string }): Promise<{ message: string; email: string }> => {
    const response = await api.post('/auth/register', data);
    return response.data;
  },

  verifyEmail: async (data: { email: string; code: string }): Promise<{ message: string }> => {
    const response = await api.post('/auth/verify-email', data);
    return response.data;
  },

  resendVerification: async (data: { email: string }): Promise<{ message: string }> => {
    const response = await api.post('/auth/resend-verification', data);
    return response.data;
  },
};

// Users API
export const usersApi = {
  getAll: async (params?: {
    role?: string;
    facultyId?: string;
    isActive?: boolean;
    search?: string;
    page?: number;
    pageSize?: number;
  }) => {
    const response = await api.get('/users', { params });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/users/${id}`);
    return response.data;
  },

  updateProfile: async (data: { name?: string; avatarUrl?: string }) => {
    const response = await api.patch('/users/profile', data);
    return response.data;
  },

  updateInterests: async (interests: string[]) => {
    const response = await api.patch('/users/interests', { interests });
    return response.data;
  },

  getStats: async () => {
    const response = await api.get('/users/stats');
    return response.data;
  },

  deactivate: async (id: string) => {
    const response = await api.patch(`/users/${id}/deactivate`);
    return response.data;
  },

  activate: async (id: string) => {
    const response = await api.patch(`/users/${id}/activate`);
    return response.data;
  },
};

export default api;
