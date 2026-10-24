export type BundleKey = "rotina" | "saude" | "alimentacao" | "financas";

export interface BundlePackRef {
  packKey: string;
  /** `null` = pack global, sem espaço (Hábitos, Remédio, Receita culinária — já se instalam sozinhos no primeiro uso). Com nome: cria um espaço novo com esse nome, se o pack ainda não estiver instalado em nenhum espaço. */
  spaceName: string | null;
}

export interface BundleDefinition {
  key: BundleKey;
  name: string;
  description: string;
  icon: string;
  packs: BundlePackRef[];
  /** "Finanças pessoais" não é pack — precisa concluir o onboarding de Finanças (4.3) em vez de instalar algo. */
  completeFinanceOnboarding?: boolean;
  redirectHref: string;
}

/**
 * Pacotes prontos (10.15): "Rotina", "Saúde", "Alimentação" e "Finanças
 * pessoais" cada um junta, com um toque, os packs que uma área da vida
 * precisa — em vez da dona ter que descobrir e instalar cada um sozinha em
 * Configurações → Métodos. Config estática (não é dado do usuário, não
 * precisa de tabela) — igual aos packs em `packs/*.json`, só que descrevendo
 * uma combinação de vários deles.
 */
export const BUNDLES: BundleDefinition[] = [
  {
    key: "rotina",
    name: "Rotina",
    description: "Instala os tipos Hábito e Entrada de diário. Horários fixos, modo foco, água e jejum já vêm no app.",
    icon: "🔁",
    packs: [{ packKey: "diario-habitos", spaceName: null }],
    redirectHref: "/rotina",
  },
  {
    key: "saude",
    name: "Saúde",
    description: "Instala o tipo Remédio e, num espaço “Saúde”, os tipos Consulta, Exame, Receita médica e Sintoma.",
    icon: "🩺",
    packs: [
      { packKey: "saude", spaceName: null },
      { packKey: "saude-registros", spaceName: "Saúde" },
    ],
    redirectHref: "/hoje",
  },
  {
    key: "alimentacao",
    name: "Alimentação",
    description: "Instala o tipo Receita (ingredientes e porções). O cardápio da semana e a lista de compras já vêm no app.",
    icon: "🍽️",
    packs: [{ packKey: "receitas", spaceName: null }],
    redirectHref: "/cardapio",
  },
  {
    key: "financas",
    name: "Finanças pessoais",
    description: "Instala o tipo Desejo num espaço “Finanças pessoais” e conclui a configuração inicial de Finanças (categorias padrão). Contas, cartões, orçamento e patrimônio já vêm no app.",
    icon: "💰",
    packs: [{ packKey: "desejos", spaceName: "Finanças pessoais" }],
    completeFinanceOnboarding: true,
    redirectHref: "/financas",
  },
];

/** Quais packs do pacote ainda faltam — pack já instalado (em qualquer espaço) não entra de novo, pra não duplicar espaço num segundo toque. */
export function pendingPacksForBundle(bundle: BundleDefinition, installedPackKeys: string[]): BundlePackRef[] {
  return bundle.packs.filter((ref) => !installedPackKeys.includes(ref.packKey));
}
