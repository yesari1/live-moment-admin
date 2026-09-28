import * as React from "react";

export interface AsyncState<T> {
  data: T | undefined;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export interface AsyncDataOptions {
  /**
   * Re-run the fetcher on this interval. Polls are silent: the current data
   * stays on screen instead of flashing a skeleton every tick.
   */
  pollIntervalMs?: number;
}

/**
 * Minimal async data hook with loading/error states and manual refresh.
 * `deps` controls when the fetcher re-runs.
 */
export function useAsyncData<T>(
  fetcher: () => Promise<T>,
  deps: React.DependencyList = [],
  options: AsyncDataOptions = {},
): AsyncState<T> {
  const [data, setData] = React.useState<T | undefined>(undefined);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const fetcherRef = React.useRef(fetcher);
  fetcherRef.current = fetcher;

  // A poll must never start while the previous read is still in flight, or a
  // slow Firestore read would queue up faster than it drains.
  const inFlight = React.useRef(false);

  const run = React.useCallback(async (silent: boolean) => {
    if (inFlight.current) return;
    inFlight.current = true;
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const result = await fetcherRef.current();
      setData(result);
      if (silent) setError(null);
    } catch (err) {
      // A failed poll keeps the last good data on screen; only a full load
      // replaces the view with an error.
      if (!silent) setError(err instanceof Error ? err.message : "Unexpected error.");
    } finally {
      inFlight.current = false;
      if (!silent) setLoading(false);
    }
  }, []);

  const load = React.useCallback(() => run(false), [run]);

  React.useEffect(() => {
    void run(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, ...deps]);

  const pollIntervalMs = options.pollIntervalMs;
  React.useEffect(() => {
    if (!pollIntervalMs) return;
    const timer = window.setInterval(() => {
      // A hidden tab has nobody watching it and still costs Firestore reads.
      if (document.visibilityState === "hidden") return;
      void run(true);
    }, pollIntervalMs);
    // Catch up immediately when the tab becomes visible again.
    const onVisible = () => {
      if (document.visibilityState === "visible") void run(true);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [pollIntervalMs, run]);

  return { data, loading, error, refresh: load };
}
