from beet import Context
from beet.contrib.vanilla import Vanilla


def precompile_ast(ctx: Context):
    ctx.require(
        "bolt",
        "bolt_expressions",
        "beet_plugins.utils",
        "wicked_expressions",
        "mecha",
    )


def prepare_vanilla_resources(ctx: Context):
    ctx.inject(Vanilla).mount()
