/**
 * Available user roles in the system
 */
export const ROLES = {
   USER: "user",
   ADMIN: "admin",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

/**
 * Valid role values
 */
export const VALID_ROLES = Object.values(ROLES);

/**
 * Check if a string is a valid role
 */
export function isValidRole(role: string): role is Role {
   return VALID_ROLES.includes(role as Role);
}
