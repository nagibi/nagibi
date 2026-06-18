import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  userPreferencesService,
  type UserPreferencesMap,
} from '@/services/user-preferences.service';
import type { ViewPreferenceKey } from '@/types/view-mode';

const QUERY_KEY = ['user-preferences'] as const;

export function useUserPreferencesQuery(enabled = true) {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const response = await userPreferencesService.get();
      return response.data.result;
    },
    enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

export function usePatchUserPreferencesCache() {
  const queryClient = useQueryClient();

  return (patch: Partial<UserPreferencesMap>) => {
    queryClient.setQueryData<UserPreferencesMap>(QUERY_KEY, (current) => {
      const next: UserPreferencesMap = { ...(current ?? {}) };

      for (const [key, value] of Object.entries(patch)) {
        if (value !== undefined) {
          next[key] = value;
        }
      }

      return next;
    });
  };
}

export function useUserPreferenceValue(key: ViewPreferenceKey) {
  const { data } = useUserPreferencesQuery();
  return data?.[key];
}
