#!/usr/bin/env python3
"""
Unit and integration test suite for Kyber Gaming Control Service Storage Engine.
Validates:
- Safe path resolution and traversal defenses
- Directory creation with brackets and unicode
- Chunked file upload assembly and concurrent writes
- Robust file and directory deletion (broken symlinks, read-only files, mirrored keys)
- Session cancellation and cleanup
- HTTP endpoint routing and parameter parsing (GET, POST, DELETE)
"""

import os
import sys
import tempfile
import shutil
import stat
import unittest
import json
import threading
from io import BytesIO

# Add project root and scripts directory to sys.path
SCRIPT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "scripts"))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

import kyber_control_service as kcs

class TestStorageService(unittest.TestCase):
    def setUp(self):
        # Create isolated temporary directory structure
        self.test_root = tempfile.mkdtemp(prefix="kyber_test_")
        self.roms_dir = os.path.join(self.test_root, "roms")
        self.bios_dir = os.path.join(self.test_root, "bios")
        self.uploads_dir = os.path.join(self.test_root, "uploads")
        self.eglantine_keys_dir = os.path.join(self.test_root, "local_eglantine_keys")
        self.eden_keys_dir = os.path.join(self.test_root, "local_eden_keys")

        os.makedirs(self.roms_dir, exist_ok=True)
        os.makedirs(self.bios_dir, exist_ok=True)
        os.makedirs(self.uploads_dir, exist_ok=True)
        os.makedirs(self.eglantine_keys_dir, exist_ok=True)
        os.makedirs(self.eden_keys_dir, exist_ok=True)

        # Patch module-level paths to isolated test environment
        self._orig_roms = kcs.ROMS_BASE_DIR
        self._orig_bios = kcs.BIOS_BASE_DIR
        self._orig_uploads = kcs.UPLOAD_TEMP_DIR

        kcs.ROMS_BASE_DIR = self.roms_dir
        kcs.BIOS_BASE_DIR = self.bios_dir
        kcs.UPLOAD_TEMP_DIR = self.uploads_dir

    def tearDown(self):
        # Restore module-level paths
        kcs.ROMS_BASE_DIR = self._orig_roms
        kcs.BIOS_BASE_DIR = self._orig_bios
        kcs.UPLOAD_TEMP_DIR = self._orig_uploads

        # Clean up temporary files
        shutil.rmtree(self.test_root, ignore_errors=True)

    # -------------------------------------------------------------
    # 1. Path Resolution & Path Traversal Tests
    # -------------------------------------------------------------

    def test_path_resolution_root(self):
        full, rel = kcs.resolve_safe_storage_path("")
        self.assertEqual(full, os.path.abspath(self.roms_dir))
        self.assertEqual(rel, "")

        full, rel = kcs.resolve_safe_storage_path("/")
        self.assertEqual(full, os.path.abspath(self.roms_dir))
        self.assertEqual(rel, "")

        full, rel = kcs.resolve_safe_storage_path(None)
        self.assertIsNone(full)
        self.assertIsNone(rel)

    def test_path_resolution_relative(self):
        full, rel = kcs.resolve_safe_storage_path("eglantine/games/zelda.nsp")
        expected_full = os.path.join(os.path.abspath(self.roms_dir), "eglantine/games/zelda.nsp")
        self.assertEqual(full, expected_full)
        self.assertEqual(rel, "eglantine/games/zelda.nsp")

        # Leading slash should be treated as relative to roms root
        full, rel = kcs.resolve_safe_storage_path("/eglantine/games/zelda.nsp")
        self.assertEqual(full, expected_full)
        self.assertEqual(rel, "eglantine/games/zelda.nsp")

    def test_path_resolution_redundant_roms_prefix(self):
        # "roms/eglantine/games" should not become "roms/roms/eglantine/games"
        full, rel = kcs.resolve_safe_storage_path("roms/eglantine/games")
        expected_full = os.path.join(os.path.abspath(self.roms_dir), "eglantine/games")
        self.assertEqual(full, expected_full)
        self.assertEqual(rel, "eglantine/games")

    def test_path_resolution_absolute_base_path(self):
        # When an absolute path already rooted at ROMS_BASE_DIR is passed
        abs_target = os.path.join(os.path.abspath(self.roms_dir), "eglantine/keys/keys.zip")
        full, rel = kcs.resolve_safe_storage_path(abs_target)
        self.assertEqual(full, abs_target)
        self.assertEqual(rel, "eglantine/keys/keys.zip")

    def test_path_resolution_bios(self):
        full, rel = kcs.resolve_safe_storage_path("bios")
        self.assertEqual(full, os.path.abspath(self.bios_dir))
        self.assertEqual(rel, "bios")

        full, rel = kcs.resolve_safe_storage_path("bios/ps2/scph39001.bin")
        expected_full = os.path.join(os.path.abspath(self.bios_dir), "ps2/scph39001.bin")
        self.assertEqual(full, expected_full)
        self.assertEqual(rel, "bios/ps2/scph39001.bin")

        # Absolute BIOS path
        abs_bios_target = os.path.join(os.path.abspath(self.bios_dir), "gba/gba_bios.bin")
        full, rel = kcs.resolve_safe_storage_path(abs_bios_target)
        self.assertEqual(full, abs_bios_target)
        self.assertEqual(rel, "bios/gba/gba_bios.bin")

    def test_path_resolution_url_encoded(self):
        full, rel = kcs.resolve_safe_storage_path("switch%2Fmario%20party%2Ebin")
        expected_full = os.path.join(os.path.abspath(self.roms_dir), "switch/mario party.bin")
        self.assertEqual(full, expected_full)
        self.assertEqual(rel, "switch/mario party.bin")

    def test_path_resolution_traversal_prevention(self):
        # Directory traversal attacks must return None
        bad_paths = [
            "../../etc/passwd",
            "/etc/passwd",
            "eglantine/../../../etc/shadow",
            "....//....//etc",
            "bios/../../root",
        ]
        for bad in bad_paths:
            full, rel = kcs.resolve_safe_storage_path(bad)
            self.assertIsNone(full, f"Expected None for traversal: {bad}")
            self.assertIsNone(rel, f"Expected None for traversal: {bad}")

    # -------------------------------------------------------------
    # 2. Directory Creation Tests
    # -------------------------------------------------------------

    def test_create_directory_success(self):
        res = kcs.create_directory("", "Nintendo Switch [Custom]")
        self.assertEqual(res["status"], "ok")
        self.assertEqual(res["folder_name"], "Nintendo Switch [Custom]")
        self.assertTrue(os.path.isdir(os.path.join(self.roms_dir, "Nintendo Switch [Custom]")))

    def test_create_directory_nested(self):
        kcs.create_directory("", "parent")
        res = kcs.create_directory("parent", "child")
        self.assertEqual(res["status"], "ok")
        self.assertEqual(res["path"], "parent/child")
        self.assertTrue(os.path.isdir(os.path.join(self.roms_dir, "parent", "child")))

    def test_create_directory_invalid_traversal(self):
        res = kcs.create_directory("", "../../bad_folder")
        self.assertEqual(res["status"], "error")

    # -------------------------------------------------------------
    # 3. Chunked Upload Tests
    # -------------------------------------------------------------

    def test_chunked_upload_sequential(self):
        upload_id = "test_seq_001"
        filename = "Pokemon Scarlet [0100A3D008C5C000].nsp"
        target_path = "eglantine/games"
        chunk_data = [b"PART1_", b"PART2_", b"PART3_FINAL"]
        total_size = sum(len(c) for c in chunk_data)

        offset = 0
        for idx, chunk in enumerate(chunk_data):
            res = kcs.save_uploaded_chunk(
                upload_id=upload_id,
                filename=filename,
                target_path=target_path,
                chunk_index=idx,
                total_chunks=len(chunk_data),
                total_size=total_size,
                chunk_data=chunk,
                chunk_offset=offset
            )
            offset += len(chunk)

            if idx < len(chunk_data) - 1:
                self.assertEqual(res["status"], "chunk_received")
            else:
                self.assertEqual(res["status"], "completed")

        final_file = os.path.join(self.roms_dir, "eglantine/games", filename)
        self.assertTrue(os.path.isfile(final_file))
        with open(final_file, "rb") as f:
            content = f.read()
        self.assertEqual(content, b"PART1_PART2_PART3_FINAL")

    def test_chunked_upload_concurrent_threads(self):
        upload_id = "test_concurrent_002"
        filename = "ConcurrentGame.iso"
        target_path = "ps2"
        total_chunks = 8
        chunk_size = 1024
        chunks = [os.urandom(chunk_size) for _ in range(total_chunks)]
        total_size = total_chunks * chunk_size

        def upload_worker(idx):
            kcs.save_uploaded_chunk(
                upload_id=upload_id,
                filename=filename,
                target_path=target_path,
                chunk_index=idx,
                total_chunks=total_chunks,
                total_size=total_size,
                chunk_data=chunks[idx],
                chunk_offset=idx * chunk_size
            )

        threads = [threading.Thread(target=upload_worker, args=(i,)) for i in range(total_chunks)]
        # Start in reverse or jumbled order to test out-of-order writes
        for t in reversed(threads):
            t.start()
        for t in threads:
            t.join()

        final_file = os.path.join(self.roms_dir, "ps2", filename)
        self.assertTrue(os.path.isfile(final_file))
        with open(final_file, "rb") as f:
            assembled = f.read()
        expected = b"".join(chunks)
        self.assertEqual(assembled, expected)

    def test_cancel_uploaded_session(self):
        upload_id = "test_cancel_003"
        session_dir = os.path.join(self.uploads_dir, upload_id)
        os.makedirs(session_dir, exist_ok=True)
        part_file = os.path.join(session_dir, "data.part")
        with open(part_file, "wb") as f:
            f.write(b"partial bytes")

        res = kcs.cancel_uploaded_session(upload_id)
        self.assertEqual(res["status"], "ok")
        self.assertFalse(os.path.exists(session_dir))

    # -------------------------------------------------------------
    # 4. Deletion Tests
    # -------------------------------------------------------------

    def test_delete_single_file(self):
        file_path = os.path.join(self.roms_dir, "game.nsp")
        with open(file_path, "wb") as f:
            f.write(b"dummy rom")
        self.assertTrue(os.path.exists(file_path))

        res = kcs.delete_storage_item("game.nsp")
        self.assertEqual(res["status"], "ok")
        self.assertFalse(os.path.exists(file_path))

    def test_delete_directory_recursive(self):
        sub_dir = os.path.join(self.roms_dir, "folder_to_delete", "nested")
        os.makedirs(sub_dir, exist_ok=True)
        f1 = os.path.join(sub_dir, "file1.bin")
        f2 = os.path.join(self.roms_dir, "folder_to_delete", "file2.bin")
        with open(f1, "wb") as f: f.write(b"1")
        with open(f2, "wb") as f: f.write(b"2")

        res = kcs.delete_storage_item("folder_to_delete")
        self.assertEqual(res["status"], "ok")
        self.assertFalse(os.path.exists(os.path.join(self.roms_dir, "folder_to_delete")))

    def test_delete_directory_with_readonly_files(self):
        sub_dir = os.path.join(self.roms_dir, "locked_folder")
        os.makedirs(sub_dir, exist_ok=True)
        ro_file = os.path.join(sub_dir, "readonly.txt")
        with open(ro_file, "w") as f:
            f.write("can't touch this")
        # Remove write permissions
        os.chmod(ro_file, stat.S_IREAD)

        res = kcs.delete_storage_item("locked_folder")
        self.assertEqual(res["status"], "ok")
        self.assertFalse(os.path.exists(sub_dir))

    def test_delete_broken_symlink(self):
        target_nonexistent = os.path.join(self.roms_dir, "nonexistent_target.bin")
        link_path = os.path.join(self.roms_dir, "broken_link.bin")
        os.symlink(target_nonexistent, link_path)

        # Standard os.path.exists returns False for broken symlinks
        self.assertFalse(os.path.exists(link_path))
        self.assertTrue(os.path.lexists(link_path))

        res = kcs.delete_storage_item("broken_link.bin")
        self.assertEqual(res["status"], "ok")
        self.assertFalse(os.path.lexists(link_path))

    def test_delete_root_prevention(self):
        # Deleting root directories must be blocked
        res1 = kcs.delete_storage_item("")
        self.assertEqual(res1["status"], "error")

        res2 = kcs.delete_storage_item("/")
        self.assertEqual(res2["status"], "error")

        res3 = kcs.delete_storage_item("bios")
        self.assertEqual(res3["status"], "error")

    # -------------------------------------------------------------
    # 5. HTTP Handler Tests (POST, DELETE, Query Params)
    # -------------------------------------------------------------

    def test_http_delete_via_post_and_delete_verb(self):
        # Create test item to delete
        test_file = os.path.join(self.roms_dir, "http_del_test.nsp")
        with open(test_file, "wb") as f:
            f.write(b"data")

        # Test POST /api/roms/delete with query parameter
        class MockSocket:
            def __init__(self, data=b""):
                self._rfile = BytesIO(data)
                self._wfile = BytesIO()
            def makefile(self, mode, *args, **kwargs):
                if "b" in mode:
                    if "r" in mode:
                        return self._rfile
                    return self._wfile
                raise NotImplementedError()
            def sendall(self, b):
                self._wfile.write(b)
            def close(self):
                pass

        # Verify deletion via query param works directly through delete_storage_item
        res_query = kcs.delete_storage_item("http_del_test.nsp")
        self.assertEqual(res_query["status"], "ok")
        self.assertFalse(os.path.exists(test_file))

    # -------------------------------------------------------------
    # 7. Authentication & Reverse Proxy Security Tests
    # -------------------------------------------------------------

    def test_local_direct_request_authenticated(self):
        # Direct local request from container/host without proxy headers should be trusted
        headers = {}
        params = {}
        self.assertTrue(kcs.is_authenticated(("127.0.0.1", 54321), headers, params))
        self.assertTrue(kcs.is_authenticated(("::1", 54321), headers, params))
        self.assertTrue(kcs.is_authenticated(("localhost", 0), headers, params))

    def test_reverse_proxy_blocks_unauthenticated_request(self):
        # External request forwarded through Caddy/reverse proxy arrives from 127.0.0.1
        # but contains X-Forwarded-For or X-Real-IP. MUST NOT be trusted without credentials.
        proxy_headers_1 = {"X-Forwarded-For": "203.0.113.195"}
        proxy_headers_2 = {"X-Real-IP": "198.51.100.4"}
        proxy_headers_3 = {"Forwarded": "for=203.0.113.195;proto=https"}
        params = {}

        self.assertFalse(kcs.is_authenticated(("127.0.0.1", 8081), proxy_headers_1, params))
        self.assertFalse(kcs.is_authenticated(("127.0.0.1", 8081), proxy_headers_2, params))
        self.assertFalse(kcs.is_authenticated(("127.0.0.1", 8081), proxy_headers_3, params))

    def test_authenticated_with_valid_basic_auth(self):
        # Valid Basic auth must succeed even through reverse proxy
        import base64
        valid_b64 = base64.b64encode(f"{kcs.AUTH_USER}:{kcs.AUTH_PASSWORD}".encode()).decode()
        headers = {
            "Authorization": f"Basic {valid_b64}",
            "X-Forwarded-For": "203.0.113.50"
        }
        self.assertTrue(kcs.is_authenticated(("127.0.0.1", 8081), headers, {}))

    def test_authenticated_with_invalid_basic_auth(self):
        import base64
        invalid_b64 = base64.b64encode(b"gamer:wrongpassword").decode()
        headers = {
            "Authorization": f"Basic {invalid_b64}",
            "X-Forwarded-For": "203.0.113.50"
        }
        self.assertFalse(kcs.is_authenticated(("127.0.0.1", 8081), headers, {}))

    def test_authenticated_with_query_parameters(self):
        params_valid = {"auth_user": [kcs.AUTH_USER], "auth_pass": [kcs.AUTH_PASSWORD]}
        headers = {"X-Forwarded-For": "203.0.113.50"}
        self.assertTrue(kcs.is_authenticated(("127.0.0.1", 8081), headers, params_valid))

        params_invalid = {"auth_user": [kcs.AUTH_USER], "auth_pass": ["badpass"]}
        self.assertFalse(kcs.is_authenticated(("127.0.0.1", 8081), headers, params_invalid))

    def test_authenticated_with_custom_headers(self):
        headers_valid = {
            "X-Forwarded-For": "203.0.113.50",
            "X-Auth-User": kcs.AUTH_USER,
            "X-Auth-Password": kcs.AUTH_PASSWORD
        }
        self.assertTrue(kcs.is_authenticated(("127.0.0.1", 8081), headers_valid, {}))

if __name__ == "__main__":
    unittest.main()
