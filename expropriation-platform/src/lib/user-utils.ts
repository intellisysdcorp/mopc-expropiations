/**
 * Utility functions for handling user names and initials
 * Safely handles cases where name properties might be undefined
 */

export type User = {
  firstName?: string;
  lastName?: string;
  name?: string;
};

/**
 * Gets user initials with proper fallbacks for missing name properties
 */
export function getUserInitials(user?: User): string {
  if (!user) return 'UU';

  const getFirstChar = (str: string) => str.charAt(0).toUpperCase();

  if (user.firstName && user.lastName) {
    return `${getFirstChar(user.firstName)}${getFirstChar(user.lastName)}`;
  }

  if (user.name) {
    const names: string[] = user.name.split(' ')
      .filter(n => n.length > 0)
      .filter(Boolean);

    if (names.length === 2) {
      return `${getFirstChar(names[0]!)}${getFirstChar(names[1]!)}`;
    }

    if (names.length === 1) {
      return getFirstChar(names[0]!);
    }
  }

  if (user.firstName) return getFirstChar(user.firstName);
  if (user.lastName) return getFirstChar(user.lastName);

  return 'UU';
}

/**
 * Gets user display name with proper fallbacks for missing name properties
 */
export function getUserName(user?: User): string {
  if (!user) return 'Usuario desconocido';

  if (user.firstName && user.lastName) {
    return `${user.firstName} ${user.lastName}`;
  }

  if (user.name) {
    return user.name;
  }

  return 'Usuario desconocido';
}