// hooks/useAuth.ts
'use client';

import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { User, LoginCredentials, DASHBOARD_ROUTES, Role } from '@/types';
import { authApi } from '@/lib/api';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Check auth status on mount by calling /auth/me
  const checkAuth = useCallback(async () => {
    try {
      const userData = await authApi.getMe();
      setUser(userData);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Login function - calls API which sets HttpOnly cookie
  const login = useCallback(async (credentials: LoginCredentials) => {
    setIsLoading(true);
    try {
      const { user: userData } = await authApi.login(credentials);
      setUser(userData);

      // Redirect based on role
      const dashboardRoute = DASHBOARD_ROUTES[userData.role as Role];
      router.push(dashboardRoute);
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  // Logout function - calls API which clears HttpOnly cookie
  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch (error) {
      // Continue with local logout even if API fails
      console.error('Logout API error:', error);
    }
    setUser(null);
    router.push('/login');
  }, [router]);

  // Refresh user data from server
  const refreshUser = useCallback(async () => {
    try {
      const userData = await authApi.getMe();
      setUser(userData);
    } catch {
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
