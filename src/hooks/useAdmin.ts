'use client';

import { useSearchParams } from 'next/navigation';

// The secret key for admin access - change this to your preferred secret
const ADMIN_SECRET = 'burbs2026';

export function useAdmin(): boolean {
  const searchParams = useSearchParams();
  const adminParam = searchParams.get('admin');

  return adminParam === ADMIN_SECRET;
}
