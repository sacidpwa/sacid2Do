// ─── TASKFLOW PRO — CONFIGURACIÓN ─────────────────────
// Reemplaza estos valores con los de tu proyecto Supabase
// Los encuentras en: Settings > API en tu dashboard de Supabase

const SUPABASE_URL = 'TU_SUPABASE_URL';       // ej: https://abcxyz.supabase.co
const SUPABASE_ANON_KEY = 'TU_SUPABASE_ANON_KEY'; // empieza con "eyJ..."

// ─── ANTHROPIC (para la funcionalidad de Junta con IA) ─
// IMPORTANTE: en producción mueve esto a un backend/edge function
// Por ahora funciona directo desde el browser para uso personal
const ANTHROPIC_API_KEY = 'TU_ANTHROPIC_API_KEY'; // empieza con "sk-ant-..."
