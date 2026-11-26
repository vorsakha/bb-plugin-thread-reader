# Thread Reader

Listen to a BB thread, one message, or a selected passage with an expressive OpenAI Realtime voice.

## Setup

Install the plugin from this checkout with `bb plugin install .`. In **Settings → Installed plugins → Thread Reader**, enter an OpenAI project API key with Realtime model access. Choose a model, voice, and narration style. The default is `gpt-realtime-2.1-mini` with the `marin` voice.

## Playback

Choose **Read thread aloud** in the thread menu for a snapshot of user and assistant messages in chronological order. Use **Read aloud** on a message or text selection for a shorter read. The player stays available while you navigate. **Stop** cancels playback, and starting another read replaces the current one.

The BB server opens an authenticated WebSocket to OpenAI for each passage. The browser plays 24 kHz mono audio and prepares one passage ahead. OpenAI receives the text for narration and bills the configured API project. The key stays in BB's server-side secret setting. Realtime generates speech and can occasionally change wording.

## Development

Use Node 22.19 or later and BB 0.50 or later. Run `npm ci`, `npm run check`, `npm test`, and `npm run build`. The protocol tests use a local WebSocket server.
