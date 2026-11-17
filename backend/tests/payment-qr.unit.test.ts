import { describe, it, expect, vi } from 'vitest';
import jsQrModule from 'jsqr';
import { PNG } from 'pngjs';
import { renderPaymentQr } from '../src/modules/payment-qr/vietqr.js';
import { bankAccountBody, qrRequestBody } from '../src/modules/payment-qr/payment-qr.schema.js';
const jsQR = jsQrModule as unknown as (
  data: Uint8ClampedArray,
  width: number,
  height: number,
) => { data: string } | null;

const fields = (text: string) => {
  const result: Record<string, string> = {};
  for (let i = 0; i < text.length;) {
    const tag = text.slice(i, i + 2),
      length = Number(text.slice(i + 2, i + 4));
    result[tag] = text.slice(i + 4, i + 4 + length);
    i += length + 4;
  }
  return result;
};
describe('Offline VietQR wire payload', () => {
  it.each(['1', '300000', '9999999999999'])(
    'decodes an actual PNG for %s VND and validates account, memo and CRC',
    async (amount) => {
      const network = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Offline test'));
      try {
        const result = await renderPaymentQr({
          bankBin: '970415',
          accountNumber: '000111222333',
          accountName: 'NGUYEN VAN AN',
          amount,
          memo: 'INN0123456789ABCDEF',
        });
        const png = PNG.sync.read(Buffer.from(result.qrDataURL.split(',')[1]!, 'base64'));
        const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
        expect(decoded?.data).toBe(result.qrCode);
        const tlv = fields(decoded!.data);
        expect(tlv['01']).toBe('12');
        expect(tlv['53']).toBe('704');
        expect(tlv['54']).toBe(amount);
        const merchant = fields(tlv['38']!),
          account = fields(merchant['01']!);
        expect(account).toMatchObject({ '00': '970415', '01': '000111222333' });
        expect(fields(tlv['62']!)['08']).toBe('INN0123456789ABCDEF');
        let crc = 0xffff;
        for (const byte of Buffer.from(result.qrCode.slice(0, -4))) {
          crc ^= byte << 8;
          for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
          crc &= 0xffff;
        }
        expect(result.qrCode.slice(-4)).toBe(crc.toString(16).toUpperCase().padStart(4, '0'));
        expect(network).not.toHaveBeenCalled();
      } finally {
        network.mockRestore();
      }
    },
  );
  it('normalizes holder names, preserves leading zeros and refuses unsupported money', () => {
    const bank = bankAccountBody.parse({
      bankBin: '970415',
      accountNumber: '000111222333',
      accountName: 'Đặng Ngọc Ánh',
      enabled: true,
      expectedVersion: 0,
    });
    expect(bank.accountName).toBe('DANG NGOC ANH');
    expect(bank.accountNumber).toBe('000111222333');
    for (const amount of ['0', '01', '1.50', '-1', '10000000000000'])
      expect(qrRequestBody.safeParse({ paymentType: 'DEPOSIT', amount }).success).toBe(false);
  });
});
