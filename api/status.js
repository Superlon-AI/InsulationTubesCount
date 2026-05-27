export default async function handler(req, res) {
  const predictionId = req.query.id; 

  try {
    const response = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
      headers: {
        "Authorization": `Token ${process.env.REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    if (response.status !== 200) {
      const error = await response.json();
      return res.status(500).json({ detail: error.detail });
    }

    const prediction = await response.json();
    res.status(200).json(prediction);
  } catch (error) {
    res.status(500).json({ detail: error.message });
  }
}