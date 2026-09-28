import * as React from "react";

import { useAsyncData, type AsyncState } from "@/hooks/use-async-data";
import { fetchModelCatalog } from "@/services/data-service";
import { setProviderCatalog, subscribeProviderCatalog } from "@/data/providers";
import type { ProviderInfo } from "@/types";

/**
 * Re-render whenever the model catalog is replaced, so model pickers and
 * provider labels reflect the latest `ai_models` read.
 */
export function useProviderCatalogVersion(): number {
  const [version, setVersion] = React.useState(0);
  React.useEffect(
    () => subscribeProviderCatalog(() => setVersion((value) => value + 1)),
    [],
  );
  return version;
}

/**
 * Load the live model catalog and publish it to the shared provider registry.
 *
 * The catalog comes from the backend-owned `ai_models` collection, so adding a
 * model there (for example a Higgsfield image model) makes it selectable under
 * AI Routing after a page reload, with no rebuild of this console.
 */
export function useModelCatalog(): AsyncState<ProviderInfo[]> & {
  catalog: ProviderInfo[];
} {
  const query = useAsyncData(fetchModelCatalog, []);
  useProviderCatalogVersion();

  React.useEffect(() => {
    if (query.data) setProviderCatalog(query.data);
  }, [query.data]);

  return { ...query, catalog: query.data ?? [] };
}
