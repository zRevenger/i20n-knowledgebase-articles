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

  try {
    // 1. prendi ultimo commit della branch
    const refRes = await fetch(`https://api.github.com/repos/${repo}/git/ref/heads/${branch}`, { headers });
    const refData = await refRes.json();
    const latestCommitSha = refData.object.sha;

    const commitRes = await fetch(`https://api.github.com/repos/${repo}/git/commits/${latestCommitSha}`, { headers });
    const commitData = await commitRes.json();
    const baseTree = commitData.tree.sha;

    // 2. elimina file marcati delete direttamente
    for (const f of files) {
      if (f.delete) {
        const getRes = await fetch(`https://api.github.com/repos/${repo}/contents/${f.path}`, { headers });
        if (!getRes.ok) continue; // file non esiste, skip
        const data = await getRes.json();

        const deleteRes = await fetch(`https://api.github.com/repos/${repo}/contents/${f.path}`, {
          method: "DELETE",
          headers,
          body: JSON.stringify({
            message,
            sha: data.sha,
            branch,
          }),
        });
        const deleteData = await deleteRes.json();
        if (!deleteRes.ok) throw new Error(JSON.stringify(deleteData));
      }
    }

    // 3. aggiorna file normali nello stesso commit come prima
    const treeItems = files
      .filter(f => !f.delete)
      .map(f => ({
        path: f.path,
        mode: "100644",
        type: "blob",
        content: f.encoding === "base64" ? f.content : Buffer.from(f.content || "", "utf-8").toString("base64"),
      }));

    const treeRes = await fetch(`https://api.github.com/repos/${repo}/git/trees`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        base_tree: baseTree,
        tree: treeItems,
      }),
    });
    const treeData = await treeRes.json();

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
