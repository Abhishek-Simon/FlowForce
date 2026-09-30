const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Request failed');
  }
  return res.json();
}

export const api = {
  // Health
  health: () => request('/api/health'),
  systemHealth: () => request('/api/system/health'),
  systemSettings: () => request('/api/system/settings'),

  // Auth
  login: (username: string, password: string) =>
    request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  // Cameras
  getCameras: () => request<any[]>('/api/cameras'),
  createCamera: (data: any) =>
    request('/api/cameras', { method: 'POST', body: JSON.stringify(data) }),
  updateCamera: (id: string, data: any) =>
    request(`/api/cameras/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCamera: (id: string) =>
    request(`/api/cameras/${id}`, { method: 'DELETE' }),
  uploadCameraSource: async (cameraId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${API_BASE}/api/cameras/${cameraId}/upload-source`, {
      method: 'POST',
      body: form,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Upload camera source failed');
    }
    return res.json();
  },

  // Videos
  getVideos: () => request<any[]>('/api/videos'),
  getVideo: (id: string) => request<any>(`/api/videos/${id}`),
  processVideo: (id: string) =>
    request(`/api/videos/${id}/process`, { method: 'POST' }),
  downloadUrl: (id: string) => `${API_BASE}/api/videos/download/${id}`,

  uploadVideo: async (file: File, cameraId: string, onProgress?: (pct: number) => void) => {
    const form = new FormData();
    form.append('file', file);
    form.append('camera_id', cameraId);
    const res = await fetch(`${API_BASE}/api/videos/upload`, {
      method: 'POST',
      body: form,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Upload failed');
    }
    return res.json();
  },

  // Traffic
  getTrafficCurrent: () => request<any[]>('/api/traffic/current'),
  getTrackedVehicles: (cameraId: string = 'CAM-01') =>
    request<any>(`/api/traffic/vehicles?camera_id=${cameraId}`),
  getTrafficAnalytics: (cameraId: string = 'CAM-01') =>
    request<any>(`/api/traffic/analytics?camera_id=${cameraId}`),
  getJunctionTraffic: (junctionId: string = 'JUNCTION-01') =>
    request<any>(`/api/traffic/junction/${junctionId}`),
  getQueueConfig: () => request<any>('/api/traffic/queue-config'),
  updateQueueConfig: (params: Record<string, number>) =>
    request<any>('/api/traffic/queue-config', { method: 'POST', body: JSON.stringify(params) }),
  getPcuConfig: () => request<any>('/api/traffic/pcu-config'),
  updatePcuConfig: (weights: Record<string, number>) =>
    request<any>('/api/traffic/pcu-config', { method: 'POST', body: JSON.stringify(weights) }),
  getTrafficHistory: (cameraId?: string) =>
    request<any[]>(`/api/traffic/history${cameraId ? `?camera_id=${cameraId}` : ''}`),

  // Emergency
  getEmergencyEvents: () => request<any[]>('/api/emergency/events'),
  getActiveEmergency: () => request<any[]>('/api/emergency/active'),
  acknowledgeEmergency: (id: string) =>
    request(`/api/emergency/${id}/acknowledge`, { method: 'POST' }),
  clearEmergency: (id: string) =>
    request(`/api/emergency/${id}/clear`, { method: 'POST' }),

  // Predictions
  getPredictions: () => request<any[]>('/api/predictions'),
  getCameraPrediction: (cameraId: string) =>
    request<any>(`/api/predictions/${cameraId}`),
  getJunctionForecast: (junctionId: string = 'J3') =>
    request<any>(`/api/predictions/junction/${junctionId}`),
  getForecastConfig: () => request<any>('/api/predictions/config'),
  updateForecastConfig: (config: any) =>
    request<any>('/api/predictions/config', { method: 'POST', body: JSON.stringify(config) }),

  // Signals & Network Optimization
  getSignalRecommendations: () => request<any[]>('/api/signals/recommendations'),
  optimizeSignal: (cameraId: string) =>
    request(`/api/signals/optimize/${cameraId}`, { method: 'POST' }),
  optimizeSignals: (trafficState?: any) =>
    request<any>('/api/signals/optimize', {
      method: 'POST',
      body: trafficState ? JSON.stringify(trafficState) : undefined,
    }),
  optimizePredictiveSignals: (payload?: any) =>
    request<any>('/api/signals/predictive-optimize', {
      method: 'POST',
      body: payload ? JSON.stringify(payload) : undefined,
    }),
  getOptimizerConfig: () => request<any>('/api/signals/config'),
  updateOptimizerConfig: (config: any) =>
    request<any>('/api/signals/config', { method: 'POST', body: JSON.stringify(config) }),
  getNetworkTopology: () => request<any>('/api/network/topology'),
  optimizeNetwork: (networkState?: any) =>
    request<any>('/api/network/optimize', {
      method: 'POST',
      body: networkState ? JSON.stringify(networkState) : undefined,
    }),
  getNetworkConfig: () => request<any>('/api/network/config'),
  updateNetworkConfig: (config: any) =>
    request<any>('/api/network/config', { method: 'POST', body: JSON.stringify(config) }),

  // Alerts
  getAlerts: () => request<any[]>('/api/alerts'),
  resolveAlert: (id: string) =>
    request(`/api/alerts/${id}/resolve`, { method: 'POST' }),
  getIncidents: () => request<any[]>('/api/alerts/incidents'),

  // Safety Analytics & Hotspots
  getJunctionRisk: (junctionId: string = 'J1') =>
    request<any>(`/api/safety/risk/${junctionId}`),
  getSafetyHotspots: () => request<any>('/api/safety/hotspots'),
  getSafetyConfig: () => request<any>('/api/safety/config'),
  updateSafetyConfig: (config: any) =>
    request<any>('/api/safety/config', { method: 'POST', body: JSON.stringify(config) }),

  // Nagpur Junctions & CCTV
  getJunctions: (searchQuery?: string) =>
    request<any[]>(`/api/junctions${searchQuery ? `?q=${encodeURIComponent(searchQuery)}` : ''}`),
  getJunctionById: (junctionId: string) =>
    request<any>(`/api/junctions/${junctionId}`),

  // Analytics
  getAnalyticsSummary: () => request<any>('/api/analytics/summary'),
  getHourlyAnalytics: () => request<any>('/api/analytics/hourly'),

  // Corridor Green Wave
  getCorridorStatus: () => request<any>('/api/corridor/status'),
  triggerGreenWave: (sourceCameraId: string = 'CAM-01', targetCameraId: string = 'CAM-02', direction: string = 'Northbound') =>
    request('/api/corridor/ambulance-trigger', {
      method: 'POST',
      body: JSON.stringify({
        source_camera_id: sourceCameraId,
        target_camera_id: targetCameraId,
        vehicle_type: 'Ambulance (EMS-911)',
        direction: direction,
      }),
    }),
  calculatePlatoonProgression: (sourceCameraId: string = 'CAM-01', targetCameraId: string = 'CAM-02') =>
    request('/api/corridor/platoon-progression', {
      method: 'POST',
      body: JSON.stringify({
        source_camera_id: sourceCameraId,
        target_camera_id: targetCameraId,
        platoon_speed_kmh: 35.0,
      }),
    }),
};
