export const USER_ROLES = ["admin", "operator", "seller"] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const ALL_APP_ROLES: readonly string[] = USER_ROLES;

