# beet-bot-infra

> Infrastructure for the beet bot.

## Usage

This is a [Pulumi](https://www.pulumi.com/) project that runs the bot on aws.

```bash
$ pulumi config set client-id
$ pulumi config set token --secret
$ pulumi up
```

The bot runs as a systemd service which allows it to restart automatically and update itself. The settings used by the bot can be found in [cloud-config.yaml](cloud-config.yaml). Discord credentials are provided to the instance through SSM parameters. The bot uses DynamoDB to persist state.

---

License - [MIT](https://github.com/mcbeet/beet-bot/blob/main/LICENSE)
