export const HF_CHAT_API_URL = "https://router.huggingface.co/v1/chat/completions";
export const HF_FE_BASE = "https://router.huggingface.co/hf-inference/models";
export const DEFAULT_EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2";
export const EMBEDDING_DIMS = 384;

export function getHfConfig() {
  const token = process.env.HUGGINGFACE_TOKEN || process.env.HF_TOKEN || "";
  const model = process.env.HUGGINGFACE_MODEL || "Qwen/Qwen2.5-7B-Instruct";
  if (!token) {
    throw new Error("Missing HUGGINGFACE_TOKEN in Convex environment variables.");
  }
  return { token, model };
}

export function getEmbeddingModel() {
  return process.env.HUGGINGFACE_EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL;
}

export function extractJson(text: string) {
  const trimmed = (text || "").trim();
  try {
    return JSON.parse(trimmed);
  } catch (_e) {
    // fall through to regex extraction
  }
  const match = trimmed.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("LLM response did not contain JSON.");
  return JSON.parse(match[0]);
}

export type ChatCallOptions = {
  systemPrompt: string;
  userPrompt: any;
  temperature?: number;
  maxTokens?: number;
  forceJson?: boolean;
  timeoutMs?: number;
};

export async function callHfChat({
  systemPrompt,
  userPrompt,
  temperature = 0.2,
  maxTokens = 1500,
  forceJson = true,
  timeoutMs = 30_000
}: ChatCallOptions): Promise<string> {
  const { token, model } = getHfConfig();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetch(HF_CHAT_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        model,
        temperature,
        max_tokens: maxTokens,
        ...(forceJson ? { response_format: { type: "json_object" } } : {}),
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content:
              typeof userPrompt === "string" ? userPrompt : JSON.stringify(userPrompt, null, 2)
          }
        ]
      }),
      signal: controller.signal
    });
  } catch (error: any) {
    if (error?.name === "AbortError") {
      throw new Error(`Hugging Face chat request timed out after ${timeoutMs}ms.`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  const raw = await response.text();
  let payload: any = null;
  try {
    payload = JSON.parse(raw);
  } catch (_error) {
    throw new Error(`Hugging Face API returned non-JSON response (${response.status}).`);
  }
  if (!response.ok) {
    const message =
      typeof payload?.error === "string"
        ? payload.error
        : payload?.error?.message || "Hugging Face API error";
    throw new Error(message);
  }
  return payload?.choices?.[0]?.message?.content || "";
}

export async function callHfJson(opts: ChatCallOptions): Promise<any> {
  const text = await callHfChat({ ...opts, forceJson: opts.forceJson ?? true });
  return extractJson(text || "{}");
}

export async function embedText(text: string, timeoutMs = 30_000): Promise<number[]> {
  const { token } = getHfConfig();
  const model = getEmbeddingModel();
  const url = `${HF_FE_BASE}/${model}/pipeline/feature-extraction`;
  const trimmedInput = (text || "").trim().slice(0, 8000);
  if (!trimmedInput) {
    throw new Error("Cannot embed empty text.");
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        inputs: trimmedInput,
        options: { wait_for_model: true, normalize: true }
      }),
      signal: controller.signal
    });
  } catch (error: any) {
    if (error?.name === "AbortError") {
      throw new Error(`Hugging Face embedding request timed out after ${timeoutMs}ms.`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Embedding failed (${response.status}): ${errText.slice(0, 200)}`);
  }
  const data = await response.json();
  let vector: number[] | null = null;
  if (Array.isArray(data) && data.length && Array.isArray(data[0])) {
    const first = data[0] as any;
    if (Array.isArray(first[0])) {
      const seqLen = first.length;
      const dim = (first[0] as number[]).length;
      const pooled = new Array(dim).fill(0);
      for (let i = 0; i < seqLen; i++) {
        for (let j = 0; j < dim; j++) pooled[j] += (first[i] as number[])[j];
      }
      vector = pooled.map((v) => v / seqLen);
    } else {
      vector = first as number[];
    }
  } else if (Array.isArray(data) && typeof data[0] === "number") {
    vector = data as number[];
  }
  if (!vector || !vector.length) {
    throw new Error("Unexpected embedding response shape from Hugging Face.");
  }
  if (vector.length !== EMBEDDING_DIMS) {
    throw new Error(
      `Embedding dimension mismatch: expected ${EMBEDDING_DIMS}, got ${vector.length}.`
    );
  }
  let norm = 0;
  for (const v of vector) norm += v * v;
  norm = Math.sqrt(norm) || 1;
  return vector.map((v) => v / norm);
}

export function cosineSim(a: number[], b: number[]) {
  if (!a?.length || !b?.length || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
