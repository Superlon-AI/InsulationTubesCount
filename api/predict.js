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
        version: "YOUR_MODEL_VERSION_ID_HERE", 
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