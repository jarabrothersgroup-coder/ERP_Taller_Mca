import { getDb } from "../../../shared/database/connection.js";

const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;

export interface RagChunk {
  content: string;
  pageNumber: number;
  section: string | null;
}

export interface RagQueryRequest {
  question: string;
  vehicleId?: string;
  topK?: number;
}

export interface RagQueryResult {
  chunks: Array<{
    content: string;
    pageNumber: number;
    section: string | null;
    score: number;
  }>;
  answer: string;
}

export async function chunkText(text: string, pageNumber: number, section: string | null): Promise<RagChunk[]> {
  const chunks: RagChunk[] = [];
  let start = 0;
  while (start < text.length) {
    let end = start + CHUNK_SIZE;
    if (end < text.length) {
      const boundary = text.lastIndexOf("\n", end);
      if (boundary > start) end = boundary;
    }
    const content = text.slice(start, Math.min(end, text.length)).trim();
    if (content) chunks.push({ content, pageNumber, section });
    const advance = end - start - CHUNK_OVERLAP;
    start = advance > 0 ? start + advance : end;
  }
  return chunks;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env["OPENAI_API_KEY"];
  if (!apiKey) throw new Error("OPENAI_API_KEY no configurada");

  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-ada-002",
      input: text,
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenAI API error: ${res.status} ${res.statusText}`);
  }

  const data: any = await res.json();
  return data.data[0].embedding as number[];
}

export async function storeChunks(
  vehicleId: string | undefined,
  chunks: RagChunk[],
  embeddings: number[][],
): Promise<void> {
  if (chunks.length !== embeddings.length) {
    throw new Error("chunks length must match embeddings length");
  }

  const values = chunks.map((chunk, i) => ({
    vehicleId: vehicleId ?? null,
    content: chunk.content.substring(0, 2000),
    pageNumber: chunk.pageNumber,
    section: chunk.section,
    embedding: embeddings[i],
  }));

  const sql = getDb();
  for (const v of values) {
    await sql`
      INSERT INTO vehicle_manual_chunks (vehicle_id, content, page_number, section, embedding)
      VALUES (${v.vehicleId}, ${v.content}, ${v.pageNumber}, ${v.section}, ${JSON.stringify(v.embedding)}::vector)
    `;
  }
}

export async function queryRag(req: RagQueryRequest): Promise<RagQueryResult> {
  const topK = req.topK ?? 3;
  const sql = getDb();
  const apiKey = process.env["OPENAI_API_KEY"];

  if (apiKey) {
    try {
      const queryEmbedding = await generateEmbedding(req.question);
      const embeddingJson = JSON.stringify(queryEmbedding);

      let rows: any[];
      if (req.vehicleId) {
        rows = await sql`
          SELECT content, page_number, section,
                 1 - (embedding <=> ${embeddingJson}::vector) AS score
          FROM vehicle_manual_chunks
          WHERE vehicle_id = ${req.vehicleId}
          ORDER BY embedding <=> ${embeddingJson}::vector
          LIMIT ${topK}
        `;
      } else {
        rows = await sql`
          SELECT content, page_number, section,
                 1 - (embedding <=> ${embeddingJson}::vector) AS score
          FROM vehicle_manual_chunks
          ORDER BY embedding <=> ${embeddingJson}::vector
          LIMIT ${topK}
        `;
      }

      const chunks = rows.map((r: any) => ({
        content: r.content as string,
        pageNumber: r.page_number as number,
        section: r.section as string | null,
        score: r.score as number,
      }));

      return { chunks, answer: synthesizeAnswer(req.question, chunks) };
    } catch {
      return fallbackSearch(req);
    }
  }

  return fallbackSearch(req);
}

async function fallbackSearch(req: RagQueryRequest): Promise<RagQueryResult> {
  const sql = getDb();
  const terms = req.question
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 3);

  if (terms.length === 0) {
    return { chunks: [], answer: "No se pudo procesar la consulta." };
  }

  const conditions = terms.map(() => `content ILIKE '%' || ? || '%'`).join(" OR ");
  const topK = req.topK ?? 3;

  let rows: any[];
  if (req.vehicleId) {
    rows = await sql.unsafe(
      `SELECT content, page_number, section FROM vehicle_manual_chunks
       WHERE vehicle_id = ? AND (${conditions})
       LIMIT ${topK}`,
      [req.vehicleId, ...terms],
    );
  } else {
    rows = await sql.unsafe(
      `SELECT content, page_number, section FROM vehicle_manual_chunks
       WHERE ${conditions}
       LIMIT ${topK}`,
      terms,
    );
  }

  const chunks = rows.map((r: any) => ({
    content: r.content as string,
    pageNumber: r.page_number as number,
    section: r.section as string | null,
    score: 0,
  }));

  return { chunks, answer: synthesizeAnswer(req.question, chunks) };
}

function synthesizeAnswer(_question: string, chunks: Array<{ content: string; pageNumber: number; section: string | null }>): string {
  if (chunks.length === 0) {
    return "No se encontraron fragmentos relevantes en el manual.";
  }
  const refs = chunks
    .map((c) => `- Página ${c.pageNumber}${c.section ? ` (${c.section})` : ""}`)
    .join("\n");
  return `Según el manual de taller, los fragmentos más relevantes son:\n\n${refs}\n\nPara una respuesta precisa, revise el contenido completo en las páginas indicadas.`;
}
