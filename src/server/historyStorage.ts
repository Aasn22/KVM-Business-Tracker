import postgres from "postgres";
// Called only after same-origin admin PIN verification and numeric validation.
// No credentials or provider errors are logged or returned.
export const historySetupSQL = `
SELECT pg_advisory_xact_lock(hashtext('kvm-history-schema'));
CREATE TABLE IF NOT EXISTS public.history_years (
 year integer PRIMARY KEY CHECK(year BETWEEN 2021 AND 2060),
 version integer NOT NULL DEFAULT 1,
 months jsonb NOT NULL CHECK(jsonb_typeof(months)='array' AND jsonb_array_length(months)=12),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.history_years ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.history_years FROM public,anon,authenticated;
GRANT SELECT ON public.history_years TO service_role;
CREATE OR REPLACE FUNCTION public.save_history_year(p_year integer,p_version integer,p_months jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE current_version integer;
BEGIN
 IF p_year NOT BETWEEN 2021 AND 2060 OR p_version<0 OR p_months IS NULL OR jsonb_typeof(p_months)<>'array' OR jsonb_array_length(p_months)<>12 THEN RAISE EXCEPTION 'Invalid history year'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('history:'||p_year));
 SELECT version INTO current_version FROM public.history_years WHERE year=p_year FOR UPDATE;
 IF coalesce(current_version,0)<>p_version THEN RAISE EXCEPTION 'History version conflict'; END IF;
 INSERT INTO public.history_years(year,version,months,updated_at) VALUES(p_year,p_version+1,p_months,now())
 ON CONFLICT(year) DO UPDATE SET version=excluded.version,months=excluded.months,updated_at=excluded.updated_at;
END $$;
REVOKE ALL ON FUNCTION public.save_history_year(integer,integer,jsonb) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_history_year(integer,integer,jsonb) TO service_role;
NOTIFY pgrst, 'reload schema';
`;
export function missingHistorySchema(
  error: { code?: string; message?: string } | null | undefined,
) {
  return (
    !!error &&
    ["42P01", "42883", "PGRST202", "PGRST205"].includes(error.code ?? "")
  );
}
export async function withHistoryDatabase<T>(
  work: (sql: postgres.Sql) => Promise<T>,
): Promise<T> {
  const connection =
    process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING;
  if (!connection)
    throw Error("History database initialization connection unavailable");
  const sql = postgres(connection, {
    max: 1,
    connect_timeout: 8,
    idle_timeout: 2,
    prepare: false,
    ssl: "require",
    onnotice: () => {},
  });
  try {
    return await work(sql);
  } finally {
    await sql.end({ timeout: 2 });
  }
}
export async function initializeAndSaveHistory(
  year: number,
  version: number,
  months: unknown,
) {
  return withHistoryDatabase(async (sql) => {
    const rows = await sql.begin(async (tx) => {
      await tx.unsafe(historySetupSQL);
      await tx`select public.save_history_year(${year},${version},${tx.json(months as postgres.JSONValue)})`;
      return await tx`select year,version,months,updated_at from public.history_years where year=${year}`;
    });
    return rows[0];
  });
}
