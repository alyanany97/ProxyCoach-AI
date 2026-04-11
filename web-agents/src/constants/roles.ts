/**
 * Available user roles in the system
 *
 * ADMIN - Full access to admin panel (user/trainer management, all data)
 * PT    - Personal Trainer; access to PT panel (own clients + own files only)
 * USER  - Client; no panel access
 */
export const ROLES = {
   USER: "user",
   PT: "pt",
   ADMIN: "admin",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const VALID_ROLES = Object.values(ROLES);

export function isValidRole(role: string): role is Role {
   return VALID_ROLES.includes(role as Role);
}
