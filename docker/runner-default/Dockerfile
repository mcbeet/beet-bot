FROM python:3.14-slim

COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin

RUN useradd --create-home beet-bot
WORKDIR /home/beet-bot
USER beet-bot

# Do not copy uv.lock to let environment rebuilds upgrade to new versions
COPY pyproject.toml ./
COPY src ./src

ARG REFRESH=0
RUN uv sync

RUN echo '{"pipeline": ["runner_default.bootstrap_environment"]}' \
  | uv run beet -p @beet/preset_stdin.yml

ENTRYPOINT ["uv", "run"]
