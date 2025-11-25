'use client';

import { useState, useRef, useEffect } from 'react';

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ message: string; isError: boolean } | null>(null);

  // ⭐ チェックされている領域の座標
  const [checkRegions, setCheckRegions] = useState<any[]>([]);

  // ⭐ 画像サイズ取得用
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [imgSize, setImgSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (imageRef.current) {
      imageRef.current.onload = () => {
        setImgSize({
          width: imageRef.current!.offsetWidth,
          height: imageRef.current!.offsetHeight
        });
      };
    }
  }, [imagePreview]);

  const triggerFileSelect = () => document.getElementById('fileInput')?.click();
  const triggerCamera = () => document.getElementById('cameraInput')?.click();

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setCheckRegions([]);
      const reader = new FileReader();
      reader.onload = (e) => setImagePreview(e.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const showStatus = (message: string, isError = false) => {
    setStatusMessage({ message, isError });
    setTimeout(() => setStatusMessage(null), 5000);
  };

  const processImage = async () => {
    if (!selectedFile) return showStatus('画像を選択してください', true);

    setLoading(true);
    setResult(null);
    setCheckRegions([]);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const res = await fetch('/api/ocr', { method: 'POST', body: formData });

      const text = await res.text();
      const data = JSON.parse(text);

      if (data.error) return showStatus(data.error, true);

      setResult(data.text);
      setCheckRegions(data.checkRegions || []);
      showStatus('OCR処理が完了しました', false);

    } catch (err: any) {
      console.error(err);
      showStatus(err.message, true);
    } finally {
      setLoading(false);
    }
  };

  // ⭐ Azure polygon → 表示用座標に変換
  const convertPolygon = (polygon: number[]) => {
    // Azure の polygon は画像の実寸（px）基準
    // 画像の表示サイズに合わせてスケーリング
    const scaleX = imgSize.width / 1000;  // Azure は通常 0〜1000 の相対座標
    const scaleY = imgSize.height / 1000;

    const points = [];
    for (let i = 0; i < polygon.length; i += 2) {
      points.push({
        x: polygon[i] * scaleX,
        y: polygon[i + 1] * scaleY,
      });
    }

    const xs = points.map(p => p.x);
    const ys = points.map(p => p.y);

    return {
      left: Math.min(...xs),
      top: Math.min(...ys),
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys)
    };
  };

  return (
    <div className="container" style={{ padding: 20 }}>
      <div className="header" style={{ textAlign: 'center', marginBottom: 20 }}>
        <h1>📄 OCR Document Scanner</h1>
        <p>Azure AI Document Intelligence を使用した文書認識</p>
      </div>

      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <button className="btn btn-primary" onClick={triggerCamera} style={{ marginRight: 10 }}>
          📷 カメラで撮影
        </button>
        <button className="btn btn-primary" onClick={triggerFileSelect}>
          🖼️ 既存の画像を選択
        </button>
        <input type="file" id="cameraInput" accept="image/*" capture="environment" onChange={handleImageSelect} style={{ display: 'none' }} />
        <input type="file" id="fileInput" accept="image/*" onChange={handleImageSelect} style={{ display: 'none' }} />
      </div>

      {/* 画像 + チェック領域オーバーレイ */}
      {imagePreview && (
        <div style={{ textAlign: 'center', position: 'relative', display: 'inline-block' }}>
          <img
            ref={imageRef}
            src={imagePreview}
            alt="Image Preview"
            style={{ maxWidth: '100%', borderRadius: 10 }}
          />

          {/* 🔥 チェックされた領域を赤枠で表示 */}
          {checkRegions.map((region, i) => {
            const box = convertPolygon(region.polygon);
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  border: '2px solid red',
                  left: box.left,
                  top: box.top,
                  width: box.width,
                  height: box.height,
                  pointerEvents: 'none'
                }}
              />
            );
          })}
        </div>
      )}

      <div style={{ textAlign: 'center', marginTop: 20 }}>
        <button className="btn btn-primary" onClick={processImage} disabled={!selectedFile || loading}>
          🔍 OCR処理を開始
        </button>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: 20 }}>
          <p>処理中です...</p>
        </div>
      )}

      {result && (
        <div style={{ marginTop: 20, padding: 20, background: '#f8f9fa', borderRadius: 10 }}>
          <h3>📋 OCR結果</h3>
          <pre>{result}</pre>
        </div>
      )}
    </div>
  );
}
