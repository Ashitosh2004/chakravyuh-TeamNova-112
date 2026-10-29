import type { TestCase } from "@/engines/challenge";

export interface Challenge {
  id: string;
  title: string;
  category: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  points: number;
  objective: string;
  statement: string;
  inputSpec: string;
  outputSpec: string;
  examples: { input: string; output: string }[];
  constraints: string[];
  starter: string;
  /** Practice tests — visible locally. Authoritative grading happens on the backend. */
  tests: TestCase[];
  hint: string;
}

export const CHALLENGES: Challenge[] = [
  {
    id: "xor-gate",
    title: "Build XOR from basic operators",
    category: "Boolean logic",
    difficulty: "Beginner",
    points: 10,
    objective: "Express a logic gate using AND, OR and NOT.",
    statement: "Return the XOR of inputs a and b using only &&, || and ! (do not use ^ or !=).",
    inputSpec: "a, b ∈ {0, 1}",
    outputSpec: "return 1 if exactly one input is 1, else 0",
    examples: [{ input: "a=1, b=0", output: "1" }, { input: "a=1, b=1", output: "0" }],
    constraints: ["Use only &&, || and !"],
    starter: "// a and b are provided (0 or 1)\nint y = 0;\n// your logic here\n\nreturn y;",
    tests: [0, 1].flatMap((a) => [0, 1].map((b) => ({ name: `a=${a}, b=${b}`, inputs: { a, b }, expectReturn: a ^ b }))),
    hint: "XOR = (a AND NOT b) OR (NOT a AND b).",
  },
  {
    id: "binary-to-decimal",
    title: "Binary digits to decimal",
    category: "Number-system conversion",
    difficulty: "Beginner",
    points: 15,
    objective: "Apply place-value weights.",
    statement: "Four bits b3 b2 b1 b0 (b3 is the MSB) are provided. Return their decimal value.",
    inputSpec: "b3, b2, b1, b0 ∈ {0, 1}",
    outputSpec: "decimal value 0–15",
    examples: [{ input: "b3=1 b2=0 b1=1 b0=1", output: "11" }],
    constraints: ["Do not hard-code answers."],
    starter: "int value = 0;\n// combine the bits using powers of two\n\nreturn value;",
    tests: [[0, 0, 0, 0], [1, 0, 1, 1], [1, 1, 1, 1], [0, 1, 1, 0], [1, 0, 0, 0]].map(([b3, b2, b1, b0]) => ({
      name: `${b3}${b2}${b1}${b0}`, inputs: { b3, b2, b1, b0 }, expectReturn: b3 * 8 + b2 * 4 + b1 * 2 + b0,
    })),
    hint: "value = b3*8 + b2*4 + b1*2 + b0, or use shifts: (b3 << 3) | …",
  },
  {
    id: "count-ones",
    title: "Count set bits",
    category: "Loops",
    difficulty: "Intermediate",
    points: 20,
    objective: "Use a loop and bitwise operators.",
    statement: "Given an 8-bit number n, return how many bits are 1 (its population count). A parity checker uses this value.",
    inputSpec: "0 ≤ n ≤ 255",
    outputSpec: "number of 1 bits",
    examples: [{ input: "n=5 (00000101)", output: "2" }, { input: "n=255", output: "8" }],
    constraints: ["Use a loop; maximum 8 iterations is enough."],
    starter: "int count = 0;\nfor (int i = 0; i < 8; i++) {\n  // check bit i\n}\nreturn count;",
    tests: [0, 5, 255, 128, 170, 77].map((n) => ({ name: `n=${n}`, inputs: { n }, expectReturn: n.toString(2).split("").filter((c) => c === "1").length })),
    hint: "(n >> i) & 1 gives bit i.",
  },
  {
    id: "fan-threshold",
    title: "Temperature-controlled fan",
    category: "Sensor threshold logic",
    difficulty: "Beginner",
    points: 15,
    objective: "Drive an actuator from a sensor threshold.",
    statement: "The temperature in °C is provided as temp. Write HIGH to pin 9 (fan) if temp is above 30, otherwise LOW. Also write HIGH to pin 13 (warning LED) if temp is 45 or more, otherwise LOW.",
    inputSpec: "temp: number (°C)",
    outputSpec: "digitalWrite(9, …) and digitalWrite(13, …)",
    examples: [{ input: "temp=32", output: "pin9=HIGH, pin13=LOW" }],
    constraints: ["Both pins must be written on every run."],
    starter: "const int FAN = 9;\nconst int LED = 13;\n\n// decide and act\n",
    tests: [[25, 0, 0], [30, 0, 0], [30.5, 1, 0], [45, 1, 1], [60, 1, 1]].map(([temp, fan, led]) => ({
      name: `temp=${temp}`, inputs: { temp }, expectPins: { 9: fan, 13: led },
    })),
    hint: "Use two independent if/else statements.",
  },
  {
    id: "hysteresis",
    title: "Thermostat with hysteresis",
    category: "Embedded programming",
    difficulty: "Intermediate",
    points: 25,
    objective: "Implement hysteresis to avoid relay chatter.",
    statement: "A heater was previously in state prev (1=on). Turn it ON when temp < 18, OFF when temp > 22, and otherwise keep the previous state. Return the new state.",
    inputSpec: "temp (°C), prev ∈ {0,1}",
    outputSpec: "return new heater state 0/1",
    examples: [{ input: "temp=20, prev=1", output: "1" }, { input: "temp=23, prev=1", output: "0" }],
    constraints: [],
    starter: "int state = prev;\n\nreturn state;",
    tests: [[17, 0, 1], [20, 1, 1], [20, 0, 0], [23, 1, 0], [18, 0, 0], [22, 1, 1]].map(([temp, prev, exp]) => ({
      name: `temp=${temp}, prev=${prev}`, inputs: { temp, prev }, expectReturn: exp,
    })),
    hint: "Two if branches; do nothing between 18 and 22 inclusive.",
  },
  {
    id: "pwm-brightness",
    title: "Light-dependent LED brightness",
    category: "Arduino-style exercises",
    difficulty: "Intermediate",
    points: 20,
    objective: "Map a sensor range to a PWM duty.",
    statement: "An LDR gives lux (0–1000). Write analogWrite(5, duty) where duty = 255 when lux ≤ 100, 0 when lux ≥ 800, and linearly decreasing in between (integer, truncate toward zero). Darker room → brighter LED.",
    inputSpec: "lux: 0–1000",
    outputSpec: "analogWrite(5, duty)",
    examples: [{ input: "lux=450", output: "duty=127" }],
    constraints: ["You may use map() and constrain()."],
    starter: "int duty = 0;\n// compute duty\n\nanalogWrite(5, duty);",
    tests: [[50, 255], [100, 255], [450, 127], [800, 0], [1000, 0], [275, 191]].map(([lux, duty]) => ({
      name: `lux=${lux}`, inputs: { lux }, expectPins: { 5: duty },
    })),
    hint: "duty = map(constrain(lux, 100, 800), 100, 800, 255, 0).",
  },
  {
    id: "moving-average",
    title: "Moving average of four samples",
    category: "Signal-processing calculations",
    difficulty: "Beginner",
    points: 10,
    objective: "Compute a simple FIR filter output.",
    statement: "Four sensor samples x0..x3 are provided. Return their mean.",
    inputSpec: "x0, x1, x2, x3: numbers",
    outputSpec: "(x0+x1+x2+x3)/4",
    examples: [{ input: "2, 4, 6, 8", output: "5" }],
    constraints: [],
    starter: "float avg = 0;\n\nreturn avg;",
    tests: [[2, 4, 6, 8], [1, 1, 1, 1], [10, 0, 0, 0], [3.5, 2.5, 1, 1]].map(([x0, x1, x2, x3]) => ({
      name: `${x0},${x1},${x2},${x3}`, inputs: { x0, x1, x2, x3 }, expectReturn: (x0 + x1 + x2 + x3) / 4,
    })),
    hint: "Add the four inputs and divide by 4.",
  },
  {
    id: "snr-db",
    title: "Signal-to-noise ratio in dB",
    category: "Signal-processing calculations",
    difficulty: "Intermediate",
    points: 15,
    objective: "Use logarithms for power ratios.",
    statement: "Given signal power S and noise power N (watts), return the SNR in decibels.",
    inputSpec: "S > 0, N > 0",
    outputSpec: "10·log10(S/N)",
    examples: [{ input: "S=100, N=1", output: "20" }],
    constraints: ["Answer accepted within ±0.01 dB."],
    starter: "// log10() is available\nreturn 0;",
    tests: [[100, 1], [1, 1], [2, 1], [0.5, 0.005]].map(([S, N]) => ({
      name: `S=${S}, N=${N}`, inputs: { S, N }, expectReturn: 10 * Math.log10(S / N), tolerance: 0.01,
    })),
    hint: "return 10 * log10(S / N);",
  },
  {
    id: "seven-segment-even",
    title: "Even-number indicator",
    category: "Conditional statements",
    difficulty: "Beginner",
    points: 10,
    objective: "Use the modulo operator in a condition.",
    statement: "Print 'EVEN' code 1 or 'ODD' code 0 using Serial.println for the number n.",
    inputSpec: "n: integer",
    outputSpec: "Serial.println(1) if n is even else Serial.println(0)",
    examples: [{ input: "n=4", output: "1" }],
    constraints: [],
    starter: "// Serial.println(value) prints a line\n",
    tests: [4, 7, 0, 13, 100].map((n) => ({ name: `n=${n}`, inputs: { n }, expectOutput: [n % 2 === 0 ? "1" : "0"] })),
    hint: "if (n % 2 == 0) …",
  },
  {
    id: "gray-code",
    title: "Binary to Gray code",
    category: "Problem-solving exercises",
    difficulty: "Advanced",
    points: 30,
    objective: "Use shifts and XOR.",
    statement: "Return the Gray code of the integer n (0–255). Adjacent Gray codes differ in exactly one bit — the ordering used by K-maps and rotary encoders.",
    inputSpec: "0 ≤ n ≤ 255",
    outputSpec: "Gray code value",
    examples: [{ input: "n=2", output: "3" }, { input: "n=7", output: "4" }],
    constraints: ["Single expression is possible."],
    starter: "return n;",
    tests: [0, 1, 2, 3, 7, 8, 200].map((n) => ({ name: `n=${n}`, inputs: { n }, expectReturn: n ^ (n >> 1) })),
    hint: "gray = n ^ (n >> 1).",
  },
];

export function getChallenge(id: string) {
  return CHALLENGES.find((c) => c.id === id);
}
