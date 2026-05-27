import React, { useState, useRef, useEffect } from 'react';

function App() {
  const [imageSrc, setImageSrc] = useState(null); // 压缩后的图片 Base64
  const [markers, setMarkers] = useState([]);     // 管子坐标数组
  const [history, setHistory] = useState([]);     // 记录历史，用于撤销
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [markerSize, setMarkerSize] = useState(13); // 新增：圈圈半径大小状态 (默认13，直径26px，比以前更大)
  
  const canvasRef = useRef(null);

  // 1. 核心功能：前端压缩图片 (限制宽度 640px)
  const compressImage = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          let width = img.width;
          let height = img.height;
          const maxWidth = 640;

          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          resolve(canvas.toDataURL('image/jpeg', 0.8)); // 转换为画质 80% 的 JPEG
        };
        img.onerror = reject;
      };
      reader.onerror = reject;
    });
  };

  // 2. 上传图片并调用后端
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setMarkers([]);
    setHistory([]);

    try {
      const compressedBase64 = await compressImage(file);
      setImageSrc(compressedBase64); // 将压缩后的图存入状态，准备画在 Canvas 上

      const response = await fetch('/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: compressedBase64 }),
      });

      let prediction = await response.json();
      if (response.status !== 201) throw new Error(prediction.detail);

      while (prediction.status !== 'succeeded' && prediction.status !== 'failed') {
        await new Promise((resolve) => setTimeout(resolve, 500));
        const statusResponse = await fetch(`/api/status?id=${prediction.id}`);
        prediction = await statusResponse.json();
        if (statusResponse.status !== 200) throw new Error(prediction.detail);
      }

      if (prediction.status === 'succeeded') {
        // 后端现在返回的是坐标数组 [{x: 10, y: 20}, ...]
        setMarkers(prediction.output || []);
      } else {
        throw new Error('AI 处理失败');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 3. Canvas 绘画逻辑 (图片 + 圆点)
  useEffect(() => {
    if (!imageSrc || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.src = imageSrc;

    img.onload = () => {
      // 保持 Canvas 大小和压缩后的图片一致
      canvas.width = img.width;
      canvas.height = img.height;
      
      // 画底图
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // 定义每 20 个号码的颜色 (绿, 橙, 蓝, 蓝紫, 红)
      const colors = ["#22c55e", "#f97316", "#3b82f6", "#8b5cf6", "#ef4444"];

      // 画坐标点
      markers.forEach((marker, index) => {
        const color = colors[Math.floor(index / 20) % colors.length];
        
        ctx.beginPath();
        ctx.arc(marker.x, marker.y, markerSize, 0, 2 * Math.PI); // 动态使用绑定的半径大小
        ctx.fillStyle = color;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = "white";
        ctx.stroke();

        // 画数字 (字号随着圈圈大小动态缩放，确保完美居中)
        ctx.fillStyle = "white";
        ctx.font = `bold ${Math.round(markerSize * 0.9)}px Arial`; 
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(index + 1, marker.x, marker.y);
      });
    };
  }, [imageSrc, markers, markerSize]); // 新增：将 markerSize 放入监听数组，拉动时实时重绘Canvas

  // 4. 点击图片增删逻辑
  const handleCanvasClick = (e) => {
    if (!canvasRef.current) return;
    
    // 记录历史用于撤销
    setHistory([...history, [...markers]]);

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // 计算真实的点击坐标 (处理 CSS 缩放的情况)
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

    const hitRadius = Math.max(15, markerSize); // 点击判定的容错半径随着圈圈变大而自动变大
    let hitIndex = -1;

    // 检查是否点中了已有的管子
    for (let i = 0; i < markers.length; i++) {
      const dx = markers[i].x - clickX;
      const dy = markers[i].y - clickY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < hitRadius) {
        hitIndex = i;
        break;
      }
    }

    if (hitIndex !== -1) {
      // 如果点中了，就删除它
      const newMarkers = [...markers];
      newMarkers.splice(hitIndex, 1);
      setMarkers(newMarkers);
    } else {
      // If not hit, add a new one
      setMarkers([...markers, { x: clickX, y: clickY }]);
    }
  };

  // 撤销功能
  const handleUndo = () => {
    if (history.length > 0) {
      const previousState = history[history.length - 1];
      setMarkers(previousState);
      setHistory(history.slice(0, -1));
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px', fontFamily: 'sans-serif' }}>
      {/* 完全复刻的 UI 样式 */}
      <style>{`
        .superlon-header { font-family: 'Arial Black', sans-serif; font-style: italic; color: #0056b8; font-size: 3.5rem; text-align: center; margin-bottom: 0; line-height: 1;}
        .superlon-reg { font-size: 1.5rem; vertical-align: top; margin-left: 8px; } /* 优化：拉开 ® 与 N 的间隙 */
        .header-divider { height: 1px; background-color: #e2e8f0; width: 60%; margin: 10px auto; }
        .subtitle { color: #0056b8; font-weight: bold; text-transform: uppercase; text-align: center; letter-spacing: 1px; }
        .metric-container { background-color: #ffffff; border: 1px solid #f1f5f9; border-radius: 16px; padding: 20px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); margin: 20px 0; text-align: center;}
        .metric-label { color: #64748b; font-size: 0.875rem; font-weight: 500; text-transform: uppercase; }
        .metric-value { color: #0056b8; font-size: 4rem; font-weight: 900; line-height: 1; }
        .action-btn { padding: 10px 20px; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; width: 100%; font-size: 1rem;}
        .btn-outline { background: white; border: 2px solid #e2e8f0; color: #64748b; }
        .btn-primary { background: #ef4444; color: white; }
        .btn-upload { background: #0056b8; color: white; margin-bottom: 20px; display: block; text-align: center;}
      `}</style>

      {/* 头部 */}
      <div>
        <h1 className="superlon-header">SUPERLON<span className="superlon-reg">®</span></h1>
        <div className="header-divider"></div>
        <div className="subtitle">Insulation Tubes Count</div>
      </div>

      {/* 上传区域 */}
      <div style={{ marginTop: '30px' }}>
        <input 
          type="file" 
          accept="image/*" 
          onChange={handleImageUpload} 
          disabled={loading}
          style={{ display: 'block', margin: '0 auto' }}
        />
        {/* 优化：修改为英文 Loading 提示 */}
        {loading && <p style={{ textAlign: 'center', color: '#0056b8', fontWeight: 'bold' }}>⚡ Analyzing image, please wait...</p>}
        {error && <p style={{ textAlign: 'center', color: 'red' }}>错误: {error}</p>}
      </div>

      {/* 计数面板 */}
      {imageSrc && !loading && (
        <>
          <div className="metric-container">
            <div className="metric-label">Total Tubes</div>
            <div className="metric-value">{markers.length}</div>
          </div>

          <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
            <button className="action-btn btn-outline" onClick={handleUndo} disabled={history.length === 0}>
              ↩ Undo Last (撤销)
            </button>
            <button className="action-btn btn-primary" onClick={() => { setHistory([...history, [...markers]]); setMarkers([]); }}>
              🗑️ Clear All (清空)
            </button>
          </div>

          <p style={{ textAlign: 'center', color: '#64748b', fontSize: '0.875rem', marginBottom: '10px' }}>
            👆 Tap image to add missing tubes or remove incorrect ones.
          </p>

          {/* 优化：新增圈圈大小动态调节拉条（Slider） */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '20px' }}>
            <span style={{ fontSize: '0.875rem', color: '#64748b', fontWeight: 'bold' }}>Dot Size:</span>
            <input 
              type="range" 
              min="8"    // 允许缩到的最小半径
              max="25"   // 允许放到的最大半径
              value={markerSize} 
              onChange={(e) => setMarkerSize(Number(e.target.value))}
              style={{ cursor: 'pointer', width: '150px' }}
            />
            <span style={{ fontSize: '0.875rem', color: '#64748b' }}>{markerSize * 2}px</span>
          </div>

          {/* 交互式画板 */}
          <div style={{ display: 'flex', justifyContent: 'center', border: '2px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
            <canvas 
              ref={canvasRef}
              onClick={handleCanvasClick}
              style={{ maxWidth: '100%', height: 'auto', cursor: 'crosshair' }}
            />
          </div>
        </>
      )}
    </div>
  );
}

export default App;
