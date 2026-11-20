export type TeamMember = {
  id?: string;
  version: number;
  name: string;
  position: string;
  department: string;
  level: string;
  username: string;
  role: "Read-Only" | "Admin" | "Super Admin";
  scope: "all" | "markets" | "india" | "kazakhstan";
  markets: string[];
};
export const emptyMember: TeamMember = {
  version: 0,
  name: "",
  position: "",
  department: "",
  level: "",
  username: "",
  role: "Read-Only",
  scope: "markets",
  markets: [],
};
export const teamColumns =
  "id,version,name,position,department,level,username,role,scope,markets";
export function safeTeamImport(value: unknown): TeamMember[] {
  if (!Array.isArray(value) || value.length > 100)
    throw Error("Expected an array of up to 100 team profiles.");
  return value.map((raw) => {
    if (
      !raw ||
      typeof raw !== "object" ||
      Object.keys(raw).some((key) => /password|token|secret/i.test(key))
    )
      throw Error("Remove all passwords and credentials before importing.");
    const r = raw as Record<string, unknown>;
    const m = {
      ...emptyMember,
      name: String(r.name ?? ""),
      position: String(r.position ?? ""),
      department: String(r.department ?? ""),
      level: String(r.level ?? ""),
      username: String(r.username ?? ""),
      role: r.role,
      scope: r.scope,
      markets: r.markets ?? [],
    } as TeamMember;
    if (
      !m.name.trim() ||
      m.name.length > 150 ||
      !["Read-Only", "Admin", "Super Admin"].includes(m.role) ||
      !["all", "markets", "india", "kazakhstan"].includes(m.scope) ||
      !Array.isArray(m.markets) ||
      m.markets.some(
        (k) =>
          ![
            "asia",
            "america",
            "middle-east",
            "russia",
            "europe",
            "other-markets",
          ].includes(k),
      ) ||
      (m.role !== "Read-Only" && m.scope !== "all")
    )
      throw Error("Invalid profile or permission scope.");
    return m;
  });
}
