"""Empirical verification of PWA assets and icon dimensions."""

import json
import os
import struct


def get_png_dimensions(filepath: str) -> tuple[int, int]:
    with open(filepath, "rb") as f:
        header = f.read(24)
        if len(header) < 24:
            raise ValueError(f"File {filepath} is too short to be a valid PNG")
        # PNG signature check: 89 50 4E 47 0D 0A 1A 0A
        if header[:8] != b"\x89PNG\r\n\x1a\n":
            raise ValueError(f"File {filepath} does not have a valid PNG signature")
        # IHDR chunk starts at byte 12: length (4B), 'IHDR' (4B), width (4B), height (4B)
        width, height = struct.unpack(">II", header[16:24])
        return width, height


print("=== VERIFYING PWA MANIFEST & ICONS ===")
manifest_path = "frontend/public/manifest.json"
with open(manifest_path, encoding="utf-8") as f:
    manifest = json.load(f)

print(f"Manifest name: {manifest.get('name')}")
print(f"Manifest scope: {manifest.get('scope')}")
print(f"Manifest display: {manifest.get('display')}")
print(f"Manifest start_url: {manifest.get('start_url')}")

icon_192_path = "frontend/public/icon-192.png"
icon_512_path = "frontend/public/icon-512.png"

w192, h192 = get_png_dimensions(icon_192_path)
status_192 = "PASS" if w192 == 192 and h192 == 192 else "FAIL"
print(f"{icon_192_path}: dimensions = {w192}x{h192} (expected 192x192) -> {status_192}")

w512, h512 = get_png_dimensions(icon_512_path)
status_512 = "PASS" if w512 == 512 and h512 == 512 else "FAIL"
print(f"{icon_512_path}: dimensions = {w512}x{h512} (expected 512x512) -> {status_512}")

# Verify dist copies as well
dist_192 = "frontend/dist/icon-192.png"
dist_512 = "frontend/dist/icon-512.png"
if os.path.exists(dist_192) and os.path.exists(dist_512):
    dw192, dh192 = get_png_dimensions(dist_192)
    dw512, dh512 = get_png_dimensions(dist_512)
    s_d192 = "PASS" if dw192 == 192 and dh192 == 192 else "FAIL"
    s_d512 = "PASS" if dw512 == 512 and dh512 == 512 else "FAIL"
    print(f"{dist_192}: dimensions = {dw192}x{dh192} -> {s_d192}")
    print(f"{dist_512}: dimensions = {dw512}x{dh512} -> {s_d512}")

print("=== PWA ICON VERIFICATION COMPLETE ===")
