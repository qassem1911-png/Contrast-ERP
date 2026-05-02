import { useEffect, useRef } from "react";
import { supabase } from "../integrations/supabase/client";

/**
 * Subscribes to postgres_changes on the given tables and calls `onChange`
 * whenever any INSERT/UPDATE/DELETE happens. Use this to refetch on the fly.
 *
 * Pass a stable callback (e.g. wrap in useCallback) — we keep a ref to
 * always invoke the latest version without resubscribing.
 */
export function useRealtime(
  channelName: string,
  tables: string[],
  onChange: () => void,
) {
  const cbRef = useRef(onChange);
  cbRef.current = onChange;

  useEffect(() => {
    const channel = supabase.channel(channelName);
    tables.forEach((table) => {
      (channel as unknown as {
        on: (e: string, f: Record<string, string>, cb: () => void) => typeof channel;
      }).on("postgres_changes", { event: "*", schema: "public", table }, () => cbRef.current());
    });
    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelName, tables.join(",")]);
}
