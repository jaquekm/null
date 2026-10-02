import {
  BarChart3,
  Dumbbell,
  Bell,
  Calendar,
  CalendarCheck,
  CalendarRange,
  GraduationCap,
  Inbox,
  Network,
  Search,
  Settings,
  Sun,
  Sparkles,
  UtensilsCrossed,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

/** Busca com filtros (espaço, tipo, tag, datas, "por significado") — fora do menu, aberta pela busca do topo. */
export const SEARCH_ITEM: NavItem = { href: "/buscar", label: "Busca avançada", icon: Search };
const HOJE: NavItem = { href: "/hoje", label: "Hoje", icon: Sun };
const INBOX: NavItem = { href: "/inbox", label: "Inbox", icon: Inbox };
const AGENDA: NavItem = { href: "/agenda", label: "Agenda", icon: Calendar };
/** Hábitos da semana e consistência (10.1). */
const ROTINA: NavItem = { href: "/rotina", label: "Rotina", icon: CalendarRange };
const LEMBRETES: NavItem = { href: "/lembretes", label: "Lembretes", icon: Bell };
const FINANCAS: NavItem = {
  href: "/financas",
  label: "Finanças",
  icon: Wallet,
};
const CONTATOS: NavItem = { href: "/contatos", label: "Contatos", icon: Users };
const RELATORIOS: NavItem = {
  href: "/relatorios",
  label: "Relatórios",
  icon: BarChart3,
};
const PERGUNTAR: NavItem = {
  href: "/perguntar",
  label: "Perguntar",
  icon: Sparkles,
};
const ESTUDOS: NavItem = {
  href: "/estudos",
  label: "Estudos",
  icon: GraduationCap,
};
const TREINOS: NavItem = {
  href: "/treinos",
  label: "Treinos",
  icon: Dumbbell,
};
/** Cardápio da semana (10.9) — antes só alcançável pelo card Refeições do Hoje; a dona não achava. */
const CARDAPIO: NavItem = {
  href: "/cardapio",
  label: "Cardápio",
  icon: UtensilsCrossed,
};
const CONFIGURACOES: NavItem = {
  href: "/configuracoes",
  label: "Configurações",
  icon: Settings,
};
const REVISAO_SEMANAL: NavItem = {
  href: "/revisao-semanal",
  label: "Revisão semanal",
  icon: CalendarCheck,
};
const ZETTELKASTEN: NavItem = {
  href: "/zettelkasten",
  label: "Zettelkasten",
  icon: Network,
};

/**
 * Itens da sidebar (desktop) e do menu completo (mobile). "Buscar" saiu do
 * menu (pedido da dona): a busca do topo (Ctrl K) já busca, e a página com
 * filtros abre por "Busca avançada" dentro dela (`SEARCH_ITEM`).
 */
export const NAV_ITEMS: NavItem[] = [
  HOJE,
  INBOX,
  AGENDA,
  ROTINA,
  LEMBRETES,
  FINANCAS,
  CONTATOS,
  PERGUNTAR,
  RELATORIOS,
  ESTUDOS,
  TREINOS,
  CARDAPIO,
  REVISAO_SEMANAL,
  ZETTELKASTEN,
  CONFIGURACOES,
];

/** Itens fixos da barra inferior no mobile (além do botão de captura e do "Menu"). */
export const MOBILE_PRIMARY_ITEMS: NavItem[] = [HOJE, INBOX, AGENDA];
