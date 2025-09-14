export default async function handler(req, res) {
    if (req.method !== "POST") return res.status(405).end();

    const { path, content, message } = req.body;

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
            }),
        }
    );

    const data = await response.json();

    if (!response.ok) return res.status(500).json({ error: data });
    res.status(200).json({ success: true, data });
}
