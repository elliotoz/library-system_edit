// lib/api.ts
import axios, { AxiosError, AxiosInstance } from 'axios';
import { User, LoginCredentials, UserProfile, ApiError, ReadingList, FollowedInstructor, FollowersCount, FollowingStatus, InstructorProfile, ReadingListVisibility } from '@/types';

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

// Public routes that should not trigger 401 redirect
const PUBLIC_ROUTES = ['/login', '/signup', '/verify-email', '/forgot-password', '/reset-password'];

// Response interceptor - handle errors
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiError>) => {
    if (error.response?.status === 401) {
      // Redirect to login on auth failure, but not from public auth routes
      if (typeof window !== 'undefined') {
        const isPublicRoute = PUBLIC_ROUTES.some(route => window.location.pathname.startsWith(route));
        if (!isPublicRoute) {
          window.location.href = '/login';
        }
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

  register: async (data: { name: string; email: string; password: string; studentId?: string }): Promise<{ message: string; email: string; emailSent: boolean }> => {
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

  forgotPassword: async (data: { email: string }): Promise<{ message: string }> => {
    const response = await api.post('/auth/forgot-password', data);
    return response.data;
  },

  resetPassword: async (data: { token: string; password: string }): Promise<{ message: string }> => {
    const response = await api.post('/auth/reset-password', data);
    return response.data;
  },

  getConfig: async (): Promise<{ googleOAuthEnabled: boolean; smtpEnabled: boolean; ollamaEnabled: boolean }> => {
    const response = await api.get('/auth/config');
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

// Reading Lists API
export const readingListsApi = {
  getMyLists: async (): Promise<ReadingList[]> =>
    (await api.get<ReadingList[]>('/reading-lists/my')).data,

  getFeed: async (): Promise<ReadingList[]> =>
    (await api.get<ReadingList[]>('/reading-lists/feed')).data,

  getInstructorProfile: async (instructorId: string): Promise<InstructorProfile> =>
    (await api.get<InstructorProfile>(`/reading-lists/instructor/${instructorId}`)).data,

  getById: async (id: string): Promise<ReadingList> =>
    (await api.get<ReadingList>(`/reading-lists/${id}`)).data,

  create: async (data: { title: string; description?: string; courseCode?: string; semester?: string; visibility?: ReadingListVisibility; status?: string }): Promise<ReadingList> =>
    (await api.post<ReadingList>('/reading-lists', data)).data,

  getAllForModeration: async (): Promise<ReadingList[]> =>
    (await api.get<ReadingList[]>('/reading-lists/admin/all')).data,

  update: async (id: string, data: { title?: string; description?: string; courseCode?: string; semester?: string; isActive?: boolean; visibility?: ReadingListVisibility; status?: string }): Promise<ReadingList> =>
    (await api.patch<ReadingList>(`/reading-lists/${id}`, data)).data,

  remove: async (id: string): Promise<void> => {
    await api.delete(`/reading-lists/${id}`);
  },

  addItem: async (listId: string, data: { bookId: string; notes?: string }) =>
    (await api.post(`/reading-lists/${listId}/items`, data)).data,

  removeItem: async (listId: string, itemId: string): Promise<void> => {
    await api.delete(`/reading-lists/${listId}/items/${itemId}`);
  },
};

// Instructor Followers API
export const followersApi = {
  getMyFollowing: async (): Promise<FollowedInstructor[]> =>
    (await api.get<FollowedInstructor[]>('/instructor-followers/my-following')).data,

  follow: async (instructorId: string) =>
    (await api.post(`/instructor-followers/${instructorId}/follow`)).data,

  unfollow: async (instructorId: string) =>
    (await api.delete(`/instructor-followers/${instructorId}/unfollow`)).data,

  getFollowersCount: async (instructorId: string): Promise<FollowersCount> =>
    (await api.get<FollowersCount>(`/instructor-followers/${instructorId}/followers-count`)).data,

  isFollowing: async (instructorId: string): Promise<FollowingStatus> =>
    (await api.get<FollowingStatus>(`/instructor-followers/${instructorId}/is-following`)).data,
};

// Branches API (Admin)
export const branchesApi = {
  getAll: async () => (await api.get('/branches')).data,

  create: async (data: {
    name: string;
    code: string;
    address: string;
    openingHours?: string;
    contactEmail?: string;
    contactPhone?: string;
  }) => (await api.post('/branches', data)).data,

  update: async (
    id: string,
    data: {
      name?: string;
      code?: string;
      address?: string;
      openingHours?: string;
      contactEmail?: string;
      contactPhone?: string;
      isActive?: boolean;
    },
  ) => (await api.patch(`/branches/${id}`, data)).data,

  activate: async (id: string) =>
    (await api.patch(`/branches/${id}/activate`)).data,

  deactivate: async (id: string) =>
    (await api.patch(`/branches/${id}/deactivate`)).data,
};

// Borrow Policies API (Admin)
export const borrowPoliciesApi = {
  getAll: async () => (await api.get('/borrow-policies')).data,

  update: async (
    role: string,
    data: {
      maxActiveBorrows?: number;
      maxBorrowDays?: number;
      maxExtensions?: number;
      extensionDays?: number;
    },
  ) => (await api.patch(`/borrow-policies/${role}`, data)).data,
};

// Fine Payments API (Admin)
export const finePaymentsApi = {
  getAll: async (params?: {
    status?: string;
    userId?: string;
    page?: number;
    pageSize?: number;
  }) => (await api.get('/fine-payments', { params })).data,

  getTotals: async () => (await api.get('/fine-payments/totals')).data,

  markPaid: async (id: string) =>
    (await api.patch(`/fine-payments/${id}/pay`)).data,

  waive: async (id: string, note?: string) =>
    (await api.patch(`/fine-payments/${id}/waive`, { note })).data,
};

// Reports API (Admin)
export const reportsApi = {
  getSummary: async (from: string, to: string) =>
    (await api.get('/reports/summary', { params: { from, to } })).data,

  exportUrl: (format: 'pdf' | 'excel', from: string, to: string) =>
    `${API_URL}/reports/export?format=${format}&from=${from}&to=${to}`,
};

// External Books API
export interface NormalizedBook {
  title: string;
  authors: string[];
  description?: string;
  coverImageUrl?: string;
  ebookUrl?: string;
  source: 'OpenLibrary' | 'Gutendex';
  isbn?: string;
  publicationYear?: number;
}

export const externalBooksApi = {
  search: async (q: string): Promise<NormalizedBook[]> => {
    const response = await api.get<NormalizedBook[]>('/external-books/search', { params: { q } });
    return response.data;
  },

  importBook: async (book: NormalizedBook): Promise<any> => {
    const response = await api.post('/external-books/import', book);
    return response.data;
  },

  checkExisting: async (books: NormalizedBook[]): Promise<string[]> => {
    const payload = books.map((b) => ({
      isbn: b.isbn,
      title: b.title,
      source: b.source,
      authors: b.authors,
    }));
    const response = await api.post<string[]>('/external-books/check-existing', { books: payload });
    return response.data;
  },

  bulkImportOpenLibrary: async (): Promise<{ imported: number; skipped: number }> => {
    const response = await api.post<{ imported: number; skipped: number }>('/external-books/import/openlibrary');
    return response.data;
  },

  bulkImportGutendex: async (): Promise<{ imported: number; skipped: number }> => {
    const response = await api.post<{ imported: number; skipped: number }>('/external-books/import/gutendex');
    return response.data;
  },
};

// AI Assistant API
export const aiApi = {
  chat: async (data: { message: string }): Promise<{ reply: string; modelUsed: string; sources?: string[] }> =>
    (await api.post<{ reply: string; modelUsed: string; sources?: string[] }>('/ai/chat', data)).data,

  getStatus: async (): Promise<{ available: boolean }> =>
    (await api.get<{ available: boolean }>('/ai/status')).data,

  scanCover: async (image: string): Promise<{ title?: string; authors?: string; isbn?: string; publisher?: string; publicationYear?: number }> =>
    (await api.post<{ title?: string; authors?: string; isbn?: string; publisher?: string; publicationYear?: number }>('/ai/scan-cover', { image })).data,
};

export default api;
