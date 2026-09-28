import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getModelDisplayName,
  getModels,
  getProviderDisplayName,
  getProviders,
} from "@/data/providers";
import { useProviderCatalogVersion } from "@/hooks/use-model-catalog";
import { formatUnitPrice } from "@/lib/format";
import type { GenerationType, ModelInfo } from "@/types";

interface ModelSelectProps {
  type: GenerationType;
  /** Limit the list to a single provider. When omitted, all providers are grouped. */
  provider?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  id?: string;
  includeDisabled?: boolean;
}

/**
 * Price exactly as the backend bills it. A per-second rate is labelled as such
 * and is never rendered as a per-request price, which would read as several
 * times the real cost on a multi-second video.
 */
function modelPriceLabel(model: ModelInfo): string {
  if (model.free) return "free";
  if (model.estimatedCost === 0) return "free";
  if (model.estimatedCost != null) return formatUnitPrice(model.estimatedCost);
  if (model.estimatedCostPerSecond != null) {
    return `${formatUnitPrice(model.estimatedCostPerSecond)}/s`;
  }
  return "";
}

export function ModelSelect({
  type,
  provider,
  value,
  onChange,
  disabled,
  id,
  includeDisabled,
}: ModelSelectProps) {
  useProviderCatalogVersion();
  const providers = getProviders(type).filter(
    (p) => !provider || p.id === provider,
  );

  const groups = providers.map((p) => ({
    provider: p,
    models: getModels(p.id, type).filter(
      (model) => includeDisabled || model.enabled,
    ),
  }));

  const knownIds = new Set(groups.flatMap((g) => g.models.map((m) => m.id)));
  const missing = value && !knownIds.has(value);

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger id={id} aria-label="Model">
        <SelectValue placeholder="Select a model" />
      </SelectTrigger>
      <SelectContent className="max-h-80">
        {groups.map((group) =>
          group.models.length ? (
            <SelectGroup key={group.provider.id}>
              <SelectLabel>{group.provider.displayName}</SelectLabel>
              {group.models.map((model) => {
                const price = modelPriceLabel(model);
                return (
                  <SelectItem key={model.id} value={model.id}>
                    {model.displayName}
                    {model.recommended ? " · recommended" : ""}
                    {price ? ` · ${price}` : ""}
                    {model.enabled ? "" : " · disabled"}
                  </SelectItem>
                );
              })}
            </SelectGroup>
          ) : null,
        )}
        {missing && (
          <SelectGroup>
            <SelectLabel>Current</SelectLabel>
            <SelectItem value={value}>{getModelDisplayName(value)}</SelectItem>
          </SelectGroup>
        )}
        {!knownIds.size && !missing && (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">
            No models available for this provider.
          </div>
        )}
        {provider && !knownIds.size && missing && (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">
            Provider: {getProviderDisplayName(provider)}
          </div>
        )}
      </SelectContent>
    </Select>
  );
}
