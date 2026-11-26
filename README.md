# Thread Reader

Listen to a BB thread, one message, or a selected passage with an expressive OpenAI Realtime voice.

## Setup

Install the plugin from this checkout with `bb plugin install .`. In **Settings → Installed plugins → Thread Reader**, enter an OpenAI project API key with Realtime model access. Enter a Realtime model ID and a built-in voice name. A link at the bottom of the settings opens OpenAI’s Realtime documentation. The default is `gpt-realtime-2.1-mini` with the `marin` voice.

Click the speaker beside **Voice** to hear the entered voice read a short sample at normal speed with your saved model and narration style. Click it again to stop.

## Playback

Choose **Read thread aloud** in the thread menu for a snapshot of human-authored messages and assistant replies in chronological order. Thread Reader loads the snapshot before playback and skips system and agent-injected user rows. Use **Read aloud** on a message or text selection for a shorter read. The player stays available while you navigate. **Pause** holds your place, **Play** resumes, and **Stop** closes the player. When a read finishes, choose **Play** to replay it or seek to a new position. Starting another read replaces the current one. Choose **Playback speed** to adjust narration from 0.75× to 2×. The browser remembers the speed and preserves the voice’s pitch.

Click or drag the timeline to seek. With the timeline focused, arrow keys move up to five seconds within the passage scale. Page Up and Page Down move one passage forward or back. Home and End move to the start or finish. A single passage shows elapsed and total time. Longer reads give each passage an equal section of the bar. Seeking to a distant passage generates its audio on demand, including when you revisit audio that has left the player’s cache.

The BB server opens an authenticated WebSocket to OpenAI for each passage. The browser plays 24 kHz mono audio and prepares one passage ahead. OpenAI receives the text for narration and bills the configured API project. The key stays in BB's server-side secret setting. Realtime generates speech and can occasionally change wording.

## Development

Use Node 22.19 or later and BB 0.50 or later. Install dependencies with `npm ci`. Run `npm run lint:fix` and then `npm run format` to apply the spacing rules and format the code.

Run `npm run lint`, `npm run format:check`, and `npm run check` to check style and types. Run `npm test` for the passage and local WebSocket tests, and `npm run build` to build the plugin.
