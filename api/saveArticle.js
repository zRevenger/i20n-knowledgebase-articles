export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  
  if (req.method !== "POST") return res.status(405).end();
  const { path, frontmatter, content, message } = req.body;

  try {
    // 1. Salvo l’articolo .md
    const mdFile = `---\n${Object.entries(frontmatter)
      .map(([k, v]) =>
        Array.isArray(v) ? `${k}:\n${v.map((t) => `  - ${t}`).join("\n")}` : `${k}: "${v}"`
      )
      .join("\n")}\n---\n\n${content}`;

    await saveFileOnGithub(path, mdFile, message);

    // 2. Aggiorno knowledge.json
    const knowledgePath = "data/knowledge.json";
    const { json, sha } = await getFileFromGithub(knowledgePath);
    let knowledge = JSON.parse(Buffer.from(json.content, "base64").toString());

    const index = knowledge.findIndex((a) => String(a.id) === String(frontmatter.id));
    if (index >= 0) {
      knowledge[index] = { ...knowledge[index], ...frontmatter };
    } else {
      knowledge.push(frontmatter);
    }

    await saveFileOnGithub(
      knowledgePath,
      JSON.stringify(knowledge, null, 2),
      message,
      sha
    );

    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function saveFileOnGithub(path, content, message, sha) {
  const response = await fetch(
    `https://api.github.com/repos/zRevenger/i20n-knowledgebase-articles/contents/${path}`,
    {
      method: "PUT",
      headers: {
        Authorization: `token ${process.env.GITHUB_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message,
        content: Buffer.from(content).toString("base64"),
        branch: "main",
        sha, // opzionale, solo se update
      }),
    }
  );
  if (!response.ok) throw new Error("GitHub error: " + (await response.text()));
  return response.json();
}

async function getFileFromGithub(path) {
  const response = await fetch(
    `https://api.github.com/repos/zRevenger/i20n-knowledgebase-articles/contents/${path}`,
    {
      headers: { Authorization: `token ${process.env.GITHUB_TOKEN}` },
    }
  );
  if (!response.ok) throw new Error("GitHub error: " + (await response.text()));
  return response.json();
}
