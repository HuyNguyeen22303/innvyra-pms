import { BANKS, generateQR, type VietQrBank } from 'vietqr';
import { AppError } from '../../shared/errors/app-error.js';

const validBanks = (banks: VietQrBank[]) =>
  banks
    .filter(
      (bank) =>
        /^\d{6}$/.test(bank.bin) &&
        typeof bank.name === 'string' &&
        typeof bank.shortName === 'string' &&
        bank.transferSupported === 1,
    )
    .map(({ bin, code, name, shortName }) => ({ bin, code, name, shortName }));
let cached = { banks: validBanks(BANKS), refreshedAt: 0, source: 'SNAPSHOT' };
let pending: Promise<typeof cached> | undefined;
export async function paymentBanks() {
  if (Date.now() - cached.refreshedAt < 86400000) return cached;
  pending ??= (async () => {
    try {
      const response = await fetch('https://api.vietqr.io/v2/banks', {
        signal: AbortSignal.timeout(2500),
        redirect: 'error',
      });
      if (!response.ok) throw new Error('Bank catalog unavailable');
      const payload = (await response.json()) as { code?: string; data?: VietQrBank[] };
      const banks =
        payload.code === '00' && Array.isArray(payload.data) ? validBanks(payload.data) : [];
      if (!banks.length) throw new Error('Invalid bank catalog');
      cached = { banks, refreshedAt: Date.now(), source: 'LIVE' };
    } catch {
      cached = { ...cached, refreshedAt: Date.now() };
    }
    return cached;
  })().finally(() => {
    pending = undefined;
  });
  return pending;
}
export async function renderPaymentQr(input: {
  bankBin: string;
  accountNumber: string;
  accountName: string;
  amount: { toString(): string };
  memo: string;
}) {
  const result = await generateQR({
    acqId: input.bankBin,
    accountNo: input.accountNumber,
    accountName: input.accountName,
    amount: input.amount.toString().split('.')[0]!,
    addInfo: input.memo,
    media: 'png',
  });
  if (result.code !== '00' || !result.data?.qrDataURL?.startsWith('data:image/png;base64,'))
    throw new AppError(503, 'QR_RENDER_FAILED', 'Chưa tạo được QR. Thử lại trên đơn đã lưu.');
  return result.data;
}
