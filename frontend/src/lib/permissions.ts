import { Role, UserProfile } from './types';

export type Permission =
  | 'machine:view'
  | 'machine:add'
  | 'machine:edit'
  | 'machine:archive'
  | 'machine:retire'
  | 'parts:view'
  | 'parts:add'
  | 'parts:edit'
  | 'parts:delete'
  | 'maintenance:view'
  | 'maintenance:add'
  | 'maintenance:edit'
  | 'repair:view'
  | 'repair:add'
  | 'repair:edit'
  | 'reports:view'
  | 'reports:export'
  | 'reports:officer_only'
  | 'images:upload'
  | 'profile:view';

const rolePermissions: Record<Role, readonly Permission[]> = {
  officer: [
    'machine:view',
    'machine:add',
    'machine:edit',
    'machine:archive',
    'machine:retire',
    'parts:view',
    'parts:add',
    'parts:edit',
    'parts:delete',
    'maintenance:view',
    'maintenance:add',
    'maintenance:edit',
    'repair:view',
    'repair:add',
    'repair:edit',
    'reports:view',
    'reports:export',
    'reports:officer_only',
    'images:upload',
    'profile:view',
  ],
  supervisor: [
    'machine:view',
    'parts:view',
    'parts:add',
    'parts:edit',
    'maintenance:view',
    'maintenance:add',
    'maintenance:edit',
    'repair:view',
    'repair:add',
    'repair:edit',
    'reports:view',
    'reports:export',
    'images:upload',
    'profile:view',
  ],
};

export function can(user: UserProfile | null, permission: Permission): boolean {
  if (!user) return false;
  const perms = rolePermissions[user.role];
  return perms.includes(permission);
}
