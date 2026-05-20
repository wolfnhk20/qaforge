"""Public agent entrypoints with lazy imports."""

from importlib import import_module

__all__ = [
    "run_code_analyst",
    "run_intent_extractor",
    "run_probe",
    "run_all_probes_parallel",
    "run_probe_designer",
    "run_probes_sync",
    "run_report_synthesizer",
    "show_probe_selection",
]

_EXPORTS = {
    "run_code_analyst": ("agents.code_analyst", "run_code_analyst"),
    "run_intent_extractor": ("agents.intent_extractor", "run_intent_extractor"),
    "run_probe": ("agents.probe_executor", "run_probe"),
    "run_all_probes_parallel": ("agents.probe_executor", "run_all_probes_parallel"),
    "run_probe_designer": ("agents.probe_designer", "run_probe_designer"),
    "run_probes_sync": ("agents.probe_executor", "run_probes_sync"),
    "run_report_synthesizer": ("agents.report_synthesizer", "run_report_synthesizer"),
    "show_probe_selection": ("agents.probe_designer", "show_probe_selection"),
}


def __getattr__(name: str):
    if name not in _EXPORTS:
        raise AttributeError(name)
    module_name, attr_name = _EXPORTS[name]
    module = import_module(module_name)
    return getattr(module, attr_name)
