"use client";

import { useState } from "react";
import { Check, Pencil, Plus, Power, PowerOff, X } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/admin/page-header";
import { ActiveBadge } from "@/components/admin/status-badge";
import { useAdminAction } from "@/components/admin/use-admin-action";
import { INPUT_CLASS } from "@/components/forms/form-field";
import { QueryState } from "@/components/query-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { locations, vessels } from "@/lib/data";
import { useRepoQuery } from "@/lib/data/hooks";
import { createLocation, renameLocation, setLocationActive } from "@/lib/services/admin/locations";
import { ValidationError } from "@/lib/services/errors";
import type { Location } from "@/lib/types";

async function loadLocationData() {
  const [locationList, vesselList] = await Promise.all([locations.list(), vessels.list()]);
  const vesselCount = new Map<string, number>();
  for (const v of vesselList) vesselCount.set(v.defaultLocationId, (vesselCount.get(v.defaultLocationId) ?? 0) + 1);
  return { locations: locationList, vesselCount };
}

const fieldError = (error: unknown) =>
  error instanceof ValidationError ? (error.fieldErrors as { name?: string }).name : undefined;

export function LocationsManager() {
  const query = useRepoQuery(["locations", "admin"], loadLocationData);
  const [newName, setNewName] = useState("");
  const [addError, setAddError] = useState<string>();
  const [renaming, setRenaming] = useState<{ id: string; name: string; error?: string } | null>(null);
  const invalidates = [["locations"]];

  const add = useAdminAction((actor, name: string) => createLocation(actor, { name }), {
    success: (l) => `${l.name} added`,
    invalidates,
    onSuccess: () => setNewName(""),
  });
  const rename = useAdminAction((actor, v: { id: string; name: string }) => renameLocation(actor, v.id, { name: v.name }), {
    success: (l) => `Location renamed to ${l.name}`,
    invalidates,
    onSuccess: () => setRenaming(null),
  });
  const toggle = useAdminAction((actor, l: Location) => setLocationActive(actor, l.id, !l.active), {
    success: (l) => `${l.name} ${l.active ? "reactivated" : "deactivated"}`,
    invalidates,
  });

  async function onAdd(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAddError(undefined);
    await add.mutateAsync(newName).catch((error) => setAddError(fieldError(error)));
  }

  async function onRename(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!renaming) return;
    await rename.mutateAsync(renaming).catch((error) => setRenaming((r) => r && { ...r, error: fieldError(error) }));
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Locations" description="Operating locations offered when starting an assessment." />

      <form onSubmit={onAdd} noValidate className="space-y-1.5">
        <div className="flex gap-2">
          <Input
            aria-label="New location name"
            aria-invalid={addError ? true : undefined}
            placeholder="New location name"
            className={INPUT_CLASS}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <Button type="submit" className="h-11" disabled={add.isPending}>
            <Plus /> Add
          </Button>
        </div>
        {addError && <p className="text-sm text-destructive">{addError}</p>}
      </form>

      <QueryState query={query}>
        {({ locations: list, vesselCount }) =>
          list.length === 0 ? (
            <EmptyState title="No locations yet">Add the first location above.</EmptyState>
          ) : (
            <ul className="divide-y rounded-xl border bg-card">
              {list.map((location) => {
                const count = vesselCount.get(location.id) ?? 0;
                const isRenaming = renaming?.id === location.id;
                return (
                  <li key={location.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    {isRenaming ? (
                      <form onSubmit={onRename} noValidate className="flex-1 space-y-1.5">
                        <div className="flex gap-2">
                          <Input
                            aria-label={`New name for ${location.name}`}
                            aria-invalid={renaming.error ? true : undefined}
                            className={INPUT_CLASS}
                            value={renaming.name}
                            onChange={(e) => setRenaming({ ...renaming, name: e.target.value, error: undefined })}
                            autoFocus
                          />
                          <Button type="submit" size="icon" className="size-11" aria-label="Save name" disabled={rename.isPending}>
                            <Check />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="size-11"
                            aria-label="Cancel rename"
                            onClick={() => setRenaming(null)}
                          >
                            <X />
                          </Button>
                        </div>
                        {renaming.error && <p className="text-sm text-destructive">{renaming.error}</p>}
                      </form>
                    ) : (
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{location.name}</span>
                          <ActiveBadge active={location.active} />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Default location for {count} vessel{count === 1 ? "" : "s"}
                          {!location.active && count > 0 && " (still shown on those vessels)"}
                        </p>
                      </div>
                    )}
                    {!isRenaming && (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-9"
                          onClick={() => setRenaming({ id: location.id, name: location.name })}
                        >
                          <Pencil /> Rename
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-9"
                          disabled={toggle.isPending}
                          onClick={() => toggle.mutate(location)}
                        >
                          {location.active ? (
                            <>
                              <PowerOff /> Deactivate
                            </>
                          ) : (
                            <>
                              <Power /> Reactivate
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )
        }
      </QueryState>
    </div>
  );
}
