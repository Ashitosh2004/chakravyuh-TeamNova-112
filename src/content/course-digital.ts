import type { Course } from "./types";

export const digitalElectronics: Course = {
  id: "digital-electronics",
  title: "Digital Electronics",
  short: "Binary, Boolean algebra, logic gates and sequential circuits.",
  overview:
    "Digital electronics represents information with two voltage levels and processes it with logic gates. This course builds from number systems through Boolean algebra and Karnaugh maps to combinational and sequential circuits — the foundation of every processor and microcontroller.",
  difficulty: "Beginner",
  hours: 9,
  objectives: [
    "Convert between binary, decimal, octal and hexadecimal.",
    "Simplify Boolean expressions using algebraic laws and K-maps.",
    "Predict the output of any basic gate and build truth tables.",
    "Design simple combinational circuits such as adders and multiplexers.",
    "Explain how flip-flops store a single bit of state.",
  ],
  prerequisites: [],
  activities: [
    { label: "Logic Gate Laboratory", href: "/lab/logic-gates" },
    { label: "Digital Circuit Builder", href: "/lab/circuit-builder" },
    { label: "Circuit Logic Puzzle", href: "/quizzes/game-circuit-puzzle" },
  ],
  quizIds: ["digital-basics", "game-rapid-logic"],
  modules: [
    {
      id: "numbers",
      title: "Number Systems",
      lessons: [
        {
          id: "binary-numbers",
          title: "Binary Numbers",
          minutes: 12,
          summary: "Why digital systems use base-2 and how place value works in binary.",
          sections: [
            {
              heading: "Two states are robust",
              body: [
                "A digital circuit only needs to distinguish two voltage ranges — for example 0–0.8 V as logic 0 and 2–5 V as logic 1 in classic TTL. Small amounts of noise do not change which range a signal falls into, so information survives copying and transmission.",
                "Each two-valued digit is a bit. Groups of 4 bits form a nibble and 8 bits form a byte.",
              ],
            },
            {
              heading: "Place value in base 2",
              body: [
                "Exactly like decimal, every position has a weight — but the weights are powers of 2 instead of powers of 10. The rightmost bit (LSB) has weight 2⁰ = 1, the next 2¹ = 2, then 4, 8, 16 and so on. The leftmost bit is the most significant bit (MSB).",
                "An n-bit unsigned number can represent values from 0 to 2ⁿ − 1. An 8-bit register therefore holds 0–255.",
              ],
            },
          ],
          terms: [["Bit", "A single binary digit, 0 or 1."], ["LSB / MSB", "Least / most significant bit — lowest and highest weight positions."], ["Byte", "A group of 8 bits."]],
          equations: [{ label: "Binary to decimal", expr: "N = Σ bᵢ · 2ⁱ", vars: "bᵢ is the bit at position i (counting from 0 at the LSB)." }],
          example: {
            problem: "Convert 1011₀₁₀ — i.e. the binary number 1011 0110 — to decimal.",
            solution: ["Weights from MSB: 128, 64, 32, 16, 8, 4, 2, 1.", "Bits: 1 0 1 1 0 1 1 0.", "Sum = 128 + 32 + 16 + 4 + 2 = 182."],
          },
          takeaways: ["Digital systems use two levels because they tolerate noise.", "Binary place values are powers of 2.", "n bits represent 2ⁿ distinct values."],
          check: [
            { q: "What is the largest unsigned value in 6 bits?", options: ["32", "63", "64", "127"], answer: 1, explanation: "2⁶ − 1 = 63." },
            { q: "Binary 1101 equals decimal…", options: ["11", "12", "13", "14"], answer: 2, explanation: "8 + 4 + 0 + 1 = 13." },
          ],
        },
        {
          id: "number-conversions",
          title: "Number-System Conversions",
          minutes: 15,
          summary: "Decimal ↔ binary ↔ hexadecimal ↔ octal conversion methods.",
          sections: [
            {
              heading: "Decimal to binary: repeated division",
              body: [
                "Divide the decimal number by 2 repeatedly and record each remainder. Reading the remainders from last to first gives the binary number.",
              ],
            },
            {
              heading: "Hexadecimal and octal shortcuts",
              body: [
                "Because 16 = 2⁴, every hex digit maps to exactly 4 bits (0–9, A=10 … F=15). Because 8 = 2³, every octal digit maps to 3 bits. Group the binary number from the right and translate each group independently.",
                "Engineers write hex with a 0x prefix (0xB6) and binary with 0b (0b10110110) in C and Arduino code.",
              ],
            },
          ],
          terms: [["Radix", "The base of a number system (2, 8, 10, 16)."], ["Hex digit", "One of 0–9, A–F; represents 4 bits."]],
          steps: ["Divide by 2, write remainder.", "Repeat with the quotient until it is 0.", "Read remainders bottom-up.", "For hex, group bits in fours from the right."],
          example: {
            problem: "Convert decimal 45 to binary and hexadecimal.",
            solution: ["45/2=22 r1, 22/2=11 r0, 11/2=5 r1, 5/2=2 r1, 2/2=1 r0, 1/2=0 r1.", "Reading upward: 101101₂.", "Group: 0010 1101 → 2 D → 0x2D."],
          },
          takeaways: ["Use repeated division for decimal → binary.", "Hex groups 4 bits, octal groups 3 bits.", "Pad with leading zeros when grouping."],
          check: [
            { q: "0x3F in decimal is", options: ["48", "63", "61", "36"], answer: 1, explanation: "3×16 + 15 = 63." },
            { q: "Binary 111 010 in octal is", options: ["72", "27", "62", "70"], answer: 0, explanation: "111 = 7, 010 = 2 → 72₈." },
          ],
        },
      ],
    },
    {
      id: "boolean",
      title: "Boolean Logic",
      lessons: [
        {
          id: "boolean-algebra",
          title: "Boolean Algebra",
          minutes: 18,
          summary: "Laws and theorems used to simplify logic expressions.",
          sections: [
            {
              heading: "Operators",
              body: ["Boolean algebra has three basic operations: AND (·), OR (+) and NOT (′ or overbar). Variables take only the values 0 and 1."],
            },
            {
              heading: "Key laws",
              body: [
                "Identity: A + 0 = A, A · 1 = A. Null: A + 1 = 1, A · 0 = 0. Idempotent: A + A = A. Complement: A + A′ = 1, A · A′ = 0.",
                "Absorption: A + A·B = A. Distributive: A·(B + C) = A·B + A·C and A + B·C = (A + B)(A + C).",
                "De Morgan's theorems: (A · B)′ = A′ + B′ and (A + B)′ = A′ · B′. These let you convert between NAND/NOR forms.",
              ],
            },
          ],
          terms: [["Literal", "A variable or its complement."], ["SOP", "Sum of products, e.g. AB + A′C."], ["De Morgan", "Breaking a bar flips the operator."]],
          equations: [
            { label: "De Morgan 1", expr: "(A · B)′ = A′ + B′" },
            { label: "De Morgan 2", expr: "(A + B)′ = A′ · B′" },
          ],
          example: {
            problem: "Simplify Y = A·B + A·B′ + A′·B.",
            solution: ["A·B + A·B′ = A·(B + B′) = A.", "Y = A + A′·B.", "Using A + A′B = A + B, Y = A + B."],
          },
          takeaways: ["Every Boolean expression can be simplified with a small set of laws.", "De Morgan converts AND↔OR with inversion.", "Simpler expressions mean fewer gates."],
          check: [
            { q: "A + A·B simplifies to", options: ["B", "A·B", "A", "1"], answer: 2, explanation: "Absorption law." },
            { q: "(A + B)′ equals", options: ["A′ + B′", "A′ · B′", "A · B", "A ⊕ B"], answer: 1, explanation: "De Morgan's second theorem." },
          ],
          simulations: ["logic-gates"],
        },
        {
          id: "logic-gates",
          title: "Logic Gates",
          minutes: 15,
          summary: "The seven basic gates, their symbols and behaviour.",
          sections: [
            {
              heading: "Basic gates",
              body: [
                "AND outputs 1 only when all inputs are 1. OR outputs 1 when any input is 1. NOT inverts a single input.",
                "NAND and NOR are AND/OR followed by NOT. They are called universal gates because any logic function can be built from NAND alone (or NOR alone).",
                "XOR outputs 1 when the inputs differ; XNOR outputs 1 when they are equal. XOR is the heart of binary adders and parity checkers.",
              ],
            },
          ],
          terms: [["Universal gate", "A gate type sufficient to build any logic function (NAND, NOR)."], ["Parity", "Whether the number of 1s is odd or even."]],
          diagram: { kind: "gate", gate: "XOR", caption: "XOR gate: Y = A ⊕ B" },
          takeaways: ["Learn each gate by its truth table.", "NAND/NOR are universal.", "XOR detects difference."],
          check: [
            { q: "Which gate outputs 0 only when both inputs are 1?", options: ["NOR", "NAND", "XOR", "AND"], answer: 1, explanation: "NAND = NOT(AND)." },
            { q: "XOR with inputs 1,1 gives", options: ["0", "1"], answer: 0, explanation: "Inputs are equal, so XOR = 0." },
          ],
          simulations: ["logic-gates", "circuit-builder"],
        },
        {
          id: "truth-tables",
          title: "Truth Tables",
          minutes: 10,
          summary: "Systematically listing every input combination and its output.",
          sections: [
            {
              heading: "Building a truth table",
              body: [
                "With n inputs there are 2ⁿ rows. List inputs in binary counting order (00, 01, 10, 11 …) so that no combination is missed.",
                "To evaluate an expression, add intermediate columns for sub-expressions, then compute the final output column.",
              ],
            },
          ],
          terms: [["Minterm", "A product term that is 1 for exactly one row."], ["Canonical SOP", "OR of the minterms where output = 1."]],
          example: {
            problem: "Build the truth table for Y = A·B′ + C.",
            solution: ["8 rows (3 inputs).", "Y = 1 when C = 1 (4 rows) or when A=1,B=0,C=0 (1 more row).", "Y = 1 for minterms 1,3,4,5,7."],
          },
          takeaways: ["2ⁿ rows for n inputs.", "Use binary counting order.", "Rows with output 1 give the canonical SOP."],
          check: [{ q: "How many rows for a 4-input function?", options: ["8", "12", "16", "32"], answer: 2, explanation: "2⁴ = 16." }],
          simulations: ["circuit-builder"],
        },
        {
          id: "karnaugh-maps",
          title: "Karnaugh Maps",
          minutes: 20,
          summary: "A visual method for minimizing Boolean functions.",
          sections: [
            {
              heading: "Gray-code layout",
              body: [
                "A K-map arranges the truth table so that adjacent cells differ by exactly one variable (Gray code order 00, 01, 11, 10). Adjacent 1s can therefore be combined, eliminating the variable that changes.",
                "Group 1s in rectangles of size 1, 2, 4, 8… Groups may wrap around the edges. Use the largest groups possible and the fewest groups to cover every 1.",
              ],
            },
          ],
          terms: [["Prime implicant", "A group that cannot be made larger."], ["Don't care (X)", "An input combination whose output doesn't matter; may be used to enlarge groups."]],
          steps: ["Fill the map from the truth table.", "Circle the largest power-of-two groups of 1s.", "For each group, keep only variables that stay constant.", "OR the resulting product terms."],
          example: { problem: "Minimize Y(A,B,C) = Σm(1,3,5,7).", solution: ["All four 1s are where C = 1.", "One group of 4 → Y = C."] },
          takeaways: ["Adjacent cells differ by one bit.", "Bigger groups → simpler terms.", "Edges wrap around."],
          check: [{ q: "A group of 4 cells in a 3-variable K-map eliminates how many variables?", options: ["1", "2", "3", "0"], answer: 1, explanation: "4 = 2², so 2 variables are eliminated." }],
        },
      ],
    },
    {
      id: "circuits",
      title: "Combinational & Sequential Circuits",
      lessons: [
        {
          id: "combinational-circuits",
          title: "Combinational Circuits",
          minutes: 18,
          summary: "Adders, multiplexers and decoders — outputs depend only on present inputs.",
          sections: [
            {
              heading: "Half and full adders",
              body: [
                "A half adder adds two bits: Sum = A ⊕ B, Carry = A · B. A full adder also accepts a carry-in: Sum = A ⊕ B ⊕ Cin, Cout = A·B + Cin·(A ⊕ B).",
                "Chaining n full adders gives a ripple-carry adder for n-bit numbers.",
              ],
            },
            {
              heading: "Multiplexers and decoders",
              body: [
                "A 2:1 multiplexer selects one of two inputs: Y = S′·I0 + S·I1. A 2-to-4 decoder activates exactly one of four outputs for each 2-bit input code.",
              ],
            },
          ],
          terms: [["Combinational", "Output depends only on current inputs, no memory."], ["MUX", "Data selector."]],
          equations: [{ label: "Half adder", expr: "S = A ⊕ B,  C = A · B" }, { label: "2:1 MUX", expr: "Y = S′·I₀ + S·I₁" }],
          takeaways: ["Adders are built from XOR and AND.", "MUXes route data under control of select lines.", "No feedback loops in combinational logic."],
          check: [{ q: "Half adder carry for A=1, B=1 is", options: ["0", "1"], answer: 1, explanation: "Carry = A·B = 1." }],
          simulations: ["circuit-builder"],
        },
        {
          id: "flip-flops",
          title: "Flip-Flops and Sequential Logic",
          minutes: 18,
          summary: "Storing a bit with feedback; SR, D, JK and T flip-flops.",
          sections: [
            {
              heading: "Memory through feedback",
              body: [
                "Cross-coupling two NOR (or NAND) gates forms an SR latch, the simplest memory element. Its output depends on the present inputs and on its previous state.",
                "A D flip-flop captures its D input on a clock edge and holds it until the next edge: Q(next) = D. JK flip-flops toggle when J = K = 1; a T flip-flop toggles when T = 1.",
              ],
            },
            {
              heading: "Registers and counters",
              body: ["Groups of flip-flops sharing a clock form registers. Connecting T flip-flops in series forms a binary counter that divides the clock frequency by 2 at each stage."],
            },
          ],
          terms: [["Clock edge", "The rising or falling transition that triggers a flip-flop."], ["State", "The stored value that determines future outputs."]],
          equations: [{ label: "D flip-flop", expr: "Q(t+1) = D" }, { label: "JK flip-flop", expr: "Q(t+1) = J·Q′ + K′·Q" }],
          takeaways: ["Sequential circuits have memory.", "Flip-flops change only on clock edges.", "Counters are chains of toggling flip-flops."],
          check: [{ q: "A T flip-flop with T=1 on every clock edge…", options: ["Holds", "Toggles", "Resets", "Sets"], answer: 1, explanation: "T=1 toggles Q each edge." }],
        },
      ],
    },
  ],
};
