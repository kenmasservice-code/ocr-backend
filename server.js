import express from "express";
import OpenAI from "openai";
import cors from "cors";

import dotenv from "dotenv";
dotenv.config();

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

const openai = new OpenAI({
  apiKey: "process.env.OPENAI_API_KEY",
});

// 🧪 TEST
app.get("/test", (req, res) => {
  return res.send("OK");
});

// 🔥 OCR PRINCIPAL
app.post("/ocr", async (req, res) => {
  console.log("\n📩 OCR REQUEST");

  try {
    const { imageBase64 } = req.body;

    if (!imageBase64) {
      console.log("❌ Sin imagen");
      return res.status(400).json([]);
    }

    // =============================
    // 🧠 OCR
    // =============================
    const ocr = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: "Extrae el texto EXACTO de la imagen respetando formato de tabla con |"
            },
            {
              type: "input_image",
              image_url: imageBase64
            }
          ]
        }
      ]
    });

    const texto = ocr.output_text || "";

    console.log("🧠 TEXTO OCR:");
    console.log(texto);

    if (!texto) {
      return res.status(200).json([]);
    }

    // =============================
    // 📄 LIMPIEZA
    // =============================
    const lineas = texto
      .split("\n")
      .map(l => l.trim())
      .filter(l => l.length > 0);

    console.log("📄 LINEAS:", lineas.length);

    // =============================
    // 🔥 PARSEO TABLA "|"
    // =============================
    console.log("📊 Parseo tabla");

    const resultado = [];

    for (let linea of lineas) {

      if (!linea.includes("|")) continue;
      if (linea.toLowerCase().includes("clave")) continue;
      if (linea.includes("---")) continue;

      try {
        let limpia = linea;

        if (limpia.startsWith("|")) limpia = limpia.slice(1);
        if (limpia.endsWith("|")) limpia = limpia.slice(0, -1);

        const partes = limpia.split("|").map(p => p.trim());

        if (partes.length < 6) continue;

        const clave = partes[0];
        const codigo = partes[1];
        const descripcion = partes[2];
        const empaques = parseFloat(partes[3]) || 0;
        const cajas = parseFloat(partes[4]) || 0;
        const piezas = parseFloat(partes[5]) || 0;

        // validación real
        if (!/^\d{4,6}$/.test(clave)) continue;
        if (!/^\d{10,14}$/.test(codigo)) continue;

        resultado.push({
          clave,
          codigo,
          descripcion,
          empaques,
          cajas,
          piezas
        });

      } catch (e) {
        console.log("⚠️ Error línea:", linea);
      }
    }

    // =============================
    // 🔁 FALLBACK (por espacios)
    // =============================
    if (resultado.length === 0) {

      console.log("🔁 Fallback activado");

      const regex = /^(\d{4,6})\s+(\d{10,14})\s+(.+?)\s+(\d+)\s+([\d.]+)\s+(\d+)$/;

      for (let linea of lineas) {
        const match = linea.match(regex);

        if (match) {
          resultado.push({
            clave: match[1],
            codigo: match[2],
            descripcion: match[3],
            empaques: parseFloat(match[4]),
            cajas: parseFloat(match[5]),
            piezas: parseFloat(match[6])
          });
        }
      }
    }

    console.log("✅ FILAS DETECTADAS:", resultado.length);

    // ✅ RESPUESTA FINAL (UNA SOLA VEZ)
    return res.status(200).json(resultado);

  } catch (err) {
    console.error("❌ ERROR:", err.message);

    return res.status(500).json([]);
  }
});

// 🚀 START SERVER
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🚀 SERVER OK en puerto " + PORT);
});