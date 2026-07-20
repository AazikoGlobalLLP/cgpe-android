import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

/** Loads data when the screen gains focus; exposes pull-to-refresh state. */
export function useData<T>(loader: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const run = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const d = await loader();
      setData(d);
    } catch {
      // demo mode never throws; real mode surfaces errors via empty state
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFocusEffect(
    useCallback(() => {
      run();
    }, [run])
  );

  const refresh = useCallback(() => run(true), [run]);
  return { data, loading, refreshing, refresh };
}
