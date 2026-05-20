"""Entry point for the Functional Contract Auditor."""

import argparse
import asyncio
import os
from pathlib import Path
import subprocess
import sys

import config
from utils.trace import trace

PROJECT_ROOT = Path(__file__).resolve().parent
MIN_RUNTIME_VERSION = (3, 11)


def _ensure_supported_python() -> None:
    """Re-run under the local venv interpreter when the active Python is too old."""
    if sys.version_info >= MIN_RUNTIME_VERSION:
        return

    if os.environ.get("QA_ENGINE_BOOTSTRAPPED") == "1":
        return

    venv_python = PROJECT_ROOT / "venv" / "Scripts" / "python.exe"
    if not venv_python.exists():
        return

    env = os.environ.copy()
    env["QA_ENGINE_BOOTSTRAPPED"] = "1"
    result = subprocess.run(
        [str(venv_python), str(PROJECT_ROOT / "main.py"), *sys.argv[1:]],
        cwd=str(PROJECT_ROOT),
        env=env,
    )
    raise SystemExit(result.returncode)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Functional Contract Auditor - one command, one filed report."
    )
    parser.add_argument("--repo", required=True, help="GitHub repo (org/repo)")
    parser.add_argument("--module", required=True, help="Module path in repo")
    parser.add_argument(
        "--scope",
        default="full_module",
        choices=["full_module", "pr", "commit_range"],
        help="Audit scope",
    )
    parser.add_argument("--pr", type=int, default=None, help="PR number (if scope=pr)")
    parser.add_argument("--from-commit", dest="base_commit", default=None, help="Base commit SHA")
    parser.add_argument("--to-commit", dest="head_commit", default=None, help="Head commit SHA")
    parser.add_argument("--branch", default=config.DEFAULT_BRANCH, help="Git branch")
    parser.add_argument(
        "--auto",
        action="store_true",
        help="Run all probes automatically without interactive selection.",
    )
    return parser.parse_args()


def count_gaps(probe_results: dict) -> int:
    return sum(len(r.get("gaps", [])) for r in probe_results.values())


async def main() -> None:
    args = parse_args()
    config.ensure_runtime_dirs()
    module_path = config.normalize_module_path(args.module)

    print("\n" + "=" * 60)
    print("  FUNCTIONAL CONTRACT AUDITOR")
    print(f"  Repo   : {args.repo}")
    print(f"  Module : {args.module}")
    print(f"  Scope  : {args.scope}")
    print("=" * 60 + "\n")

    trace("MAIN", "Initializing pipeline...")

    from graph.pipeline import build_pipeline

    pipeline = build_pipeline()
    initial_state = {
        "repo": args.repo,
        "module_path": module_path,
        "scope": args.scope,
        "pr_number": args.pr,
        "base_commit": args.base_commit,
        "head_commit": args.head_commit,
        "branch": args.branch,
        "auto_run": args.auto,
        "probe_results": {},
        "errors": [],
    }

    final_state = await pipeline.ainvoke(initial_state)

    probe_results = final_state.get("probe_results", {})
    gaps = count_gaps(probe_results)
    errors = final_state.get("errors", [])
    report_path = final_state.get(
        "report_path",
        config.to_project_relative(config.OUTPUTS_DIR / "audit_report.md"),
    )
    issue_urls = final_state.get("github_issue_urls", [])

    print("\n" + "=" * 60)
    print("  AUDIT COMPLETE")
    print(f"  Gaps found : {gaps}")
    print(f"  Report     : {report_path}")
    if issue_urls:
        print(f"  GitHub     : {', '.join(issue_urls)}")
    if errors:
        print(f"  Errors     : {len(errors)} (check trace log)")
        for err in errors:
            print(f"    - {err}", file=sys.stderr)
    print("=" * 60 + "\n")


if __name__ == "__main__":
    _ensure_supported_python()
    asyncio.run(main())
