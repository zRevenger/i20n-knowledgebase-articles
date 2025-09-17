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

  // 🔑 helper: se è già base64 valido non lo riconvertiamo
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

    // 2. crea un nuovo tree con tutti i file
    const treeItems = [];
    for (const f of files) {
      const apiUrl = `https://api.github.com/repos/${repo}/contents/${f.path}`;

      // Se delete = true, bisogna prendere lo SHA del file esistente
      let sha;
      if (f.delete) {
        const getRes = await fetch(apiUrl, { headers });
        if (getRes.ok) {
          const data = await getRes.json();
          sha = data.sha;
        } else {
          continue; // se non esiste, ignoriamo
        }
      }

      // Blob per commit
      treeItems.push({
        path: f.path,
        mode: "100644",
        type: "blob",
        content: f.delete ? undefined : f.encoding === "base64" ? f.content : ensureBase64(f.content),
        ...(f.delete && { sha }),
        ...(f.delete && { type: "blob" }), // GitHub richiede blob anche per delete
      });
    }

    const treeRes = await fetch(`https://api.github.com/repos/${repo}/git/trees`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        base_tree: baseTree,
        tree: treeItems,
      }),
    });
    const treeData = await treeRes.json();

    // 3. crea il commit
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

    // 4. aggiorna il ref della branch
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
