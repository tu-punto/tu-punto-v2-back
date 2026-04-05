export const USER_ROLES = ["admin", "operator", "seller", "superadmin"] as const;

export const ASSIGNABLE_USER_ROLES = ["admin", "operator", "seller"] as const;

export type UserRole = (typeof USER_ROLES)[number];
export type AssignableUserRole = (typeof ASSIGNABLE_USER_ROLES)[number];

export const ALL_APP_ROLES: readonly string[] = USER_ROLES;

export const normalizeUserRole = (role?: string | null): UserRole | "" => {
  const value = String(role || "").trim().toLowerCase();
  if ((USER_ROLES as readonly string[]).includes(value)) {
    return value as UserRole;
  }

  return "";
};

export const isSuperadminRole = (role?: string | null): boolean =>
  normalizeUserRole(role) === "superadmin";

export const getPublicUserRole = (role?: string | null): AssignableUserRole | "" => {
  const normalizedRole = normalizeUserRole(role);
  if (!normalizedRole) return "";

  if (normalizedRole === "superadmin") {
    return "admin";
  }

  return normalizedRole as AssignableUserRole;
};

export const roleSatisfies = (currentRole?: string | null, allowedRoles: string[] = []): boolean => {
  const normalizedCurrentRole = normalizeUserRole(currentRole);
  if (!normalizedCurrentRole) return false;

  const normalizedAllowedRoles = allowedRoles
    .map((role) => normalizeUserRole(role))
    .filter(Boolean);

  if (normalizedAllowedRoles.includes(normalizedCurrentRole)) {
    return true;
  }

  return normalizedCurrentRole === "superadmin" && normalizedAllowedRoles.includes("admin");
};

