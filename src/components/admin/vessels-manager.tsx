"use client";

import { useState } from "react";
import { Pencil, Plus, Power, PowerOff, Search, SearchX } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { useAdminAction } from "@/components/admin/use-admin-action";
import { VesselFormSheet } from "@/components/admin/vessel-form-sheet";
import { INPUT_CLASS } from "@/components/forms/form-field";
import { NativeSelect } from "@/components/forms/native-select";
import { QueryState } from "@/components/query-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { locations, packages, vessels, vesselTypes } from "@/lib/data";
import { useRepoQuery } from "@/lib/data/hooks";
import { setVesselStatus } from "@/lib/services/admin/vessels";
import type { LookupItem, Vessel, VesselStatus } from "@/lib/types";

async function loadVesselData() {
  const [vesselList, typeList, packageList, locationList] = await Promise.all([
    vessels.list(),
    vesselTypes.list(),
    packages.list(),
    locations.list(),
  ]);
  return { vessels: vesselList, vesselTypes: typeList, packages: packageList, locations: locationList };
}

const nameOf = (items: LookupItem[], id: string) => items.find((item) => item.id === id)?.name ?? "—";

export function VesselsManager() {
  const query = useRepoQuery(["vessels", "admin"], loadVesselData);
  const [search, setSearch] = useState("");
  const [packageId, setPackageId] = useState("");
  const [typeId, setTypeId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [status, setStatus] = useState<VesselStatus | "">("ACTIVE");
  const [editing, setEditing] = useState<{ vessel: Vessel | null } | null>(null);

  const toggleStatus = useAdminAction(
    (actor, vessel: Vessel) => setVesselStatus(actor, vessel.id, vessel.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"),
    { success: (v) => `${v.name} ${v.status === "ACTIVE" ? "reactivated" : "deactivated"}`, invalidates: [["vessels"]] },
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vessels"
        description="The fleet register. Deactivate a vessel to retire it; history is kept."
        actions={
          <Button className="h-10" onClick={() => setEditing({ vessel: null })} disabled={!query.data}>
            <Plus /> Add vessel
          </Button>
        }
      />

      <QueryState query={query}>
        {(data) => {
          const term = search.trim().toLowerCase();
          const shown = data.vessels.filter(
            (v) =>
              (!term || v.name.toLowerCase().includes(term) || (v.contractor ?? "").toLowerCase().includes(term)) &&
              (!packageId || v.packageId === packageId) &&
              (!typeId || v.vesselTypeId === typeId) &&
              (!locationId || v.defaultLocationId === locationId) &&
              (!status || v.status === status),
          );
          const actions = (vessel: Vessel) => (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="h-9" onClick={() => setEditing({ vessel })}>
                <Pencil /> Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-9"
                disabled={toggleStatus.isPending}
                onClick={() => toggleStatus.mutate(vessel)}
              >
                {vessel.status === "ACTIVE" ? (
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
          );

          return (
            <>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                <div className="relative sm:col-span-2 lg:col-span-1">
                  <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    aria-label="Search vessels"
                    placeholder="Search vessels…"
                    className={`${INPUT_CLASS} pl-9`}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <NativeSelect aria-label="Filter by package" value={packageId} onChange={(e) => setPackageId(e.target.value)}>
                  <option value="">All packages</option>
                  {data.packages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </NativeSelect>
                <NativeSelect aria-label="Filter by vessel type" value={typeId} onChange={(e) => setTypeId(e.target.value)}>
                  <option value="">All types</option>
                  {data.vesselTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </NativeSelect>
                <NativeSelect aria-label="Filter by location" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
                  <option value="">All locations</option>
                  {data.locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </NativeSelect>
                <NativeSelect
                  aria-label="Filter by status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as VesselStatus | "")}
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                  <option value="">All statuses</option>
                </NativeSelect>
              </div>

              <p className="text-sm text-muted-foreground">
                Showing {shown.length} of {data.vessels.length} vessels
              </p>

              {shown.length === 0 ? (
                <EmptyState icon={SearchX} title="No vessels match these filters">
                  Try another search, package, type, location or status.
                </EmptyState>
              ) : (
                <>
                  <ul className="space-y-3 md:hidden">
                    {shown.map((v) => (
                      <li key={v.id} className="space-y-2 rounded-xl border bg-card p-4">
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-medium">{v.name}</span>
                          <StatusBadge status={v.status} />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {nameOf(data.vesselTypes, v.vesselTypeId)} · {nameOf(data.packages, v.packageId)} ·{" "}
                          {nameOf(data.locations, v.defaultLocationId)}
                          {v.contractor && ` · ${v.contractor}`}
                        </p>
                        {actions(v)}
                      </li>
                    ))}
                  </ul>

                  <div className="hidden overflow-x-auto rounded-xl border bg-card md:block">
                    <table className="w-full text-sm">
                      <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                        <tr>
                          <th className="px-4 py-3 font-medium">Vessel</th>
                          <th className="px-4 py-3 font-medium">Type</th>
                          <th className="px-4 py-3 font-medium">Package</th>
                          <th className="px-4 py-3 font-medium">Default location</th>
                          <th className="px-4 py-3 font-medium">Contractor</th>
                          <th className="px-4 py-3 font-medium">Status</th>
                          <th className="px-4 py-3 font-medium">
                            <span className="sr-only">Actions</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {shown.map((v) => (
                          <tr key={v.id}>
                            <td className="px-4 py-3 font-medium">{v.name}</td>
                            <td className="px-4 py-3">{nameOf(data.vesselTypes, v.vesselTypeId)}</td>
                            <td className="px-4 py-3">{nameOf(data.packages, v.packageId)}</td>
                            <td className="px-4 py-3">{nameOf(data.locations, v.defaultLocationId)}</td>
                            <td className="px-4 py-3 text-muted-foreground">{v.contractor ?? "—"}</td>
                            <td className="px-4 py-3">
                              <StatusBadge status={v.status} />
                            </td>
                            <td className="px-4 py-3">{actions(v)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              <VesselFormSheet
                open={editing !== null}
                onOpenChange={(open) => !open && setEditing(null)}
                vessel={editing?.vessel ?? null}
                vesselTypes={data.vesselTypes}
                packages={data.packages}
                locations={data.locations}
              />
            </>
          );
        }}
      </QueryState>
    </div>
  );
}
