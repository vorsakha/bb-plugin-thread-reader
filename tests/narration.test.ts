import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import { WebSocketServer } from "ws";
import { synthesize } from "../realtime.ts";
import { passageLimit, passages } from "../speech.ts";

test("long passages stay in order and preserve Unicode pairs", () => {
  const text = "a".repeat(passageLimit - 1) + "🦊".repeat(500);
  const result = passages(text);
  assert.equal(result.join(""), text);
  assert.ok(result.every(part => part.length <= passageLimit && !/[\uD800-\uDBFF]$/u.test(part)));
  assert.deepEqual(passages("  "), []);
});

for (const status of ["completed", "incomplete"]) {
  test(`Realtime audio with a ${status} response`, async t => {
    const server = new WebSocketServer({ port: 0, host: "127.0.0.1" });
    await once(server, "listening");
    t.after(() => server.close());
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    server.on("connection", (socket, req) => {
      assert.equal(req.headers.authorization, "Bearer test-only");
      assert.equal(req.url, "/?model=gpt-realtime-2.1-mini");
      socket.send(JSON.stringify({ type: "session.created" }));
      socket.on("message", raw => {
        const event = JSON.parse(raw.toString());
        assert.equal(event.response.input[0].content[0].text, "Read me.");
        assert.equal(event.response.audio.output.voice, "marin");
        assert.match(event.response.instructions, /warm/);
        for (const frame of ["AQI=", "AwQ="]) {
          socket.send(JSON.stringify({ type: "response.output_audio.delta", delta: frame }));
        }
        socket.send(JSON.stringify({ type: "response.done", response: { status } }));
      });
    });
    const audio = synthesize("Read me.", { model: "gpt-realtime-2.1-mini", apiKey: "test-only", voice: "marin", style: "warm" }, AbortSignal.timeout(5000), `ws://127.0.0.1:${address.port}`);
    if (status === "completed") {
      assert.deepEqual(await audio, Buffer.from([1, 2, 3, 4]));
    } else {
      await assert.rejects(audio, /incomplete narration/);
    }
  });
}
