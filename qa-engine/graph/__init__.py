"""Public graph exports with lazy imports."""

from importlib import import_module

__all__ = ["PipelineState", "build_pipeline", "pipeline"]

_EXPORTS = {
    "PipelineState": ("graph.pipeline", "PipelineState"),
    "build_pipeline": ("graph.pipeline", "build_pipeline"),
    "pipeline": ("graph.pipeline", "pipeline"),
}


def __getattr__(name: str):
    if name not in _EXPORTS:
        raise AttributeError(name)
    module_name, attr_name = _EXPORTS[name]
    module = import_module(module_name)
    return getattr(module, attr_name)
