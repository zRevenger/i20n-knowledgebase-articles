// /pages/api/updateKnowledge.js
import fs from "fs";
import path from "path";

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    try {
        const dataDir = path.join(process.cwd(), "data");
        const knowledgePath = path.join(dataDir, "knowledge.json");

        // leggi il contenuto corrente
        let knowledgeData = [];
        if (fs.existsSync(knowledgePath)) {
            const raw = fs.readFileSync(knowledgePath, "utf-8");
            knowledgeData = JSON.parse(raw);
        }

        const newArticle = req.body;

        if (!newArticle.id) {
            return res.status(400).json({ error: "Missing article id" });
        }

        // cerca se esiste già un articolo con lo stesso id
        const index = knowledgeData.findIndex((a) => String(a.id) === String(newArticle.id));

        if (index > -1) {
            // aggiorna l'articolo esistente
            knowledgeData[index] = { ...knowledgeData[index], ...newArticle };
        } else {
            // aggiungi un nuovo articolo
            knowledgeData.push(newArticle);
        }

        // scrivi di nuovo il file
        fs.writeFileSync(knowledgePath, JSON.stringify(knowledgeData, null, 2), "utf-8");

        res.status(200).json({ success: true, data: newArticle });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Errore durante aggiornamento knowledge", details: err.message });
    }
}
