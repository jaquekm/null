/**
 * Placeholder até a tarefa 0.4/0.5 rodarem o Supabase local e `pnpm db:types`
 * gerar este arquivo de verdade a partir do banco (`supabase gen types typescript --local`).
 * Não edite à mão além desta nota — o comando sobrescreve o arquivo inteiro.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
