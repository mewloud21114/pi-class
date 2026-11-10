'use strict';

/**
 * Mauritanian mobile numbers: 8 digits, first digit identifies the operator
 * (2 = Chinguitel, 3 = Mattel, 4 = Mauritel). Country code +222.
 * Accepts "36123456", "+222 36 12 34 56", "0022236123456", "222-36-12-34-56".
 * Returns E.164 ("+22236123456") or null when invalid.
 */
function normalizeMauritanianPhone(input) {
  if (typeof input !== 'string') return null;
  let digits = input.replace(/[\s\-().]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);
  else if (digits.startsWith('00')) digits = digits.slice(2);
  if (!/^\d+$/.test(digits)) return null;
  if (digits.length === 11 && digits.startsWith('222')) digits = digits.slice(3);
  if (!/^[234]\d{7}$/.test(digits)) return null;
  return `+222${digits}`;
}

module.exports = { normalizeMauritanianPhone };
