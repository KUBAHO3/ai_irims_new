'use client';
import type { ApplicationDto, UserDto } from '@rfda/shared';
import { createContext, useContext } from 'react';
import useSWR, { mutate } from 'swr';
import { fetcher } from '@/lib/api';

export const SessionCtx = createContext<UserDto | null>(null);
/** The signed-in user. Only available inside the portal shell. */
export const useMe = () => useContext(SessionCtx)!;

/** The signed-in applicant's applications (shared cache for every applicant page). */
export const useMyApps = () => useSWR<ApplicationDto[]>('/applications', fetcher);
/** All submitted applications (assessor). */
export const useAllApps = () => useSWR<ApplicationDto[]>('/review/applications', fetcher);

/** Put a fresh copy of an application in the cache and refresh the lists that include it. */
export function storeApp(app: ApplicationDto, scope: 'applicant' | 'assessor' = 'applicant') {
  const base = scope === 'applicant' ? '/applications' : '/review/applications';
  mutate(`${base}/${app.id}`, app, { revalidate: false });
  mutate(base);
}
