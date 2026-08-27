import {
  Activity,
  Container,
  Database,
  Globe,
  HardDrive,
  KeyRound,
  Lock,
  Network,
  Rocket,
  Server,
  Settings,
  ShieldCheck,
  Terminal,
  type LucideIcon,
} from '@slideops/icons';

/** Choose a recognizable mark from the outcome language shown in a catalog. */
export function catalogIcon(key: string, label: string, category = ''): LucideIcon {
  const value = `${key} ${label} ${category}`.toLowerCase();
  if (/database|postgres|mysql|maria|redis|mongo|sql/.test(value)) return Database;
  if (/security|secure|firewall|hardening|ssh|tls|https|certificate|secret|credential/.test(value)) {
    return value.includes('ssh') || value.includes('key') ? KeyRound : ShieldCheck;
  }
  if (/docker|container|runtime|compose|kubernetes/.test(value)) return Container;
  if (/network|dns|proxy|nginx|caddy|routing|domain|port/.test(value)) return Network;
  if (/storage|disk|backup|volume|file/.test(value)) return HardDrive;
  if (/terminal|shell|command|script/.test(value)) return Terminal;
  if (/deploy|release|repository|git|app|service|launch/.test(value)) return Rocket;
  if (/monitor|metric|health|observe|alert/.test(value)) return Activity;
  if (/server|node|machine/.test(value)) return Server;
  if (/web|http|browser/.test(value)) return Globe;
  if (/config|setting|environment/.test(value)) return Settings;
  if (/lock|access|permission|user/.test(value)) return Lock;
  return Server;
}
