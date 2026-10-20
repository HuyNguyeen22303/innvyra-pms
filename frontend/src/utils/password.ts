/**
 * Generates a cryptographically strong random password using Web Crypto API.
 * Ensures minimum 16 characters with at least 8 distinct characters.
 */
export const generateSecurePassword = (length = 16): string => {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=';
  const array = new Uint32Array(length);
  window.crypto.getRandomValues(array);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += charset[array[i] % charset.length];
  }
  // Guarantee at least 8 distinct characters
  const uniqueCount = new Set(result).size;
  if (uniqueCount < 8) {
    return generateSecurePassword(length);
  }
  return result;
};
