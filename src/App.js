import React, { useState } from 'react';

function App() {
  const [imageBox, setImageBox] = useState(null); 
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const convertToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const fileReader = new FileReader();
      fileReader.readAsDataURL(file);
      fileReader.onload = () => resolve(fileReader.result);
      fileReader.onerror = (error) => reject(error);
    });
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setImageBox(null);

    try {
      const base64Image = await convertToBase64(file);

      const response = await fetch('/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64Image }),
      });

      let prediction = await response.json();
      if (response.status !== 201) throw new Error(prediction.detail);

      while (
        prediction.status !== 'succeeded' &&
        prediction.status !== 'failed'
      ) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const statusResponse = await fetch(`/api/status?id=${prediction.id}`);
        prediction = await statusResponse.json();
        if (statusResponse.status !== 200) throw new Error(prediction.detail);
      }

      if (prediction.status === 'succeeded') {
        setImageBox(prediction.output[0] || prediction.output); 
      } else {
        throw new Error('Processing failed');
      }

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>Insulation Tube Counter</h1>
      
      <input 
        type="file" 
        accept="image/*" 
        onChange={handleImageUpload} 
        disabled={loading}
      />

      {loading && <p>Sending to AI, please wait...</p>}
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}

      {imageBox && (
        <div style={{ marginTop: '20px' }}>
          <h3>Result:</h3>
          <img 
            src={imageBox} 
            alt="Result Box" 
            style={{ maxWidth: '100%', height: 'auto', border: '2px solid #ccc' }}
          />
        </div>
      )}
    </div>
  );
}

export default App;