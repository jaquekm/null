// Substitui o pacote `server-only` nos testes (Vitest, via alias em
// vitest.config.mts). O pacote de verdade lança um erro sempre que é
// importado fora do pipeline de build do Next.js (é assim que ele barra
// import em Client Component) — o que inclui rodar sob Vitest, que não
// passa pelo bundler do Next. Não afeta o build de produção: o Next
// continua resolvendo `server-only` normalmente, só o Vitest usa isto.
export {};
