import json
import time
from typing import List
from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self._start_time = time.time()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        data = json.dumps(message)
        to_remove = []
        for connection in self.active_connections:
            try:
                await connection.send_text(data)
            except Exception:
                to_remove.append(connection)

        for conn in to_remove:
            self.disconnect(conn)

    async def broadcast_json(self, message: dict):
        await self.broadcast(message)

    async def broadcast_traffic(self, cameras_data: list):
        """Broadcast live traffic metrics to all connected clients."""
        await self.broadcast({
            "type": "traffic",
            "timestamp": time.time(),
            "data": cameras_data,
        })

    async def broadcast_alert(self, alert: dict):
        """Broadcast a new alert event to all connected clients."""
        await self.broadcast({
            "type": "alert",
            "timestamp": time.time(),
            "data": alert,
        })

    async def broadcast_emergency(self, emergency: dict):
        """Broadcast an emergency preemption event to all connected clients."""
        await self.broadcast({
            "type": "emergency",
            "timestamp": time.time(),
            "data": emergency,
        })

    @property
    def connection_count(self) -> int:
        return len(self.active_connections)

    @property
    def uptime_seconds(self) -> float:
        return time.time() - self._start_time


ws_manager = ConnectionManager()
