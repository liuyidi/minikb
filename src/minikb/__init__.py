"""minikb — knowledge base platform for agents."""

from __future__ import annotations

__version__ = "0.1.0"


def main() -> None:
    """Console entry point declared in pyproject.toml."""

    # 通过 main 模块启动 uvicorn，避免顶层 import fastapi 影响 --help 之类的场景
    from minikb.main import main as _main

    _main()
