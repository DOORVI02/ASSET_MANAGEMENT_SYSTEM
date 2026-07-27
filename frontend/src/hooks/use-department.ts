import { createContext, useContext } from 'react';
import type { AccessScope, Department } from '@/lib/types';

export interface DepartmentContextValue {
  /** Departments this user may reach, in display order. */
  available: Department[];
  /** The department currently in context, or null when selection is still pending. */
  current: Department | null;
  /** What the current user may read. Pass into scoped repository calls. */
  scope: AccessScope;
  /** Officers choose between departments; a Supervisor has only one. */
  canChoose: boolean;
  selectDepartment: (departmentId: string) => void;
  clearDepartment: () => void;
}

export const DepartmentContext = createContext<DepartmentContextValue | undefined>(undefined);

export function useDepartment(): DepartmentContextValue {
  const context = useContext(DepartmentContext);
  if (context === undefined) {
    throw new Error('useDepartment must be used within a DepartmentProvider');
  }
  return context;
}
