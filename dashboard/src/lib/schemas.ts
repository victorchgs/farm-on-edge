import { z } from "zod";

export const ReadingSchema = z.object({
  _id: z.string(),
  insect_count: z.number().optional(),
  processed_at: z.string().datetime(),
  sourceImage: z.string(),
});
export type Reading = z.infer<typeof ReadingSchema>;

export const TrapSchema = z.object({
  _id: z.string(),
  last_insect_count: z.number().optional(),
  last_reading_at: z.string().datetime(),
});
export type Trap = z.infer<typeof TrapSchema>;

export const FarmSchema = z.object({
  id: z.string(),
  name: z.string(),
});
export type Farm = z.infer<typeof FarmSchema>;

export const LoginSchema = z.object({
  email: z.string().min(1, "O nome de usuário ou email é obrigatório"),
  password: z.string().min(1, "A senha é obrigatória"),
});
export type LoginFormData = z.infer<typeof LoginSchema>;
