// Re-exportar o cliente Supabase principal
export { supabase } from './supabaseClient';

// Re-exportar tipos do banco de dados
export * from '@/types/database';

// Re-exportar mappers
export * from './mappers';

// Re-exportar funções RPC e de serviço
export * from '@/services/supabaseRpc';

// Re-exportar funções de diagnóstico
export * from './supabaseDiagnostics';

// Nota: O código original de inicialização, tipos, mappers, RPCs e diagnósticos
// foi movido para os arquivos:
// - src/lib/supabaseClient.ts
// - src/types/database.ts
// - src/lib/mappers.ts
// - src/services/supabaseRpc.ts
// - src/lib/supabaseDiagnostics.ts