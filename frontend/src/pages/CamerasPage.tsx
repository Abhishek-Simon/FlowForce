import React, { useEffect, useState } from 'react';
import { Camera, Plus, Trash2, RefreshCw } from 'lucide-react';
import { api } from '../services/api';

export default function CamerasPage() {
  const [cameras, setCameras] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    id: '',
    name: '',
    location: '',
    source_type: 'VIDEO_FILE',
    source_url: '',
    fps: 25,
    resolution: '1920x1080',
    lat: 12.9716,
    lng: 77.5946,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const fetchCameras = async () => {
    try {
      setCameras(await api.getCameras());
    } catch {} finally {
      setLoading(false);
    }
  };

  const deleteCamera = async (id: string) => {
    if (!confirm(`Delete camera ${id}?`)) return;
    await api.deleteCamera(id).catch(() => {});
    fetchCameras();
  };

  const saveCamera = async () => {
    if (!form.id || !form.name || !form.source_url) {
      setErr('Camera ID, Name and Source URL are required.');
      return;
    }
    setSaving(true);
    setErr('');
    try {
      await api.createCamera({
        ...form,
        status: 'ONLINE',
        last_seen: Date.now() / 1000,
        created_at: Date.now() / 1000,
      });
      setShowAdd(false);
      setForm({
        id: '',
        name: '',
        location: '',
        source_type: 'VIDEO_FILE',
        source_url: '',
        fps: 25,
        resolution: '1920x1080',
        lat: 12.9716,
        lng: 77.5946,
      });
      fetchCameras();
    } catch (e: any) {
      setErr(e.message || 'Failed to create camera');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    fetchCameras();
  }, []);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 max-w-6xl mx-auto font-mono">
      <div className="flex items-center justify-between panel px-3.5 py-2">
        <div>
          <h1 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Camera size={16} className="text-blue-600 dark:text-blue-400" /> SENSOR & CAMERA REGISTRY
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">Municipal node network and video feed bindings</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchCameras} className="btn-secondary text-xs">
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> REFRESH
          </button>
          <button onClick={() => setShowAdd(!showAdd)} className="btn-primary text-xs">
            <Plus size={12} /> ADD SENSOR
          </button>
        </div>
      </div>

      {showAdd && (
        <div className="panel p-4 space-y-3">
          <h3 className="text-slate-900 dark:text-white font-bold text-xs">REGISTER NEW SENSOR / CAMERA</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { key: 'id', label: 'Sensor ID', placeholder: 'CAM-05' },
              { key: 'name', label: 'Junction Name', placeholder: 'West Outer Ring Road' },
              { key: 'location', label: 'Sector Location', placeholder: 'Sector 9' },
              { key: 'source_url', label: 'RTSP / Video Path', placeholder: 'samples/sample_traffic.mp4' },
              { key: 'fps', label: 'Target FPS', placeholder: '25', type: 'number' },
              { key: 'resolution', label: 'Resolution', placeholder: '1920x1080' },
            ].map(({ key, label, placeholder, type }) => (
              <div key={key}>
                <label className="text-slate-600 dark:text-slate-400 text-[10px] font-bold block mb-1 uppercase">
                  {label}
                </label>
                <input
                  type={type || 'text'}
                  value={(form as any)[key]}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      [key]: type === 'number' ? parseFloat(e.target.value) : e.target.value,
                    }))
                  }
                  placeholder={placeholder}
                  className="w-full bg-slate-50 dark:bg-[#080c15] border border-slate-300 dark:border-[#1c273e] text-slate-900 dark:text-white rounded p-2 text-xs outline-none focus:border-blue-500"
                />
              </div>
            ))}
          </div>
          {err && <p className="text-red-600 dark:text-red-400 text-xs">{err}</p>}
          <div className="flex gap-2 pt-1">
            <button onClick={saveCamera} disabled={saving} className="btn-primary text-xs">
              {saving ? 'SAVING...' : 'SAVE SENSOR'}
            </button>
            <button onClick={() => setShowAdd(false)} className="btn-secondary text-xs">
              CANCEL
            </button>
          </div>
        </div>
      )}

      {/* Camera Table */}
      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Sensor ID</th>
                <th>Junction Name</th>
                <th>Location</th>
                <th>Protocol</th>
                <th>Status</th>
                <th>FPS</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {cameras.map((cam) => (
                <tr key={cam.id}>
                  <td className="font-bold text-blue-600 dark:text-blue-400">{cam.id}</td>
                  <td className="font-semibold text-slate-900 dark:text-white">{cam.name}</td>
                  <td>{cam.location}</td>
                  <td>
                    <span className="status-pill-neutral">{cam.source_type}</span>
                  </td>
                  <td>
                    <span className={cam.status === 'ONLINE' ? 'status-pill-green' : 'status-pill-neutral'}>
                      {cam.status}
                    </span>
                  </td>
                  <td>{cam.fps}</td>
                  <td>
                    <button
                      onClick={() => deleteCamera(cam.id)}
                      className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-950 text-red-600 dark:text-red-400"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
