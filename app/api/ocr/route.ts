import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

export const POST = async (req: NextRequest) => {
  try {
    // 1. ファイル取得
    const formData = await req.formData();
    const file = formData.get('file') as File;
    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });

    // 2. 環境変数
    const AZURE_ENDPOINT = process.env.AZURE_ENDPOINT!;
    const AZURE_API_KEY = process.env.AZURE_API_KEY!;
    const SUPABASE_URL = process.env.SUPABASE_URL!;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;

    // 3. Supabase クライアント作成
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // 4. 画像/PDF/TIFF 処理
    const arrayBuffer = await file.arrayBuffer();
    let bodyForFetch: Blob;

    if (file.type === 'application/pdf' || file.type === 'image/tiff') {
      // PDF/TIFF はそのまま Blob 化
      bodyForFetch = new Blob([arrayBuffer], { type: file.type });
    } else if (file.type.startsWith('image/')) {
      // 画像は圧縮して Blob 化
      const buffer = Buffer.from(arrayBuffer);
      const compressedBuffer = await sharp(buffer)
        .jpeg({ quality: 60 })
        .toBuffer();

      bodyForFetch = new Blob([new Uint8Array(compressedBuffer)], { type: 'image/jpeg' });
    } else {
      return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
    }

    // 5. Azure OCR 実行（prebuilt-read 例、必要に応じて prebuilt-layout に変更）
    const analyzeUrl = `${AZURE_ENDPOINT}/formrecognizer/documentModels/prebuilt-read:analyze?api-version=2023-07-31`;

    const analyzeResponse = await fetch(analyzeUrl, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': AZURE_API_KEY,
        'Content-Type': 'application/octet-stream'
      },
      body: bodyForFetch
    });

    if (!analyzeResponse.ok) {
      const text = await analyzeResponse.text();
      return NextResponse.json({ error: text }, { status: analyzeResponse.status });
    }

    const operationLocation = analyzeResponse.headers.get('Operation-Location');
    if (!operationLocation) return NextResponse.json({ error: 'No Operation-Location' }, { status: 500 });

    // 6. ポーリングでOCR結果取得
    let resultData: any = null;
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 1000));
      const res = await fetch(operationLocation, {
        headers: { 'Ocp-Apim-Subscription-Key': AZURE_API_KEY }
      });
      const json = await res.json();
      if (json.status === 'succeeded') {
        resultData = json;
        break;
      } else if (json.status === 'failed') {
        return NextResponse.json({ error: 'OCR failed' }, { status: 500 });
      }
    }

    const extractedText = resultData?.analyzeResult?.content || '';

    // 7. Supabase に保存
    const { error: supabaseError } = await supabase.from('ocr_results').insert({
      created_at: new Date().toISOString(),
      image_name: file.name,
      ocr_text: extractedText,
      metadata: {
        file_size: file.size,
        file_type: file.type,
        azure_model: 'prebuilt-read',
        processed_date: new Date().toISOString(),
        pages: resultData?.analyzeResult?.pages?.length || 1
      },
      raw_result: resultData?.analyzeResult
    });

    if (supabaseError) {
      console.error('Supabase 保存エラー:', supabaseError);
      return NextResponse.json({ error: 'OCR成功, しかし Supabase 保存に失敗しました' }, { status: 500 });
    }

    // 8. フロントに結果返却
    return NextResponse.json({ text: extractedText });

  } catch (error: any) {
    console.error('サーバーエラー:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
};
