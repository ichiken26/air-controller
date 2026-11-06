// Parser for ESPHome remote_receiver logs (dump: [pronto, toshiba_ac]) as saved in captures/.

export interface EsphomeCapture {
  /** Each "Received Pronto" block, words joined by spaces. */
  readonly prontos: readonly string[];
  /** Last "Received Toshiba AC" line, as 12-digit uppercase hex. */
  readonly toshibaAc: { readonly code1: string; readonly code2: string | null } | null;
}

const TOSHIBA_RE = /Received Toshiba AC:\s*rc_code_1=0x([0-9A-Fa-f]+)(?:,\s*rc_code_2=0x([0-9A-Fa-f]+))?/g;
const WORD_RE = /\b[0-9A-Fa-f]{4}\b/g;

export function parseEsphomeLog(text: string): EsphomeCapture {
  const prontos: string[][] = [];
  let current: string[] | null = null;
  for (const line of text.replace(/^﻿/, '').split(/\r?\n/)) {
    if (line.includes('Received Pronto: data=')) {
      current = [];
      prontos.push(current);
    } else if (line.includes('[remote.pronto:')) {
      const words = line.slice(line.lastIndexOf(']:') + 2).match(WORD_RE) ?? [];
      // Some logs were saved without the "Received Pronto" line.
      if (current === null) {
        if (words[0] !== '0000') continue;
        current = [];
        prontos.push(current);
      }
      current.push(...words);
    } else if (line.trim()) {
      current = null;
    }
  }

  let toshibaAc: EsphomeCapture['toshibaAc'] = null;
  for (const m of text.matchAll(TOSHIBA_RE)) {
    toshibaAc = { code1: pad(m[1]), code2: m[2] ? pad(m[2]) : null };
  }
  return { prontos: prontos.filter((p) => p.length).map((p) => p.join(' ')), toshibaAc };
}

function pad(hex: string): string {
  return hex.toUpperCase().padStart(12, '0');
}
