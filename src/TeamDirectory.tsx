import { useEffect, useState } from "react";
import { db } from "./api";
import {
  emptyMember,
  safeTeamImport,
  teamColumns,
  type TeamMember,
} from "./team";
import { markets } from "./model";
export default function TeamDirectory({
  demo,
  userId,
  canEdit,
  onEditingChange,
  onDirtyChange,
  onBusyChange,
}: {
  demo: boolean;
  userId: string | null;
  canEdit: boolean;
  onEditingChange: (value: boolean) => void;
  onDirtyChange: (v: boolean) => void;
  onBusyChange: (v: boolean) => void;
}) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [draft, setDraft] = useState<TeamMember | null>(null);
  const [link, setLink] = useState("");
  const [invite, setInvite] = useState<TeamMember | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    onEditingChange(!!draft);
  }, [draft, onEditingChange]);
  async function load() {
    if (demo) {
      try {
        const stored = JSON.parse(
          localStorage.getItem("business-eye-demo-team") ?? "[]",
        );
        setMembers(stored);
      } catch {
        setMembers([]);
      }
      return;
    }
    if (!userId || !db) return;
    const { data, error } = await db
      .from("team_directory")
      .select(teamColumns)
      .order("name");
    if (error) throw error;
    setMembers(data as TeamMember[]);
  }
  useEffect(() => {
    void load().catch((e) =>
      setError(
        `Team directory unavailable: ${e.message}. Apply team/country migration.`,
      ),
    );
  }, [demo, userId]);
  const change = (m: TeamMember) => {
    setDraft(m);
    onDirtyChange(true);
  };
  async function save() {
    if (!canEdit || !draft) return;
    setError("");
    setBusy(true);
    onBusyChange(true);
    try {
      safeTeamImport([draft]);
      if (demo) {
        const m = {
          ...draft,
          id: draft.id ?? crypto.randomUUID(),
          version: draft.version + 1,
        };
        const next = [...members.filter((x) => x.id !== m.id), m];
        localStorage.setItem("business-eye-demo-team", JSON.stringify(next));
        setMembers(next);
      } else {
        const { error } = await db!.rpc("save_team_member", {
          p_id: draft.id ?? null,
          p_user_id: link.trim() || null,
          p_data: draft,
          p_version: draft.version,
        });
        if (error) throw error;
        await load();
      }
      setDraft(null);
      onDirtyChange(false);
      setMessage(
        "Team profile saved. New Auth users must still be privately invited and linked by Super Admin.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      onBusyChange(false);
    }
  }
  async function sendInvite() {
    if (!canEdit || !invite?.id || demo) return;
    if (!inviteEmail.trim()) {
      setError("Enter the team member’s individual email address.");
      return;
    }
    setBusy(true);
    onBusyChange(true);
    setError("");
    setMessage("");
    try {
      const current = await db!.auth.getSession();
      if (!current.data.session) throw Error("Sign in again.");
      const response = await fetch("/api/invite-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${current.data.session.access_token}`,
        },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          memberId: invite.id,
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw Error(
          result.message ||
            "Invitation could not be confirmed. Check Supabase Auth before retrying.",
        );
      setMessage(result.message);
      setInvite(null);
      setInviteEmail("");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      onBusyChange(false);
    }
  }
  async function importFile(file?: File) {
    if (!file || !canEdit) return;
    try {
      if (file.size > 100000) throw Error("Roster JSON must be under 100 KB.");
      const data = safeTeamImport(JSON.parse(await file.text()));
      if (!demo) {
        setBusy(true);
        onBusyChange(true);
        let completed = 0;
        try {
          for (const member of data) {
            const result = await db!.rpc("save_team_member", {
              p_id: null,
              p_user_id: null,
              p_data: member,
              p_version: 0,
            });
            if (result.error) throw result.error;
            completed++;
          }
          await load();
          setMessage(
            `Imported ${completed} unlinked profiles. Invite each account privately and link its Auth UUID to activate access.`,
          );
        } catch (e) {
          await load();
          throw Error(
            `Imported ${completed} profiles before stopping: ${(e as Error).message}. Review existing rows before retrying.`,
          );
        } finally {
          setBusy(false);
          onBusyChange(false);
        }
        return;
      }
      const next = [
        ...members,
        ...data.map((m) => ({ ...m, id: crypto.randomUUID(), version: 1 })),
      ];
      localStorage.setItem("business-eye-demo-team", JSON.stringify(next));
      setMembers(next);
      setMessage("Private demo roster imported locally.");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <section className="team-directory">
      <div className="section-heading">
        <h2>Team members & access</h2>
        {canEdit && (
          <button
            className="button outline"
            disabled={busy || !!draft}
            onClick={() => {
              setDraft(structuredClone(emptyMember));
              setLink("");
            }}
          >
            Add team member
          </button>
        )}
      </div>
      <div className="notice">
        Visible to signed-in users. Only Super Admin can edit profiles or
        permissions. Passwords are never stored or shown. Country scopes expose
        only their own explicit country financial records, not regional totals.
        Unlinked profiles have no login access.
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      {invite && canEdit && (
        <div className="notice">
          <h3>Invite {invite.name}</h3>
          <p>
            Use the person’s own email. They will choose their password. No
            shared password is created or displayed.
          </p>
          <label>
            Email address
            <input
              aria-label="Invitation email"
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
            />
          </label>
          <button
            className="button outline"
            disabled={busy}
            onClick={() => setInvite(null)}
          >
            Cancel invitation
          </button>
          <button
            className="button primary"
            disabled={busy || demo}
            onClick={sendInvite}
          >
            {busy ? "Sending…" : "Send private invitation"}
          </button>
          {demo && <p>Invitation delivery is disabled in demo mode.</p>}
        </div>
      )}
      {draft && canEdit && (
        <fieldset disabled={busy} className="team-form">
          <h3>{draft.id ? "Edit team member" : "New team member"}</h3>
          <div className="property-fields">
            {(
              ["name", "position", "department", "level", "username"] as const
            ).map((key) => (
              <label key={key}>
                {key}
                <input
                  aria-label={`Team ${key}`}
                  value={draft[key]}
                  onChange={(e) => change({ ...draft, [key]: e.target.value })}
                />
              </label>
            ))}
            <label>
              Access role
              <select
                aria-label="Team role"
                value={draft.role}
                onChange={(e) =>
                  change({
                    ...draft,
                    role: e.target.value as TeamMember["role"],
                    scope: e.target.value === "Read-Only" ? draft.scope : "all",
                  })
                }
              >
                {["Read-Only", "Admin", "Super Admin"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label>
              Financial scope
              <select
                aria-label="Team financial scope"
                disabled={draft.role !== "Read-Only"}
                value={draft.scope}
                onChange={(e) =>
                  change({
                    ...draft,
                    scope: e.target.value as TeamMember["scope"],
                  })
                }
              >
                <option value="all">All markets / reports</option>
                <option value="markets">Selected markets</option>
                <option value="india">India only</option>
                <option value="kazakhstan">Kazakhstan only</option>
              </select>
            </label>
            {draft.scope === "markets" && (
              <label>
                Assigned markets
                {markets.map((m) => (
                  <span key={m.id}>
                    <input
                      type="checkbox"
                      checked={draft.markets.includes(m.id)}
                      onChange={(e) =>
                        change({
                          ...draft,
                          markets: e.target.checked
                            ? [...draft.markets, m.id]
                            : draft.markets.filter((k) => k !== m.id),
                        })
                      }
                    />
                    {m.name}
                  </span>
                ))}
              </label>
            )}
            {!demo && (
              <label>
                Invited Auth user UUID (optional; blank preserves existing link)
                <input
                  aria-label="Team Auth user ID"
                  value={link}
                  onChange={(e) => {
                    setLink(e.target.value);
                    onDirtyChange(true);
                  }}
                />
              </label>
            )}
          </div>
          <div className="editor-actions">
            <button
              className="button outline"
              onClick={() => {
                setDraft(null);
                onDirtyChange(false);
              }}
            >
              Cancel team edit
            </button>
            <button className="button primary" onClick={save}>
              Save team member
            </button>
          </div>
        </fieldset>
      )}
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Team member</th>
              <th>Position</th>
              <th>Section</th>
              <th>Level</th>
              <th>Username</th>
              <th>Access</th>
              <th>Task access</th>
              <th>Financial pages / reports</th>
              {canEdit && <th>Edit</th>}
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id}>
                <th>{m.name}</th>
                <td>{m.position}</td>
                <td>{m.department}</td>
                <td>{m.level}</td>
                <td>{m.username}</td>
                <td>{m.role}</td>
                <td>
                  {m.role === "Super Admin"
                    ? "Property, team & financial entry"
                    : m.role === "Admin"
                      ? "Admin Data Input only"
                      : "No access to modify"}
                </td>
                <td>
                  {m.scope === "markets" ? m.markets.join(", ") : m.scope}
                </td>
                {canEdit && (
                  <td>
                    <button
                      className="text-button"
                      onClick={() => {
                        setDraft(structuredClone(m));
                        setLink("");
                      }}
                    >
                      Edit {m.name}
                    </button>
                    <button
                      className="text-button"
                      disabled={busy || !!draft}
                      onClick={() => {
                        setInvite(m);
                        setInviteEmail("");
                        setError("");
                      }}
                    >
                      Invite {m.name}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!members.length && (
        <p className="empty">
          No team members configured. Your private roster has not been published
          or preloaded.
        </p>
      )}
      {canEdit && !draft && (
        <label className="roster-import">
          Import private roster JSON (no password fields)
          <input
            type="file"
            accept="application/json"
            onChange={(e) => void importFile(e.target.files?.[0])}
          />
        </label>
      )}
    </section>
  );
}
