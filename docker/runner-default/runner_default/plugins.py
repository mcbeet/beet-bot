from beet import Context
from beet.contrib.vanilla import Vanilla


def prepare_vanilla_resources(ctx: Context):
    ctx.inject(Vanilla).mount()
