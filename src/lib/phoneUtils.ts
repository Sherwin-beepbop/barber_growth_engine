export function normalizePhoneNumber(phone: string): string {
  let normalized = phone.trim();

  normalized = normalized.replace(/[\s\(\)\-]/g, '');

  if (normalized.startsWith('06')) {
    normalized = '+316' + normalized.slice(2);
  }

  else if (normalized.startsWith('+316')) {
    normalized = normalized;
  }

  else if (normalized.startsWith('+3106')) {
    normalized = '+316' + normalized.slice(5);
  }

  else if (normalized.startsWith('+310')) {
    normalized = '+31' + normalized.slice(4);
  }

  else if (!normalized.startsWith('+')) {
    if (normalized.startsWith('31')) {
      normalized = '+' + normalized;
    } else if (normalized.startsWith('0')) {
      normalized = '+31' + normalized.slice(1);
    }
  }

  return normalized;
}
