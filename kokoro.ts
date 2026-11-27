const endpoint = "http://127.0.0.1:8880/v1/audio/speech";

export async function synthesizeKokoro(text: string, voice: string, signal: AbortSignal): Promise<Buffer> {
  const timeout = AbortSignal.timeout(90_000);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "kokoro", input: text, voice, response_format: "pcm", stream: false }),
      signal: AbortSignal.any([signal, timeout]),
      redirect: "error",
    });

    if (!response.ok) {
      await response.body?.cancel();

      throw new Error(
        `Kokoro rejected the passage (HTTP ${response.status}). Check the Kokoro voice and service logs.`,
      );
    }

    if (response.headers.get("content-type")?.split(";")[0] !== "audio/pcm") {
      await response.body?.cancel();

      throw new Error("Expected PCM audio from Kokoro-FastAPI on port 8880.");
    }

    const pcm = Buffer.from(await response.arrayBuffer());

    if (!pcm.length || pcm.length % 2) {
      throw new Error("Kokoro returned incomplete audio.");
    }

    return pcm;
  } catch (error) {
    signal.throwIfAborted();

    if (timeout.aborted) {
      throw new Error("Local Kokoro took too long to generate audio.");
    }

    if (error instanceof TypeError) {
      throw new Error("Could not reach local Kokoro. Start Kokoro-FastAPI on port 8880 on the BB server.");
    }

    throw error;
  }
}
