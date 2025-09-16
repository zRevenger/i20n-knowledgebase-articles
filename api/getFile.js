export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  
  const { path } = req.query;

  const response = await fetch(
    `https://api.github.com/repos/zRevenger/i20n-knowledgebase-articles/contents/${path}`,
    {
      headers: { Authorization: `token ${process.env.GITHUB_TOKEN}` },
    }
  );

  if (!response.ok) {
    return res.status(response.status).json({ error: await response.text() });
  }

  const data = await response.json();
  res.status(200).json({ content: data.content, sha: data.sha });
}
