import {
  BarChart3,
  Bell,
  Calendar,
  CalendarCheck,
  GraduationCap,
  Inbox,
  Network,
  Search,
  Settings,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const INBOX: NavItem = { href: "/inbox", label: "Inbox", icon: Inbox };
const BUSCAR: NavItem = { href: "/buscar", label: "Buscar", icon: Search };
const AGENDA: NavItem = { href: "/agenda", label: "Agenda", icon: Calendar };
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
const ESTUDOS: NavItem = {
  href: "/estudos",
  label: "Estudos",
  icon: GraduationCap,
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

/** Itens da sidebar (desktop) e do menu completo (mobile). */
export const NAV_ITEMS: NavItem[] = [
  INBOX,
  BUSCAR,
  AGENDA,
  LEMBRETES,
  FINANCAS,
  CONTATOS,
  RELATORIOS,
  ESTUDOS,
  REVISAO_SEMANAL,
  ZETTELKASTEN,
  CONFIGURACOES,
];

/** Itens fixos da barra inferior no mobile (além do botão de captura e do "Menu"). */
export const MOBILE_PRIMARY_ITEMS: NavItem[] = [INBOX, BUSCAR, AGENDA];
