import type { Course } from "./types";

export const embeddedSystems: Course = {
  id: "embedded-systems",
  title: "Microcontrollers and Embedded Systems",
  short: "GPIO, sensors, actuators, serial links and Arduino-style code.",
  overview:
    "An embedded system is a computer dedicated to one job inside a larger product. This course introduces microcontroller architecture, digital I/O, sensor interfacing, actuator control and serial communication using Arduino-style C.",
  difficulty: "Beginner",
  hours: 10,
  objectives: [
    "Identify the main blocks of a microcontroller.",
    "Configure pins as inputs or outputs and read/write them.",
    "Convert ADC readings into physical units.",
    "Drive LEDs, buzzers and motors safely with PWM and transistors.",
    "Structure an Arduino sketch with setup() and loop().",
  ],
  prerequisites: ["Digital Electronics — binary and logic gates"],
  activities: [
    { label: "Sensor & IoT Lab", href: "/lab/sensors" },
    { label: "Arduino-style coding challenges", href: "/coding" },
    { label: "Smart Home scenario", href: "/scenarios/smart-home" },
  ],
  quizIds: ["embedded-iot"],
  modules: [
    {
      id: "mcu",
      title: "Microcontroller Basics",
      lessons: [
        {
          id: "microcontroller-fundamentals",
          title: "Microcontroller Fundamentals",
          minutes: 14,
          summary: "CPU, memory and peripherals on one chip.",
          diagram: { kind: "blocks", blocks: ["Sensors", "ADC / GPIO", "CPU + Flash + RAM", "GPIO / PWM", "Actuators"], caption: "Data flow in an embedded controller" },
          sections: [
            {
              heading: "What is on the chip",
              body: [
                "A microcontroller (MCU) integrates a CPU core, Flash memory for the program, SRAM for variables, and peripherals: GPIO pins, timers, an ADC, and serial interfaces such as UART, SPI and I²C.",
                "The ATmega328P used on the Arduino Uno runs at 16 MHz with 32 KB Flash, 2 KB SRAM, 14 digital pins (6 with PWM) and a 6-channel 10-bit ADC.",
              ],
            },
            {
              heading: "Program structure",
              body: ["Arduino sketches have setup(), run once after reset to configure pins, and loop(), which runs forever. Embedded programs typically never exit."],
            },
          ],
          terms: [["GPIO", "General-purpose input/output pin."], ["Flash", "Non-volatile program memory."], ["Peripheral", "On-chip hardware block such as a timer or ADC."]],
          takeaways: ["MCUs combine CPU, memory and I/O.", "setup() configures, loop() repeats.", "Resources are small — write efficient code."],
          check: [{ q: "Which memory keeps the program after power-off?", options: ["SRAM", "Flash", "Registers"], answer: 1, explanation: "Flash is non-volatile." }],
        },
        {
          id: "digital-io",
          title: "Digital Input and Output",
          minutes: 14,
          summary: "pinMode, digitalRead, digitalWrite and pull-up resistors.",
          sections: [
            {
              heading: "Outputs",
              body: ["pinMode(13, OUTPUT) then digitalWrite(13, HIGH) drives the pin to 5 V. A series resistor limits LED current: R = (Vcc − Vf)/I, e.g. (5 − 2)/0.015 ≈ 200 Ω."],
            },
            {
              heading: "Inputs and pull-ups",
              body: [
                "A floating input reads random values. A pull-up resistor (or INPUT_PULLUP) holds the pin HIGH; pressing a button to ground makes it read LOW — so the logic is inverted.",
                "Mechanical buttons bounce for a few milliseconds; debounce in software by requiring a stable reading for ~20 ms.",
              ],
            },
          ],
          terms: [["Pull-up", "Resistor to Vcc that defines an idle HIGH level."], ["Debounce", "Filtering contact bounce."]],
          equations: [{ label: "LED resistor", expr: "R = (V꜀꜀ − V_f) / I_f" }],
          example: { problem: "Choose a resistor for a red LED (Vf = 2 V, 10 mA) on 5 V.", solution: ["R = (5 − 2)/0.01 = 300 Ω.", "Use the next standard value, 330 Ω."] },
          takeaways: ["Always limit LED current.", "Never leave inputs floating.", "With pull-ups, pressed = LOW."],
          check: [{ q: "With INPUT_PULLUP, an unpressed button reads", options: ["HIGH", "LOW"], answer: 0, explanation: "The pull-up holds the pin HIGH." }],
          simulations: ["sensors"],
        },
      ],
    },
    {
      id: "interfacing",
      title: "Interfacing",
      lessons: [
        {
          id: "sensor-interfaces",
          title: "Sensor Interfaces",
          minutes: 16,
          summary: "Reading analog sensors with the ADC and converting to units.",
          sections: [
            {
              heading: "ADC conversion",
              body: [
                "A 10-bit ADC maps 0–Vref to 0–1023. Voltage = reading × Vref / 1023. The LM35 temperature sensor outputs 10 mV/°C, so T(°C) = Voltage × 100.",
                "An LDR in a voltage divider gives a voltage that rises or falls with light. An HC-SR04 ultrasonic sensor reports distance through echo time: d = t × 343 m/s ÷ 2.",
              ],
            },
          ],
          terms: [["ADC", "Analog-to-digital converter."], ["Voltage divider", "Two resistors producing a fraction of the input voltage."]],
          equations: [{ label: "ADC to voltage", expr: "V = ADC × V_ref / (2ⁿ − 1)" }, { label: "Ultrasonic distance", expr: "d = (t × 0.0343 cm/µs) / 2" }],
          example: { problem: "LM35 reading = 62 on a 5 V, 10-bit ADC.", solution: ["V = 62 × 5/1023 ≈ 0.303 V.", "T ≈ 30.3 °C."] },
          takeaways: ["Know your ADC resolution and reference.", "Each sensor has a transfer function to physical units."],
          check: [{ q: "Echo time of 580 µs gives distance ≈", options: ["5 cm", "10 cm", "20 cm", "58 cm"], answer: 1, explanation: "580 × 0.0343 / 2 ≈ 9.9 cm." }],
          simulations: ["sensors"],
        },
        {
          id: "actuator-control",
          title: "Actuator Control",
          minutes: 14,
          summary: "PWM, transistors and relays for LEDs, motors and buzzers.",
          sections: [
            {
              heading: "PWM",
              body: [
                "Pulse-width modulation rapidly switches a pin on and off. The average voltage equals duty cycle × Vcc. analogWrite(pin, 128) gives roughly 50% duty on an 8-bit PWM channel.",
                "MCU pins can source only ~20 mA. Motors and relays need a transistor or MOSFET driver and a flyback diode to absorb inductive spikes.",
              ],
            },
          ],
          terms: [["Duty cycle", "Fraction of the period the signal is HIGH."], ["Flyback diode", "Protects drivers from inductive voltage spikes."]],
          equations: [{ label: "Average voltage", expr: "V_avg = D × V꜀꜀" }],
          takeaways: ["PWM controls average power.", "Use drivers for loads above ~20 mA.", "Protect against inductive kickback."],
          check: [{ q: "analogWrite(pin, 64) on 5 V gives average ≈", options: ["0.6 V", "1.25 V", "2.5 V", "3.2 V"], answer: 1, explanation: "64/255 × 5 ≈ 1.25 V." }],
          simulations: ["sensors"],
        },
        {
          id: "serial-communication",
          title: "Serial Communication",
          minutes: 12,
          summary: "UART, I²C and SPI at a glance.",
          sections: [
            {
              heading: "Three common buses",
              body: [
                "UART sends bytes asynchronously on TX/RX lines at an agreed baud rate (e.g. 9600 bit/s); each frame has a start bit, 8 data bits and a stop bit.",
                "I²C uses two shared wires (SDA, SCL) and 7-bit addresses so many sensors share one bus. SPI uses four wires (MOSI, MISO, SCK, CS) and is faster but needs one chip-select per device.",
              ],
            },
          ],
          terms: [["Baud rate", "Symbols per second on a serial line."], ["Chip select", "SPI line that enables one device."]],
          example: { problem: "How long does one byte take at 9600 baud with 8N1 framing?", solution: ["10 bits per frame.", "10/9600 ≈ 1.04 ms."] },
          takeaways: ["UART: simple point-to-point.", "I²C: many devices, 2 wires.", "SPI: fast, more wires."],
          check: [{ q: "Which bus uses device addresses on two wires?", options: ["UART", "SPI", "I²C"], answer: 2, explanation: "I²C addresses devices on SDA/SCL." }],
        },
        {
          id: "arduino-programming",
          title: "Basic Arduino-Style Programming",
          minutes: 16,
          summary: "Variables, conditionals and loops in sketches.",
          sections: [
            {
              heading: "Control flow",
              body: [
                "Embedded logic is mostly read → decide → act. For example: int t = readTemp(); if (t > 30) digitalWrite(FAN, HIGH); else digitalWrite(FAN, LOW);",
                "Adding hysteresis (turn on above 30 °C, off below 28 °C) prevents rapid toggling when the reading hovers near the threshold.",
                "Avoid long delay() calls in loop(); use millis() timing so the controller stays responsive.",
              ],
            },
          ],
          terms: [["Hysteresis", "Different on/off thresholds to avoid chatter."], ["millis()", "Milliseconds since reset — used for non-blocking timing."]],
          takeaways: ["Read, decide, act.", "Use hysteresis for thresholds.", "Prefer non-blocking timing."],
          check: [{ q: "Hysteresis prevents…", options: ["Overflow", "Rapid on/off toggling", "Floating inputs"], answer: 1, explanation: "Separate thresholds stop chatter near the setpoint." }],
          simulations: ["sensors"],
        },
      ],
    },
  ],
};
