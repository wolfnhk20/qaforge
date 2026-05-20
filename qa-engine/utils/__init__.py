"""Public utility exports with lazy imports."""

from importlib import import_module

__all__ = ["safe_model_invoke", "trace"]

_EXPORTS = {
    "safe_model_invoke": ("utils.llm_helpers", "safe_model_invoke"),
    "trace": ("utils.trace", "trace"),
}


def __getattr__(name: str):
    if name not in _EXPORTS:
        raise AttributeError(name)
    module_name, attr_name = _EXPORTS[name]
    module = import_module(module_name)
    return getattr(module, attr_name)
