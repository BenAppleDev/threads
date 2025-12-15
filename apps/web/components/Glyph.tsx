'use client';

import React from 'react';

function bitsToMatrix(bits: string): number[][] {
  const normalized = bits.padEnd(64, '0').slice(0, 64);
  const matrix: number[][] = [];
  for (let i = 0; i < 8; i += 1) {
    const row = normalized
      .slice(i * 8, i * 8 + 8)
      .split('')
      .map((b) => (b === '1' ? 1 : 0));
    matrix.push(row);
  }
  return matrix;
}

export function Glyph({ bits, size = 96 }: { bits: string; size?: number }) {
  const matrix = bitsToMatrix(bits);
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(8, 1fr)',
        width: size,
        height: size,
        gap: 2,
        background: 'rgba(255,255,255,0.03)',
        padding: 4,
        borderRadius: 12,
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      {matrix.flatMap((row, rowIndex) =>
        row.map((cell, cellIndex) => (
          <div
            key={`${rowIndex}-${cellIndex}`}
            style={{
              width: '100%',
              height: '100%',
              background: cell ? 'linear-gradient(120deg, #8a5cff, #00e5ff)' : 'rgba(255, 255, 255, 0.06)',
              borderRadius: 2,
            }}
          />
        ))
      )}
    </div>
  );
}
