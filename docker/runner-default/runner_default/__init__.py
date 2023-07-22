from beet import Context

from .plugins import precompile_ast, prepare_vanilla_resources


def bootstrap_environment(ctx: Context):
    ctx.require(
        precompile_ast,
        prepare_vanilla_resources,
    )
