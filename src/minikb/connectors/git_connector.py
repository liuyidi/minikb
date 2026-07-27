"""Git connector - fetch documents from git repositories."""
from __future__ import annotations

import asyncio
import hashlib
import logging
import os
import tempfile
from fnmatch import fnmatch
from pathlib import Path
from typing import Any, AsyncIterator

from minikb.connectors.base import Connector, SourceRecord

logger = logging.getLogger(__name__)

# MIME type mapping for code files
CODE_MIME_MAP = {
    ".py": "text/x-python",
    ".js": "text/javascript",
    ".ts": "text/typescript",
    ".tsx": "text/typescript",
    ".jsx": "text/javascript",
    ".java": "text/x-java",
    ".go": "text/x-go",
    ".rs": "text/x-rust",
    ".rb": "text/x-ruby",
    ".c": "text/x-c",
    ".cpp": "text/x-c++",
    ".h": "text/x-c",
    ".hpp": "text/x-c++",
    ".cs": "text/x-csharp",
    ".scala": "text/x-scala",
    ".swift": "text/x-swift",
    ".kt": "text/x-kotlin",
    ".sh": "text/x-shellscript",
    ".bash": "text/x-shellscript",
    ".sql": "text/x-sql",
    ".md": "text/markdown",
    ".rst": "text/plain",
    ".txt": "text/plain",
    ".json": "application/json",
    ".yaml": "text/yaml",
    ".yml": "text/yaml",
    ".toml": "text/toml",
    ".xml": "text/xml",
    ".html": "text/html",
    ".css": "text/css",
    ".vue": "text/html",
    ".svelte": "text/html",
}

# Default file patterns to exclude
DEFAULT_EXCLUDE = {
    ".git", ".svn", ".hg",
    "node_modules", "__pycache__", ".venv", "venv", ".tox",
    ".mypy_cache", ".pytest_cache", ".ruff_cache",
    "dist", "build", ".next", ".nuxt",
    "*.pyc", "*.pyo", "*.class", "*.o", "*.so", "*.dylib",
    "*.exe", "*.dll", "*.bin",
}

# Default file patterns to include
DEFAULT_INCLUDE = {
    "*.py", "*.js", "*.ts", "*.tsx", "*.jsx",
    "*.java", "*.go", "*.rs", "*.rb", "*.c", "*.cpp", "*.h", "*.hpp",
    "*.cs", "*.scala", "*.swift", "*.kt",
    "*.sh", "*.bash", "*.sql",
    "*.md", "*.rst", "*.txt",
    "*.json", "*.yaml", "*.yml", "*.toml", "*.xml",
    "*.html", "*.css", "*.vue", "*.svelte",
    "Makefile", "Dockerfile", "README*", "LICENSE*",
}


class GitConnector(Connector):
    """Fetch documents from git repositories.

    Config:
        repo_url: str  - Git repository URL
        branch: str  - Branch to clone (default: main/master)
        path_globs: list[str]  - Glob patterns to include files (default: all code files)
        exclude_globs: list[str]  - Glob patterns to exclude
        depth: int  - Clone depth (default: 1 for shallow clone)
        language_hints: list[str]  - Only include files of these languages
    """

    kind = "git"

    async def fetch(
        self,
        config: dict[str, Any],
        state: dict[str, Any] | None = None,
    ) -> AsyncIterator[SourceRecord]:
        repo_url = config.get("repo_url", "")
        branch = config.get("branch", "")
        path_globs = config.get("path_globs", list(DEFAULT_INCLUDE))
        exclude_globs = config.get("exclude_globs", list(DEFAULT_EXCLUDE))
        depth = config.get("depth", 1)
        language_hints = config.get("language_hints", [])

        if not repo_url:
            return

        # Clone to temp directory
        with tempfile.TemporaryDirectory(prefix="minikb-git-") as tmpdir:
            try:
                # Clone the repo
                clone_cmd = ["git", "clone", "--depth", str(depth)]
                if branch:
                    clone_cmd.extend(["--branch", branch])
                clone_cmd.extend([repo_url, tmpdir])

                proc = await asyncio.create_subprocess_exec(
                    *clone_cmd,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )
                stdout, stderr = await proc.communicate()

                if proc.returncode != 0:
                    logger.error("Git clone failed: %s", stderr.decode())
                    return

                # Get current commit SHA
                proc = await asyncio.create_subprocess_exec(
                    "git", "-C", tmpdir, "rev-parse", "HEAD",
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )
                stdout, _ = await proc.communicate()
                current_sha = stdout.decode().strip()

                # Check if we already synced this commit
                prev_sha = (state or {}).get("commit_sha")
                if prev_sha == current_sha:
                    logger.info("No new commits since last sync (%s)", current_sha[:8])
                    return

                # Walk files
                repo_path = Path(tmpdir)
                file_count = 0

                for file_path in repo_path.rglob("*"):
                    if not file_path.is_file():
                        continue

                    rel_path = file_path.relative_to(repo_path)
                    rel_str = str(rel_path)

                    # Check exclusions
                    if self._should_exclude(rel_str, exclude_globs):
                        continue

                    # Check inclusions
                    if not self._should_include(rel_str, path_globs, language_hints):
                        continue

                    try:
                        content = file_path.read_bytes()
                        ext = file_path.suffix.lower()
                        mime = CODE_MIME_MAP.get(ext, "text/plain")

                        yield SourceRecord(
                            title=rel_str,
                            content=content,
                            uri=f"{repo_url}/blob/{branch or 'HEAD'}/{rel_str}",
                            mime=mime,
                            meta={
                                "source": "git",
                                "repo_url": repo_url,
                                "branch": branch or "HEAD",
                                "path": rel_str,
                                "extension": ext,
                                "commit_sha": current_sha,
                                "size_bytes": len(content),
                            },
                            external_id=hashlib.sha256(
                                f"{repo_url}:{rel_str}".encode()
                            ).hexdigest()[:16],
                        )
                        file_count += 1

                    except Exception as e:
                        logger.error("Error reading %s: %s", rel_str, e)

                logger.info("Fetched %d files from %s", file_count, repo_url)

            except Exception as e:
                logger.error("Git connector error: %s", e)

    def _should_exclude(self, path: str, patterns: set[str]) -> bool:
        """Check if path matches any exclusion pattern."""
        parts = path.split(os.sep)
        for part in parts:
            if part in patterns:
                return True
        for pattern in patterns:
            if fnmatch(path, pattern) or fnmatch(path, f"*/{pattern}"):
                return True
        return False

    def _should_include(
        self,
        path: str,
        patterns: set[str],
        language_hints: list[str],
    ) -> bool:
        """Check if path matches any inclusion pattern."""
        basename = os.path.basename(path)

        # Check language hints
        if language_hints:
            ext = os.path.splitext(path)[1].lower()
            lang_exts = {
                "python": {".py"},
                "javascript": {".js", ".jsx", ".mjs"},
                "typescript": {".ts", ".tsx"},
                "java": {".java"},
                "go": {".go"},
                "rust": {".rs"},
                "ruby": {".rb"},
                "c": {".c", ".h"},
                "cpp": {".cpp", ".hpp", ".cxx", ".cc"},
                "csharp": {".cs"},
                "scala": {".scala"},
                "swift": {".swift"},
                "kotlin": {".kt", ".kts"},
                "shell": {".sh", ".bash"},
                "sql": {".sql"},
                "markdown": {".md", ".markdown"},
                "yaml": {".yaml", ".yml"},
                "json": {".json"},
                "html": {".html", ".htm"},
                "css": {".css"},
            }
            matched_lang = False
            for lang in language_hints:
                if ext in lang_exts.get(lang.lower(), set()):
                    matched_lang = True
                    break
            if not matched_lang:
                return False

        # Check glob patterns
        for pattern in patterns:
            if fnmatch(basename, pattern) or fnmatch(path, pattern):
                return True
            # Also match directory patterns
            if fnmatch(path, f"*/{pattern}"):
                return True

        return False

    def validate_config(self, config: dict[str, Any]) -> tuple[bool, str | None]:
        repo_url = config.get("repo_url")
        if not repo_url:
            return False, "repo_url is required"
        if not isinstance(repo_url, str):
            return False, "repo_url must be a string"
        if not repo_url.startswith(("http://", "https://", "git@", "ssh://")):
            return False, "repo_url must be a valid git URL"
        return True, None

    async def probe(self, config: dict[str, Any]) -> dict[str, Any]:
        """Check if the repo is accessible."""
        is_valid, error = self.validate_config(config)
        if not is_valid:
            return {"status": "error", "message": error}

        repo_url = config["repo_url"]
        try:
            proc = await asyncio.create_subprocess_exec(
                "git", "ls-remote", "--heads", repo_url,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=10)

            if proc.returncode == 0:
                branches = stdout.decode().strip().split("\n")
                branch_count = len([b for b in branches if b.strip()])
                return {
                    "status": "ok",
                    "message": f"Repository accessible, {branch_count} branches found",
                    "details": {"branch_count": branch_count},
                }
            else:
                return {"status": "error", "message": stderr.decode().strip()[:200]}
        except asyncio.TimeoutError:
            return {"status": "error", "message": "Connection timed out"}
        except Exception as e:
            return {"status": "error", "message": str(e)[:200]}
