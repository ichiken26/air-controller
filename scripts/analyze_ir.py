#!/usr/bin/env python3
"""Compare ESPHome Toshiba AC IR capture logs. Python stdlib only.
Usage: python3 scripts/analyze_ir.py captures/cool-24_0.log captures/cool-24_5.log
"""
from __future__ import annotations
import argparse
from pathlib import Path
import re
from dataclasses import dataclass

CODE_RE = re.compile(r"Received Toshiba AC:\s*rc_code_1=0x([0-9A-Fa-f]+)(?:,\s*rc_code_2=0x([0-9A-Fa-f]+))?")
WORD_RE = re.compile(r"\b[0-9A-Fa-f]{4}\b")

@dataclass
class Capture:
    path: Path
    code1: int | None
    code2: int | None
    pronto_count: int
    valid_prontos: int
    error: str | None
    frames: list[int] | None

def parse_pronto_groups(text: str) -> list[list[str]]:
    groups: list[list[str]] = []
    current: list[str] | None = None
    for line in text.splitlines():
        if 'Received Pronto: data=' in line:
            if current is not None:
                groups.append(current)
            current = []
        elif '[remote.pronto:' in line:
            # ESPHome prefix: [02:54:44][I][remote.pronto:239]: 0000 006D ...
            words = WORD_RE.findall(line.rsplit(']:', 1)[-1])
            if current is None:
                # Tolerate logs pasted without the "Received Pronto: data=" line.
                if not words or words[0] != '0000':
                    continue
                current = []
            current.extend(words)
        elif current is not None and line.strip():
            groups.append(current)
            current = None
    if current is not None:
        groups.append(current)
    return groups

def decode_pronto(words: list[str]) -> tuple[list[int] | None, str | None]:
    if len(words) < 4:
        return None, 'Pronto header missing'
    h = [int(v, 16) for v in words[:4]]
    if h[0] != 0:
        return None, 'not an unmodulated Pronto format 0000 header'
    expected = 4 + 2 * (h[2] + h[3])
    if len(words) != expected:
        return None, f'Pronto count mismatch: expected={expected}, actual={len(words)}'
    pulses = [int(v, 16) for v in words[4:]]
    if len(pulses) % 100:
        return None, f'{len(pulses)} timing values not divisible into 48-bit frames (100 per frame)'
    frames = []
    for start in range(0, len(pulses), 100):
        frame = pulses[start:start+100]
        if frame[0] < 100 or frame[1] < 100:
            return None, 'frame leader not detected at expected offset'
        bits = 0
        for i in range(48):
            mark = frame[2 + 2*i]
            space = frame[3 + 2*i]
            if not (8 <= mark <= 32):
                return None, f'unexpected bit mark {mark} (frame {start//100 + 1}, bit {i})'
            if 30 <= space <= 45:
                return None, f'ambiguous 0/1 space {space} (frame {start//100 + 1}, bit {i})'
            bits = (bits << 1) | (1 if space > 45 else 0)
        frames.append(bits)
    return frames, None

def capture(path: Path) -> Capture:
    data = path.read_text(encoding='utf-8-sig', errors='replace')
    codes = CODE_RE.findall(data)
    code1 = int(codes[-1][0], 16) if codes else None
    code2 = int(codes[-1][1], 16) if codes and codes[-1][1] else None
    groups = parse_pronto_groups(data)
    valid = 0
    frames = None
    err = None
    for group in groups:
        decoded, problem = decode_pronto(group)
        if problem is None:
            valid += 1
            frames = decoded
        else:
            err = problem
    return Capture(path, code1, code2, len(groups), valid, err, frames)

def hx(value: int | None) -> str:
    return f'{value:012X}' if value is not None else '------------'

def effective_codes(item: Capture) -> tuple[int | None, int | None]:
    # Prefer ESPHome's decoded result; fall back to Pronto bit timing.
    frame1 = item.frames[1] if item.frames and len(item.frames) >= 2 else None
    frame2 = item.frames[2] if item.frames and len(item.frames) >= 3 else None
    return (item.code1 if item.code1 is not None else frame1,
            item.code2 if item.code2 is not None else frame2)

def compare(a: Capture, b: Capture) -> None:
    print(f'\nDIFF  {a.path.name} -> {b.path.name}')
    a1, a2 = effective_codes(a)
    b1, b2 = effective_codes(b)
    for label, x, y in [('code1', a1, b1), ('code2', a2, b2)]:
        if x is None or y is None:
            print(f'  {label}: no comparable decoded Toshiba data')
            continue
        print(f'  {label}: {hx(x)} -> {hx(y)}  changed_bits={(x ^ y).bit_count()}')
        x_bytes, y_bytes = x.to_bytes(6, 'big'), y.to_bytes(6, 'big')
        changes = [f'byte{i}: {left:02X}->{right:02X} (xor={left^right:02X})'
                   for i,(left,right) in enumerate(zip(x_bytes,y_bytes)) if left != right]
        print('    ' + ('; '.join(changes) if changes else '(identical)'))

def main() -> None:
    p = argparse.ArgumentParser(description='Analyze ESPHome Toshiba AC reception logs')
    p.add_argument('files', nargs='+', type=Path, help='ESPHome logs saved as .log/.txt')
    args = p.parse_args()
    results = [capture(path) for path in args.files]
    for item in results:
        print(f'\nFILE  {item.path.name}')
        print(f'  Toshiba AC: rc_code_1={hx(item.code1)} rc_code_2={hx(item.code2)}')
        if item.code1 is not None:
            print('  bytes1:', ' '.join(f'{v:02X}' for v in item.code1.to_bytes(6,'big')))
        if item.code2 is not None:
            print('  bytes2:', ' '.join(f'{v:02X}' for v in item.code2.to_bytes(6,'big')))
        print(f'  Pronto groups={item.pronto_count}, valid groups={item.valid_prontos}')
        if item.frames:
            print('  Pronto decoded frames:', ' / '.join(hx(f) for f in item.frames))
            if len(item.frames) >= 2 and item.frames[0] != item.frames[1]:
                print('  WARNING: first two 48-bit frames differ')
            if item.code1 is not None and len(item.frames) >= 2 and item.frames[1] != item.code1:
                print('  WARNING: Pronto frame2 differs from ESPHome Toshiba AC code1')
            if item.code2 is not None and len(item.frames) >= 3 and item.frames[2] != item.code2:
                print('  WARNING: Pronto frame3 differs from ESPHome Toshiba AC code2')
        elif item.error:
            print('  Pronto issue:', item.error)
        if item.code1 is None and item.frames:
            print('  Note: bits recovered from Pronto timing only (Toshiba decoder did not match).')
        if item.code1 is None and not item.frames:
            print('  No decoded data found. Paste complete ESPHome log with [remote.pronto:] lines.')
    if len(results) > 1:
        for a,b in zip(results, results[1:]):
            compare(a,b)

if __name__ == '__main__':
    main()
