---
name: thread-reader
description: Configure Thread Reader narration or explain how to listen to a BB thread.
---

Choose a Narration provider in Settings → Installed plugins → Thread Reader.
Local Kokoro 82M uses Kokoro-FastAPI on port 8880 of the BB server. It works
without an API key and defaults to the af_heart voice. The plugin README includes the Docker setup.
For OpenAI Realtime, enter an OpenAI project key in the secret field and choose
the Realtime model, OpenAI voice, and Narration style. Never request the key in chat.
Click **Preview** beside the active provider’s voice to preview it, or click again to stop.

Show playback window is on by default. Turn it off in Thread Reader settings
to hide the player while narration continues.

Use Read aloud on a message or selection, or Read thread aloud in the thread
menu for the conversation in chronological order. Pause holds your place and Play
resumes it. Use the active message button or whole-thread menu action to cancel
loading or stop playback, including when the playback window is hidden.
A finished read stays available for replay. Seek with the timeline,
change the playback speed, or use Stop to close the player. The plugin sends the passage being narrated and at most one
upcoming passage to the selected provider. Local Kokoro processes them on the BB server. OpenAI Realtime usage is billed to the configured project.
