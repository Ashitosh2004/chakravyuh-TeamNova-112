import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address").max(255),
  password: z.string().min(1, "Password is required").max(128),
});

export const registerSchema = z
  .object({
    displayName: z.string().trim().min(2, "Name must be at least 2 characters").max(60, "Name must be under 60 characters"),
    email: z.string().trim().min(1, "Email is required").email("Enter a valid email address").max(255),
    password: z
      .string()
      .min(8, "Use at least 8 characters")
      .max(128)
      .regex(/[A-Z]/, "Include an uppercase letter")
      .regex(/[a-z]/, "Include a lowercase letter")
      .regex(/[0-9]/, "Include a number"),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: "Passwords do not match", path: ["confirm"] });

export const forgotSchema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address").max(255),
});

export function passwordStrength(pw: string) {
  const checks = [
    { label: "8+ characters", ok: pw.length >= 8 },
    { label: "Uppercase letter", ok: /[A-Z]/.test(pw) },
    { label: "Lowercase letter", ok: /[a-z]/.test(pw) },
    { label: "Number", ok: /[0-9]/.test(pw) },
    { label: "Symbol", ok: /[^A-Za-z0-9]/.test(pw) },
  ];
  const score = checks.filter((c) => c.ok).length;
  const label = score <= 2 ? "Weak" : score <= 4 ? "Good" : "Strong";
  return { checks, score, label };
}
