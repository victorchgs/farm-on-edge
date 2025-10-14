import type { VercelRequest, VercelResponse } from "@vercel/node";
import "dotenv/config";
import jwt from "jsonwebtoken";
import { validateCredentials } from "../server/logic/auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const { email, password } = req.body;

  const isValid = await validateCredentials(email, password);

  if (!isValid) {
    return res.status(401).json({ message: "Credenciais inválidas" });
  }

  const token = jwt.sign({ user: email }, process.env.JWT_SECRET!, {
    expiresIn: "8h",
  });

  res.status(200).json({ token });
}
