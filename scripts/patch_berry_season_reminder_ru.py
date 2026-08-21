#!/usr/bin/env python3
"""Patch Berry Season Reminder's two hard-coded hover strings in-place.

The mod has no i18n resources. Its current DLL contains two player-facing strings in
the .NET user-string heap. We replace their UTF-16LE payloads with Russian text of
equal total byte length (padding with spaces), so PE/.NET metadata offsets and file
size do not change.

Usage:
  python scripts/patch_berry_season_reminder_ru.py input.zip output.zip
"""
from __future__ import annotations
import io
import json
import sys
import zipfile
from pathlib import Path

PATCHES = {
    "Blackberry Season": "Сезон ежевики",
    "Salmonberry Season": "Сезон морошки",
}
EXPECTED_DLL_SUFFIX = "/BerrySeasonReminder.dll"


def fixed_utf16(old: str, new: str) -> tuple[bytes, bytes]:
    if len(new) > len(old):
        raise ValueError(f"replacement is longer than source: {old!r} -> {new!r}")
    padded = new + (" " * (len(old) - len(new)))
    a, b = old.encode("utf-16le"), padded.encode("utf-16le")
    if len(a) != len(b):
        raise AssertionError("UTF-16 byte lengths differ")
    return a, b


def patch_dll(data: bytes) -> tuple[bytes, list[dict]]:
    buf = bytearray(data)
    report = []
    for old, new in PATCHES.items():
        needle, replacement = fixed_utf16(old, new)
        count = bytes(buf).count(needle)
        if count != 1:
            raise RuntimeError(f"expected exactly one UTF-16 occurrence of {old!r}, found {count}")
        pos = bytes(buf).find(needle)
        buf[pos:pos + len(needle)] = replacement
        if needle in buf:
            raise RuntimeError(f"source string still present after patch: {old!r}")
        if replacement not in buf:
            raise RuntimeError(f"replacement missing after patch: {new!r}")
        report.append({
            "source": old,
            "russian": new,
            "sourceChars": len(old),
            "russianChars": len(new),
            "storedChars": len(old),
            "byteOffset": pos,
        })
    if len(buf) != len(data):
        raise RuntimeError("DLL size changed; refusing output")
    return bytes(buf), report


def main(src_name: str, dst_name: str) -> None:
    src, dst = Path(src_name), Path(dst_name)
    raw = src.read_bytes()
    with zipfile.ZipFile(io.BytesIO(raw), "r") as zin:
        names = zin.namelist()
        dlls = [n for n in names if n.replace("\\", "/").endswith(EXPECTED_DLL_SUFFIX)]
        if len(dlls) != 1:
            raise RuntimeError(f"expected one BerrySeasonReminder.dll, found {dlls}")
        dll_name = dlls[0]
        patched_dll, patches = patch_dll(zin.read(dll_name))
        out = io.BytesIO()
        with zipfile.ZipFile(out, "w", compression=zipfile.ZIP_DEFLATED) as zout:
            for info in zin.infolist():
                data = patched_dll if info.filename == dll_name else zin.read(info.filename)
                zout.writestr(info, data)
            report = {
                "mod": "Berry Season Reminder",
                "targetVersion": "1.1.2",
                "targetNexusModId": 9315,
                "targetNexusFileId": 115757,
                "method": "same-length UTF-16LE .NET user-string replacement",
                "dll": dll_name,
                "dllBytes": len(patched_dll),
                "patches": patches,
                "validation": {
                    "sourceOccurrencesRemaining": 0,
                    "dllSizeUnchanged": True,
                    "archiveOriginalEntriesPreserved": len(names),
                },
            }
            zout.writestr("BERRY_SEASON_REMINDER_RU_REPORT.json", json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    dst.write_bytes(out.getvalue())
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("usage: patch_berry_season_reminder_ru.py INPUT.zip OUTPUT.zip")
    main(sys.argv[1], sys.argv[2])
