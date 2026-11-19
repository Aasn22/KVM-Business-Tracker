import { useEffect, useRef, useState } from "react";
import { Building2, LockKeyhole, Plus, Save, Upload, X } from "lucide-react";
import { db } from "./api";
import TeamDirectory from "./TeamDirectory";
import {
  defaultProperty,
  inventoryTotal,
  propertyStorageKey,
  validProperty,
  type PropertyRecord,
  type PropertyData,
} from "./property";
export default function PropertySetup({
  demo,
  userId,
  onDirtyChange,
  onBusyChange,
}: {
  demo: boolean;
  userId: string | null;
  onDirtyChange: (value: boolean) => void;
  onBusyChange: (value: boolean) => void;
}) {
  const [record, setRecord] = useState<PropertyRecord | null>(null);
  const [draft, setDraft] = useState<PropertyData>(
    structuredClone(defaultProperty),
  );
  const [superAdmin, setSuperAdmin] = useState(false);
  const [editing, setEditing] = useState(false);
  const [teamEditing, setTeamEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const canEdit = demo || superAdmin;
  useEffect(() => {
    let active = true;
    setLoading(true);
    setSuperAdmin(false);
    setEditing(false);
    setError("");
    setRecord(null);
    setDraft(structuredClone(defaultProperty));
    if (demo) {
      try {
        const raw = localStorage.getItem(propertyStorageKey);
        const stored = raw ? JSON.parse(raw) : null;
        const r =
          stored &&
          validProperty(stored.data) &&
          Number.isInteger(stored.version)
            ? stored
            : { data: structuredClone(defaultProperty), version: 0 };
        setRecord(r);
        setDraft(structuredClone(r.data));
      } catch {
        setRecord({ data: structuredClone(defaultProperty), version: 0 });
      }
      setLoading(false);
      return;
    }
    if (!userId || !db) {
      setLoading(false);
      return;
    }
    Promise.all([
      db
        .from("property_settings")
        .select("data,version,updated_at")
        .eq("id", 1)
        .maybeSingle(),
      db.rpc("is_super_admin"),
    ])
      .then(([settings, role]) => {
        if (!active) return;
        if (settings.error) throw settings.error;
        if (role.error) throw role.error;
        const r = (settings.data as PropertyRecord | null) ?? {
          data: structuredClone(defaultProperty),
          version: 0,
        };
        setRecord(r);
        setDraft(structuredClone(r.data));
        setSuperAdmin(role.data === true);
      })
      .catch((e) => {
        if (active)
          setError(
            `Unable to load Property Setup: ${e.message}. Apply the property setup migration before live use.`,
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [demo, userId]);
  const update = (next: PropertyData) => {
    if (!editing || !canEdit) return;
    setDraft(next);
    onDirtyChange(true);
    setMessage("");
  };
  const activity = (v: boolean) => {
    setBusy(v);
    onBusyChange(v);
  };
  async function save() {
    if (!editing || !canEdit || !record) return;
    if (!validProperty(draft)) {
      setError(
        "Check name, three-letter currency code, unique category names, whole-number inventory, and logo size.",
      );
      return;
    }
    activity(true);
    setError("");
    try {
      let version = record.version + 1;
      if (!demo) {
        const { data, error } = await db!.rpc("save_property_settings", {
          p_data: draft,
          p_version: record.version,
        });
        if (error) throw error;
        version = data;
      }
      const next = {
        data: structuredClone(draft),
        version,
        updated_at: new Date().toISOString(),
      };
      if (demo) localStorage.setItem(propertyStorageKey, JSON.stringify(next));
      setRecord(next);
      setEditing(false);
      onDirtyChange(false);
      setMessage(
        demo
          ? "Demo property saved in this browser."
          : "Property settings saved.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      activity(false);
    }
  }
  async function logo(file?: File) {
    if (!file || !editing) return;
    setError("");
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      file.size > 200000
    ) {
      setError(
        "Choose a PNG, JPEG or WebP logo under 200 KB. SVG is not supported.",
      );
      return;
    }
    activity(true);
    try {
      const source = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(Error("Unable to read image"));
        reader.readAsDataURL(file);
      });
      await new Promise<void>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve();
        image.onerror = () => reject(Error("Invalid image file"));
        image.src = source;
      });
      update({ ...draft, logo: source });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      activity(false);
      if (input.current) input.current.value = "";
    }
  }
  const data = editing ? draft : (record?.data ?? defaultProperty);
  if (!demo && !userId)
    return (
      <section className="panel empty">
        <LockKeyhole size={28} />
        <h2>Property Setup</h2>
        <p>
          Sign in to view property settings. Only a Super Admin can edit them.
        </p>
      </section>
    );
  if (loading)
    return (
      <section className="panel empty" role="status">
        Loading property settings…
      </section>
    );
  if (error && !record)
    return (
      <section className="panel empty">
        <h2>Property Setup unavailable</h2>
        <p role="alert">{error}</p>
        <p>
          No defaults are presented as saved property data. Reload after
          configuration is corrected.
        </p>
      </section>
    );
  return (
    <section className="panel property-setup">
      <div className="property-setup-heading">
        <div>
          <div className="eyebrow">PROPERTY PROFILE</div>
          <h2>{data.name}</h2>
          <p>
            {demo
              ? "Demo property configuration"
              : "Shared property configuration"}
          </p>
        </div>
        {canEdit && !editing && record && (
          <button
            className="button primary"
            disabled={teamEditing}
            onClick={() => {
              setDraft(structuredClone(record.data));
              setEditing(true);
              setError("");
            }}
          >
            {demo ? "Try Super Admin editing" : "Edit property"}
          </button>
        )}
        {editing && (
          <div className="editor-actions">
            <button
              className="button outline"
              disabled={busy}
              onClick={() => {
                setEditing(false);
                onDirtyChange(false);
                setDraft(structuredClone(record!.data));
              }}
            >
              Cancel
            </button>
            <button className="button primary" disabled={busy} onClick={save}>
              <Save size={15} />
              {busy ? "Saving…" : "Save property"}
            </button>
          </div>
        )}
      </div>
      <div className="notice">
        <LockKeyhole size={14} />{" "}
        {demo
          ? "Demo viewer by default. “Try Super Admin editing” changes fictional local settings only; no live privileges are granted."
          : superAdmin
            ? "Super Admin verified. Only this role can change property settings."
            : "Read-only access. Regular admins and market managers cannot edit property settings."}
      </div>
      {error && (
        <div role="alert" className="error">
          {error}
        </div>
      )}
      {message && (
        <div role="status" className="notice">
          {message}
        </div>
      )}
      <div className="notice">
        Property configuration is separate from saved financial history.
        Changing currency does not convert or relabel existing USD budgets.
        Inventory is a setup reference, not historical occupancy. Categories and
        logo here do not rewrite existing market records or application
        branding.
      </div>
      {editing && (
        <button
          className="button outline"
          disabled={busy}
          onClick={() =>
            update({
              ...draft,
              villaCategories: structuredClone(defaultProperty.villaCategories),
              mealPlans: [...defaultProperty.mealPlans],
              mealPlanCodes: { ...defaultProperty.mealPlanCodes },
            })
          }
        >
          Use supplied villa & meal plan configuration (75 units)
        </button>
      )}
      <fieldset disabled={busy}>
        <div className="property-details-grid">
          <div className="property-logo">
            <img src={data.logo} alt={`${data.name} logo`} />
            {editing && (
              <>
                <button
                  className="button outline"
                  onClick={() => input.current?.click()}
                >
                  <Upload size={14} />
                  Change logo
                </button>
                <input
                  ref={input}
                  type="file"
                  hidden
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => void logo(e.target.files?.[0])}
                />
                <button
                  className="text-button"
                  onClick={() =>
                    update({ ...draft, logo: defaultProperty.logo })
                  }
                >
                  Use resort logo
                </button>
              </>
            )}
          </div>
          <div className="property-fields">
            <label>
              Property name
              {editing ? (
                <input
                  aria-label="Property name"
                  maxLength={150}
                  value={draft.name}
                  onChange={(e) => update({ ...draft, name: e.target.value })}
                />
              ) : (
                <strong>{data.name}</strong>
              )}
            </label>
            <label>
              Address
              {editing ? (
                <textarea
                  aria-label="Property address"
                  maxLength={1000}
                  value={draft.address}
                  onChange={(e) =>
                    update({ ...draft, address: e.target.value })
                  }
                />
              ) : (
                <span className="property-address">
                  {data.address || "Not configured"}
                </span>
              )}
            </label>
            <label>
              Property currency (ISO code)
              {editing ? (
                <input
                  aria-label="Property currency"
                  maxLength={3}
                  value={draft.currency}
                  onChange={(e) =>
                    update({ ...draft, currency: e.target.value.toUpperCase() })
                  }
                />
              ) : (
                <strong>{data.currency}</strong>
              )}
            </label>
            <label>
              Total room / villa inventory
              <strong>
                <Building2 size={17} /> {inventoryTotal(data)} units
              </strong>
              <small>
                Calculated from category inventory. Zero means no inventory
                entered yet.
              </small>
            </label>
          </div>
        </div>
        <div className="section-heading">
          <h2>Villa categories & inventory</h2>
          {editing && (
            <button
              className="text-button"
              onClick={() =>
                update({
                  ...draft,
                  villaCategories: [
                    ...draft.villaCategories,
                    { name: "", units: 0 },
                  ],
                })
              }
            >
              <Plus size={14} />
              Add villa category
            </button>
          )}
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Villa category</th>
                <th>Code</th>
                <th>Units</th>
                {editing && <th>Remove</th>}
              </tr>
            </thead>
            <tbody>
              {data.villaCategories.map((c, i) => (
                <tr key={i}>
                  <th>
                    {editing ? (
                      <input
                        aria-label={`Villa category ${i + 1}`}
                        value={c.name}
                        maxLength={150}
                        onChange={(e) =>
                          update({
                            ...draft,
                            villaCategories: draft.villaCategories.map(
                              (v, j) =>
                                j === i ? { ...v, name: e.target.value } : v,
                            ),
                          })
                        }
                      />
                    ) : (
                      c.name
                    )}
                  </th>
                  <td>
                    {editing ? (
                      <input
                        aria-label={`Villa code ${i + 1}`}
                        value={c.code ?? ""}
                        maxLength={10}
                        onChange={(e) =>
                          update({
                            ...draft,
                            villaCategories: draft.villaCategories.map(
                              (v, j) =>
                                j === i
                                  ? { ...v, code: e.target.value.toUpperCase() }
                                  : v,
                            ),
                          })
                        }
                      />
                    ) : (
                      c.code || "Not configured"
                    )}
                  </td>
                  <td>
                    {editing ? (
                      <input
                        type="number"
                        aria-label={`Villa units ${i + 1}`}
                        min={0}
                        max={10000}
                        step={1}
                        value={Number.isNaN(c.units) ? "" : c.units}
                        onChange={(e) =>
                          update({
                            ...draft,
                            villaCategories: draft.villaCategories.map(
                              (v, j) =>
                                j === i
                                  ? {
                                      ...v,
                                      units:
                                        e.target.value === ""
                                          ? NaN
                                          : Number(e.target.value),
                                    }
                                  : v,
                            ),
                          })
                        }
                      />
                    ) : (
                      c.units
                    )}
                  </td>
                  {editing && (
                    <td>
                      <button
                        aria-label={`Remove villa category ${i + 1}`}
                        onClick={() =>
                          update({
                            ...draft,
                            villaCategories: draft.villaCategories.filter(
                              (_, j) => j !== i,
                            ),
                          })
                        }
                      >
                        <X size={15} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="section-heading">
          <h2>Meal plans</h2>
          {editing && (
            <button
              className="text-button"
              onClick={() =>
                update({ ...draft, mealPlans: [...draft.mealPlans, ""] })
              }
            >
              <Plus size={14} />
              Add meal plan
            </button>
          )}
        </div>
        <ul className="property-meals">
          {data.mealPlans.map((p, i) => (
            <li key={i}>
              {editing && (
                <input
                  aria-label={`Meal plan code ${i + 1}`}
                  value={draft.mealPlanCodes?.[p] ?? ""}
                  maxLength={10}
                  placeholder="Code"
                  onChange={(e) =>
                    update({
                      ...draft,
                      mealPlanCodes: {
                        ...draft.mealPlanCodes,
                        [p]: e.target.value.toUpperCase(),
                      },
                    })
                  }
                />
              )}
              {editing ? (
                <>
                  <input
                    aria-label={`Meal plan ${i + 1}`}
                    maxLength={150}
                    value={p}
                    onChange={(e) =>
                      update({
                        ...draft,
                        mealPlanCodes: Object.fromEntries([
                          ...Object.entries(draft.mealPlanCodes ?? {}).filter(
                            ([key]) => key !== p,
                          ),
                          [e.target.value, draft.mealPlanCodes?.[p] ?? "NEW"],
                        ]),
                        mealPlans: draft.mealPlans.map((v, j) =>
                          j === i ? e.target.value : v,
                        ),
                      })
                    }
                  />
                  <button
                    aria-label={`Remove meal plan ${i + 1}`}
                    onClick={() =>
                      update({
                        ...draft,
                        mealPlans: draft.mealPlans.filter((_, j) => j !== i),
                      })
                    }
                  >
                    <X size={15} />
                  </button>
                </>
              ) : (
                <>
                  {p}{" "}
                  <strong>{data.mealPlanCodes?.[p] || "Not configured"}</strong>
                </>
              )}
            </li>
          ))}
        </ul>
      </fieldset>
      <TeamDirectory
        demo={demo}
        userId={userId}
        canEdit={canEdit && !editing}
        onEditingChange={setTeamEditing}
        onDirtyChange={onDirtyChange}
        onBusyChange={onBusyChange}
      />
      <footer className="editor-footer">
        {record?.version
          ? `Version ${record.version} · Last saved ${record.updated_at ? new Date(record.updated_at).toLocaleString() : "previously"}`
          : "Default profile · not yet saved"}{" "}
        ·{" "}
        {demo
          ? "Browser-only demo"
          : "Super Admin saves are versioned and audit logged"}
      </footer>
    </section>
  );
}
