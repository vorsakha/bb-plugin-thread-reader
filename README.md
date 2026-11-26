# Thread Reader

Listen to a BB thread, a message, or text you select. Thread Reader uses OpenAI Realtime to read the text aloud. You can preview a voice, adjust the speed, and seek through a long thread.

![Thread Reader playing passage three of four at 1.25× speed.](./screenshots/thread-reader/player.png)

## Install from a checkout

You need BB 0.50 or later and an OpenAI API key with access to a Realtime model. OpenAI bills your API project for narration and voice previews.

1. From the root of this repository, run `bb plugin install .`.
2. In BB, open **Settings**, then **Installed plugins**, then **Thread Reader**.
3. Enter your key in **OpenAI API key**. BB stores the key on the server.
4. Click the speaker beside **Voice** to hear a sample. Click it again to stop.

The default **Realtime model** is `gpt-realtime-2.1-mini`. The default **Voice** is `marin`. To change how the voice reads, edit **Narration style** and play the sample again. For supported voice names, see the [OpenAI Realtime guide](https://developers.openai.com/api/docs/guides/realtime-conversations).

## Read aloud

- For a whole conversation, open the thread menu and choose **Read thread aloud**. The player reads your messages and assistant replies in order, up to the point when you started the read.
- For one message, hover over the message and click the **Read aloud** speaker icon beneath it.
- For an excerpt, select the text and choose **Read aloud** from the selection menu.

![The speaker icon beneath a reply with the Read aloud tooltip visible.](./screenshots/thread-reader/message-action.png)

A new read replaces the current one. Thread Reader sends the current passage to OpenAI and prepares up to one passage ahead. If you seek back to a passage that the player has discarded, Thread Reader requests the audio again. The voice can occasionally change the wording.

## Control playback

Choose **Pause** to hold your place or **Play** to resume. After the last passage, **Play** starts the read again. **Stop** closes the player.

Use **Playback speed** to choose a rate from 0.75× to 2×. The browser remembers your choice and preserves the voice's pitch.

Click or drag the timeline to seek. For a single passage, the timeline shows elapsed and total time. For longer reads, each passage takes up an equal part of the timeline. With the timeline focused, use these keys.

| Key | Action |
| --- | --- |
| Left or right arrow | Move back or forward by 10% of a passage, up to five seconds when its duration is known. |
| Page Up or Page Down | Move one passage forward or back, respectively. |
| Home or End | Go to the start or end of the read. |

## Check a change locally

Use Node.js 22.19 or later and the BB CLI. From the repository root, run the checks and build the plugin.

```sh
npm ci
npm run lint
npm run format:check
npm run check
npm test
npm run build
```

To apply the spacing and formatting rules, run `npm run lint:fix`, then `npm run format`.

## List a release in BB Community

Thread Reader is a single plugin with `package.json` at the repository root. For a GitHub release, BB reads the listing from the tagged commit. The GitHub route works with `"private": true` in `package.json`. That setting prevents npm publication.

1. Check the listing name in `bb.name`, the description in `bb.description`, and the icon path in `bb.branding.icon`. BB derives the listing ID `thread-reader` from the package name.
2. Check that the two files in `bbMarketplace.screenshots` exist in the release checkout. The listing uses the `thread-content` category.
3. Run the local checks above. If your BB CLI supports `bb plugin publish --check`, run it to validate the listing before you tag the release.
4. When you are ready to publish, make the GitHub repository public and add the repository topic `bb-plugin`.
5. Push a version tag for the release commit, such as `v0.1.0` for version `0.1.0`.
6. After the next crawl, look up `github:vorsakha/bb-plugin-thread-reader` in the [BB crawl report](https://getbb.app/marketplace/v1/index/v1/report.json). BB checks for releases every 30 minutes.

For asset limits, category IDs, and the alternative npm release process, see the [BB Community listing rules](https://github.com/get-bb/marketplace#get-listed).
