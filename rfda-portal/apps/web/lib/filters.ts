import { groupOf, type ApplicationDto } from '@rfda/shared';

export const GROUPS = [['all', 'All'], ['action', 'Needs your action'], ['fda', 'With Rwanda FDA'], ['approved', 'Registered'], ['rejected', 'Rejected']] as const;
export type GroupKey = (typeof GROUPS)[number][0];

export function countByGroup(apps: ApplicationDto[]): Record<GroupKey, number> {
  const c = { all: apps.length, action: 0, fda: 0, approved: 0, rejected: 0 };
  apps.forEach((a) => { c[groupOf(a.status)] += 1; });
  return c;
}
