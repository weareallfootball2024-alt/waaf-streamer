export type StaffUser = {
  id: number;
  full_name?: string;
  phone?: string;
  role?: string;
  roles?: string[];
};

const TESTING_ROLES = new Set(['club_admin', 'admin', 'coach', 'superadmin', 'super_admin']);

export function getUserRoles(user: StaffUser | null): string[] {
  if (!user) return [];
  const roles = new Set<string>();
  if (user.role) roles.add(user.role);
  if (Array.isArray(user.roles)) user.roles.forEach((r) => roles.add(r));
  return [...roles];
}

export function canAccessTesting(user: StaffUser | null): boolean {
  return getUserRoles(user).some((r) => TESTING_ROLES.has(r));
}

export function isSuperAdmin(user: StaffUser | null): boolean {
  return getUserRoles(user).some((r) => r === 'superadmin' || r === 'super_admin');
}
