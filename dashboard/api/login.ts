import type { VercelRequest, VercelResponse } from "@vercel/node";
import "dotenv/config";
import jwt from "jsonwebtoken";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: "Email e senha são obrigatórios." });
  }

  let isValid = false;

  if (process.env.VITE_APP_ENV === "local") {
    isValid =
      email === process.env.LOCAL_USER &&
      password === process.env.LOCAL_PASSWORD;
  } else {
    isValid =
      email === process.env.ADMIN_EMAIL &&
      password === process.env.ADMIN_PASSWORD;
  }

  if (!isValid) {
    return res.status(401).json({ message: "Credenciais inválidas" });
  }

  const token = jwt.sign({ user: email }, process.env.JWT_SECRET!, {
    expiresIn: "8h",
  });

  res.status(200).json({ token });
}
