import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ""), ...process.env };
  return {
    plugins: [react()],
    build: { chunkSizeWarningLimit: 1000 },
    // Exact public allowlist: never expose provider secrets via envPrefix.
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(
        env.VITE_SUPABASE_URL ||
          env.NEXT_PUBLIC_SUPABASE_URL ||
          env.SUPABASE_URL ||
          "",
      ),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(
        env.VITE_SUPABASE_PUBLISHABLE_KEY ||
          env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
          env.SUPABASE_PUBLISHABLE_KEY ||
          env.SUPABASE_ANON_KEY ||
          "",
      ),
    },
  };
});
