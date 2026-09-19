export interface ShortcutGroup {
  title: string;
  shortcuts: { keys: string[]; description: string }[];
}

/**
 * Lista de atalhos do app, mostrada em `/configuracoes/atalhos` (1.16).
 * É só documentação: cada atalho aqui já está implementado em outro lugar
 * do código (ver referências nos comentários abaixo); mudar esta lista não
 * muda o comportamento de nenhum atalho.
 */
export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: "Globais",
    shortcuts: [
      { keys: ["Ctrl", "K"], description: "Abrir a paleta de comandos" },
      { keys: ["Ctrl", "Shift", "Espaço"], description: "Abrir a captura rápida" },
      { keys: ["Esc"], description: "Fechar diálogo aberto (captura, paleta de comandos)" },
    ],
  },
  {
    title: "Paleta de comandos",
    shortcuts: [
      { keys: ["↑", "↓"], description: "Navegar entre os resultados" },
      { keys: ["Enter"], description: "Abrir ou executar o item selecionado" },
    ],
  },
  {
    title: "Editor de texto",
    shortcuts: [
      { keys: ["/"], description: "Menu de blocos (título, lista, tarefa...)" },
      { keys: ["@"], description: "Mencionar outro item" },
      { keys: ["Enter"], description: "Salvar título e ir para o corpo" },
      { keys: ["Shift", "Enter"], description: "Quebra de linha (título, captura rápida)" },
    ],
  },
  {
    title: "Quadro (Kanban) e visões",
    shortcuts: [
      { keys: ["Enter"], description: "Confirmar novo cartão ou nova visão" },
      { keys: ["Esc"], description: "Cancelar novo cartão" },
    ],
  },
];
