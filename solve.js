// Fast drop-in for csv-reader 1.0.0 (make.fun's own reference program): run(input)
// returns exactly csv-reader's answer {columns, rows, errors} for every input,
// but reads the text by jumping between delimiters instead of one character at
// a time. Only the rare broken-row paths walk characters.
//
// Semantics, copied from the reference (vendor/csv-reader/index.js):
//   - a U+FEFF at the very start of the text is dropped;
//   - a record ends at LF or CRLF, and a line left with no characters is no record;
//   - outside a quoted field a CR not followed by LF is dropped (stray_cr);
//   - a field that opens with a quote runs to the next quote that is not doubled,
//     "" inside it one quote, and each CRLF or lone CR inside it is read as LF;
//     what follows its closing quote, up to the next comma or line break, is
//     appended as it stands (quote_junk, when the field ends); a quote that never
//     closes is a literal character, and the text after it is read again as
//     unquoted (unterminated_quote);
//   - a quote inside an unquoted field is a literal character; fields stay
//     strings, never trimmed or converted;
//   - columns is the first record when header is true, else null; rows holds the
//     records after it, each padded with "" (short_row, with fields: its count)
//     or cut (long_row, with extra: the cut fields) to the first record's width;
//   - each error is {code, line, row}: line the 1-based line its record starts
//     on, row its record's index in rows (null for the header), in the order met.

const COMMA = 0;
const LINE_BREAK = 1;
const END = 2;

/** csv-reader 1.0.0's answer for one case's input. */
export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  const n = text.length;
  let pos = 0; // the next character to read
  let line = 1; // the line that character is on
  if (n > 0 && text.charCodeAt(0) === 0xFEFF) pos = 1;

  // The record being read: the line it starts on and the index in rows it takes (null: the header).
  let recordLine = 1;
  let recordRow = null;

  // The field just read (avoids one small object per field).
  let fValue = '';
  let fEnded = END;
  let fAdded = 0;

  // One scan finds the next of comma / CR / LF, so a far-away CR is never
  // scanned for (a stray CR is rare, the next comma or LF is always close).
  const SEP = /[,\r\n]/g;

  // Reads an unquoted field starting at pos, appending onto `prefix`.
  // Sets fValue / fEnded / fAdded (characters kept by this read, prefix excluded).
  function readUnquoted(prefix) {
    let value = prefix;
    let added = 0;
    SEP.lastIndex = pos;
    let m;
    while ((m = SEP.exec(text)) !== null) {
      const i = m.index;
      const c = m[0];
      if (c === ',') {
        value += text.slice(pos, i);
        added += i - pos;
        pos = i + 1;
        fValue = value;
        fEnded = COMMA;
        fAdded = added;
        return;
      }
      if (c === '\n') {
        value += text.slice(pos, i);
        added += i - pos;
        pos = i + 1;
        line += 1;
        fValue = value;
        fEnded = LINE_BREAK;
        fAdded = added;
        return;
      }
      // A CR: a line break when followed by LF, else a dropped stray CR.
      if (text.charCodeAt(i + 1) === 10) {
        value += text.slice(pos, i);
        added += i - pos;
        pos = i + 2;
        line += 1;
        fValue = value;
        fEnded = LINE_BREAK;
        fAdded = added;
        return;
      }
      errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
      value += text.slice(pos, i);
      added += i - pos;
      pos = i + 1;
      SEP.lastIndex = pos;
    }
    value += text.slice(pos, n);
    added += n - pos;
    pos = n;
    fValue = value;
    fEnded = END;
    fAdded = added;
  }

  // Reads the quoted segment [from, to): CRLF and lone CR inside it each become
  // one LF (and count one line), LF stays LF. Only used when the segment holds
  // a CR or LF at all; returns the converted string.
  function convertSegment(from, to) {
    let out = '';
    let p = from;
    while (p < to) {
      const c = text.charCodeAt(p);
      if (c === 13) {
        out += '\n';
        line += 1;
        p += text.charCodeAt(p + 1) === 10 ? 2 : 1;
      } else if (c === 10) {
        out += '\n';
        line += 1;
        p += 1;
      } else {
        out += text[p];
        p += 1;
      }
    }
    return out;
  }

  // Reads a quoted field whose opening quote is at pos. Sets fValue / fEnded /
  // fAdded (fAdded counts only what the junk tail kept, as the reference does).
  function readQuoted() {
    const open = pos;
    const openLine = line;
    let value = '';
    pos += 1; // past the opening quote
    for (;;) {
      const q = text.indexOf('"', pos);
      if (q === -1) {
        // The quote never closes: it is a literal character, and the text after
        // it is read again as an unquoted field.
        pos = open + 1;
        line = openLine;
        errors.push({ code: 'unterminated_quote', line: recordLine, row: recordRow });
        readUnquoted('"');
        return;
      }
      // Segment [pos, q) holds no quote; convert it only if it holds CR/LF.
      const nl = text.indexOf('\n', pos);
      const cr = text.indexOf('\r', pos);
      if ((nl === -1 || nl >= q) && (cr === -1 || cr >= q)) {
        value += text.slice(pos, q);
      } else {
        value += convertSegment(pos, q);
      }
      if (text.charCodeAt(q + 1) === 34) {
        // Doubled quote: one quote in the value, field goes on.
        value += '"';
        pos = q + 2;
        continue;
      }
      // Closing quote at q.
      pos = q + 1;
      if (pos >= n) {
        fValue = value;
        fEnded = END;
        fAdded = 0;
        return;
      }
      const c = text.charCodeAt(pos);
      if (c === 44) {
        pos += 1;
        fValue = value;
        fEnded = COMMA;
        fAdded = 0;
        return;
      }
      if (c === 10) {
        pos += 1;
        line += 1;
        fValue = value;
        fEnded = LINE_BREAK;
        fAdded = 0;
        return;
      }
      if (c === 13 && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
        fValue = value;
        fEnded = LINE_BREAK;
        fAdded = 0;
        return;
      }
      // What follows the closing quote is appended as it stands, up to the
      // next comma or line break.
      readUnquoted(value);
      if (fAdded > 0) errors.push({ code: 'quote_junk', line: recordLine, row: recordRow });
      return;
    }
  }

  for (;;) {
    // Lines with no characters are no records.
    while (pos < n) {
      const c = text.charCodeAt(pos);
      if (c === 10) {
        pos += 1;
        line += 1;
      } else if (c === 13 && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
      } else {
        break;
      }
    }
    if (pos >= n) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;

    // Fast path: the rest of this line holds no quote and no stray CR, so the
    // whole record is one slice split on commas. (A quote anywhere in the line
    // forces the slow path: a quoted field may span the line break, and junk
    // may follow its closing quote. A CR anywhere but the line's end is a
    // stray CR, which the slow path drops with an error.) The checks run on
    // the line's own slice, so no scan ever runs past the line's end.
    const le = text.indexOf('\n', pos);
    const end = le === -1 ? n : le;
    const seg = text.slice(pos, end);
    if (seg.indexOf('"') === -1) {
      const ri = seg.indexOf('\r');
      if (ri === -1) {
        commitRecord(seg.split(','));
        pos = le === -1 ? n : le + 1;
        if (le !== -1) line += 1;
        continue;
      }
      if (le !== -1 && ri === seg.length - 1) {
        // CRLF line ending, and nothing else in the line is a CR.
        commitRecord(seg.slice(0, -1).split(','));
        pos = le + 1;
        line += 1;
        continue;
      }
      // A stray CR inside the line: fall through to the slow path.
    }

    const fields = [];
    let quoted = false;
    do {
      quoted = text.charCodeAt(pos) === 34;
      if (quoted) readQuoted();
      else readUnquoted('');
      fields.push(fValue);
    } while (fEnded === COMMA);

    // A line that held only stray CRs is left with no characters: no record
    // (its stray_cr errors stay).
    if (fields.length === 1 && fields[0] === '' && !quoted) continue;

    commitRecord(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };

  // Files one parsed record: header, width, short/long-row errors, padding.
  function commitRecord(fields) {
    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      return;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }
}
