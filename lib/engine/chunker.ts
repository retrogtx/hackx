export type ChunkMetadata = {
  fileName?: string;
  fileType?: string;
  charCount: number;
};

export interface Chunk {
  content: string;
  chunkIndex: number;
  pageNumber?: number;
  sectionTitle?: string;
  metadata: ChunkMetadata;
}

const CHUNK_SIZE = 1500; 
const OVERLAP = 200;

export function chunkText(
  text: string,
  opts?: { fileName?: string; fileType?: string },
): Chunk[] {
  const chunks: Chunk[] = [];

  const sections = text.split(/\n{2,}/);
  let buffer = "";
  let chunkIndex = 0;

  const buildMetadata = (content: string): ChunkMetadata => ({
    fileName: opts?.fileName,
    fileType: opts?.fileType,
    charCount: content.length,
  });

  for (const section of sections) {
    const trimmed = section.trim();
    if (!trimmed) continue;

    if (buffer.length + trimmed.length > CHUNK_SIZE && buffer.length > 0) {
      const content = buffer.trim();
      chunks.push({
        content,
        chunkIndex: chunkIndex++,
        sectionTitle: extractSectionTitle(buffer),
        metadata: buildMetadata(content),
      });

      const overlapText = buffer.slice(-OVERLAP);
      buffer = overlapText + "\n\n" + trimmed;
    } else {
      buffer += (buffer ? "\n\n" : "") + trimmed;
    }
  }

  if (buffer.trim()) {
    const content = buffer.trim();
    chunks.push({
      content,
      chunkIndex: chunkIndex++,
      sectionTitle: extractSectionTitle(buffer),
      metadata: buildMetadata(content),
    });
  }

  if (chunks.length === 0 && text.trim()) {
    const content = text.trim();
    chunks.push({
      content,
      chunkIndex: 0,
      metadata: buildMetadata(content),
    });
  }

  return chunks;
}

function extractSectionTitle(text: string): string | undefined {
  // Try to extract a heading from markdown-style headers
  const match = text.match(/^#+\s+(.+)/m);
  if (match) return match[1].trim();

  // Try first line if it's short enough to be a title
  const firstLine = text.split("\n")[0]?.trim();
  if (firstLine && firstLine.length < 100 && !firstLine.endsWith(".")) {
    return firstLine;
  }

  return undefined;
}
