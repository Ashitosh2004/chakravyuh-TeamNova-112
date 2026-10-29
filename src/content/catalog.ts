import { Activity, Binary, Cpu, Radio, Waves, type LucideIcon } from "lucide-react";

export interface Simulation {
  id: string;
  title: string;
  description: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  icon: LucideIcon;
  lessons: { label: string; href: string }[];
}

export const SIMULATIONS: Simulation[] = [
  { id: "logic-gates", title: "Logic Gate Laboratory", difficulty: "Beginner", icon: Binary, description: "Toggle inputs on all seven basic gates and watch outputs and truth tables update.", lessons: [{ label: "Logic Gates", href: "/learn/digital-electronics/lesson/logic-gates" }, { label: "Truth Tables", href: "/learn/digital-electronics/lesson/truth-tables" }] },
  { id: "circuit-builder", title: "Digital Circuit Builder", difficulty: "Intermediate", icon: Cpu, description: "Place gates, wire them together, evaluate outputs and generate truth tables.", lessons: [{ label: "Combinational Circuits", href: "/learn/digital-electronics/lesson/combinational-circuits" }] },
  { id: "signals", title: "Signal Processing Laboratory", difficulty: "Beginner", icon: Waves, description: "Shape waveforms, then sample, quantize and reconstruct them.", lessons: [{ label: "Periodic Signals", href: "/learn/signals-systems/lesson/periodic-signals" }, { label: "Sampling", href: "/learn/communication-systems/lesson/sampling" }] },
  { id: "communication", title: "Communication Systems Laboratory", difficulty: "Intermediate", icon: Radio, description: "AM and FM modulation, envelope detection and noise/SNR effects (simplified models).", lessons: [{ label: "Amplitude Modulation", href: "/learn/communication-systems/lesson/amplitude-modulation" }, { label: "Noise and SNR", href: "/learn/communication-systems/lesson/noise-snr" }] },
  { id: "sensors", title: "Sensor & IoT Laboratory", difficulty: "Beginner", icon: Activity, description: "Virtual temperature, light, distance and motion sensors driving LEDs, fans and buzzers.", lessons: [{ label: "Sensor Interfaces", href: "/learn/embedded-systems/lesson/sensor-interfaces" }, { label: "Actuator Control", href: "/learn/embedded-systems/lesson/actuator-control" }] },
];

export interface Scenario {
  id: string;
  title: string;
  problem: string;
  objectives: string[];
  difficulty: "Beginner" | "Intermediate" | "Advanced";
}

export const SCENARIOS: Scenario[] = [
  { id: "smart-home", title: "Smart Home Automation", difficulty: "Beginner", problem: "Design rules so a room's fan, lights and buzzer respond sensibly to temperature, light and motion.", objectives: ["Translate requirements into threshold rules.", "Observe how readings trigger actuators.", "Avoid conflicting or wasteful rules."] },
  { id: "safety-system", title: "Intelligent Safety System", difficulty: "Intermediate", problem: "Configure gas and smoke thresholds so alarms trigger for hazards but not for normal cooking fluctuations.", objectives: ["Set alarm thresholds with safety margins.", "Understand false positives vs false negatives.", "Escalate responses by severity."] },
  { id: "environment-monitoring", title: "IoT Environmental Monitoring", difficulty: "Beginner", problem: "Monitor a classroom's temperature, humidity and air quality and raise alerts when comfort or health limits are exceeded.", objectives: ["Classify readings into status bands.", "Track readings over a simulated day.", "Relate thresholds to health guidelines."] },
  { id: "communication-network", title: "Intelligent Communication Network", difficulty: "Advanced", problem: "Tune signal power, bandwidth and load so a multi-hop wireless link delivers video with low loss and latency.", objectives: ["Relate SNR to capacity (Shannon).", "See how congestion causes loss and delay.", "Balance throughput against latency."] },
];

export const getSimulation = (id: string) => SIMULATIONS.find((s) => s.id === id);
export const getScenario = (id: string) => SCENARIOS.find((s) => s.id === id);
