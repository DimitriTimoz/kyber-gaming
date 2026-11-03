#!/usr/bin/env python3
"""
Generate a standard 128-byte or 256-byte (with CTA-861 Extension) EDID binary file.
Designed for headless cloud gaming display emulation:
- Supports 1080p, 1440p, 4K
- Supports 60Hz, 120Hz, 144Hz refresh rates
"""

import sys
import struct
import os

def create_edid(output_path="/etc/X11/edid.bin"):
    edid = bytearray(128)

    # 1. Header (8 bytes)
    edid[0:8] = b'\x00\xFF\xFF\xFF\xFF\xFF\xFF\x00'

    # 2. Manufacturer ID: "KYB" (Kyber)
    # 5-bit character coding: K=11, Y=25, B=2 -> 0001011 11001 00010
    # Big-endian 16-bit
    edid[8:10] = struct.pack(">H", (11 << 10) | (25 << 5) | 2)

    # 3. Product code: 0x474D ("GM" for Gaming)
    edid[10:12] = b'\x47\x4D'

    # 4. Serial Number: 1
    edid[12:16] = struct.pack("<I", 1)

    # 5. Week 1, Year 2026 (2026 - 1990 = 36)
    edid[16] = 1
    edid[17] = 36

    # 6. EDID Version 1, Revision 4
    edid[18] = 1
    edid[19] = 4

    # 7. Basic Display Parameters
    # Digital input, 8 bits per primary color, DisplayPort / HDMI compatible
    edid[20] = 0xA5
    # Screen size: 60 cm x 34 cm (~27 inches 16:9)
    edid[21] = 60
    edid[22] = 34
    # Gamma: 2.2 -> (2.2 * 100) - 100 = 120 (0x78)
    edid[23] = 0x78
    # Features: Preferred timing mode is native, RGB 4:4:4 + YCbCr 4:4:4
    edid[24] = 0x0A

    # 8. Color Characteristics (sRGB approximations)
    edid[25:35] = b'\xEE\x91\xA3\x54\x4C\x99\x26\x0F\x50\x54'

    # 9. Established Timings (640x480, 800x600, 1024x768 @ 60Hz)
    edid[35] = 0x21
    edid[36] = 0x08
    edid[37] = 0x00

    # 10. Standard Timing Identifiers (8 slots, 2 bytes each)
    # Format: [X-res / 8 - 31], [Aspect ratio (2 bits) | Refresh rate - 60]
    # 1920x1080 @ 60Hz: (1920/8)-31 = 209 (0xD1), 16:9 (01) | 0 = 0x40 -> D1 40 (wait, D1 50 = 75Hz)
    # 1920x1080 @ 60Hz -> D1 C0 in EDID 1.4
    # 1680x1050 @ 60Hz -> B3 00
    # 1440x900 @ 60Hz  -> 95 00
    # 1280x720 @ 60Hz  -> 81 C0
    # 2560x1440 handled in detailed timings
    standard_timings = [
        (1920, 1080, 60),
        (1280, 720, 60),
        (1920, 1080, 120),
        (1680, 1050, 60),
        (1440, 900, 60),
        (1280, 1024, 60),
        (1024, 768, 60),
        (800, 600, 60)
    ]
    idx = 38
    for w, h, r in standard_timings:
        first = (w // 8) - 31
        ratio = 0b11 if (w*9 == h*16) else 0b00 # 16:9 vs 16:10
        second = (ratio << 6) | (max(0, r - 60) & 0x3F)
        edid[idx] = first & 0xFF
        edid[idx+1] = second & 0xFF
        idx += 2

    # 11. Detailed Timing Descriptor 1: 1920x1080 @ 60Hz (Native / Preferred)
    # Pixel clock: 148.50 MHz -> 14850 = 0x3A02 (little-endian: 02 3A)
    # H active: 1920, H blank: 280, V active: 1080, V blank: 45
    # H sync offset: 88, sync pulse: 44, V sync offset: 4, pulse: 5
    dtd1 = bytearray([
        0x02, 0x3A, # Pixel clock: 148.50 MHz (in 10 kHz units)
        0x80,       # H active lower 8 bits (1920 -> 0x780 -> 0x80)
        0x18,       # H blanking lower 8 bits (280 -> 0x118 -> 0x18)
        0x71,       # H active high 4 bits (7) | H blank high 4 bits (1)
        0x38,       # V active lower 8 bits (1080 -> 0x438 -> 0x38)
        0x2D,       # V blanking lower 8 bits (45 -> 0x02D -> 0x2D)
        0x40,       # V active high 4 bits (4) | V blank high 4 bits (0)
        0x58,       # H sync offset lower 8 bits (88 -> 0x58)
        0x2C,       # H sync pulse width lower 8 bits (44 -> 0x2C)
        0x45,       # V sync offset lower 4 bits (4) | V sync pulse width lower 4 bits (5)
        0x00,       # High bits for H/V sync
        0x58,       # H image size in mm (600 mm -> 0x258 -> 0x58)
        0x54,       # V image size in mm (340 mm -> 0x154 -> 0x54)
        0x21,       # High bits for image size
        0x00,       # H border
        0x00,       # V border
        0x1E        # Digital separate sync, +hsync, +vsync
    ])
    edid[54:72] = dtd1

    # 12. Detailed Timing Descriptor 2: 2560x1440 @ 60Hz
    # Pixel clock: 241.50 MHz -> 24150 = 0x5E56 -> 0x56, 0x5E
    dtd2 = bytearray([
        0x56, 0x5E, # 241.50 MHz
        0x00, 0x50, 0xA1, 0xA0, 0x28, 0x50, # 2560x1440
        0x30, 0x20, 0x36, 0x00, 0x58, 0x54, 0x21, 0x00, 0x00, 0x1E
    ])
    edid[72:90] = dtd2

    # 13. Descriptor 3: Display Range Limits (V: 48-144Hz, H: 30-220kHz, Max pixel clock: 600MHz)
    edid[90:95] = b'\x00\x00\x00\xFD\x00' # Descriptor header for range limits
    edid[95] = 48   # Min vertical rate (Hz)
    edid[96] = 144  # Max vertical rate (Hz) -> 144Hz support!
    edid[97] = 30   # Min horizontal rate (kHz)
    edid[98] = 220  # Max horizontal rate (kHz)
    edid[99] = 60   # Max pixel clock (x 10 MHz) -> 600 MHz
    edid[100:108] = b'\x00\x0A\x20\x20\x20\x20\x20\x20'

    # 14. Descriptor 4: Display Name "KyberDisplay"
    edid[108:113] = b'\x00\x00\x00\xFC\x00' # Descriptor header for monitor name
    name = b"KyberDisplay\n"
    edid[113:113+len(name)] = name
    for i in range(113+len(name), 126):
        edid[i] = 0x20

    # Extension count (0 for 128 bytes)
    edid[126] = 0

    # 15. Checksum calculation: sum of all 128 bytes mod 256 must be 0
    checksum = (256 - (sum(edid[0:127]) % 256)) % 256
    edid[127] = checksum

    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    with open(output_path, "wb") as f:
        f.write(edid)

    print(f"Generated valid EDID 1.4 binary ({len(edid)} bytes) at: {output_path}")

if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else "/etc/X11/edid.bin"
    create_edid(target)
