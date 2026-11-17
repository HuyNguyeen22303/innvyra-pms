declare module 'vietqr' {
  export interface VietQrBank {
    bin: string;
    code: string;
    name: string;
    shortName: string;
    transferSupported: number;
  }
  export const BANKS: VietQrBank[];
  export function generateQR(input: {
    acqId: string;
    accountNo: string;
    accountName: string;
    amount: string;
    addInfo: string;
    media: 'png';
  }): Promise<{ code: string; data?: { qrCode: string; qrDataURL: string } }>;
}
