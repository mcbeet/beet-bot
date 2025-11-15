# beet-bot

[![GitHub Actions](https://github.com/mcbeet/beet-bot/workflows/CI/badge.svg)](https://github.com/mcbeet/beet-bot/actions)
[![npm](https://img.shields.io/npm/v/beet-bot.svg)](https://www.npmjs.com/package/beet-bot)
[![Discord](https://img.shields.io/discord/900530660677156924?color=7289DA&label=discord&logo=discord&logoColor=fff)](https://discord.gg/98MdSGMm8j)

> Packages for the beet bot.

Click the following link to add the bot to your own server:

- https://discord.com/oauth2/authorize?client_id=980644229984419932

## Installation

You can install the beet bot via `npm`.

```bash
$ npm install beet-bot
```

To run your own instance of the bot use the `beet-bot` command or simply run it with `npx` to install it automatically.

```bash
$ npx beet-bot --clientId=... --token=...
```

## Usage

You can provide credentials through command-line options `--clientId/--token` or by using environment variables `BEET_BOT_CLIENT_ID/BEET_BOT_TOKEN`. The bot will load the `.env` file in the working directory. The `--config` option lets you specify a json file in which you can define runner environments.

```bash
$ beet-bot --config bot.json
```

> Check out the sample [bot.json](bot.json).

## Contributing

This is a monorepo managed with [`pnpm`](https://pnpm.io/). If you don't have it installed already check out the [standalone script](https://pnpm.io/installation) for your platform or get it via [Corepack](https://github.com/nodejs/corepack) using `corepack enable`.

```bash
$ pnpm install
```

Set up packages for local development by running `pnpm -r stub`, and then launch the bot with the required credentials.

```bash
$ pnpm dev --clientId=... --token=...
```

You can also create a `.env` file at the root of the repository.

```env
BEET_BOT_CLIENT_ID=...
BEET_BOT_TOKEN=...
```

To build for production use the `pnpm -r build` command. Note that this overwrites package stubs so you will need to run `pnpm -r stub` again if you want to resume developing locally.

```bash
$ pnpm -r build
$ pnpm start --clientId=... --token=...
```

The project must type-check and `eslint` shouldn't report any error.

```bash
$ pnpm -r lint
```

---

License - [MIT](https://github.com/mcbeet/beet-bot/blob/main/LICENSE)
