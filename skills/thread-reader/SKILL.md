---
name: thread-reader
description: Configure Thread Reader narration or explain how to listen to a BB thread.
---

Choose **Narration provider** in **Settings → Installed plugins → Thread Reader**.
OpenAI Realtime is the default. Enter the project key in **OpenAI API key**. Use
**Narration style** to change the delivery. Never request the key in chat.

Local Kokoro 82M uses Kokoro-FastAPI on the machine hosting BB. It works without
an API key. The default voice is `af_heart` for English. Use **Browse Kokoro voices**
to find another voice ID, or enter `pf_dora` for Brazilian Portuguese.
Click **Preview** to hear the voice and **Stop** to end the sample.

Kokoro appears in settings even when the service is offline. If a preview or read
reports “Could not reach local Kokoro,” run `curl --fail http://127.0.0.1:8880/health`
on the BB server. If Kokoro is missing, follow the Docker setup in the plugin README.
If the documented container is stopped, start it with `docker start thread-reader-kokoro`.
Retry **Preview** after the health check returns `{"status":"healthy"}`.

Show playback window is on by default. Turn it off in Thread Reader settings
to hide the player while narration continues.

Use Read aloud on a message or selection, or Read thread aloud in the thread
menu for the conversation in chronological order. Pause holds your place and Play
resumes it. Use the active message button or whole-thread menu action to cancel
loading or stop playback, including when the playback window is hidden.
A finished read stays available for replay by default. To dismiss the player
automatically, enable **Close window when finished** under **Playback**. Seek with the timeline,
change the playback speed, or use Stop to close the player. The plugin sends the passage being narrated and at most one
upcoming passage to the selected provider. Local Kokoro processes them on the BB server. OpenAI Realtime usage is billed to the configured project.
