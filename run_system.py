"""
FlowForce - Smart City Traffic Intelligence Platform
Quick Launcher & Runner Script
"""

import os
import sys
import subprocess
import time
import webbrowser

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
VENV_PYTHON = os.path.join(BASE_DIR, ".venv", "Scripts", "python.exe") if os.name == "nt" else os.path.join(BASE_DIR, ".venv", "bin", "python")


def main():
    print("=" * 70)
    print("FLOWFORCE - AI INTELLIGENT TRAFFIC MANAGEMENT PLATFORM")
    print("=" * 70)
    print("Starting backend FastAPI and frontend Vite servers...\n")

    env = os.environ.copy()
    env["PYTHONPATH"] = BASE_DIR

    backend_cmd = [VENV_PYTHON, "-m", "uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
    frontend_cmd = ["npm", "run", "dev"] if os.name != "nt" else ["cmd", "/c", "npm", "run", "dev"]

    print("[1/2] Launching Backend on http://localhost:8000 ...")
    backend_proc = subprocess.Popen(backend_cmd, cwd=BASE_DIR, env=env)

    print("[2/2] Launching Frontend on http://localhost:5173 ...")
    frontend_proc = subprocess.Popen(frontend_cmd, cwd=os.path.join(BASE_DIR, "frontend"))

    print("\n[+] System active!")
    print("Web Command Center: http://localhost:5173")
    print("Swagger API Docs:   http://localhost:8000/api/docs")
    print("\nPress Ctrl+C to stop both servers.")

    try:
        while True:
            time.sleep(0.5)
    except KeyboardInterrupt:
        print("\nStopping services...")
        try:
            if os.name == "nt":
                subprocess.call(["taskkill", "/F", "/T", "/PID", str(backend_proc.pid)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                subprocess.call(["taskkill", "/F", "/T", "/PID", str(frontend_proc.pid)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            else:
                backend_proc.terminate()
                frontend_proc.terminate()
        except Exception:
            pass
        print("Shutdown complete.")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        pass
