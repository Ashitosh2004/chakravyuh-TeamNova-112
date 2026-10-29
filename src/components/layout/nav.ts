import { Award, BookOpen, Bot, Code2, FlaskConical, Gauge, Globe2, LineChart, ListChecks, Settings, User } from "lucide-react";

export const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: Gauge },
  { to: "/learn", label: "Learning Center", icon: BookOpen },
  { to: "/lab", label: "Virtual Lab", icon: FlaskConical },
  { to: "/coding", label: "Coding Challenges", icon: Code2 },
  { to: "/quizzes", label: "Quizzes & Games", icon: ListChecks },
  { to: "/scenarios", label: "Real-World Scenarios", icon: Globe2 },
  { to: "/ai-assistant", label: "AI Assistant", icon: Bot },
  { to: "/progress", label: "Progress", icon: LineChart },
  { to: "/achievements", label: "Achievements", icon: Award },
] as const;

export const ACCOUNT_NAV = [
  { to: "/profile", label: "Profile", icon: User },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;
