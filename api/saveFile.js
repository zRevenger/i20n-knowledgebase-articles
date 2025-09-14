export default async function handler(req, res) {
    if (req.method !== "POST") return res.status(405).end("Method not allowed");

  const { path, content, message } = req.body;
  if (!path || !content || !message)
    return res.status(400).json({ error: "Missing path, content, or message" });

  const apiUrl = `https://api.github.com/repos/zRevenger/i20n-knowledgebase-articles/contents/${path}`;
  const headers = {
    Authorization: `token ${process.env.GITHUB_TOKEN}`,
    "Content-Type": "application/json",
  };

  try {
    // Controlla se il file esiste per ottenere lo SHA
    let sha;
    const getRes = await fetch(apiUrl, { headers });
    if (getRes.ok) {
      const data = await getRes.json();
      sha = data.sha;
    } else if (getRes.status !== 404) {
      const errorText = await getRes.text();
      return res.status(getRes.status).json({ error: errorText });
    }

    // Prepara il payload per PUT
    const payload = {
      message,
      content: Buffer.from(content, "utf-8").toString("base64"),
      branch: "main",
      ...(sha && { sha }),
    };

    // Salva/aggiorna il file
    const putRes = await fetch(apiUrl, {
      method: "PUT",
      headers,
      body: JSON.stringify(payload),
    });

    const data = await putRes.json();
    if (!putRes.ok) return res.status(putRes.status).json({ error: data });

    res.status(200).json({ success: true, data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
