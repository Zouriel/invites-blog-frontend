import { RoleDefinition } from './types/api.types';

type RolesBlob = { roles?: RoleDefinition[] };

/**
 * Parses a campaign's RolesJson blob (`{"roles":[{"name":"vip","contentBlocks":[...]}]}`) into a
 * flat list of role names, skipping anything malformed. Shared by every place that offers a guest
 * "role" picker built from the campaign's own configured roles (the pre-payment Guests step and the
 * post-payment Dashboard's Add-guest dialog) so they can't drift apart.
 */
export function parseRoleNames(rolesJson: string | undefined | null): string[] {
  if (!rolesJson) {
    return [];
  }
  try {
    const blob = JSON.parse(rolesJson) as RolesBlob;
    if (!Array.isArray(blob.roles)) {
      return [];
    }
    return blob.roles.map((r) => r.name?.trim()).filter((n): n is string => !!n);
  } catch {
    return [];
  }
}
