"""Async helper for running coroutines in Celery prefork workers."""

import asyncio
import threading

# One event loop per thread (worker process), never closed
_thread_local = threading.local()


def run_async(coro):
    """Run an async coroutine safely in a Celery worker process."""
    loop = getattr(_thread_local, "loop", None)
    if loop is None or loop.is_closed():
        loop = asyncio.new_event_loop()
        _thread_local.loop = loop
    return loop.run_until_complete(coro)
