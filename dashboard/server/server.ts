import cors from "cors";
import "dotenv/config";
import express from "express";
import jwt from "jsonwebtoken";

import { validateCredentials } from "./logic/auth";
import { fetchFarmsFromAtlas, fetchFarmsFromFiware } from "./logic/farms";
import { getMinioDirectUrl, getS3SignedUrl } from "./logic/images";
import {
  fetchReadingsFromAtlas,
  fetchReadingsFromFiware,
} from "./logic/reading";
import { fetchTrapsFromAtlas, fetchTrapsFromFiware } from "./logic/traps";

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const isLocal = process.env.VITE_APP_ENV === "local";

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  const isValid = await validateCredentials(email, password);
  if (!isValid) {
    return res.status(401).json({ message: "Credenciais inválidas" });
  }
  const token = jwt.sign({ user: email }, process.env.JWT_SECRET!, {
    expiresIn: "8h",
  });
  res.status(200).json({ token });
});

app.get("/api/farms", async (req, res) => {
  try {
    const farms = isLocal
      ? await fetchFarmsFromFiware()
      : await fetchFarmsFromAtlas();
    res.status(200).json(farms);
  } catch (error) {
    res.status(500).json({ message: "Erro ao buscar fazendas" });
  }
});

app.get("/api/traps/:farmId", async (req, res) => {
  try {
    const { farmId } = req.params;
    const traps = isLocal
      ? await fetchTrapsFromFiware(farmId)
      : await fetchTrapsFromAtlas(farmId);
    res.status(200).json(traps);
  } catch (error) {
    res.status(500).json({ message: "Erro ao buscar armadilhas" });
  }
});

app.get("/api/readings/:trapId", async (req, res) => {
  try {
    const { trapId } = req.params;
    const readings = isLocal
      ? await fetchReadingsFromFiware(trapId)
      : await fetchReadingsFromAtlas(trapId);
    res.status(200).json(readings);
  } catch (error) {
    res.status(500).json({ message: "Erro ao buscar leituras" });
  }
});

app.get("/api/images", async (req, res) => {
  try {
    const { key } = req.query as { key: string };
    const imageUrl = isLocal
      ? getMinioDirectUrl(key)
      : await getS3SignedUrl(key);
    res.status(200).json({ url: imageUrl });
  } catch (error) {
    res.status(500).json({ message: "Erro ao buscar imagem" });
  }
});

app.listen(port, () => {
  console.log(`Servidor da API do Dashboard rodando na porta ${port}`);
});
