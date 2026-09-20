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
import type { GenerationType } from "@/types";

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

export function ModelSelect({
  type,
  provider,
  value,
  onChange,
  disabled,
  id,
  includeDisabled,
}: ModelSelectProps) {
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
      <SelectContent>
        {groups.map((group) =>
          group.models.length ? (
            <SelectGroup key={group.provider.id}>
              <SelectLabel>{group.provider.displayName}</SelectLabel>
              {group.models.map((model) => (
                <SelectItem key={model.id} value={model.id}>
                  {model.displayName}
                  {model.recommended ? " · recommended" : ""}
                </SelectItem>
              ))}
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
