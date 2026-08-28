const emptyLabels = {
  date: '日付を選択',
  month: '月を選択',
  time: '時刻を選択',
  'datetime-local': '日時を選択'
};

const matchValue = (value, pattern) => String(value || '').trim().match(pattern);

export function formatDateFieldValue(value, type = 'date') {
  const inputType = Object.hasOwn(emptyLabels, type) ? type : 'date';
  if (!String(value || '').trim()) return emptyLabels[inputType];

  if (inputType === 'date') {
    const match = matchValue(value, /^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? `${match[1]}/${match[2]}/${match[3]}` : String(value);
  }

  if (inputType === 'month') {
    const match = matchValue(value, /^(\d{4})-(\d{2})$/);
    return match ? `${match[1]}/${match[2]}` : String(value);
  }

  if (inputType === 'time') {
    const match = matchValue(value, /^(\d{2}):(\d{2})(?::(\d{2}))?$/);
    return match ? `${match[1]}:${match[2]}${match[3] ? `:${match[3]}` : ''}` : String(value);
  }

  const match = matchValue(value, /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  return match
    ? `${match[1]}/${match[2]}/${match[3]} ${match[4]}:${match[5]}${match[6] ? `:${match[6]}` : ''}`
    : String(value);
}

export function syncDateFieldDisplay(input) {
  const display = input?.closest?.('.date-field-frame')?.querySelector?.('[data-date-field-display]');
  if (!display) return false;
  display.textContent = formatDateFieldValue(input.value, input.type);
  return true;
}
