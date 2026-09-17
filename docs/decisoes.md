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
- **Consequências:** quando a 0.5 rodar `pnpm db:types` de verdade, este arquivo placeholder será substituído. Nenhuma tabela real é referenciada nos clientes, então não há retrabalho. **Não verificado neste ambiente:** o critério de aceite da 0.6 ("acessar `/inbox` sem login redireciona; rotas públicas respondem sem login") depende de um Supabase real (local ou `hub-dev`) respondendo às chamadas de `auth.getUser()` no proxy — sem isso, `pnpm dev` falha ao tentar validar as variáveis de ambiente (comportamento esperado da 0.3) ou, com variáveis fictícias, falharia na chamada de rede. Precisa ser confirmado manualmente assim que a 0.4 (ou a 0.1) estiver pronta.

### 2026-09-17 — `env.ts` com validação preguiçosa (lazy) + proxy sai cedo em rotas públicas

- **Fase/tarefa:** 0.9/0.12, corrigindo um bug introduzido na 0.6.
- **Contexto:** ao testar os cabeçalhos de segurança (0.9) e o health check (0.12) com `pnpm build && next start` sem nenhuma variável do Supabase configurada, `GET /api/health` — uma rota pública, que não deveria depender do Supabase — respondia 500. Duas causas, uma em cima da outra: (1) `src/proxy.ts` criava o cliente Supabase e chamava `auth.getUser()` **antes** de checar `isPublicPath`, gastando uma dependência desnecessária em toda rota pública; (2) mesmo corrigindo isso, `publicEnv`/`serverEnv` em `src/lib/env.ts` eram validados **no import do módulo** (efeito colateral de topo de arquivo), então só o `import { publicEnv } from "@/lib/env"` no topo do `proxy.ts` já derrubava a requisição antes de qualquer lógica rodar.
- **Opções consideradas:** (1) manter a validação eager e mover o `import` do Supabase para dentro do `if` (não resolve — o import de `env.ts` já falha antes); (2) tornar `publicEnv`/`serverEnv` objetos com validação preguiçosa via `Proxy`, rodando o `zod.safeParse` só na primeira leitura de uma propriedade.
- **Decisão:** opção 2, combinada com o proxy checando `isPublicPath` e retornando `NextResponse.next()` antes de instanciar qualquer cliente Supabase.
- **Consequências:** rotas públicas (`/api/health`, `/api/webhooks/*`, `/api/jobs/tick`, `/api/capture`, `/api/mcp`, `/p/*`, `/login`) não dependem mais do Supabase estar configurado ou acessível — elas validam seu próprio segredo/token, como já dizia a seção de Segurança do `CLAUDE.md`. `src/lib/env.test.ts` foi ajustado: os testes de variável ausente agora leem uma propriedade (`serverEnv.OWNER_EMAIL`, `publicEnv.NEXT_PUBLIC_SUPABASE_URL`) em vez de esperar que o `import()` rejeite. Verificado com `pnpm build && next start` + `curl -I` em `/api/health` (200) e `/p/algum-token` (responde, com `Referrer-Policy: no-referrer`), sem nenhuma variável do Supabase definida.

## Decisões em aberto previstas no plano

- [ ] Provedor de transcrição (fase 2.4) — preço por hora na data da escolha
- [ ] Estratégia de eventos recorrentes do Google Calendar (fase 3.5)
- [ ] Biblioteca da agenda: FullCalendar ou componente próprio (fase 3.6)
- [ ] Integração do WhatsApp no N8N: Cloud API ou integração existente (fase 3.9)
- [ ] Provedor, modelo e dimensão de embeddings (fase 6.5)
- [ ] Destino dos backups externos (fase 7.1)
- [ ] Modelo do Claude usado em `ANTHROPIC_MODEL`
