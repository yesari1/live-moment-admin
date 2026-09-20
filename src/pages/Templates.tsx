import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Copy,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Power,
  Save,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { ErrorState } from "@/components/shared/error-state";
import { StatCard } from "@/components/shared/stat-card";
import { ConfirmActionDialog } from "@/components/shared/confirm-action-dialog";
import { useAsyncData } from "@/hooks/use-async-data";
import { useAuth } from "@/hooks/use-auth";
import {
  deleteTemplate,
  fetchTemplates,
  saveTemplate,
} from "@/services/data-service";
import { formatNumber, formatRelative } from "@/lib/format";
import { PLAN_LABELS, PLAN_ORDER } from "@/data/plans";
import type { GenerationType, PlanId, TemplateRecord } from "@/types";

const schema = z.object({
  id: z
    .string()
    .regex(/^[a-z0-9_]{1,40}$/, "Use lowercase letters, numbers and underscores (max 40)."),
  title: z.string().min(1, "Title is required.").max(80, "Max 80 characters."),
  description: z.string().max(240, "Max 240 characters.").optional(),
  category: z.string().min(1, "Category is required."),
  type: z.enum(["image", "video"]),
  enabled: z.boolean(),
  sortOrder: z.coerce.number().int().min(0),
  activeVersion: z.coerce.number().int().min(1),
  defaultLoopFix: z.boolean(),
  supportedPlans: z.array(z.enum(["free", "single", "live_weather", "live_weather_plus"])),
});

type FormValues = z.infer<typeof schema>;

const emptyTemplate: TemplateRecord = {
  id: "",
  title: "",
  description: "",
  iconKey: "",
  category: "uncategorized",
  type: "video",
  enabled: true,
  sortOrder: 0,
  activeVersion: 1,
  defaultLoopFix: false,
  supportedPlans: ["free", "single", "live_weather", "live_weather_plus"],
  previewUrl: null,
  updatedAt: null,
};

export function TemplatesPage() {
  const { user: actor } = useAuth();
  const query = useAsyncData(fetchTemplates);
  const [editing, setEditing] = React.useState<TemplateRecord | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [deleting, setDeleting] = React.useState<TemplateRecord | null>(null);

  const templates = query.data ?? [];

  const persist = async (template: TemplateRecord, isNew: boolean) => {
    if (!actor) return;
    try {
      await saveTemplate(
        { ...template, iconKey: template.iconKey || template.id },
        { uid: actor.uid, email: actor.email },
      );
      toast.success(isNew ? "Template created." : "Template saved.");
      await query.refresh();
    } catch (error) {
      toast.error("Failed to save template", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  const toggleEnabled = async (template: TemplateRecord) => {
    await persist(
      { ...template, enabled: !template.enabled },
      false,
    );
  };

  const duplicate = async (template: TemplateRecord) => {
    const baseId = `${template.id}_copy`.slice(0, 40);
    let id = baseId;
    let counter = 1;
    while (templates.some((t) => t.id === id)) {
      id = `${baseId.slice(0, 36)}_${counter}`;
      counter += 1;
    }
    await persist(
      {
        ...template,
        id,
        title: `${template.title} (copy)`,
        sortOrder: (template.sortOrder ?? 0) + 1,
      },
      true,
    );
  };

  const confirmDelete = async () => {
    if (!deleting || !actor) return;
    try {
      await deleteTemplate(deleting.id, { uid: actor.uid, email: actor.email });
      toast.success("Template deleted.");
      setDeleting(null);
      await query.refresh();
    } catch (error) {
      toast.error("Failed to delete template", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  const columns = React.useMemo<ColumnDef<TemplateRecord, unknown>[]>(
    () => [
      {
        accessorKey: "title",
        header: "Template",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{row.original.title}</p>
            <p className="truncate font-mono text-xs text-muted-foreground">
              {row.original.id}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "category",
        header: "Category",
        cell: ({ row }) => (
          <Badge variant="muted">{row.original.category}</Badge>
        ),
      },
      {
        accessorKey: "type",
        header: "Type",
        cell: ({ row }) => (
          <Badge variant={row.original.type === "image" ? "info" : "default"}>
            {row.original.type}
          </Badge>
        ),
      },
      {
        accessorKey: "enabled",
        header: "Status",
        cell: ({ row }) => (
          <Badge variant={row.original.enabled ? "success" : "muted"}>
            {row.original.enabled ? "Active" : "Inactive"}
          </Badge>
        ),
      },
      {
        accessorKey: "sortOrder",
        header: "Sort",
        cell: ({ row }) => (
          <span className="tabular-nums">{row.original.sortOrder}</span>
        ),
      },
      {
        accessorKey: "activeVersion",
        header: "Version",
        cell: ({ row }) => (
          <span className="tabular-nums">v{row.original.activeVersion}</span>
        ),
      },
      {
        accessorKey: "supportedPlans",
        header: "Plans",
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {row.original.supportedPlans.map((plan) => (
              <Badge key={plan} variant="outline" className="text-[10px]">
                {PLAN_LABELS[plan]}
              </Badge>
            ))}
          </div>
        ),
      },
      {
        accessorKey: "updatedAt",
        header: "Updated",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {formatRelative(row.original.updatedAt)}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        enableHiding: false,
        cell: ({ row }) => (
          <div
            className="flex justify-end"
            onClick={(event) => event.stopPropagation()}
          >
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Template actions">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setEditing(row.original)}>
                  <Pencil className="h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void toggleEnabled(row.original)}>
                  <Power className="h-4 w-4" />
                  {row.original.enabled ? "Disable" : "Enable"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void duplicate(row.original)}>
                  <Copy className="h-4 w-4" />
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => setDeleting(row.original)}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [templates],
  );

  if (query.error) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Templates"
          description="Manage generation templates remotely."
        />
        <ErrorState message={query.error} onRetry={query.refresh} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Templates"
        description="Create, edit, reorder and disable generation templates. Prompt changes become active without publishing a new app version."
        actions={
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" />
            New template
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Templates" value={formatNumber(templates.length)} loading={query.loading} />
        <StatCard
          label="Active"
          value={formatNumber(templates.filter((t) => t.enabled).length)}
          loading={query.loading}
        />
        <StatCard
          label="Video templates"
          value={formatNumber(templates.filter((t) => t.type === "video").length)}
          loading={query.loading}
        />
        <StatCard
          label="Image templates"
          value={formatNumber(templates.filter((t) => t.type === "image").length)}
          loading={query.loading}
        />
      </div>

      <DataTable
        columns={columns}
        data={templates}
        loading={query.loading}
        searchPlaceholder="Search templates…"
        emptyTitle="No templates found"
        emptyDescription="Create a template to make it available for remote generation."
        getRowId={(row) => row.id}
        onRowClick={(row) => setEditing(row)}
        initialPageSize={20}
      />

      <TemplateDialog
        open={creating || editing !== null}
        template={editing}
        existingIds={templates.map((t) => t.id)}
        onOpenChange={(open) => {
          if (!open) {
            setCreating(false);
            setEditing(null);
          }
        }}
        onSubmit={async (template, isNew) => {
          await persist(template, isNew);
          setCreating(false);
          setEditing(null);
        }}
      />

      <ConfirmActionDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete this template?"
        destructive
        confirmLabel="Delete template"
        onConfirm={confirmDelete}
        description={
          <p>
            The template <span className="font-medium text-foreground">{deleting?.title}</span>{" "}
            will be removed. Existing generations are not affected.
          </p>
        }
      />
    </div>
  );
}

function TemplateDialog({
  open,
  template,
  existingIds,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  template: TemplateRecord | null;
  existingIds: string[];
  onOpenChange: (open: boolean) => void;
  onSubmit: (template: TemplateRecord, isNew: boolean) => Promise<void>;
}) {
  const isNew = template === null;
  const [saving, setSaving] = React.useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: toValues(template ?? emptyTemplate),
  });

  React.useEffect(() => {
    if (open) form.reset(toValues(template ?? emptyTemplate));
  }, [open, template, form]);

  const submit = form.handleSubmit(async (values) => {
    if (isNew && existingIds.includes(values.id)) {
      form.setError("id", { message: "A template with this ID already exists." });
      return;
    }
    setSaving(true);
    try {
      await onSubmit(
        {
          ...(template ?? emptyTemplate),
          ...values,
          description: values.description ?? "",
          iconKey: template?.iconKey || values.id,
          previewUrl: template?.previewUrl ?? null,
          updatedAt: new Date(),
        },
        isNew,
      );
    } finally {
      setSaving(false);
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isNew ? "New template" : `Edit ${template?.title}`}</DialogTitle>
          <DialogDescription>
            Templates define the keyframe and video prompts used by Live Moment
            generation. Changes are published to Firebase immediately on save.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Template ID</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        disabled={!isNew}
                        placeholder="garden_swing"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Garden Swing" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="weather" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <FormControl>
                      <select
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                        value={field.value}
                        onChange={(e) =>
                          field.onChange(e.target.value as GenerationType)
                        }
                      >
                        <option value="video">Video</option>
                        <option value="image">Image</option>
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sortOrder"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sort order</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="activeVersion"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Active version</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="enabled"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 space-y-0">
                    <FormLabel>Active</FormLabel>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        aria-label="Template active"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="defaultLoopFix"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 space-y-0">
                    <FormLabel>Loop fix</FormLabel>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        aria-label="Default loop fix"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="supportedPlans"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Supported plans</FormLabel>
                  <FormDescription>
                    Templates are only offered to these plans.
                  </FormDescription>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {PLAN_ORDER.map((plan) => {
                      const checked = field.value.includes(plan);
                      return (
                        <label
                          key={plan}
                          className="flex items-center gap-2 rounded-md border p-2 text-sm"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(value) => {
                              const set = new Set(field.value as PlanId[]);
                              if (value) set.add(plan);
                              else set.delete(plan);
                              field.onChange([...set]);
                            }}
                          />
                          {PLAN_LABELS[plan]}
                        </label>
                      );
                    })}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {isNew ? "Create template" : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function toValues(template: TemplateRecord): FormValues {
  return {
    id: template.id,
    title: template.title,
    description: template.description,
    category: template.category,
    type: template.type,
    enabled: template.enabled,
    sortOrder: template.sortOrder,
    activeVersion: template.activeVersion,
    defaultLoopFix: template.defaultLoopFix,
    supportedPlans: template.supportedPlans,
  };
}
