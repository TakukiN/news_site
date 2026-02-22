const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen3:8b";
const MAX_RETRIES = 2;
const DETAIL_NUM_PREDICT = 2000;

async function callOllama(prompt: string, numPredict = 800): Promise<string> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        stream: false,
        options: {
          temperature: 0.3,
          num_predict: numPredict,
        },
      }),
    });

    if (!res.ok) {
      throw new Error(`Ollama API error: ${res.status} ${await res.text()}`);
    }

    const data = await res.json();
    let response = data.response?.trim() || "";

    // Remove <think>...</think> blocks if present (qwen3 thinking mode)
    response = response.replace(/<think>[\s\S]*?<\/think>/g, "").trim();

    // Validate response format: must have both タイトル and 要約
    const hasTitle = /タイトル[：:]/.test(response);
    const hasSummary = /要約[：:]/.test(response);
    if (response.length > 20 && hasTitle && hasSummary) {
      return response;
    }
    // Accept if at least 要約 is present (タイトル might be missing)
    if (response.length > 50 && hasSummary) {
      return response;
    }

    // Retry if response was empty or too short
    if (attempt < MAX_RETRIES) {
      console.warn(`[Summarizer] Empty/short response, retrying (${attempt + 1}/${MAX_RETRIES})...`);
    }
  }

  throw new Error("Ollama returned empty response after retries");
}

export async function summarizeArticle(
  title: string,
  content: string
): Promise<string> {
  const truncatedContent = content.slice(0, 4000);

  return callOllama(`あなたは大手ニュースメディアの編集者です。以下の記事について、2つの作業を行ってください。
本文に記載されていない情報は絶対に追加しないでください。

【作業1】読みたくなる日本語タイトルを1つ作成
想定読者：20〜40代のビジネスパーソン
評価基準：興味喚起、明確さ、具体性、信頼感
タイトルは30文字以内で、記事の核心を捉えたものにしてください。

【作業2】日本語の要約文を3〜4文、100〜150文字程度で作成
ルール：
- 製品名・技術名・企業名は原語のまま記載
- 重要なキーワード（技術名、規格名、数値、企業名など）は **太字** で囲む
  （例: **5G対応**, **IP68**, **Android 14**, **Qualcomm QCM6490**）
- 核心となる事実とビジネスインパクトを簡潔にまとめる
- 推測は含めず、記事に記載された事実のみ

出力形式（必ずこの形式で出力してください）：
タイトル：（日本語タイトル）
要約：（要約文）

thinkタグは出力しないでください。

記事タイトル: ${title}
記事本文:
${truncatedContent}`);
}

export async function summarizeProduct(
  title: string,
  content: string
): Promise<string> {
  const truncatedContent = content.slice(0, 4000);

  return callOllama(`あなたは産業用デバイスの製品アナリストです。以下の製品情報について、2つの作業を行ってください。
本文に記載されていない情報は絶対に追加しないでください。

【作業1】わかりやすい日本語の製品タイトルを1つ作成
- 製品名は原語のまま含める
- 主な用途や特長がわかるようにする
- 30文字以内

【作業2】日本語の製品紹介文を3〜4文、100〜150文字程度で作成
ルール：
- 製品名・型番は原語のまま記載
- 重要なキーワード（技術名、規格名、数値、企業名など）は **太字** で囲む
  （例: **5G対応**, **IP68**, **Android 14**, **Qualcomm QCM6490**）
- 主な仕様と対象業界を簡潔にまとめる
- 推測は含めず、記載された事実のみ

出力形式（必ずこの形式で出力してください）：
タイトル：（日本語タイトル）
要約：（製品紹介文）

thinkタグは出力しないでください。

製品名: ${title}
製品情報:
${truncatedContent}`);
}

export async function summarizeDetailArticle(
  title: string,
  content: string
): Promise<string> {
  const truncatedContent = content.slice(0, 6000);

  return callOllama(`あなたは大手ニュースメディアの編集者です。以下の記事について、詳細な日本語要約を作成してください。

【最重要ルール】
- 本文に記載されていない情報は絶対に追加しないでください
- スペック、数値、企業名、技術名は本文に明記されているものだけ使用
- 本文の情報が不十分な場合は、短い要約にしてください（無理に長くしない）

【指示】
- 15〜20文程度の詳細な要約を作成（本文に十分な情報がある場合）
- 記事の主要な論点・事実・数値をすべて網羅する
- 製品名・技術名・企業名・数値は原語のまま記載
- 重要なキーワード（技術名、規格名、数値、企業名など）は **太字** で囲む
  （例: **5G対応**, **IP68**, **Android 14**, **Qualcomm QCM6490**）
- 時系列に沿って構造的にまとめる
- 背景情報、具体的な施策内容、今後の展望を含める
- 推測や一般知識からの補完は絶対に含めず、記事に記載された事実のみ

出力形式（必ずこの形式で出力してください）：
タイトル：（日本語タイトル、30文字以内）
要約：（詳細要約文、15〜20文）

thinkタグは出力しないでください。

記事タイトル: ${title}
記事本文:
${truncatedContent}`, DETAIL_NUM_PREDICT);
}

export async function summarizeDetailProduct(
  title: string,
  content: string
): Promise<string> {
  const truncatedContent = content.slice(0, 6000);

  return callOllama(`あなたは産業用デバイスの製品アナリストです。以下の製品について、詳細な日本語紹介文を作成してください。

【最重要ルール】
- 本文に記載されていない情報は絶対に追加しないでください
- スペック、数値、企業名、技術名は本文に明記されているものだけ使用
- 他の製品や競合の情報を勝手に追加しないでください
- 本文の情報が不十分な場合は、短い紹介文にしてください（無理に長くしない）

【指示】
- 15〜20文程度の詳細な製品紹介文を作成（本文に十分な情報がある場合）
- 本文に記載されている仕様（プロセッサ、OS、ディスプレイ、バッテリー、通信、耐久性、重量等）を記載
- 対象業界・ユースケースを本文から抽出して明記
- 製品名・型番・技術名は原語のまま記載
- 重要なキーワード（技術名、規格名、数値、企業名など）は **太字** で囲む
  （例: **5G対応**, **IP68**, **Android 14**, **Qualcomm QCM6490**）
- 推測や一般知識からの補完は絶対に含めず、記載された事実のみ

出力形式（必ずこの形式で出力してください）：
タイトル：（日本語タイトル、30文字以内）
要約：（詳細製品紹介文、15〜20文）

thinkタグは出力しないでください。

製品名: ${title}
製品情報:
${truncatedContent}`, DETAIL_NUM_PREDICT);
}
