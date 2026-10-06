import * as React from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { ErrorState } from "@/components/shared/error-state";
import { PanelSkeleton } from "@/components/shared/loading-skeletons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAsyncData } from "@/hooks/use-async-data";
import { useAuth } from "@/hooks/use-auth";
import { fetchModelCatalog, isLiveData } from "@/services/data-service";
import { fetchModelPrices, saveModelPrice } from "@/services/model-pricing";
import { type ModelPrice, type ModelPrices } from "@/lib/model-pricing";
import type { ModelInfo } from "@/types";

async function loadPricing() {
  const [catalog, prices] = await Promise.all([fetchModelCatalog(), fetchModelPrices()]);
  if (isLiveData && catalog.source !== "firestore")
    throw new Error("The live model catalog could not be loaded. Check admin access to ai_models and retry.");
  return { ...catalog, prices };
}

export function ModelPricingPage() {
  const query = useAsyncData(loadPricing);
  const [search, setSearch] = React.useState("");
  const [type, setType] = React.useState("all");
  const [localPrices, setLocalPrices] = React.useState<ModelPrices>({});
  const models = (query.data?.providers ?? []).flatMap(provider =>
    [...provider.imageModels, ...provider.videoModels].map(model => ({ ...model, providerName: provider.displayName })));
  const filtered = models.filter(model => (type === "all" || type === model.type) &&
    `${model.displayName} ${model.id} ${model.providerName}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="space-y-6">
    <PageHeader title="Model Pricing" description="Set image and video cost estimates in USD. Saved prices apply only to jobs created after saving. Earlier jobs keep the price in effect when they were created. Provider billing is managed separately." />
    {query.error ? <ErrorState message={query.error} onRetry={query.refresh} /> : query.loading ? <PanelSkeleton rows={6} /> : <>
      <div className="flex flex-wrap gap-3">
        <Input aria-label="Search models" placeholder="Search model or provider…" className="max-w-sm" value={search} onChange={e => setSearch(e.target.value)} />
        <Select value={type} onValueChange={setType}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent>
          <SelectItem value="all">All models ({models.length})</SelectItem><SelectItem value="image">Image</SelectItem><SelectItem value="video">Video</SelectItem>
        </SelectContent></Select>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {filtered.map(model => <PriceEditor key={model.id} model={model}
          saved={localPrices[model.id] ?? query.data?.prices[model.id]}
          onSaved={price => setLocalPrices(previous => ({ ...previous, [model.id]: price }))} />)}
      </div>
      {filtered.length === 0 && <p className="text-sm text-muted-foreground">No models match your search.</p>}
    </>}
  </div>;
}

function PriceEditor({ model, saved, onSaved }: { model: ModelInfo & { providerName: string }; saved?: ModelPrice; onSaved: (price: ModelPrice) => void }) {
  const { user } = useAuth();
  const defaults = saved ?? { type: model.type, mode: model.type === "image" ? "per_image" :
    model.estimatedCostPerSecond !== null ? "per_second" : "fixed",
    amountUsd: model.estimatedCostPerSecond ?? model.estimatedCost,
    fixedDurationSeconds: model.capabilities?.supportedDurationsSeconds.length === 1
      ? model.capabilities.supportedDurationsSeconds[0] : null };
  const [mode, setMode] = React.useState<ModelPrice["mode"]>(defaults.mode);
  const [amount, setAmount] = React.useState(defaults.amountUsd?.toString() ?? "");
  const [duration, setDuration] = React.useState(defaults.fixedDurationSeconds?.toString() ?? "");
  const [baseline, setBaseline] = React.useState({ mode, amount, duration });
  const [custom, setCustom] = React.useState(!!saved);
  const [saving, setSaving] = React.useState(false);
  const dirty = mode !== baseline.mode || amount !== baseline.amount || duration !== baseline.duration;
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!user || !amount.trim()) return;
    setSaving(true);
    try {
      const next = await saveModelPrice(model.id, { type: model.type, mode, amountUsd: Number(amount),
        fixedDurationSeconds: mode === "fixed" && duration.trim() ? Number(duration) : null }, user);
      onSaved(next);
      setBaseline({ mode, amount, duration });
      setCustom(true);
      toast.success(`${model.displayName} price saved.`);
    } catch (error) {
      toast.error("Could not save price", { description: error instanceof Error ? error.message : undefined });
    } finally { setSaving(false); }
  }
  const prefix = `price-${model.id}`;
  return <Card>
    <CardHeader className="pb-3">
      <div className="flex items-start justify-between gap-3"><div className="min-w-0">
        <CardTitle className="break-words text-sm">{model.displayName}</CardTitle>
        <p className="mt-1 text-xs text-muted-foreground">{model.providerName} · {model.type}{!model.enabled && " · Disabled"}</p>
        <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">{model.id}</p>
      </div><Badge variant="muted">{custom ? "Custom price" : "Default price"}</Badge></div>
    </CardHeader>
    <CardContent>
      <form className="space-y-4" onSubmit={submit}>
        <fieldset disabled={saving} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2"><Label htmlFor={`${prefix}-mode`}>Billing method</Label>
            {model.type === "image" ? <p className="flex h-10 items-center text-sm">Per image</p> :
              <Select value={mode} onValueChange={value => setMode(value as ModelPrice["mode"])}>
                <SelectTrigger id={`${prefix}-mode`}><SelectValue /></SelectTrigger><SelectContent>
                  <SelectItem value="per_second">Per second</SelectItem><SelectItem value="fixed">Fixed per video</SelectItem>
                </SelectContent></Select>}
          </div>
          <div className="space-y-2"><Label htmlFor={`${prefix}-amount`}>{mode === "per_second" ? "USD / second" : mode === "per_image" ? "USD / image" : "USD / video"}</Label>
            <Input id={`${prefix}-amount`} required type="number" min="0" step="any" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} />
          </div>
          {mode === "fixed" && <div className="space-y-2 sm:col-span-2"><Label htmlFor={`${prefix}-duration`}>Fixed video duration (seconds, optional)</Label>
            <Input id={`${prefix}-duration`} className="max-w-40" type="number" min="0.001" step="any" placeholder="e.g. 5" value={duration} onChange={e => setDuration(e.target.value)} />
            <p className="text-xs text-muted-foreground">The price is charged once per video, regardless of duration.</p>
          </div>}
        </fieldset>
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">{dirty ? "Unsaved changes" : custom ? "Saved" : "Save to use this price in estimates"}</p>
          <Button type="submit" size="sm" disabled={saving || !amount.trim() || (custom && !dirty)}><Save className="h-4 w-4" />{saving ? "Saving…" : "Save price"}</Button>
        </div>
      </form>
    </CardContent>
  </Card>;
}
