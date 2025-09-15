import fetch from "node-fetch";
import yaml from "js-yaml";

const GITHUB_REPO = "zRevenger/i20n-knowledgebase-articles";
const BRANCH = "main";
const TOKEN = process.env.GITHUB_TOKEN;

export default async function handler(req, res) {
  // 🌐 CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  // Preflight request
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end("Method not allowed");

  const { path, frontmatter, content, message } = req.body;
  if (!path || !frontmatter || !content || !message)
    return res.status(400).json({ error: "Missing path, frontmatter, content, or message" });

  try {
    // 1️⃣ Recupera ultimo commit del branch
    const refRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/git/ref/heads/${BRANCH}`, {
      headers: { Authorization: `token ${TOKEN}` },
    });
    const refData = await refRes.json();
    const latestCommitSha = refData.object.sha;

    const commitRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/git/commits/${latestCommitSha}`, {
      headers: { Authorization: `token ${TOKEN}` },
    });
    const commitData = await commitRes.json();
    const baseTreeSha = commitData.tree.sha;

    // 2️⃣ Prepara contenuti da salvare
    const mdContent = `---\n${yaml.dump(frontmatter)}---\n\n${content}`;

    // Recupera knowledge.json da GitHub
    const knowledgeRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/data/knowledge.json`, {
      headers: { Authorization: `token ${TOKEN}` },
    });
    const knowledgeData = await knowledgeRes.json();
    const knowledge = JSON.parse(Buffer.from(knowledgeData.content, "base64").toString());

    const index = knowledge.findIndex((a) => String(a.id) === String(frontmatter.id));
    if (index >= 0) knowledge[index] = { ...knowledge[index], ...frontmatter };
    else knowledge.push(frontmatter);

    const knowledgeContent = JSON.stringify(knowledge, null, 2);

    // 3️⃣ Crea un nuovo tree con entrambi i file
    const treeRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/git/trees`, {
      method: "POST",
      headers: { Authorization: `token ${TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        base_tree: baseTreeSha,
        tree: [
          { path, mode: "100644", type: "blob", content: mdContent },
          { path: "data/knowledge.json", mode: "100644", type: "blob", content: knowledgeContent },
        ],
      }),
    });
    const treeData = await treeRes.json();

    // 4️⃣ Crea nuovo commit
    const newCommitRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/git/commits`, {
      method: "POST",
      headers: { Authorization: `token ${TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        tree: treeData.sha,
        parents: [latestCommitSha],
      }),
    });
    const newCommitData = await newCommitRes.json();

    // 5️⃣ Aggiorna branch per puntare al nuovo commit
    await fetch(`https://api.github.com/repos/${GITHUB_REPO}/git/refs/heads/${BRANCH}`, {
      method: "PATCH",
      headers: { Authorization: `token ${TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ sha: newCommitData.sha }),
    });

    res.status(200).json({ success: true, commitSha: newCommitData.sha });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
