export class InvalidJsonBodyError extends Error {}
export class PayloadTooLargeError extends Error {}

export async function readJsonBody(request: Request, maxBytes: number): Promise<unknown> {
  const contentLength = request.headers.get("content-length");
  if (contentLength && Number(contentLength) > maxBytes) {
    throw new PayloadTooLargeError();
  }

  const reader = request.body?.getReader();
  if (!reader) {
    throw new InvalidJsonBodyError();
  }

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel();
      throw new PayloadTooLargeError();
    }

    chunks.push(value);
  }

  try {
    const body = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), totalBytes);
    return JSON.parse(body.toString("utf8")) as unknown;
  } catch {
    throw new InvalidJsonBodyError();
  }
}
