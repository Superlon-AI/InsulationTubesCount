// 这个才是 api/predict.js 应该有的样子!
export default async function handler(req, res) {
    if (req.method !== "POST") return res.status(405).json({ detail: "Method not allowed" });

    try {
        const response = await fetch("https://api.replicate.com/v1/predictions", {
            method: "POST",
            headers: {
                "Authorization": `Token ${process.env.REPLICATE_API_TOKEN}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                version: "48af369e979f592f88e231ec76af28929de01adf9c1922a11f685f7efb7a5ed5", 
                input: { image: req.body.image },
            }),
        });

        if (response.status !== 201) {
            const error = await response.json();
            return res.status(500).json({ detail: error.detail });
        }

        const prediction = await response.json();
        res.status(201).json(prediction);
    } catch (error) {
        res.status(500).json({ detail: error.message });
    }
}
