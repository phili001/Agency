/**
 * CSV sin dependencias (RFC 4180): comillas, saltos de línea dentro de celdas,
 * BOM de Excel y separador `,` o `;` (el Excel en español guarda con `;`).
 *
 * Anti-fórmulas (de crm-levy `_csv_safe`/`_csv_unsafe`): al exportar, una
 * celda que empieza por = + - @ tab o CR lleva delante una comilla simple para
 * que Excel no la ejecute; al importar se quita SOLO en ese caso. Sin la
 * segunda mitad, exportar y volver a importar duplicaba a todos los contactos
 * (todo teléfono E.164 empieza por `+` y salía como `'+34…`).
 */

const FORMULA_STARTS = ["=", "+", "-", "@", "\t", "\r"];

export function csvSafe(value: string) {
  return value && FORMULA_STARTS.includes(value[0]) ? `'${value}` : value;
}

export function csvUnsafe(value: string) {
  return value.length >= 2 && value[0] === "'" && FORMULA_STARTS.includes(value[1]) ? value.slice(1) : value;
}

/** Separador más probable mirando la cabecera (fuera de comillas). */
export function detectDelimiter(text: string) {
  let commas = 0;
  let semicolons = 0;
  let quoted = false;

  for (const char of text) {
    if (char === '"') {
      quoted = !quoted;
    } else if (!quoted && (char === "\n" || char === "\r")) {
      break;
    } else if (!quoted && char === ",") {
      commas += 1;
    } else if (!quoted && char === ";") {
      semicolons += 1;
    }
  }

  return semicolons > commas ? ";" : ",";
}

/** Filas de celdas. Quita el BOM y las filas totalmente vacías. */
export function parseCsv(input: string, delimiter = detectDelimiter(input.replace(/^﻿/, ""))) {
  const text = input.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"' && cell === "") {
      quoted = true;
    } else if (char === delimiter) {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") {
        i += 1;
      }
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter((cells) => cells.some((value) => value.trim() !== ""));
}

/** Filas como objetos con la cabecera en minúsculas y sin espacios alrededor. */
export function parseCsvRecords(input: string) {
  const [header, ...rows] = parseCsv(input);

  if (!header) {
    return { columns: [] as string[], records: [] as Array<Record<string, string>> };
  }

  const columns = header.map((name) => name.trim().toLowerCase());

  return {
    columns,
    records: rows.map((cells) =>
      Object.fromEntries(columns.map((column, index) => [column, csvUnsafe((cells[index] ?? "").trim())])),
    ),
  };
}

function quoteCell(value: string, delimiter: string) {
  const safe = csvSafe(value);
  return /["\r\n]/.test(safe) || safe.includes(delimiter) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** CSV con BOM (para que Excel lea bien los acentos) y fin de línea CRLF. */
export function toCsv(header: string[], rows: string[][], delimiter = ",") {
  const lines = [header, ...rows].map((cells) => cells.map((cell) => quoteCell(cell ?? "", delimiter)).join(delimiter));
  return `﻿${lines.join("\r\n")}\r\n`;
}
