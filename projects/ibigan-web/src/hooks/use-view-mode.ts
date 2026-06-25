import { useCallback, useEffect, useRef, useState } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  usePatchUserPreferencesCache,
  useUserPreferencesQuery,
} from '@/hooks/use-user-preferences';
import { getData, setData } from '@/lib/storage';
import { userPreferencesService } from '@/services/user-preferences.service';
import {
  defaultViewMode,
  isViewMode,
  type ViewMode,
  type ViewPreferenceKey,
} from '@/types/view-mode';

const LOCAL_CACHE_PREFIX = 'user-preferences:';

type PersistMode = 'api' | 'local';

export function useViewMode(
  preferenceKey: ViewPreferenceKey,
  options?: { persist?: PersistMode },
) {
  const persist = options?.persist ?? 'api';
  const isMobile = useIsMobile();
  const patchPreferencesCache = usePatchUserPreferencesCache();
  const { data: preferences, isSuccess: preferencesLoaded, isError: preferencesError } =
    useUserPreferencesQuery(persist === 'api');
  const [viewMode, setViewModeState] = useState<ViewMode>(() =>
    defaultViewMode(isMobile),
  );
  const [isReady, setIsReady] = useState(false);
  const saveTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const rawCached = getData(`${LOCAL_CACHE_PREFIX}${preferenceKey}`);
    const cached = typeof rawCached === 'string' ? rawCached : undefined;
    if (isViewMode(cached)) {
      setViewModeState(cached);
    }

    if (persist === 'local') {
      if (!isViewMode(cached)) {
        setViewModeState(defaultViewMode(isMobile));
      }
      setIsReady(true);
      return;
    }

    if (!preferencesLoaded && !preferencesError) {
      return;
    }

    const saved = preferences?.[preferenceKey];
    if (isViewMode(saved)) {
      setViewModeState(saved);
      setData(`${LOCAL_CACHE_PREFIX}${preferenceKey}`, saved);
    } else if (!isViewMode(cached)) {
      setViewModeState(defaultViewMode(isMobile));
    }

    setIsReady(true);
  }, [isMobile, persist, preferenceKey, preferences, preferencesError, preferencesLoaded]);

  const persistPreference = useCallback(
    (mode: ViewMode) => {
      setData(`${LOCAL_CACHE_PREFIX}${preferenceKey}`, mode);

      if (persist === 'local') {
        return;
      }

      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }

      saveTimerRef.current = window.setTimeout(() => {
        void userPreferencesService.update({ [preferenceKey]: mode })
          .then((response) => {
            patchPreferencesCache(response.data.result);
          })
          .catch(() => undefined);
      }, 400);
    },
    [patchPreferencesCache, persist, preferenceKey],
  );

  const setViewMode = useCallback(
    (mode: ViewMode) => {
      setViewModeState(mode);
      persistPreference(mode);
    },
    [persistPreference],
  );

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  return {
    viewMode,
    setViewMode,
    isReady,
    isMobile,
    savedViewMode: viewMode,
  };
}
