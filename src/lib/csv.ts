/**
 * 轻量 CSV 解析：支持 UTF-8 BOM、CRLF、引号转义与引号内换行。
 * 返回二维字符串数组，行尾空行会被丢弃。
 */
export const parseCsv = (text: string): string[][] => {
  const source = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  const pushCell = () => {
    row.push(cell);
    cell = "";
  };
  const pushRow = () => {
    // 忽略完全空白的尾行；中间的空行保留，交由导入层给出提示。
    if (row.length > 1 || row[0]?.trim()) rows.push(row);
    row = [];
  };

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === '"') {
      if (quoted && source[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (char === "," && !quoted) {
      pushCell();
      continue;
    }
    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && source[index + 1] === "\n") index += 1;
      pushCell();
      pushRow();
      continue;
    }
    cell += char;
  }

  if (cell || row.length) {
    pushCell();
    pushRow();
  }
  return rows;
};

/** 首行作为表头，其余行转为对象；空表头列会被忽略。 */
export const csvToObjects = (rows: string[][]): Record<string, unknown>[] => {
  const headers = (rows[0] ?? []).map((cell) => cell.trim());
  return rows.slice(1).map((row) => {
    const object: Record<string, unknown> = {};
    headers.forEach((header, index) => {
      if (header) object[header] = row[index] ?? "";
    });
    return object;
  });
};
