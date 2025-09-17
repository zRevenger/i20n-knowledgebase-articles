export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end("Method not allowed");

  const { files, message } = req.body;

  if (!files || files.length === 0 || !message) {
    return res.status(400).json({ error: "Missing files or message" });
  }

  const repo = "zRevenger/i20n-knowledgebase-articles";
  const branch = "main";
  const headers = {
    Authorization: `token ${process.env.GITHUB_TOKEN}`,
    "Content-Type": "application/json",
  };

  function ensureBase64(content) {
    const base64regex = /^[A-Za-z0-9+/]+={0,2}$/;
    if (base64regex.test(content.trim())) return content.trim();
    return Buffer.from(content, "utf-8").toString("base64");
  }

  try {
    // 1. prendi ultimo commit della branch
    const refRes = await fetch(`https://api.github.com/repos/${repo}/git/ref/heads/${branch}`, { headers });
    const refData = await refRes.json();
    const latestCommitSha = refData.object.sha;

    const commitRes = await fetch(`https://api.github.com/repos/${repo}/git/commits/${latestCommitSha}`, { headers });
    const commitData = await commitRes.json();
    const baseTree = commitData.tree.sha;

    // 2. prepara tree items
    const treeItems = [];

    for (const f of files) {
      if (f.delete) {
        // prendi SHA necessario per eliminare
        const getRes = await fetch(`https://api.github.com/repos/${repo}/contents/${f.path}`, { headers });
        if (!getRes.ok) continue; // file non esiste, skip
        const data = await getRes.json();
        treeItems.push({
          path: f.path,
          mode: "100644",
          type: "blob",
          sha: data.sha,
          // per eliminare si invia solo SHA e PATCH del tree poi in commit
          // il commit con questo tree "cancella" il file
          content: undefined,
        });
      } else {
        // file nuovo o aggiornamento
        let content;
        if (f.encoding === "base64") {
          content = f.content; // immagine già in base64
        } else {
          content = f.content; // JSON/Markdown normale (UTF-8)
        }
        treeItems.push({
          path: f.path,
          mode: "100644",
          type: "blob",
          content,
        });
      }
    }

    // 3. crea un nuovo tree
    const treeRes = await fetch(`https://api.github.com/repos/${repo}/git/trees`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        base_tree: baseTree,
        tree: treeItems,
      }),
    });
    const treeData = await treeRes.json();

    // 4. crea il commit
    const newCommitRes = await fetch(`https://api.github.com/repos/${repo}/git/commits`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        message,
        tree: treeData.sha,
        parents: [latestCommitSha],
      }),
    });
    const newCommitData = await newCommitRes.json();

    // 5. aggiorna il ref della branch
    await fetch(`https://api.github.com/repos/${repo}/git/refs/heads/${branch}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ sha: newCommitData.sha }),
    });

    return res.status(200).json({ success: true, commitSha: newCommitData.sha });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
