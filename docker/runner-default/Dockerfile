FROM python:3.11-slim

RUN pip install poetry --no-cache-dir

RUN useradd --create-home beet-bot
WORKDIR /home/beet-bot
USER beet-bot

COPY pyproject.toml poetry.toml ./
COPY runner_default ./runner_default
RUN poetry install

RUN echo '{"pipeline": ["runner_default.bootstrap_environment"]}' \
  | poetry run beet -p @beet/preset_stdin.yml

ENTRYPOINT ["poetry", "run"]
