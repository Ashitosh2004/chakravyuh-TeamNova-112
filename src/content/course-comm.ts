import type { Course } from "./types";

export const communicationSystems: Course = {
  id: "communication-systems",
  title: "Communication Systems",
  short: "Block diagrams, modulation, sampling, quantization and noise.",
  overview:
    "Communication systems move information from a source to a destination through an imperfect channel. You will study the transmitter–channel–receiver model, analog modulation (AM and FM), the digitization of signals and the effect of noise.",
  difficulty: "Intermediate",
  hours: 10,
  objectives: [
    "Describe each block of a communication system.",
    "Compute AM modulation index, bandwidth and efficiency.",
    "Apply Carson's rule to estimate FM bandwidth.",
    "Choose a sampling rate that satisfies the Nyquist criterion.",
    "Relate quantization bits to signal-to-quantization-noise ratio.",
  ],
  prerequisites: ["Signals and Systems — basic waveforms"],
  activities: [
    { label: "Communication Systems Lab", href: "/lab/communication" },
    { label: "Signal Processing Lab", href: "/lab/signals" },
    { label: "Communication Network scenario", href: "/scenarios/communication-network" },
  ],
  quizIds: ["communication-fundamentals"],
  modules: [
    {
      id: "foundations",
      title: "Foundations",
      lessons: [
        {
          id: "block-diagram",
          title: "Communication-System Block Diagram",
          minutes: 12,
          summary: "Source, transmitter, channel, receiver and destination.",
          diagram: { kind: "blocks", blocks: ["Source", "Transmitter", "Channel + noise", "Receiver", "Destination"], caption: "Basic communication system" },
          sections: [
            {
              heading: "The five blocks",
              body: [
                "The source produces a message (voice, data). The transmitter converts it into a form suited to the channel — encoding, modulation, amplification. The channel (cable, fibre, free space) carries the signal and adds noise, attenuation and distortion.",
                "The receiver reverses the transmitter's operations: filtering, amplification, demodulation and decoding. The destination consumes the recovered message.",
              ],
            },
          ],
          terms: [["Channel", "The physical medium between transmitter and receiver."], ["Attenuation", "Loss of signal power along the channel."]],
          takeaways: ["Every link has the same five conceptual blocks.", "Noise enters mainly in the channel and receiver front end."],
          check: [{ q: "Which block performs modulation?", options: ["Source", "Transmitter", "Channel", "Destination"], answer: 1, explanation: "The transmitter adapts the message to the channel." }],
        },
        {
          id: "analog-digital-signals",
          title: "Analog and Digital Signals",
          minutes: 10,
          summary: "Continuous vs discrete in time and amplitude.",
          diagram: { kind: "wave", shape: "sine", caption: "A continuous-time analog sinusoid" },
          sections: [
            {
              heading: "Definitions",
              body: [
                "An analog signal is continuous in both time and amplitude — such as the voltage from a microphone. A digital signal takes a finite set of values at discrete instants.",
                "Digital transmission tolerates noise better because the receiver only needs to decide between a few levels, and regenerative repeaters can remove accumulated noise.",
              ],
            },
          ],
          terms: [["Discrete-time", "Defined only at sample instants."], ["Regeneration", "Re-creating clean digital symbols at a repeater."]],
          takeaways: ["Analog = continuous; digital = discrete levels.", "Digital links can regenerate signals."],
          check: [{ q: "A thermometer's raw voltage output is typically…", options: ["Analog", "Digital"], answer: 0, explanation: "It varies continuously with temperature." }],
          simulations: ["signals"],
        },
      ],
    },
    {
      id: "modulation",
      title: "Analog Modulation",
      lessons: [
        {
          id: "amplitude-modulation",
          title: "Amplitude Modulation",
          minutes: 18,
          summary: "Varying the carrier amplitude with the message.",
          diagram: { kind: "am", caption: "AM wave with its envelope following the message" },
          sections: [
            {
              heading: "The AM equation",
              body: [
                "In standard AM the carrier amplitude follows the message: s(t) = Ac[1 + m·cos(2πfm t)]·cos(2πfc t). The modulation index m = Am/Ac sets how deeply the envelope swings.",
                "For m ≤ 1 the envelope never crosses zero and a simple envelope detector (diode + RC) recovers the message. For m > 1 the wave is over-modulated and the envelope is distorted.",
              ],
            },
            {
              heading: "Spectrum and power",
              body: [
                "Tone-modulated AM contains the carrier at fc and two sidebands at fc ± fm, so the bandwidth is 2fm. Most power remains in the carrier: efficiency η = m²/(2 + m²), at most 33.3% when m = 1.",
              ],
            },
          ],
          terms: [["Carrier", "High-frequency sinusoid that carries the message."], ["Sideband", "Spectral components at fc ± fm."], ["Envelope", "The curve traced by the wave's peaks."]],
          equations: [
            { label: "AM signal", expr: "s(t) = Ac[1 + m cos(2πfₘt)] cos(2πf꜀t)" },
            { label: "Modulation index", expr: "m = (Vmax − Vmin)/(Vmax + Vmin)" },
            { label: "Efficiency", expr: "η = m² / (2 + m²)" },
          ],
          example: {
            problem: "A 1 MHz carrier is modulated by a 5 kHz tone with m = 0.5. Find bandwidth and efficiency.",
            solution: ["B = 2fm = 10 kHz.", "η = 0.25/(2.25) ≈ 11.1%."],
          },
          takeaways: ["Keep m ≤ 1 to avoid distortion.", "AM bandwidth = 2 × message bandwidth.", "AM is simple but power-inefficient."],
          check: [
            { q: "Maximum efficiency of tone-modulated AM is", options: ["25%", "33.3%", "50%", "100%"], answer: 1, explanation: "η = 1/3 at m = 1." },
            { q: "If m = 1.3, the signal is", options: ["Under-modulated", "Over-modulated", "Unmodulated"], answer: 1, explanation: "m > 1 is over-modulation." },
          ],
          simulations: ["communication"],
        },
        {
          id: "frequency-modulation",
          title: "Frequency Modulation",
          minutes: 18,
          summary: "Varying the carrier frequency with the message.",
          sections: [
            {
              heading: "Instantaneous frequency",
              body: [
                "In FM the carrier's instantaneous frequency is fi(t) = fc + kf·m(t). For a tone message, s(t) = Ac cos(2πfc t + β sin 2πfm t), where β = Δf/fm is the modulation index and Δf the peak deviation.",
                "The amplitude stays constant, so FM is robust to amplitude noise and allows efficient non-linear power amplifiers.",
              ],
            },
            {
              heading: "Bandwidth",
              body: ["Carson's rule estimates the bandwidth containing ~98% of the power: B ≈ 2(Δf + fm). Commercial FM radio uses Δf = 75 kHz and fm up to 15 kHz, giving about 180 kHz (channels are 200 kHz apart)."],
            },
          ],
          terms: [["Frequency deviation Δf", "Maximum shift from the carrier frequency."], ["β", "FM modulation index Δf/fm."]],
          equations: [{ label: "Carson's rule", expr: "B ≈ 2(Δf + fₘ) = 2fₘ(β + 1)" }],
          example: { problem: "Δf = 50 kHz, fm = 10 kHz. Estimate bandwidth.", solution: ["β = 5.", "B ≈ 2(50 + 10) = 120 kHz."] },
          takeaways: ["FM trades bandwidth for noise immunity.", "Amplitude is constant in FM.", "Use Carson's rule for bandwidth."],
          check: [{ q: "With β = 2 and fm = 3 kHz, Carson bandwidth is", options: ["6 kHz", "12 kHz", "18 kHz", "9 kHz"], answer: 2, explanation: "2·3·(2+1) = 18 kHz." }],
          simulations: ["communication"],
        },
      ],
    },
    {
      id: "digitization",
      title: "Digitization and Noise",
      lessons: [
        {
          id: "sampling",
          title: "Sampling",
          minutes: 15,
          summary: "The Nyquist criterion and aliasing.",
          diagram: { kind: "sampling", caption: "Continuous signal with sampled points" },
          sections: [
            {
              heading: "Nyquist–Shannon theorem",
              body: [
                "A band-limited signal with highest frequency fmax can be perfectly reconstructed from samples taken at fs > 2fmax. The minimum rate 2fmax is the Nyquist rate.",
                "If fs is too low, high frequencies 'fold' and appear as lower frequencies — aliasing. A sinusoid of frequency f sampled at fs appears at |f − k·fs| for the nearest integer k.",
                "Anti-aliasing low-pass filters before the ADC remove components above fs/2.",
              ],
            },
          ],
          terms: [["Nyquist rate", "2 × highest signal frequency."], ["Aliasing", "Undersampled frequencies masquerading as lower ones."]],
          equations: [{ label: "Nyquist criterion", expr: "fₛ > 2fₘₐₓ" }, { label: "Alias", expr: "fₐ = |f − k·fₛ|" }],
          example: { problem: "A 7 kHz tone is sampled at 10 kHz. What frequency is observed?", solution: ["k = round(7/10) = 1.", "fa = |7 − 10| = 3 kHz — aliased."] },
          takeaways: ["Sample faster than twice the highest frequency.", "Aliasing cannot be removed after sampling.", "Filter before you sample."],
          check: [{ q: "Audio up to 20 kHz needs fs of at least", options: ["20 kHz", "40 kHz", "10 kHz", "80 kHz"], answer: 1, explanation: "2 × 20 kHz = 40 kHz (CD uses 44.1 kHz)." }],
          simulations: ["signals"],
        },
        {
          id: "quantization",
          title: "Quantization",
          minutes: 12,
          summary: "Mapping continuous amplitudes to discrete levels.",
          sections: [
            {
              heading: "Levels and step size",
              body: [
                "An n-bit quantizer has L = 2ⁿ levels. Over a range of 2V the step size is Δ = 2V/(L − 1). Rounding introduces an error of at most ±Δ/2 — quantization noise.",
                "For a full-scale sinusoid the signal-to-quantization-noise ratio is approximately SQNR ≈ 6.02n + 1.76 dB: every extra bit buys about 6 dB.",
              ],
            },
          ],
          terms: [["Resolution", "Smallest distinguishable step Δ."], ["SQNR", "Signal-to-quantization-noise ratio."]],
          equations: [{ label: "SQNR", expr: "SQNR ≈ 6.02n + 1.76 dB" }],
          example: { problem: "SQNR of a 10-bit ADC for a full-scale sine?", solution: ["6.02 × 10 + 1.76 = 61.96 dB."] },
          takeaways: ["More bits → smaller steps → less noise.", "≈6 dB per bit."],
          check: [{ q: "An 8-bit quantizer has how many levels?", options: ["8", "128", "255", "256"], answer: 3, explanation: "2⁸ = 256." }],
          simulations: ["signals"],
        },
        {
          id: "noise-snr",
          title: "Noise and Signal-to-Noise Ratio",
          minutes: 14,
          summary: "Thermal noise, SNR in decibels and channel capacity.",
          sections: [
            {
              heading: "Sources of noise",
              body: [
                "Thermal (Johnson) noise arises from random electron motion; its power is N = kTB, so it grows with temperature and bandwidth. Other sources include shot noise, interference and quantization noise.",
                "SNR compares signal power to noise power: SNR(dB) = 10 log₁₀(S/N). An SNR of 20 dB means the signal is 100 times stronger than the noise.",
              ],
            },
            {
              heading: "Shannon capacity",
              body: ["The maximum error-free data rate of a channel is C = B log₂(1 + S/N). Doubling bandwidth doubles capacity; doubling SNR adds only about one bit/s/Hz."],
            },
          ],
          terms: [["kTB", "Thermal noise power: Boltzmann constant × temperature × bandwidth."], ["dB", "Logarithmic ratio, 10 log₁₀ of a power ratio."]],
          equations: [{ label: "SNR (dB)", expr: "SNR = 10 log₁₀(S/N)" }, { label: "Shannon capacity", expr: "C = B log₂(1 + S/N)" }],
          example: { problem: "B = 3 kHz, SNR = 30 dB. Find C.", solution: ["S/N = 1000.", "C = 3000 × log₂(1001) ≈ 3000 × 9.97 ≈ 29.9 kbit/s."] },
          takeaways: ["Noise grows with bandwidth.", "Use dB for power ratios.", "Capacity grows linearly with B, logarithmically with SNR."],
          check: [{ q: "S/N = 100 corresponds to", options: ["10 dB", "20 dB", "100 dB", "2 dB"], answer: 1, explanation: "10 log₁₀(100) = 20 dB." }],
          simulations: ["communication"],
        },
      ],
    },
  ],
};
