"""URL connector - fetch documents from web URLs."""
from __future__ import annotations

import hashlib
import logging
import re
from typing import Any, AsyncIterator
from urllib.parse import urlparse

import httpx

from minikb.connectors.base import Connector, SourceRecord

logger = logging.getLogger(__name__)


class URLConnector(Connector):
    """Fetch documents from web URLs.

    Config:
        urls: list[str] | str  - URL(s) to fetch
        headers: dict[str, str]  - Optional HTTP headers
        respect_robots: bool  - Whether to check robots.txt (default: true)
        timeout: int  - Request timeout in seconds (default: 30)
        extract_content: bool  - Strip HTML tags (default: true)
    """

    kind = "url"

    async def fetch(
        self,
        config: dict[str, Any],
        state: dict[str, Any] | None = None,
    ) -> AsyncIterator[SourceRecord]:
        urls = config.get("urls", [])
        if isinstance(urls, str):
            urls = [urls]

        if not urls:
            return

        headers = config.get("headers", {})
        respect_robots = config.get("respect_robots", True)
        timeout = config.get("timeout", 30)
        extract_content = config.get("extract_content", True)

        async with httpx.AsyncClient(
            timeout=timeout,
            follow_redirects=True,
            headers={"User-Agent": "minikb-bot/1.0"},
        ) as client:
            for url in urls:
                try:
                    # Check robots.txt if enabled
                    if respect_robots:
                        allowed = await self._check_robots(client, url)
                        if not allowed:
                            logger.warning("URL blocked by robots.txt: %s", url)
                            continue

                    response = await client.get(url, headers=headers)
                    response.raise_for_status()

                    content = response.content
                    content_type = response.headers.get("content-type", "text/html")

                    # Extract text from HTML if needed
                    if extract_content and "html" in content_type:
                        text = self._extract_text(content.decode("utf-8", errors="replace"))
                        content = text.encode("utf-8")
                        content_type = "text/plain"

                    # Determine title from URL or content
                    title = self._extract_title(url, content, content_type)

                    yield SourceRecord(
                        title=title,
                        content=content,
                        uri=url,
                        mime=content_type.split(";")[0].strip(),
                        meta={
                            "source": "url",
                            "url": url,
                            "status_code": response.status_code,
                            "content_length": len(response.content),
                        },
                        external_id=hashlib.sha256(url.encode()).hexdigest()[:16],
                    )

                except httpx.HTTPStatusError as e:
                    logger.error("HTTP error fetching %s: %s", url, e)
                except httpx.RequestError as e:
                    logger.error("Request error fetching %s: %s", url, e)
                except Exception as e:
                    logger.error("Error fetching %s: %s", url, e)

    async def _check_robots(self, client: httpx.AsyncClient, url: str) -> bool:
        """Check if the URL is allowed by robots.txt."""
        try:
            parsed = urlparse(url)
            robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
            resp = await client.get(robots_url)
            if resp.status_code != 200:
                return True  # No robots.txt = allowed

            content = resp.text
            # Simple robots.txt parsing
            is_our_agent = False
            for line in content.splitlines():
                line = line.strip()
                if line.lower().startswith("user-agent:"):
                    agent = line.split(":", 1)[1].strip()
                    is_our_agent = agent == "*" or "minikb" in agent.lower()
                elif line.lower().startswith("disallow:") and is_our_agent:
                    path = line.split(":", 1)[1].strip()
                    if path and url.startswith(f"{parsed.scheme}://{parsed.netloc}{path}"):
                        return False
            return True
        except Exception:
            return True  # On error, allow

    def _extract_text(self, html: str) -> str:
        """Extract text from HTML, stripping tags."""
        # Remove script and style blocks
        text = re.sub(r"<(script|style)[^>]*>.*?</\1>", "", html, flags=re.DOTALL | re.IGNORECASE)
        # Replace block elements with newlines
        text = re.sub(r"<(br|p|div|h[1-6]|li|tr)[^>]*>", "\n", text, flags=re.IGNORECASE)
        # Strip remaining tags
        text = re.sub(r"<[^>]+>", "", text)
        # Decode HTML entities
        import html as html_module
        text = html_module.unescape(text)
        # Collapse whitespace
        text = re.sub(r"\n{3,}", "\n\n", text)
        return text.strip()

    def _extract_title(self, url: str, content: bytes, content_type: str) -> str:
        """Extract a title from the URL or content."""
        # Try HTML title tag
        if b"<title" in content[:500].lower():
            match = re.search(rb"<title[^>]*>([^<]+)</title>", content[:2000], re.IGNORECASE)
            if match:
                return match.group(1).decode("utf-8", errors="replace").strip()

        # Fall back to URL path
        parsed = urlparse(url)
        path = parsed.path.strip("/")
        if path:
            return path.rsplit("/", 1)[-1] or parsed.netloc
        return parsed.netloc

    def validate_config(self, config: dict[str, Any]) -> tuple[bool, str | None]:
        urls = config.get("urls")
        if not urls:
            return False, "urls is required"
        if isinstance(urls, str):
            urls = [urls]
        if not isinstance(urls, list):
            return False, "urls must be a string or list of strings"
        for url in urls:
            if not isinstance(url, str) or not url.startswith(("http://", "https://")):
                return False, f"Invalid URL: {url}"
        return True, None
