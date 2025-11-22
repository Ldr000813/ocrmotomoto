'use client';

import { useState } from 'react';

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ message: string; isError: boolean } | null>(null);

  const triggerFileSelect = () => {
    document.getElementById('fileInput')?.click();
  };

  const triggerCamera = () => {
    document.getElementById('cameraInput')?.click();
  };

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
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

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const res = await fetch('/api/ocr', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (data.error) return showStatus(data.error, true);

      setResult(data.text);
      showStatus('OCR処理が完了しました', false);
    } catch (error: any) {
      console.error(error);
      showStatus(error.message, true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="header">
        <h1>📄 OCR Document Scanner</h1>
        <p>Azure AI Document Intelligence を使用した文書認識サービス</p>
      </div>

      <div className="content">
        {/* アップロードセクション */}
        <div className="upload-section">
          <h2 style={{ marginBottom: '20px', color: '#333' }}>画像をアップロード</h2>
          <div className="button-group">
            <button className="btn btn-primary" onClick={triggerCamera}>📷 カメラで撮影</button>
            <button className="btn btn-primary" onClick={triggerFileSelect}>🖼️ 既存の画像を選択</button>
          </div>
          <input
            type="file"
            id="cameraInput"
            accept="image/*"
            capture="environment"
            onChange={handleImageSelect}
            style={{ display: 'none' }}
          />
          <input
            type="file"
            id="fileInput"
            accept="image/*"
            onChange={handleImageSelect}
            style={{ display: 'none' }}
          />
        </div>

        {/* プレビュー */}
        {imagePreview && (
          <div className="preview-section">
            <img src={imagePreview} alt="Image Preview" id="imagePreview" />
          </div>
        )}

        {/* OCR処理ボタン */}
        <div style={{ textAlign: 'center', margin: '20px 0' }}>
          <button className="btn btn-primary" onClick={processImage} disabled={!selectedFile || loading}>
            🔍 OCR処理を開始
          </button>
        </div>

        {/* ローディング */}
        {loading && (
          <div className="loading" id="loading">
            <div className="spinner"></div>
            <p>処理中です。しばらくお待ちください...</p>
          </div>
        )}

        {/* ステータスメッセージ */}
        {statusMessage && (
          <div className={`status-message ${statusMessage.isError ? 'status-error' : 'status-success'}`}>
            {statusMessage.message}
          </div>
        )}

        {/* OCR結果 */}
        {result && (
          <div className="result-section" id="resultSection">
            <h3>📋 OCR結果</h3>
            <div className="result-content" id="resultContent">{result}</div>
          </div>
        )}
      </div>
    </div>
  );
}
