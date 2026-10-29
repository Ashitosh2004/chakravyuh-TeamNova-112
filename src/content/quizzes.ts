import type { Question } from "@/engines/quiz";

export interface Quiz {
  id: string;
  title: string;
  category: string;
  description: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  timeLimitSec?: number;
  questions: Question[];
}

export interface Game {
  id: string;
  title: string;
  description: string;
  kind: "circuit-puzzle" | "components" | "rapid-logic";
}

export const GAMES: Game[] = [
  { id: "game-circuit-puzzle", title: "Circuit Logic Puzzle", kind: "circuit-puzzle", description: "Find the input combination that lights the output LED in multi-gate circuits." },
  { id: "game-components", title: "Component Identification", kind: "components", description: "Identify electronic components from their schematic symbol and function." },
  { id: "game-rapid-logic", title: "Rapid Logic Challenge", kind: "rapid-logic", description: "Evaluate as many Boolean expressions as you can before the timer runs out." },
];

export const QUIZZES: Quiz[] = [
  {
    id: "digital-basics",
    title: "Digital Electronics Fundamentals",
    category: "Digital Electronics",
    difficulty: "Beginner",
    description: "Number systems, gates, Boolean algebra and truth tables.",
    timeLimitSec: 600,
    questions: [
      { id: "d1", type: "numeric", topic: "Number systems", prompt: "Convert binary 101101 to decimal.", answer: 45, tolerance: 0, explanation: "32 + 8 + 4 + 1 = 45." },
      { id: "d2", type: "mcq", topic: "Number systems", prompt: "0xA7 in binary is:", options: ["1010 0111", "1011 0111", "1010 1111", "0111 1010"], answer: 0, explanation: "A = 1010, 7 = 0111." },
      { id: "d3", type: "truthtable", topic: "Logic gates", prompt: "Complete the output column for Y = A ⊕ B.", inputs: ["A", "B"], answer: [0, 1, 1, 0], explanation: "XOR is 1 when inputs differ: rows 01 and 10." },
      { id: "d4", type: "mcq", topic: "Logic gates", prompt: "Circuit output prediction: A = 1, B = 0, C = 1 feed Y = (A · B) + C′. What is Y?", figure: "Y = (A AND B) OR (NOT C)", options: ["0", "1"], answer: 0, explanation: "A·B = 0, C′ = 0, so Y = 0 + 0 = 0." },
      { id: "d5", type: "tf", topic: "Boolean algebra", prompt: "NAND is a universal gate.", answer: true, explanation: "Any Boolean function can be built from NAND gates alone." },
      { id: "d6", type: "mcq", topic: "Boolean algebra", prompt: "Simplify A + A′B.", options: ["A", "B", "A + B", "AB"], answer: 2, explanation: "A + A′B = (A + A′)(A + B) = A + B." },
      { id: "d7", type: "truthtable", topic: "Logic gates", prompt: "Complete the output column for Y = (A + B)′ (NOR).", inputs: ["A", "B"], answer: [1, 0, 0, 0], explanation: "NOR is 1 only when both inputs are 0." },
      { id: "d8", type: "mcq", topic: "Code output", prompt: "Basic code output: what does this print?", figure: "int x = 0b0110;\nint y = x ^ 0b0011;\nSerial.println(y);", options: ["5", "3", "6", "7"], answer: 0, explanation: "0110 XOR 0011 = 0101 = 5." },
      { id: "d9", type: "numeric", topic: "Truth tables", prompt: "How many rows does the truth table of a 5-input function have?", answer: 32, tolerance: 0, explanation: "2⁵ = 32." },
      { id: "d10", type: "tf", topic: "Sequential logic", prompt: "A D flip-flop's output changes immediately whenever D changes, regardless of the clock.", answer: false, explanation: "An edge-triggered D flip-flop updates only on the active clock edge." },
    ],
  },
  {
    id: "communication-fundamentals",
    title: "Communication Systems Essentials",
    category: "Communication Systems",
    difficulty: "Intermediate",
    description: "AM, FM, sampling, quantization and SNR.",
    timeLimitSec: 720,
    questions: [
      { id: "c1", type: "numeric", topic: "AM", prompt: "AM with fm = 4 kHz. Bandwidth in kHz?", answer: 8, tolerance: 0.01, unit: "kHz", explanation: "B = 2fm = 8 kHz." },
      { id: "c2", type: "mcq", topic: "AM", prompt: "Vmax = 15 V, Vmin = 5 V on an AM envelope. Modulation index?", options: ["0.33", "0.5", "0.67", "1.0"], answer: 1, explanation: "(15 − 5)/(15 + 5) = 0.5." },
      { id: "c3", type: "numeric", topic: "FM", prompt: "FM with Δf = 75 kHz and fm = 15 kHz. Carson bandwidth in kHz?", answer: 180, tolerance: 0.5, unit: "kHz", explanation: "2(75 + 15) = 180 kHz." },
      { id: "c4", type: "tf", topic: "FM", prompt: "The amplitude of an FM signal varies with the message.", answer: false, explanation: "FM keeps a constant amplitude; frequency varies." },
      { id: "c5", type: "numeric", topic: "Sampling", prompt: "Minimum sampling rate (kHz) for a signal band-limited to 3.4 kHz?", answer: 6.8, tolerance: 0.01, unit: "kHz", explanation: "Nyquist rate = 2 × 3.4 = 6.8 kHz." },
      { id: "c6", type: "mcq", topic: "Sampling", prompt: "A 9 kHz tone sampled at 12 kHz appears at:", options: ["9 kHz", "3 kHz", "21 kHz", "6 kHz"], answer: 1, explanation: "|9 − 12| = 3 kHz alias." },
      { id: "c7", type: "numeric", topic: "Quantization", prompt: "Approximate SQNR (dB) of a 12-bit quantizer for a full-scale sine? (1 decimal)", answer: 74, tolerance: 0.2, unit: "dB", explanation: "6.02 × 12 + 1.76 ≈ 74.0 dB." },
      { id: "c8", type: "mcq", topic: "Noise", prompt: "S/N = 1000 in dB is:", options: ["10 dB", "20 dB", "30 dB", "100 dB"], answer: 2, explanation: "10 log₁₀(1000) = 30 dB." },
    ],
  },
  {
    id: "signals-dsp",
    title: "Signals and DSP",
    category: "Signals and Systems",
    difficulty: "Intermediate",
    description: "Waveform parameters, LTI systems and the DFT.",
    questions: [
      { id: "s1", type: "numeric", topic: "Waveforms", prompt: "Period in ms of a 250 Hz sinusoid?", answer: 4, tolerance: 0.01, unit: "ms", explanation: "T = 1/250 = 4 ms." },
      { id: "s2", type: "mcq", topic: "Waveforms", prompt: "A square wave contains which harmonics?", options: ["All", "Even only", "Odd only", "None"], answer: 2, explanation: "Fourier series of a square wave has odd harmonics only." },
      { id: "s3", type: "tf", topic: "LTI", prompt: "y[n] = x[n − 2] is time-invariant.", answer: true, explanation: "A delay commutes with shifting the input." },
      { id: "s4", type: "numeric", topic: "DFT", prompt: "fs = 1 kHz, N = 200. DFT bin spacing in Hz?", answer: 5, tolerance: 0.01, unit: "Hz", explanation: "Δf = 1000/200 = 5 Hz." },
      { id: "s5", type: "mcq", topic: "Filters", prompt: "A moving average is a:", options: ["High-pass IIR", "Low-pass FIR", "Band-stop IIR"], answer: 1, explanation: "Averaging smooths fast variations; no feedback → FIR." },
    ],
  },
  {
    id: "embedded-iot",
    title: "Embedded Systems, Sensors & IoT",
    category: "Embedded Systems",
    difficulty: "Beginner",
    description: "GPIO, ADC, PWM, sensors and IoT protocols.",
    timeLimitSec: 480,
    questions: [
      { id: "e1", type: "numeric", topic: "ADC", prompt: "10-bit ADC, Vref = 5 V. Reading 512 is about how many volts? (2 decimals)", answer: 2.5, tolerance: 0.02, unit: "V", explanation: "512 × 5/1023 ≈ 2.50 V." },
      { id: "e2", type: "mcq", topic: "Sensors", prompt: "Component identification: which sensor outputs 10 mV per °C?", options: ["LDR", "LM35", "HC-SR04", "PIR"], answer: 1, explanation: "The LM35 is a linear 10 mV/°C temperature sensor." },
      { id: "e3", type: "tf", topic: "GPIO", prompt: "An input pin left unconnected reliably reads LOW.", answer: false, explanation: "Floating inputs read unpredictably; use pull-up/down resistors." },
      { id: "e4", type: "numeric", topic: "PWM", prompt: "analogWrite value for 40% duty on 8-bit PWM (nearest integer)?", answer: 102, tolerance: 0.5, explanation: "0.4 × 255 = 102." },
      { id: "e5", type: "mcq", topic: "Code output", prompt: "What is written to pin 8?", figure: "int t = 31;\nif (t > 30 && t < 40) digitalWrite(8, HIGH);\nelse digitalWrite(8, LOW);", options: ["HIGH", "LOW"], answer: 0, explanation: "31 is between 30 and 40." },
      { id: "e6", type: "mcq", topic: "IoT", prompt: "In MQTT, devices exchange messages through a:", options: ["Broker", "Router table", "Peer socket"], answer: 0, explanation: "Publishers and subscribers connect to a broker." },
      { id: "e7", type: "mcq", topic: "Sensors", prompt: "Component identification: which device detects motion via infrared changes?", options: ["Thermistor", "PIR sensor", "Potentiometer", "Photodiode"], answer: 1, explanation: "Passive infrared sensors detect moving warm bodies." },
    ],
  },
];

export function getQuiz(id: string) {
  return QUIZZES.find((q) => q.id === id);
}
export function getGame(id: string) {
  return GAMES.find((g) => g.id === id);
}
