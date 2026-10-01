# Registro de decisões

Registre aqui toda escolha que desvia do plano ou que o plano deixou em aberto (provedores, bibliotecas, limites).

## Modelo

### AAAA-MM-DD — Título da decisão
- **Fase/tarefa:** 
- **Contexto:** o que precisava ser decidido
- **Opções consideradas:** 
- **Decisão:** 
- **Consequências:** custos, limites, o que muda no código

## Decisões tomadas

### 2026-09-17 — Ordem das tarefas 0.5/0.6 e placeholder de `database.types.ts`

- **Fase/tarefa:** 0.6 (Clientes Supabase)
- **Contexto:** o dono pediu para adiantar a 0.6 antes da 0.4/0.5 (Supabase local ainda não configurado neste ambiente — sem Docker/Supabase CLI). O plano previa que `database.types.ts` só existiria depois de `supabase db reset` + `pnpm db:types`.
- **Opções consideradas:** (1) esperar a 0.4/0.5 para escrever `server.ts`/`client.ts`/`admin.ts`; (2) criar um `database.types.ts` placeholder com `Tables`/`Views`/etc. vazios, no mesmo formato do gerado por `supabase gen types typescript`, e escrever os clientes já tipados com ele.
- **Decisão:** opção 2. `src/lib/supabase/database.types.ts` tem uma nota no topo avisando que será sobrescrito pela 0.5.
- **Consequências:** quando a 0.5 rodar `pnpm db:types` de verdade, este arquivo placeholder será substituído.