import React, { createContext, useContext, useState, type ReactNode } from 'react';
import { Role, UserProfile } from './types';
import { DEMO_PASSWORD } from './mock-data';
import { mockRepository } from './mock-repository';

interface AuthContextType {
  user: UserProfile | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
  switchRole: (role: Role) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(readStoredUser);
  const isLoading = false;

  const login = async (email: string, password: string) => {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 800));

    const previewUser = mockRepository.findUserByEmail(email);
    if (previewUser && password === DEMO_PASSWORD) {
      setUser(previewUser);
      localStorage.setItem('sail_auth', JSON.stringify(previewUser));
      return true;
    }
    return false;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('sail_auth');
  };

  const switchRole = (role: Role) => {
    if (!user) return;
    const newUser = mockRepository.findUserByRole(role);
    if (newUser) {
      setUser(newUser);
      localStorage.setItem('sail_auth', JSON.stringify(newUser));
    }
  };

  return React.createElement(
    AuthContext.Provider,
    { value: { user, login, logout, isLoading, switchRole } },
    children,
  );
}

function readStoredUser(): UserProfile | null {
  const stored = localStorage.getItem('sail_auth');
  if (!stored) return null;

  try {
    const storedUser: unknown = JSON.parse(stored);
    return isUserProfile(storedUser) ? storedUser : null;
  } catch {
    localStorage.removeItem('sail_auth');
    return null;
  }
}

function isUserProfile(value: unknown): value is UserProfile {
  if (!value || typeof value !== 'object') return false;

  const candidate = value as Partial<UserProfile>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.email === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.phone === 'string' &&
    typeof candidate.department === 'string' &&
    Array.isArray(candidate.departmentScope) &&
    (candidate.role === 'officer' || candidate.role === 'supervisor')
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
