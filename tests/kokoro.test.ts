import assert from "node:assert/strict";
import test from "node:test";
import { synthesizeKokoro } from "../kokoro.ts";

test("Kokoro posts the selected voice and passage to loopback and returns mono PCM", async (t) => {
  const pcm = new Uint8Array([1, 2, 3, 4]);
  const fetch = t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    assert.equal(url, "http://127.0.0.1:8880/v1/audio/speech");
    assert.equal(init.method, "POST");
    assert.deepEqual(init.headers, { "Content-Type": "application/json" });
    assert.deepEqual(JSON.parse(String(init.body)), {
      model: "kokoro",
      input: "Boa tarde.",
      voice: "pf_dora",
      response_format: "pcm",
      stream: false,
    });

    return new Response(pcm, { headers: { "Content-Type": "audio/pcm" } });
  });

  const result = await synthesizeKokoro("Boa tarde.", "pf_dora", AbortSignal.timeout(1000));

  assert.equal(fetch.mock.callCount(), 1);
  assert.deepEqual(result, Buffer.from(pcm));
});

test("a different service on the Kokoro port cannot pass HTML to the player as audio", async (t) => {
  t.mock.method(
    globalThis,
    "fetch",
    async () => new Response("<html></html>", { headers: { "Content-Type": "text/html" } }),
  );

  await assert.rejects(synthesizeKokoro("Read me.", "af_heart", AbortSignal.timeout(1000)), /Expected PCM audio/);
});
