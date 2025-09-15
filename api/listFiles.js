export default async function handler(req, res) {
  
    res.setHeader("Access-Control-Allow-Origin", "*");

  const { type } = req.query;

  // In base al tipo cambio la cartella
  const folder = type === "images" ? "images" : "articles";

  const response = await fetch(
    `https://api.github.com/repos/zRevenger/i20n-knowledgebase-articles/contents/${folder}`,
    {
      headers: {
        Authorization: `token ${process.env.GITHUB_TOKEN}`,
      },
    }
  );

  const data = await response.json();

  if (!response.ok) {
    return res.status(500).json({ error: data });
  }

  // Estraggo solo nome e path
  const files = data.map((f) => ({
    name: f.name,
    path: f.path,
  }));

  res.status(200).json(files);
}
