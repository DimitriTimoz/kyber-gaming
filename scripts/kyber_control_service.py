#!/usr/bin/env python3
"""
Kyber Gaming Control & Management Service.
Unified control plane daemon for:
- Dynamic screen resolution & refresh rate resizing (xrandr)
- Dynamic launcher and console session switching
- System metrics and hardware telemetry (GPU, RAM, VRAM, Display)
- Hierarchical ROM & emulator storage explorer, chunked uploads, and auto-key mirroring
- Web server for Kyber Console OS Hub and Web Client
"""

import os
import sys
import json
import subprocess
import re
import ssl
import shutil
import base64
import socket
import threading
import time
import stat
import urllib.parse
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

PORT = int(os.environ.get("KYBER_CONTROL_PORT", os.environ.get("RESIZER_PORT", "8081")))
DISCOVERY_PORT = int(os.environ.get("KYBER_DISCOVERY_PORT", "8082"))
DISPLAY = os.environ.get("DISPLAY", ":0")
AUTH_USER = os.environ.get("AUTH_USER", "gamer")
AUTH_PASSWORD = os.environ.get("AUTH_PASSWORD", "kybergaming")
ROMS_BASE_DIR = os.environ.get("ROMS_DIR", "/home/gamer/roms")
BIOS_BASE_DIR = os.environ.get("BIOS_DIR", "/home/gamer/bios")
UPLOAD_TEMP_DIR = os.environ.get("UPLOAD_TEMP_DIR", "/home/gamer/.kyber_uploads")
try:
    os.makedirs(UPLOAD_TEMP_DIR, exist_ok=True)
except Exception:
    pass

def run_discovery_responder():
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
        except Exception:
            pass
        sock.bind(("0.0.0.0", DISCOVERY_PORT))
        print(f"[discovery] Listening for LAN auto-discovery probes on UDP port {DISCOVERY_PORT}...")
        while True:
            try:
                data, addr = sock.recvfrom(2048)
                if not data:
                    continue
                req_text = data.decode("utf-8", errors="ignore").strip()
                if "KYBER_DISCOVER" in req_text or "discover" in req_text.lower():
                    server_name = os.environ.get("SERVER_NAME", f"Kyber Gaming ({os.uname().nodename})")
                    payload = json.dumps({
                        "type": "kyber_server_announce",
                        "name": server_name,
                        "port": int(os.environ.get("KYBER_PORT", "8080")),
                        "control_port": PORT,
                        "version": "1.0.0"
                    }).encode("utf-8")
                    sock.sendto(payload, addr)
            except Exception:
                pass
    except Exception as e:
        print(f"[discovery] Warning: Unable to bind UDP port {DISCOVERY_PORT}: {e}")

def start_discovery_responder():
    t = threading.Thread(target=run_discovery_responder, daemon=True, name="DiscoveryResponder")
    t.start()

ROM_SYSTEMS_DEF = [
    {"id": "switch", "name": "Nintendo Switch & NX2 (Eglantine)", "extensions": [".nsp", ".xci", ".nsz", ".zip"]},
]

def format_bytes(num_bytes):
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if abs(num_bytes) < 1024.0:
            return f"{num_bytes:3.1f} {unit}"
        num_bytes /= 1024.0
    return f"{num_bytes:.1f} PB"

def resolve_safe_storage_path(rel_path=""):
    """
    Safely resolves a relative or absolute storage path against ROMS_BASE_DIR or BIOS_BASE_DIR.
    Prevents directory traversal attacks and correctly handles URL-encoding, leading slashes,
    and absolute paths that are already rooted at ROMS_BASE_DIR or BIOS_BASE_DIR.
    Returns (absolute_path, clean_relative_path) or (None, None) if invalid/unsafe.
    """
    if rel_path is None:
        return None, None

    raw_path = urllib.parse.unquote(str(rel_path).strip())
    raw_path = raw_path.replace("\\", "/")

    roms_base_abs = os.path.abspath(ROMS_BASE_DIR)
    bios_base_abs = os.path.abspath(BIOS_BASE_DIR)

    # Check if raw_path is explicitly an absolute path targeting one of our bases
    if os.path.isabs(raw_path):
        norm_abs = os.path.abspath(raw_path)
        try:
            if os.path.commonpath([bios_base_abs, norm_abs]) == bios_base_abs:
                rel = os.path.relpath(norm_abs, bios_base_abs).replace("\\", "/")
                clean_rel = "bios" if rel == "." else f"bios/{rel}"
                return norm_abs, clean_rel
        except (ValueError, Exception):
            pass

        try:
            if os.path.commonpath([roms_base_abs, norm_abs]) == roms_base_abs:
                rel = os.path.relpath(norm_abs, roms_base_abs).replace("\\", "/")
                clean_rel = "" if rel == "." else rel
                return norm_abs, clean_rel
        except (ValueError, Exception):
            pass

        # Check default system paths if configured
        for def_bios in ["/home/gamer/bios"]:
            if norm_abs == def_bios or norm_abs.startswith(def_bios + "/"):
                sub = norm_abs[len(def_bios):].lstrip("/")
                full = os.path.abspath(os.path.join(bios_base_abs, sub))
                clean_rel = "bios" if not sub else f"bios/{sub}"
                return full, clean_rel

        for def_roms in ["/home/gamer/roms"]:
            if norm_abs == def_roms or norm_abs.startswith(def_roms + "/"):
                sub = norm_abs[len(def_roms):].lstrip("/")
                full = os.path.abspath(os.path.join(roms_base_abs, sub))
                return full, sub

        # Disallow system directories
        if any(norm_abs == p or norm_abs.startswith(p + "/") for p in ["/etc", "/root", "/var", "/usr", "/bin", "/sbin", "/lib", "/dev", "/proc", "/sys"]):
            return None, None

    # Treat leading slashes in relative paths as rooted at storage root
    clean_parts = [p for p in raw_path.split("/") if p and p != "."]

    # Reject any component that consists entirely of dots (e.g. "..", "...", "....")
    for p in clean_parts:
        if all(c == "." for c in p) and len(p) >= 2:
            return None, None

    joined_rel = "/".join(clean_parts)
    norm_rel = os.path.normpath(joined_rel) if joined_rel else ""
    if norm_rel in [".", ""]:
        return roms_base_abs, ""

    # Strip redundant "roms/" prefix if present
    if norm_rel == "roms":
        return roms_base_abs, ""
    if norm_rel.startswith("roms/"):
        norm_rel = norm_rel[5:].lstrip("/")
        if not norm_rel:
            return roms_base_abs, ""

    if norm_rel == "bios":
        return bios_base_abs, "bios"
    if norm_rel.startswith("bios/"):
        sub = norm_rel[5:].lstrip("/")
        full = os.path.abspath(os.path.join(bios_base_abs, sub))
        try:
            if os.path.commonpath([bios_base_abs, full]) != bios_base_abs:
                return None, None
        except (ValueError, Exception):
            return None, None
        return full, f"bios/{sub}"

    full = os.path.abspath(os.path.join(roms_base_abs, norm_rel))
    try:
        if os.path.commonpath([roms_base_abs, full]) != roms_base_abs:
            return None, None
    except (ValueError, Exception):
        return None, None
    return full, norm_rel

def classify_file_type(filename):
    ext = os.path.splitext(filename)[1].lower()
    # ROMs, game disc images, and packages
    if ext in [".nsp", ".xci", ".nsz", ".xcz", ".iso", ".chd", ".cso", ".rvz", ".wbfs", ".gcm", ".cue", ".bin", ".3ds", ".cia", ".nds", ".gba", ".gbc", ".gb", ".sfc", ".smc", ".nes", ".n64", ".z64", ".v64", ".elf", ".dol", ".pbp"]:
        return "rom"
    if ext in [".keys"] or "key" in filename.lower() or ext in [".prod.keys", ".title.keys"]:
        return "key"
    if ext in [".zip", ".7z", ".rar", ".tar", ".gz", ".tgz", ".bz2", ".xz"]:
        return "archive"
    if ext in [".dat", ".img"]:
        return "binary"
    if ext in [".sav", ".srm", ".state"]:
        return "save"
    if ext in [".exe", ".msi", ".sh", ".appimage"]:
        return "executable"
    return "file"

def browse_directory(rel_path=""):
    full_path, clean_rel = resolve_safe_storage_path(rel_path)
    if not full_path or not os.path.exists(full_path):
        return {"error": "Directory not found", "status": "error"}

    if not os.path.isdir(full_path):
        return {"error": "Path is not a directory", "status": "error"}

    parts = [p for p in clean_rel.split("/") if p]
    breadcrumbs = [{"name": "ROMs Root", "path": ""}]
    acc = ""
    for p in parts:
        acc = f"{acc}/{p}".lstrip("/")
        breadcrumbs.append({"name": p, "path": acc})

    parent_path = "/".join(parts[:-1]) if parts else None

    folders = []
    files = []
    total_bytes = 0

    for entry in os.scandir(full_path):
        if entry.name.startswith("."):
            continue
        try:
            stat = entry.stat()
            if entry.is_dir():
                sub_count = 0
                sub_bytes = 0
                try:
                    for sub in os.scandir(entry.path):
                        if not sub.name.startswith("."):
                            sub_count += 1
                            if sub.is_file():
                                sub_bytes += sub.stat().st_size
                except Exception:
                    pass
                folders.append({
                    "name": entry.name,
                    "path": f"{clean_rel}/{entry.name}".lstrip("/"),
                    "item_count": sub_count,
                    "size_formatted": format_bytes(sub_bytes),
                    "modified": int(stat.st_mtime)
                })
            elif entry.is_file():
                total_bytes += stat.st_size
                files.append({
                    "name": entry.name,
                    "path": f"{clean_rel}/{entry.name}".lstrip("/"),
                    "size": stat.st_size,
                    "size_formatted": format_bytes(stat.st_size),
                    "extension": os.path.splitext(entry.name)[1].lower(),
                    "type": classify_file_type(entry.name),
                    "modified": int(stat.st_mtime)
                })
        except Exception:
            pass

    folders.sort(key=lambda x: x["name"].lower())
    files.sort(key=lambda x: x["name"].lower())

    return {
        "status": "ok",
        "current_path": clean_rel,
        "parent_path": parent_path,
        "breadcrumbs": breadcrumbs,
        "folders": folders,
        "files": files,
        "total_folders": len(folders),
        "total_files": len(files),
        "total_size": format_bytes(total_bytes),
        "storage_root": ROMS_BASE_DIR
    }

def create_directory(rel_path, folder_name):
    full_path, clean_rel = resolve_safe_storage_path(rel_path)
    if not full_path or not os.path.exists(full_path):
        return {"error": "Base path not found", "status": "error"}

    raw_name = urllib.parse.unquote(str(folder_name).strip())
    if ".." in raw_name:
        return {"error": "Invalid folder name", "status": "error"}

    safe_folder = re.sub(r'[^\w\-\.\(\)\[\]\s]', '_', raw_name).strip()
    if not safe_folder or safe_folder in [".", ".."] or all(c == "." for c in safe_folder):
        return {"error": "Invalid folder name", "status": "error"}

    target_dir = os.path.join(full_path, safe_folder)
    try:
        os.makedirs(target_dir, exist_ok=True)
        try:
            shutil.chown(target_dir, user="gamer", group="gamer")
        except Exception:
            pass
        created_rel = f"{clean_rel}/{safe_folder}".lstrip("/")
        return {
            "status": "ok",
            "folder_name": safe_folder,
            "path": created_rel,
            "created_path": created_rel
        }
    except Exception as e:
        return {"error": str(e), "status": "error"}

UPLOAD_SESSIONS = {}
UPLOAD_SESSIONS_LOCK = threading.Lock()
UPLOAD_FILE_LOCKS = {}
UPLOAD_FILE_LOCKS_MUTEX = threading.Lock()

def get_upload_file_lock(upload_id):
    with UPLOAD_FILE_LOCKS_MUTEX:
        if upload_id not in UPLOAD_FILE_LOCKS:
            UPLOAD_FILE_LOCKS[upload_id] = threading.Lock()
        return UPLOAD_FILE_LOCKS[upload_id]

def cleanup_stale_upload_sessions(max_age_secs=3600):
    now = time.time()
    stale_ids = []
    with UPLOAD_SESSIONS_LOCK:
        for uid, sess in list(UPLOAD_SESSIONS.items()):
            if now - sess.get("last_active", now) > max_age_secs:
                stale_ids.append(uid)
                UPLOAD_SESSIONS.pop(uid, None)

    with UPLOAD_FILE_LOCKS_MUTEX:
        for uid in stale_ids:
            UPLOAD_FILE_LOCKS.pop(uid, None)

    for uid in stale_ids:
        sdir = os.path.join(UPLOAD_TEMP_DIR, uid)
        if os.path.lexists(sdir):
            try:
                shutil.rmtree(sdir, ignore_errors=True)
            except Exception:
                pass

def cancel_uploaded_session(upload_id):
    upload_id = re.sub(r'[^a-zA-Z0-9_\-]', '', str(upload_id))
    if not upload_id:
        return {"error": "Invalid upload ID", "status": "error"}
    with UPLOAD_SESSIONS_LOCK:
        UPLOAD_SESSIONS.pop(upload_id, None)
    with UPLOAD_FILE_LOCKS_MUTEX:
        UPLOAD_FILE_LOCKS.pop(upload_id, None)

    temp_session_dir = os.path.join(UPLOAD_TEMP_DIR, upload_id)
    if os.path.lexists(temp_session_dir):
        try:
            shutil.rmtree(temp_session_dir, ignore_errors=True)
        except Exception:
            pass
    return {"status": "ok", "message": f"Upload session {upload_id} cancelled"}

def save_uploaded_chunk(upload_id, filename, target_path, chunk_index, total_chunks, total_size, chunk_data, chunk_offset=None):
    upload_id = re.sub(r'[^a-zA-Z0-9_\-]', '', str(upload_id))
    if not upload_id:
        return {"error": "Invalid upload ID", "status": "error"}

    raw_name = urllib.parse.unquote(os.path.basename(str(filename)))
    safe_name = re.sub(r'[^\w\-\.\(\)\[\]\s]', '_', raw_name).strip()
    if not safe_name:
        safe_name = f"upload_{upload_id}.bin"

    temp_session_dir = os.path.join(UPLOAD_TEMP_DIR, upload_id)
    os.makedirs(temp_session_dir, exist_ok=True)
    part_file = os.path.join(temp_session_dir, "data.part")

    if chunk_offset is None or chunk_offset < 0:
        chunk_offset = chunk_index * len(chunk_data)

    file_lock = get_upload_file_lock(upload_id)
    with file_lock:
        if chunk_index == 0 and total_size > 0:
            try:
                statvfs = shutil.disk_usage(temp_session_dir)
                if statvfs.free < (total_size + 50 * 1024 * 1024):
                    return {"error": "Insufficient disk space on server for upload", "status": "error"}
            except Exception:
                pass

        if not os.path.exists(part_file):
            with open(part_file, "wb") as f:
                if chunk_offset > 0:
                    f.truncate(chunk_offset)

        with open(part_file, "r+b") as f:
            f.seek(chunk_offset)
            f.write(chunk_data)

    now = time.time()
    with UPLOAD_SESSIONS_LOCK:
        if upload_id not in UPLOAD_SESSIONS:
            UPLOAD_SESSIONS[upload_id] = {
                "chunks": set(),
                "total_chunks": total_chunks,
                "total_size": total_size,
                "last_active": now
            }
        session = UPLOAD_SESSIONS[upload_id]
        session["chunks"].add(chunk_index)
        session["last_active"] = now
        is_completed = len(session["chunks"]) >= total_chunks

    if is_completed:
        with UPLOAD_SESSIONS_LOCK:
            UPLOAD_SESSIONS.pop(upload_id, None)
        with UPLOAD_FILE_LOCKS_MUTEX:
            UPLOAD_FILE_LOCKS.pop(upload_id, None)

        dest_dir, clean_rel = resolve_safe_storage_path(target_path)
        if not dest_dir:
            dest_dir = os.path.join(ROMS_BASE_DIR, "eglantine/games")
            clean_rel = "eglantine/games"
        os.makedirs(dest_dir, exist_ok=True)

        final_dest = os.path.join(dest_dir, safe_name)

        if os.path.exists(final_dest):
            try:
                os.remove(final_dest)
            except Exception:
                pass

        shutil.move(part_file, final_dest)
        shutil.rmtree(temp_session_dir, ignore_errors=True)

        try:
            shutil.chown(final_dest, user="gamer", group="gamer")
        except Exception:
            pass

        # Auto-mirror keys if loose key file
        if safe_name.endswith(".keys") or "key" in safe_name.lower():
            for kdir in ["/home/gamer/.local/share/eglantine/keys", "/home/gamer/.local/share/eden/keys"]:
                try:
                    os.makedirs(kdir, exist_ok=True)
                    target_kfile = os.path.join(kdir, safe_name)
                    shutil.copy2(final_dest, target_kfile)
                    shutil.chown(target_kfile, user="gamer", group="gamer")
                except Exception:
                    pass

        # Auto-extract archives if in keys, firmware or if file is an archive in emulator paths
        is_archive = classify_file_type(safe_name) == "archive" or safe_name.lower().endswith(".iso")
        auto_extract = (classify_file_type(safe_name) == "archive") and (
            "key" in target_path.lower() or
            "firmware" in target_path.lower() or
            "key" in safe_name.lower() or
            "firmware" in safe_name.lower()
        )
        if auto_extract:
            try:
                dest_rel_archive = f"{clean_rel}/{safe_name}".lstrip("/")
                extract_archive(dest_rel_archive, delete_archive=False)
            except Exception as e:
                print(f"[kyber-control] Auto-extract notice for {safe_name}: {e}", file=sys.stderr)

        file_stat = os.stat(final_dest)
        return {
            "status": "completed",
            "filename": safe_name,
            "path": final_dest,
            "rel_path": f"{clean_rel}/{safe_name}".lstrip("/"),
            "size": file_stat.st_size,
            "size_formatted": format_bytes(file_stat.st_size),
            "is_archive": is_archive
        }

    return {
        "status": "chunk_received",
        "chunk_index": chunk_index,
        "total_chunks": total_chunks
    }

def post_process_extracted_content(search_dir):
    """Auto-detects and installs keys and firmware from extracted archives."""
    keys_dirs = [
        "/home/gamer/.local/share/eglantine/keys",
        "/home/gamer/.local/share/eden/keys",
        "/home/gamer/roms/eglantine/keys"
    ]
    for root, _, files in os.walk(search_dir):
        for f in files:
            lower = f.lower()
            src_file = os.path.join(root, f)
            # Match any keys file (prod.keys, title.keys, *.keys)
            if lower.endswith(".keys") or lower in ["prod.keys", "title.keys"]:
                for kdir in keys_dirs:
                    try:
                        os.makedirs(kdir, exist_ok=True)
                        dest_file = os.path.join(kdir, f)
                        shutil.copy2(src_file, dest_file)
                        shutil.chown(dest_file, user="gamer", group="gamer")
                    except Exception:
                        pass

            # Match any Switch firmware packages (.nca)
            if lower.endswith(".nca"):
                firmware_targets = [
                    "/home/gamer/.local/share/eden/nand/system/Contents/registered",
                    "/home/gamer/roms/eglantine/firmware"
                ]
                for ftarget in firmware_targets:
                    try:
                        os.makedirs(ftarget, exist_ok=True)
                        dest_file = os.path.join(ftarget, f)
                        if not os.path.exists(dest_file) or os.path.getsize(dest_file) != os.path.getsize(src_file):
                            shutil.copy2(src_file, dest_file)
                            shutil.chown(dest_file, user="gamer", group="gamer")
                    except Exception:
                        pass

def extract_archive(rel_path, delete_archive=False):
    """Safely extracts zip, 7z, rar, tar, gz archives into their parent directory and fixes permissions."""
    full_path, clean_rel = resolve_safe_storage_path(rel_path)
    if not full_path or not os.path.exists(full_path):
        return {"error": "Archive file not found", "status": "error"}

    if os.path.isdir(full_path):
        return {"error": "Target is a directory, not an archive file", "status": "error"}

    ext = os.path.splitext(full_path)[1].lower()
    valid_exts = [".zip", ".7z", ".rar", ".tar", ".gz", ".tgz", ".bz2", ".xz", ".iso"]
    if not any(full_path.lower().endswith(e) for e in valid_exts):
        return {"error": f"Unsupported archive format: {ext}", "status": "error"}

    dest_dir = os.path.dirname(full_path)
    archive_name = os.path.basename(full_path)

    try:
        has_7z = shutil.which("7z") or shutil.which("7za")
        has_unzip = shutil.which("unzip")

        if has_7z:
            cmd = [has_7z, "x", "-y", f"-o{dest_dir}", full_path]
            res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=600)
            if res.returncode != 0:
                if ext == ".zip" and has_unzip:
                    subprocess.run(["unzip", "-o", "-d", dest_dir, full_path], check=True, timeout=600)
                else:
                    return {"error": f"7z extraction error: {res.stderr.decode(errors='ignore')[:300]}", "status": "error"}
        elif ext == ".zip":
            if has_unzip:
                subprocess.run(["unzip", "-o", "-d", dest_dir, full_path], check=True, timeout=600)
            else:
                import zipfile
                with zipfile.ZipFile(full_path, "r") as zf:
                    zf.extractall(dest_dir)
        elif ext in [".tar", ".gz", ".tgz", ".bz2", ".xz"]:
            import tarfile
            with tarfile.open(full_path, "r:*") as tf:
                tf.extractall(dest_dir)
        else:
            return {"error": "No decompression utility available on host", "status": "error"}

        # Fix ownership
        subprocess.run(["chown", "-R", "gamer:gamer", dest_dir], check=False)

        # Post-process keys and firmware
        post_process_extracted_content(dest_dir)

        if delete_archive:
            try:
                os.remove(full_path)
            except Exception:
                pass

        return {
            "status": "ok",
            "message": f"Successfully extracted {archive_name}",
            "archive": archive_name,
            "target_dir": clean_rel
        }
    except Exception as e:
        return {"error": f"Extraction failure: {str(e)}", "status": "error"}

def handle_remove_readonly(func, path, exc_info):
    """Clear readonly permissions and retry deletion."""
    try:
        os.chmod(path, stat.S_IWRITE | stat.S_IWUSR)
        func(path)
    except Exception:
        pass

def delete_storage_item(rel_path):
    if rel_path is None or str(rel_path).strip() == "":
        return {"error": "Path parameter is required", "status": "error"}

    full_path, clean_rel = resolve_safe_storage_path(rel_path)
    if not full_path or not os.path.lexists(full_path):
        return {"error": "Item not found", "status": "error"}

    if os.path.abspath(full_path) in [os.path.abspath(ROMS_BASE_DIR), os.path.abspath(BIOS_BASE_DIR)]:
        return {"error": "Cannot delete root directory", "status": "error"}

    try:
        if os.path.islink(full_path):
            os.unlink(full_path)
        elif os.path.isdir(full_path):
            shutil.rmtree(full_path, onerror=handle_remove_readonly)
        else:
            try:
                os.remove(full_path)
            except PermissionError:
                os.chmod(full_path, stat.S_IWRITE | stat.S_IWUSR)
                os.remove(full_path)

            safe_name = os.path.basename(full_path)
            if safe_name.endswith(".keys") or "key" in safe_name.lower():
                for kdir in ["/home/gamer/.local/share/eglantine/keys", "/home/gamer/.local/share/eden/keys"]:
                    kp = os.path.join(kdir, safe_name)
                    if os.path.lexists(kp):
                        try:
                            os.remove(kp)
                        except Exception:
                            pass
        return {"status": "ok", "deleted": clean_rel}
    except Exception as e:
        return {"error": str(e), "status": "error"}

def list_roms_inventory():
    systems_data = []
    total_roms = 0
    total_bytes = 0

    for sys_def in ROM_SYSTEMS_DEF:
        sys_id = sys_def["id"]
        sys_dir = os.path.join(ROMS_BASE_DIR, sys_id)
        files = []
        if os.path.exists(sys_dir) and os.path.isdir(sys_dir):
            for entry in os.scandir(sys_dir):
                if entry.is_file() and not entry.name.startswith("."):
                    stat = entry.stat()
                    total_roms += 1
                    total_bytes += stat.st_size
                    files.append({
                        "name": entry.name,
                        "size": stat.st_size,
                        "size_formatted": format_bytes(stat.st_size),
                        "modified": int(stat.st_mtime)
                    })
        files.sort(key=lambda x: x["name"].lower())
        systems_data.append({
            "id": sys_id,
            "name": sys_def["name"],
            "extensions": sys_def["extensions"],
            "count": len(files),
            "files": files
        })

    bios_files = []
    if os.path.exists(BIOS_BASE_DIR) and os.path.isdir(BIOS_BASE_DIR):
        for entry in os.scandir(BIOS_BASE_DIR):
            if entry.is_file() and not entry.name.startswith("."):
                stat = entry.stat()
                bios_files.append({
                    "name": entry.name,
                    "size": stat.st_size,
                    "size_formatted": format_bytes(stat.st_size),
                    "modified": int(stat.st_mtime)
                })
    bios_files.sort(key=lambda x: x["name"].lower())

    return {
        "base_path": ROMS_BASE_DIR,
        "bios_path": BIOS_BASE_DIR,
        "total_roms": total_roms,
        "total_size": format_bytes(total_bytes),
        "total_bytes": total_bytes,
        "systems": systems_data,
        "bios": {
            "count": len(bios_files),
            "files": bios_files
        }
    }

def save_uploaded_stream(system_id, filename, rfile, content_length):
    valid_systems = [s["id"] for s in ROM_SYSTEMS_DEF] + ["bios"]
    if system_id not in valid_systems:
        system_id = "switch"

    safe_name = os.path.basename(filename)
    safe_name = re.sub(r'[^a-zA-Z0-9_\-\.\(\)\s]', '_', safe_name).strip()
    if not safe_name:
        safe_name = f"rom_upload_{int(os.getpid())}.bin"

    target_dir = BIOS_BASE_DIR if system_id == "bios" else os.path.join(ROMS_BASE_DIR, system_id)
    os.makedirs(target_dir, exist_ok=True)
    target_path = os.path.join(target_dir, safe_name)

    bytes_written = 0
    chunk_size = 64 * 1024
    with open(target_path, "wb") as f:
        remaining = content_length
        while remaining > 0:
            to_read = min(chunk_size, remaining)
            chunk = rfile.read(to_read)
            if not chunk:
                break
            f.write(chunk)
            remaining -= len(chunk)
            bytes_written += len(chunk)

    try:
        shutil.chown(target_path, user="gamer", group="gamer")
    except Exception:
        pass

    # Auto-sync keys for Eglantine Switch emulator
    if safe_name.endswith(".keys") or "key" in safe_name.lower():
        eglantine_keys_dir = "/home/gamer/.local/share/eglantine/keys"
        try:
            os.makedirs(eglantine_keys_dir, exist_ok=True)
            shutil.copy2(target_path, os.path.join(eglantine_keys_dir, safe_name))
            shutil.chown(os.path.join(eglantine_keys_dir, safe_name), user="gamer", group="gamer")
        except Exception:
            pass

    return {
        "status": "ok",
        "system": system_id,
        "filename": safe_name,
        "bytes_written": bytes_written,
        "size_formatted": format_bytes(bytes_written),
        "path": target_path
    }

def delete_rom_file(system_id, filename):
    valid_systems = [s["id"] for s in ROM_SYSTEMS_DEF] + ["bios"]
    if system_id not in valid_systems:
        return {"error": "Invalid system", "status": "error"}

    safe_name = os.path.basename(filename)
    target_dir = BIOS_BASE_DIR if system_id == "bios" else os.path.join(ROMS_BASE_DIR, system_id)
    target_path = os.path.abspath(os.path.join(target_dir, safe_name))

    allowed_roms = os.path.abspath(ROMS_BASE_DIR)
    allowed_bios = os.path.abspath(BIOS_BASE_DIR)
    if not (target_path.startswith(allowed_roms) or target_path.startswith(allowed_bios)):
        return {"error": "Access denied", "status": "error"}

    if os.path.exists(target_path) and os.path.isfile(target_path):
        os.remove(target_path)
        # Clean synced Eglantine key if present
        if safe_name.endswith(".keys") or "key" in safe_name.lower():
            eglantine_key_path = os.path.join("/home/gamer/.local/share/eglantine/keys", safe_name)
            if os.path.exists(eglantine_key_path):
                try:
                    os.remove(eglantine_key_path)
                except Exception:
                    pass
        return {"status": "ok", "deleted": safe_name}
    return {"error": "File not found", "status": "error"}

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


def get_tls_fingerprint():
    """Retrieve SHA-256 fingerprint for WebTransport serverCertificateHashes."""
    fp_path = "/etc/kyber/tls/fingerprint_sha256.txt"
    if os.path.exists(fp_path):
        try:
            with open(fp_path, "r") as f:
                return {"has_tls": True, "fingerprint_sha256": f.read().strip()}
        except Exception:
            pass
    cert_path = os.environ.get("TLS_CERT", "/etc/kyber/tls/cert.pem")
    if os.path.exists(cert_path):
        out = run_cmd(f"openssl x509 -in {cert_path} -outform der | openssl dgst -sha256 2>/dev/null")
        if out:
            fp = out.split()[-1]
            return {"has_tls": True, "fingerprint_sha256": fp}
    return {"has_tls": False, "fingerprint_sha256": None}

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
        "hostname": hostname,
        "tls": get_tls_fingerprint()
    }

def get_launchers_config():
    """Read dynamic launchers & emulators registry and check availability."""
    paths = [
        "/opt/kyber/hub/launchers.json",
        "/etc/kyber/launchers.json",
        "hub/launchers.json",
        "config/launchers.json"
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
        if cmd_bin in ["desktop", "menu", "restart-steam", "rom-manager"]:
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

    # Ensure Kyber Console Hub window immediately fills the new screen dimensions
    run_cmd(f'wmctrl -r "Kyber Console OS" -b remove,fullscreen,maximized_vert,maximized_horz 2>/dev/null || true')
    run_cmd(f'wmctrl -r "Kyber Console OS" -e 0,0,0,{width},{height} 2>/dev/null || true')
    run_cmd(f'wmctrl -r "Kyber Console OS" -b add,fullscreen,maximized_vert,maximized_horz 2>/dev/null || true')

    return {"status": "ok", "width": width, "height": height, "rate": rate, "output": output, "mode": mode_name}

class ResizeHandler(BaseHTTPRequestHandler):
    def _send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.send_header("Access-Control-Expose-Headers", "*")

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
        elif parsed.path == "/api/roms":
            self._send_json_response(list_roms_inventory())
        elif parsed.path == "/api/roms/browse":
            target_path = params.get("path", [""])[0]
            self._send_json_response(browse_directory(target_path))
        elif parsed.path == "/api/roms/extract":
            target_path = params.get("path", [""])[0]
            delete_archive = params.get("delete_archive", ["false"])[0].lower() == "true"
            result = extract_archive(target_path, delete_archive=delete_archive)
            self._send_json_response(result)
        elif parsed.path == "/api/roms/download":
            target_path = params.get("path", [""])[0]
            full_path, clean_rel = resolve_safe_storage_path(target_path)
            if not full_path or not os.path.exists(full_path) or not os.path.isfile(full_path):
                self._send_json_response({"error": "File not found", "status": "error"}, code=404)
                return
            filename = os.path.basename(full_path)
            file_size = os.path.getsize(full_path)
            self.send_response(200)
            self._send_cors_headers()
            self.send_header("Content-Type", "application/octet-stream")
            self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
            self.send_header("Content-Length", str(file_size))
            self.end_headers()
            with open(full_path, "rb") as f:
                shutil.copyfileobj(f, self.wfile)
        elif parsed.path == "/api/tls/fingerprint":
            self._send_json_response(get_tls_fingerprint())
        elif parsed.path == "/api/launcher/status":
            steam_running = subprocess.run("pgrep -u gamer -f 'ubuntu12_32/steam' >/dev/null 2>&1", shell=True).returncode == 0
            heroic_running = subprocess.run("pgrep -u gamer -f 'heroic' >/dev/null 2>&1", shell=True).returncode == 0
            menu_running = subprocess.run("pgrep -u gamer -f 'kyber-hub-profile|kyber_console_hub' >/dev/null 2>&1", shell=True).returncode == 0
            browser_running = subprocess.run("pgrep -u gamer -f 'chrome' | while read p; do tr '\\0' ' ' < /proc/$p/cmdline 2>/dev/null | grep -v 'kyber-hub-profile' | grep -q 'chrome' && exit 0; done; exit 1", shell=True).returncode == 0
            eglantine_running = subprocess.run("pgrep -u gamer -f 'eglantine' >/dev/null 2>&1", shell=True).returncode == 0
            self._send_json_response({
                "steam": steam_running,
                "heroic": heroic_running,
                "menu": menu_running,
                "browser": browser_running,
                "eglantine": eglantine_running
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

        if parsed.path in ["/api/resize", "/api/launcher", "/api/roms/upload", "/api/roms/upload_chunk", "/api/roms/cancel_upload", "/api/roms/create_folder", "/api/roms/delete", "/api/roms/extract"]:
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
        elif parsed.path == "/api/roms/create_folder":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length) if content_length > 0 else b"{}"
            try:
                data = json.loads(body.decode("utf-8"))
            except Exception:
                data = {}
            target_path = data.get("path", params.get("path", [""])[0])
            folder_name = data.get("folder_name", params.get("folder_name", [""])[0])
            result = create_directory(target_path, folder_name)
            self._send_json_response(result)
        elif parsed.path == "/api/roms/upload_chunk":
            content_length = int(self.headers.get("Content-Length", 0))
            if content_length <= 0:
                self._send_json_response({"error": "Empty chunk body", "status": "error"}, code=400)
                return
            upload_id = params.get("upload_id", [self.headers.get("X-Upload-ID", "")])[0]
            filename = params.get("filename", [self.headers.get("X-Filename", "")])[0]
            target_path = params.get("target_path", [self.headers.get("X-Target-Path", "eglantine/games")])[0]
            chunk_index = int(params.get("chunk_index", [self.headers.get("X-Chunk-Index", 0)])[0])
            chunk_offset_val = params.get("chunk_offset", [self.headers.get("X-Chunk-Offset", "")])[0]
            chunk_offset = int(chunk_offset_val) if chunk_offset_val != "" else None
            total_chunks = int(params.get("total_chunks", [self.headers.get("X-Total-Chunks", 1)])[0])
            total_size = int(params.get("total_size", [self.headers.get("X-Total-Size", 0)])[0])

            chunk_data = self.rfile.read(content_length)
            result = save_uploaded_chunk(upload_id, filename, target_path, chunk_index, total_chunks, total_size, chunk_data, chunk_offset)
            self._send_json_response(result)
        elif parsed.path == "/api/roms/cancel_upload":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length) if content_length > 0 else b"{}"
            try:
                data = json.loads(body.decode("utf-8"))
            except Exception:
                data = {}
            upload_id = data.get("upload_id", params.get("upload_id", [""])[0])
            result = cancel_uploaded_session(upload_id)
            self._send_json_response(result)
        elif parsed.path == "/api/roms/upload":
            content_length = int(self.headers.get("Content-Length", 0))
            if content_length <= 0:
                self._send_json_response({"error": "Empty upload body", "status": "error"}, code=400)
                return
            system = params.get("system", [self.headers.get("X-Rom-System", "switch")])[0]
            filename = params.get("filename", [self.headers.get("X-Rom-Filename", "")])[0]
            if not filename:
                filename = f"rom_{int(os.getpid())}.bin"
            result = save_uploaded_stream(system, filename, self.rfile, content_length)
            self._send_json_response(result)
        elif parsed.path == "/api/roms/delete":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length) if content_length > 0 else b"{}"
            try:
                data = json.loads(body.decode("utf-8"))
            except Exception:
                data = {}
            path = data.get("path", params.get("path", [""])[0])
            if not path and "filename" in data:
                sys_id = data.get("system", "switch")
                path = f"{sys_id}/{data['filename']}" if sys_id != "bios" else f"bios/{data['filename']}"
            result = delete_storage_item(path)
            self._send_json_response(result)
        elif parsed.path == "/api/roms/extract":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length) if content_length > 0 else b"{}"
            try:
                data = json.loads(body.decode("utf-8"))
            except Exception:
                data = {}
            target_path = data.get("path", params.get("path", [""])[0])
            delete_archive = data.get("delete_archive", params.get("delete_archive", ["false"])[0].lower() == "true")
            result = extract_archive(target_path, delete_archive=delete_archive)
            self._send_json_response(result)
        else:
            self.send_response(404)
            self._send_cors_headers()
            self.end_headers()

    def do_DELETE(self):
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)

        if parsed.path == "/api/roms/delete":
            if not is_authenticated(self.client_address, self.headers, params):
                self._send_json_response({"error": "Unauthorized", "authenticated": False}, code=401)
                return
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length) if content_length > 0 else b"{}"
            try:
                data = json.loads(body.decode("utf-8"))
            except Exception:
                data = {}
            path = data.get("path", params.get("path", [""])[0])
            if not path and "filename" in data:
                sys_id = data.get("system", "switch")
                path = f"{sys_id}/{data['filename']}" if sys_id != "bios" else f"bios/{data['filename']}"
            result = delete_storage_item(path)
            self._send_json_response(result)
        else:
            self.send_response(404)
            self._send_cors_headers()
            self.end_headers()

    def log_message(self, format, *args):
        # Concise logging
        print(f"[control-http] {args[0]} {args[1]} -> {args[2]}")

class DualProtocolHTTPServer(ThreadingHTTPServer):
    """Dual HTTP and HTTPS server that dynamically handles both plaintext HTTP and TLS on the same port."""
    def __init__(self, server_address, RequestHandlerClass, ssl_context=None):
        super().__init__(server_address, RequestHandlerClass)
        self.ssl_context = ssl_context
        self.daemon_threads = True

    def get_request(self):
        newsock, fromaddr = self.socket.accept()
        if self.ssl_context is not None:
            try:
                # Peek at the first byte without consuming it from the stream
                first_byte = newsock.recv(1, socket.MSG_PEEK)
                # 0x16 is the standard TLS Handshake record type
                if first_byte == b'\x16':
                    newsock = self.ssl_context.wrap_socket(newsock, server_side=True)
            except Exception:
                pass
        return newsock, fromaddr

def main():
    print(f"[kyber-control] Starting Kyber Gaming Control Service on port {PORT} for display {DISPLAY}...")
    start_discovery_responder()
    tls_cert = os.environ.get("TLS_CERT", "/etc/kyber/tls/cert.pem")
    tls_key = os.environ.get("TLS_KEY", "/etc/kyber/tls/key.pem")
    ssl_ctx = None
    if os.path.exists(tls_cert) and os.path.exists(tls_key):
        try:
            ssl_ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
            ssl_ctx.load_cert_chain(certfile=tls_cert, keyfile=tls_key)
            print(f"[kyber-control] Dual HTTP & HTTPS support enabled using {tls_cert}")
        except Exception as e:
            print(f"[kyber-control] Warning: Could not initialize TLS ({e}), falling back to HTTP.")
    server = DualProtocolHTTPServer(("0.0.0.0", PORT), ResizeHandler, ssl_context=ssl_ctx)
    server.serve_forever()

if __name__ == "__main__":
    main()
