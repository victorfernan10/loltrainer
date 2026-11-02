function setValue(values, section, name, value) {
  const normalizedSection = section.trim().toLowerCase();
  const normalizedName = name.trim().toLowerCase();
  const normalizedValue = String(value ?? '').trim();
  values[`${normalizedSection}.${normalizedName}`] = normalizedValue;
  if (!Object.hasOwn(values, normalizedName) || normalizedSection === 'general') {
    values[normalizedName] = normalizedValue;
  }
}

export function parseLolConfig(fileName, text) {
  const values = Object.create(null);
  if (/\.json$/i.test(fileName)) {
    const document = JSON.parse(text);
    for (const file of document.files ?? []) {
      for (const section of file.sections ?? []) {
        for (const setting of section.settings ?? []) {
          setValue(values, section.name ?? '', setting.name, setting.value);
        }
      }
    }
    return values;
  }

  let section = '';
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith(';') || line.startsWith('#')) continue;
    const sectionMatch = line.match(/^\[([^\]]+)\]$/);
    if (sectionMatch) {
      section = sectionMatch[1];
      continue;
    }
    const equals = line.indexOf('=');
    if (equals < 1) continue;
    setValue(values, section, line.slice(0, equals), line.slice(equals + 1));
  }
  return values;
}

export function findLolSetting(values, ...names) {
  for (const name of names) {
    const key = name.toLowerCase();
    if (Object.hasOwn(values, `general.${key}`)) return values[`general.${key}`];
    if (Object.hasOwn(values, key)) return values[key];
  }
  return undefined;
}
