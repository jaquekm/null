/**
 * "Como funciona" de cada módulo (pedido da dona, 03/10): a ajuda que
 * aparecia passando o mouse (`title`) não existe no celular. Cada tela
 * principal ganha um botão no título que abre isto por toque.
 * Texto curto, no jeito de falar da dona — o que dá pra fazer e onde.
 */
export interface PageHelpContent {
  title: string;
  tips: string[];
}

export const PAGE_HELP = {
  hoje: {
    title: "Seu dia num lugar só",
    tips: [
      "Cada cartão mostra o que é de hoje (agenda, lembretes, prazos, contas, treino, água, refeições). Toque no título do cartão pra abrir a tela completa.",
      "A caixa de cima anota qualquer coisa: escreva e salve. “Me lembra de… amanhã 9h” vira lembrete; “pagar luz R$ 120 dia 10” vira conta a pagar.",
      "Água, refeições e hábitos você marca aqui mesmo, com um toque.",
    ],
  },
  agenda: {
    title: "Agenda",
    tips: [
      "Mostra junto: eventos do Google, prazos dos seus itens, lembretes e os horários fixos da Rotina (em verde-azulado). As caixinhas de cima escondem cada tipo.",
      "Toque num horário vazio pra criar evento (precisa do Google conectado em Configurações → Integrações).",
      "“Planejador do dia”: arraste uma tarefa pra um horário e ela vira um bloco na agenda.",
    ],
  },
  rotina: {
    title: "Rotina",
    tips: [
      "Hábitos: toque no quadrado do dia pra marcar que fez. Tracejado = dia que não é do hábito (dá pra marcar mesmo assim). Toque no nome do hábito pra mudar os dias.",
      "Horários: blocos fixos da semana (ex.: 7h academia). Aparecem na Agenda e no Hoje como “Agora / Depois”.",
      "Foco: quanto tempo você passou em cada tarefa com o cronômetro.",
    ],
  },
  treinos: {
    title: "Treinos",
    tips: [
      "Registrar: preencha o treino do dia (check-in, séries, cargas) e salve. O rascunho fica guardado se você sair no meio.",
      "Histórico: toque num treino pra ver tudo. Lá tem “Editar este treino” (data errada, série errada) e “Excluir”.",
      "Gráficos e Semanal mostram a evolução; Programa é onde você importa o Word ou monta o treino.",
    ],
  },
  cardapio: {
    title: "Cardápio e lista de compras",
    tips: [
      "Escreva o que vai comer em cada refeição. “Copiar de” repete outro dia; “Repetir esta semana” copia tudo pra próxima.",
      "Embaixo de cada prato, “+ Ingredientes” guarda o que vai nele (uma vez só por prato).",
      "“Gerar lista de compras” soma os ingredientes da semana na sua lista “Compras”.",
    ],
  },
  estudos: {
    title: "Estudos",
    tips: [
      "Flashcards com revisão espaçada: o que você erra volta mais cedo, o que acerta demora mais pra voltar.",
      "Faça a revisão do dia um pouco por dia — é o que faz lembrar.",
    ],
  },
  financas: {
    title: "Finanças",
    tips: [
      "O painel mostra o mês: entradas, saídas, saldo das contas e o que vence. Os menus de cima levam pra Lançamentos, Contas a pagar, Cartões, Orçamento e Divisões.",
      "Lançamento é dinheiro que já entrou ou saiu; Conta a pagar/receber é o que ainda vai vencer.",
      "Pela caixa do Hoje: “pagar luz R$ 120 dia 10” já cria a conta a pagar.",
    ],
  },
  contas: {
    title: "Contas a pagar e receber",
    tips: [
      "Tudo que ainda vai vencer. Quando pagar, toque em “Marcar como paga” — vira lançamento.",
      "Com o agendador ligado (Configurações → Notificações), você recebe aviso antes do vencimento.",
    ],
  },
  patrimonio: {
    title: "Patrimônio",
    tips: [
      "Cadastre investimentos e dívidas e, de vez em quando, o valor atual de cada um. O gráfico mostra a evolução mês a mês.",
      "Nas dívidas, a taxa de juros ajuda a sugerir qual quitar primeiro.",
    ],
  },
  contatos: {
    title: "Contatos",
    tips: [
      "Pessoas e empresas. Aniversário cadastrado vira lembrete automático.",
      "Contas a receber, divisões e lembretes ficam ligados ao contato — abra o contato pra ver tudo junto.",
    ],
  },
  lembretes: {
    title: "Lembretes",
    tips: [
      "Escreva quando em frase: “amanhã 9h”, “toda segunda”, “dia 10 de todo mês”.",
      "Pra você: chega por notificação (ou WhatsApp, se configurado). Pra um contato: escolha a pessoa.",
      "Se nada chega, veja o aviso no topo desta página ou Configurações → Notificações.",
    ],
  },
} satisfies Record<string, PageHelpContent>;

export type PageHelpTopic = keyof typeof PAGE_HELP;
