"""In-memory SSE broadcaster: fan-out events to connected staff/customer browsers.

Design notes:
- Single-process pub/sub (adequate for 1-25 tables on one FastAPI instance).
- Each connection gets its own asyncio.Queue; publishers never block on slow
  consumers because we drop queues of disconnected clients on cleanup.
- Events are tenant-scoped: a subscriber only receives events for its tenant.
"""
import asyncio
import json
import uuid
from dataclasses import dataclass, field


@dataclass
class Subscriber:
    id: uuid.UUID
    tenant_id: uuid.UUID
    queue: asyncio.Queue = field(default_factory=asyncio.Queue)


class SSEBroadcaster:
    def __init__(self) -> None:
        self._subscribers: dict[uuid.UUID, Subscriber] = {}

    def subscribe(self, tenant_id: uuid.UUID) -> Subscriber:
        sub = Subscriber(id=uuid.uuid4(), tenant_id=tenant_id)
        self._subscribers[sub.id] = sub
        return sub

    def unsubscribe(self, sub: Subscriber) -> None:
        self._subscribers.pop(sub.id, None)

    def broadcast(self, tenant_id: uuid.UUID, event: str, data: dict) -> None:
        """Send an event to every subscriber of this tenant. Never blocks."""
        payload = json.dumps(data, default=str)
        for sub in list(self._subscribers.values()):
            if sub.tenant_id != tenant_id:
                continue
            try:
                sub.queue.put_nowait((event, payload))
            except asyncio.QueueFull:
                # Slow consumer: drop this event rather than stall the server.
                pass


# Single shared instance for the whole app process
broadcaster = SSEBroadcaster()
