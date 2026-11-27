# Thread Reader

Listen to a BB thread, a single message, or text you select. The player lets you pause, skip to another passage, and change the speed from 0.75× to 2×.

![Thread Reader paused beside the conversation after dragging the player over the sidebar](./screenshots/thread-reader/player.png)

## Install

You need BB 0.50 or later.

```sh
bb plugin install git:https://github.com/vorsakha/bb-plugin-thread-reader.git@v0.1.7
```

## Choose a narration provider

In **Settings → Installed plugins → Thread Reader**, choose a **Narration provider**. Click **Preview** beside the selected provider’s voice to hear a sample.

**OpenAI Realtime** is the default. Enter an OpenAI API key with Realtime access. The defaults are `gpt-realtime-2.1-mini` and the `marin` voice. Edit **Narration style** to change the delivery.

**Local Kokoro 82M** runs on the BB server’s CPU and works without an API key. Start Kokoro-FastAPI on the machine running BB:

```sh
docker run -d --name thread-reader-kokoro --restart unless-stopped \
  -p 127.0.0.1:8880:8880 --cpus=4 --memory=3g \
  -e OMP_NUM_THREADS=4 -e MKL_NUM_THREADS=4 -e CORS_ENABLED=false \
  ghcr.io/remsky/kokoro-fastapi-cpu:v0.10.0
```

Select **Local Kokoro 82M** and preview the default English voice, `af_heart`. Enter another voice ID in **Kokoro voice** to change the voice and language. [Kokoro voice list](https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md)

## Read aloud

- **One message.** Hover over a message and click the speaker beneath it.
- **Selected text.** Highlight the passage and choose **Read aloud**.
- **Whole thread.** Open the thread menu and choose **Read thread aloud** to hear your messages and the assistant's replies in order.

The message button shows a spinner while narration loads and a stop icon during playback. Click it again to cancel or stop, even with the playback window hidden. For a whole-thread read, use the same action in the thread menu.

![Read aloud speaker button beneath an assistant reply](./screenshots/thread-reader/message-action.png)

Drag the player by its title to move it. With the title focused, use the arrow keys to move it or press Home to return it to the top right.

**Show playback window** is on by default in Thread Reader settings. Turn it off to hide the player while narration continues. Turn it back on during a read to see the controls again.

To dismiss the player after the last passage, turn on **Close window when finished** in Thread Reader settings. By default, the player stays open for replay.

## Privacy and cost

Thread Reader prepares one passage ahead. With local Kokoro, the BB server sends narration and previews to its loopback speech service. With OpenAI Realtime, the BB server sends passages to OpenAI and keeps your API key server-side. OpenAI bills your API project for narration and voice previews.
