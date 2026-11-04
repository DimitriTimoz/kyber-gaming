#!/usr/bin/env bash
#!/usr/bin/env python3
"""
Dynamic Resolution Resize Service for Headless Cloud Gaming.
Listens on port 8081 for client viewport dimensions and dynamically
adjusts the virtual X11 screen using xrandr.
"""

import os
import sys
import json
import subprocess
import re
import ssl
import shutil
import base64
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

PORT = int(os.environ.get("RESIZER_PORT", "8081"))
DISPLAY = os.environ.get("DISPLAY", ":0")
AUTH_USER = os.environ.get("AUTH_USER", "gamer")
AUTH_PASSWORD = os.environ.get("AUTH_PASSWORD", "kybergaming")

def is_authenticated(client_address, headers, params):
    # Local requests originating from container/host localhost (e.g. Console Hub kiosk) are trusted
    client_ip = client_address[0] if client_address else ""
    if client_ip in ("127.0.0.1", "::1", "localhost", "testclient"):
        return True

    auth_header = headers.get("Authorization", "")
    if auth_header.startswith("Basic "):
        try:
            decoded = base64.b64decode(auth_header[6:]).decode("utf-8")
            if ":" in decoded:
                u, p = decoded.split(":", 1)
                if u == AUTH_USER and p == AUTH_PASSWORD:
                    return True
        except Exception:
            pass

    u = params.get("auth_user", [None])[0]
    p = params.get("auth_pass", [None])[0]
    if u == AUTH_USER and p == AUTH_PASSWORD:
        return True

    return False


def run_cmd(cmd):
    try:
        res = subprocess.run(
            cmd,
            shell=True,
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            env=dict(os.environ, DISPLAY=DISPLAY)
        )
        return res.stdout.strip()
    except subprocess.CalledProcessError as e:
        print(f"[resizer] Command failed: {cmd}\nError: {e.stderr.strip()}", file=sys.stderr)
        return None

def get_system_info():
    """Dynamically query GPU and screen state without hardcoded values."""
    gpu_name = "GPU Accéléré"
    # 1. Try nvidia-smi
    try:
        res = subprocess.run(
            ["nvidia-smi", "--query-gpu=name", "--format=csv,noheader"],
            capture_output=True, text=True, timeout=1
        )
        if res.returncode == 0 and res.stdout.strip():
            raw = res.stdout.splitlines()[0].strip()
            # Clean "NVIDIA GeForce RTX 4060" -> "RTX 4060" or keep clean
            gpu_name = re.sub(r"^NVIDIA\s+(GeForce\s+)?", "", raw)
    except Exception:
        pass

    # 2. Fallback to lspci if nvidia-smi failed (e.g. AMD, Intel, or virtual GPU)
    if gpu_name == "GPU Accéléré":
        lspci = run_cmd("lspci | grep -iE 'vga|3d|display'") or ""
        if lspci:
            gpu_name = lspci.split(":")[-1].strip()[:24]

    # Current screen resolution
    xrandr_out = run_cmd("xrandr --current") or ""
    current_res = "1080p 60Hz"
    for line in xrandr_out.splitlines():
        if "*" in line:
            parts = line.split()
            if len(parts) >= 2:
                res = parts[0]
                rate = parts[1].replace("*", "").replace("+", "")
                try:
                    current_res = f"{res} {round(float(rate))}Hz"
                except Exception:
                    current_res = f"{res}"
            break

    hostname = os.uname().nodename if hasattr(os, "uname") else "Kyber"

    return {
        "gpu": gpu_name,
        "resolution": current_res,
        "hostname": hostname
    }

def get_launchers_config():
    """Read dynamic launchers & emulators registry and check availability."""
    paths = [
        "/etc/kyber/launchers.json",
        "/opt/kyber/hub/launchers.json",
        "config/launchers.json",
        "hub/launchers.json"
    ]
    config = None
    for p in paths:
        if os.path.exists(p):
            try:
                with open(p, "r", encoding="utf-8") as f:
                    config = json.load(f)
                    break
            except Exception as e:
                print(f"[resizer] Error reading {p}: {e}", file=sys.stderr)

    if not config:
        config = {"categories": [{"id": "all", "name": "Tous"}], "items": []}

    # Annotate items with installed status based on container PATH
    for item in config.get("items", []):
        cmd = item.get("command", "")
        cmd_bin = cmd.split()[0] if cmd else ""
        if cmd_bin in ["desktop", "menu", "restart-steam"]:
            item["installed"] = True
        else:
            item["installed"] = shutil.which(cmd_bin) is not None

    return config

def get_active_output():
    out = run_cmd("xrandr --current")
    if not out:
        return "default"
    for line in out.splitlines():
        if " connected" in line or line.startswith("default connected") or (line.split() and line.split()[1] == "connected"):
            return line.split()[0]
    # Fallback to first word of first line matching 'connected'
    for line in out.splitlines():
        parts = line.split()
        if len(parts) >= 2 and parts[1] == "connected":
            return parts[0]
    return "default"

def get_cvt_modeline(width, height, rate=60):
    """Obtain VESA CVT modeline via cvt tool or pure python fallback."""
    out = run_cmd(f"cvt {width} {height} {rate}")
    if out:
        for line in out.splitlines():
            if line.startswith("Modeline"):
                parts = line.split()[1:]
                mode_name = parts[0].strip('"')
                mode_params = " ".join(parts[1:])
                return mode_name, mode_params

    # Fallback approximation if cvt is not installed
    # Standard GTF timing approximation
    pixel_clock = round((width * height * rate * 1.35) / 1000000, 2)
    h_sync_start = width + 88
    h_sync_end = h_sync_start + 44
    h_total = h_sync_end + 148
    v_sync_start = height + 4
    v_sync_end = v_sync_start + 5
    v_total = v_sync_end + 36
    mode_name = f"{width}x{height}_{rate}.00"
    mode_params = f"{pixel_clock} {width} {h_sync_start} {h_sync_end} {h_total} {height} {v_sync_start} {v_sync_end} {v_total} -hsync +vsync"
    return mode_name, mode_params

def set_resolution(width, height, rate=60):
    # Enforce even dimensions (essential for H264/HEVC/AV1 encoders)
    width = (int(width) // 2) * 2
    height = (int(height) // 2) * 2
    rate = int(rate)

    # Clamp bounds
    width = max(640, min(width, 3840))
    height = max(480, min(height, 2160))
    rate = max(30, min(rate, 144))

    output = get_active_output()
    print(f"[resizer] Request to change resolution: {width}x{height}@{rate}Hz on output '{output}'")

    mode_name, mode_params = get_cvt_modeline(width, height, rate)

    # Check if mode already registered in xrandr
    xrandr_out = run_cmd("xrandr --current") or ""
    if mode_name not in xrandr_out:
        print(f"[resizer] Adding new mode: {mode_name} with params: {mode_params}")
        run_cmd(f'xrandr --newmode "{mode_name}" {mode_params}')
        run_cmd(f'xrandr --addmode {output} "{mode_name}"')

    # Apply the mode
    print(f"[resizer] Applying mode {mode_name} to {output}...")
    applied = run_cmd(f'xrandr --output {output} --mode "{mode_name}"')
    if applied is None:
        # Fallback to simple -s if output-based switch failed
        run_cmd(f'xrandr -s {width}x{height} -r {rate}')

    return {"status": "ok", "width": width, "height": height, "rate": rate, "output": output, "mode": mode_name}

class ResizeHandler(BaseHTTPRequestHandler):
    def _send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _send_json_response(self, data, code=200):
        body = json.dumps(data).encode("utf-8")
        self.send_response(code)
        self._send_cors_headers()
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_text_response(self, text, code=200):
        body = text.encode("utf-8")
        self.send_response(code)
        self._send_cors_headers()
        self.send_header("Content-Type", "text/plain")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(200)
        self._send_cors_headers()
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)

        # Authentication endpoint
        if parsed.path == "/api/auth/verify":
            if is_authenticated(self.client_address, self.headers, params):
                self._send_json_response({"authenticated": True, "user": AUTH_USER})
            else:
                self._send_json_response({"authenticated": False, "error": "Identifiants invalides"}, code=401)
            return

        # Protect sensitive execution endpoints
        if parsed.path in ["/api/resize", "/api/launcher"]:
            if not is_authenticated(self.client_address, self.headers, params):
                self._send_json_response({"error": "Unauthorized", "authenticated": False}, code=401)
                return

        if parsed.path == "/api/resize":
            width = int(params.get("width", ["1920"])[0])
            height = int(params.get("height", ["1080"])[0])
            rate = int(params.get("rate", ["60"])[0])
            result = set_resolution(width, height, rate)
            self._send_json_response(result)
        elif parsed.path == "/api/launcher":
            app = params.get("app", ["menu"])[0]
            app = re.sub(r"[^a-zA-Z0-9_\-]", "", app)
            if not app:
                app = "menu"
            subprocess.Popen(["/usr/local/bin/switch_launcher.sh", app])
            self._send_json_response({"status": "ok", "app": app})
        elif parsed.path == "/api/status":
            current_xrandr = run_cmd("xrandr --current") or "Unavailable"
            self._send_text_response(current_xrandr)
        elif parsed.path == "/api/system":
            self._send_json_response(get_system_info())
        elif parsed.path == "/api/launchers":
            self._send_json_response(get_launchers_config())
        elif parsed.path == "/api/launcher/status":
            steam_running = subprocess.run("pgrep -u gamer -f 'ubuntu12_32/steam' >/dev/null 2>&1", shell=True).returncode == 0
            heroic_running = subprocess.run("pgrep -u gamer -f 'heroic' >/dev/null 2>&1", shell=True).returncode == 0
            menu_running = subprocess.run("pgrep -u gamer -f 'kyber-hub-profile|kyber_console_hub' >/dev/null 2>&1", shell=True).returncode == 0
            browser_running = subprocess.run("pgrep -u gamer -f 'chrome' | while read p; do tr '\\0' ' ' < /proc/$p/cmdline 2>/dev/null | grep -v 'kyber-hub-profile' | grep -q 'chrome' && exit 0; done; exit 1", shell=True).returncode == 0
            self._send_json_response({
                "steam": steam_running,
                "heroic": heroic_running,
                "menu": menu_running,
                "browser": browser_running
            })
        elif parsed.path == "/" or parsed.path == "/hub" or parsed.path.startswith("/hub/"):
            hub_dir = "/opt/kyber/hub"
            rel_path = parsed.path[len("/hub"):].lstrip("/") if parsed.path.startswith("/hub") else ""
            if not rel_path or rel_path.endswith("/"):
                rel_path = "index.html"
            file_path = os.path.normpath(os.path.join(hub_dir, rel_path))
            if os.path.exists(file_path) and os.path.isfile(file_path):
                ext = os.path.splitext(file_path)[1].lower()
                mime_types = {
                    ".html": "text/html; charset=utf-8",
                    ".css": "text/css; charset=utf-8",
                    ".js": "application/javascript; charset=utf-8",
                    ".png": "image/png",
                    ".svg": "image/svg+xml",
                    ".jpg": "image/jpeg",
                    ".woff2": "font/woff2",
                }
                content_type = mime_types.get(ext, "application/octet-stream")
                with open(file_path, "rb") as f:
                    content = f.read()
                self.send_response(200)
                self._send_cors_headers()
                self.send_header("Content-Type", content_type)
                self.send_header("Content-Length", str(len(content)))
                self.end_headers()
                self.wfile.write(content)
            else:
                self.send_response(404)
                self._send_cors_headers()
                self.end_headers()
        else:
            self.send_response(404)
            self._send_cors_headers()
            self.end_headers()

    def do_POST(self):
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)

        if parsed.path in ["/api/resize", "/api/launcher"]:
            if not is_authenticated(self.client_address, self.headers, params):
                self._send_json_response({"error": "Unauthorized", "authenticated": False}, code=401)
                return

        if parsed.path == "/api/resize":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)
            try:
                data = json.loads(body.decode("utf-8"))
            except Exception:
                data = {}

            width = data.get("width", 1920)
            height = data.get("height", 1080)
            rate = data.get("rate", 60)
            result = set_resolution(width, height, rate)
            self._send_json_response(result)
        elif parsed.path == "/api/launcher":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length) if content_length > 0 else b"{}"
            try:
                data = json.loads(body.decode("utf-8"))
            except Exception:
                data = {}
            app = data.get("app", "menu")
            app = re.sub(r"[^a-zA-Z0-9_\-]", "", app)
            if not app:
                app = "menu"
            subprocess.Popen(["/usr/local/bin/switch_launcher.sh", app])
            self._send_json_response({"status": "ok", "app": app})
        else:
            self.send_response(404)
            self._send_cors_headers()
            self.end_headers()

    def log_message(self, format, *args):
        # Concise logging
        print(f"[resizer-http] {args[0]} {args[1]} -> {args[2]}")

def main():
    print(f"[resizer] Starting Dynamic Display Resizer Service on port {PORT} for display {DISPLAY}...")
    server = HTTPServer(("0.0.0.0", PORT), ResizeHandler)
    tls_cert = os.environ.get("TLS_CERT", "/etc/kyber/tls/cert.pem")
    tls_key = os.environ.get("TLS_KEY", "/etc/kyber/tls/key.pem")
    if os.path.exists(tls_cert) and os.path.exists(tls_key):
        try:
            ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
            ctx.load_cert_chain(certfile=tls_cert, keyfile=tls_key)
            server.socket = ctx.wrap_socket(server.socket, server_side=True)
            print(f"[resizer] TLS enabled using {tls_cert}")
        except Exception as e:
            print(f"[resizer] Warning: Could not initialize TLS ({e}), falling back to HTTP.")
    server.serve_forever()

if __name__ == "__main__":
    main()
