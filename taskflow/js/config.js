// ─── TASKFLOW PRO — CONFIGURACIÓN ─────────────────────
// Reemplaza estos valores con los de tu proyecto Supabase
// Los encuentras en: Settings > API en tu dashboard de Supabase

const SUPABASE_URL = 'https://gxxxrubpnlxzxqjecwmr.supabase.co';       // ej: https://abcxyz.supabase.co
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4eHhydWJwbmx4enhxamVjd21yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MjgzNjMsImV4cCI6MjA4OTIwNDM2M30.GouI3a21yaTF7xmRggI8kHCL8Tp4f2IuykBP6BaoXD4'; // empieza con "eyJ..."

// ─── ANTHROPIC (para la funcionalidad de Junta con IA) ─
// IMPORTANTE: en producción mueve esto a un backend/edge function
// Por ahora funciona directo desde el browser para uso personal
const ANTHROPIC_API_KEY = 'TU_ANTHROPIC_API_KEY'; // empieza con "sk-ant-..."
