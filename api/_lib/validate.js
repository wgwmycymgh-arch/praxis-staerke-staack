// Body-Felder kommen als JSON von außen und sind nicht zwingend Strings.
// Ohne diese Prüfung wirft .trim() auf einer Zahl einen TypeError -> 500
// statt einer sauberen 400.
export function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

// error.message von Postgres kann Tabellen- und Spaltennamen enthalten.
// Details ins Log, dem Client nur die Tatsache.
export function serverError(res, context, error) {
  console.error(context, error?.message || error);
  return res.status(500).json({ success: false, error: 'Interner Fehler. Bitte später erneut versuchen.' });
}
