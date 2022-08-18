from beet import Context

from .plugins import prepare_vanilla_resources


def bootstrap_environment(ctx: Context):
    ctx.require(prepare_vanilla_resources)
