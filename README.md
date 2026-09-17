# Hub

Sistema pessoal de organização (uso único, do dono). Veja `CLAUDE.md` para as regras do projeto e `docs/00-visao-geral.md` para a arquitetura e o roadmap completo.

## Desenvolvimento

```bash
pnpm install
pnpm dev
```

Abra [http://localhost:3000](http://localhost:3000).

```bash
pnpm lint         # ESLint
pnpm typecheck    # tsc --noEmit
pnpm test         # Vitest
pnpm test:e2e     # Playwright
```

Configuração do ambiente local do Supabase e das variáveis de ambiente será documentada aqui na tarefa 0.4.
