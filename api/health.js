// Temporaer. Keine Imports, keine Abhaengigkeiten, keine Env-WERTE — nur die
// Information, ob sie zur Laufzeit ankommen. Trennt zwei Ursachen voneinander:
// crasht schon das hier, liegt es an Runtime/Bundling; laeuft es und meldet
// false, fehlen die Variablen; laeuft es und meldet true, liegt es am
// Supabase-Import. Nach der Diagnose wieder entfernen.
export default function handler(req, res) {
  res.json({
    ok: true,
    node: process.version,
    env: {
      SUPABASE_URL: Boolean(process.env.SUPABASE_URL),
      SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      ADMIN_KEY: Boolean(process.env.ADMIN_KEY),
    },
  });
}
