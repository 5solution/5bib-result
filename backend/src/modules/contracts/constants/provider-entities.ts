/**
 * F-024 Contract Management — Provider Entity Static Config
 *
 * BR-CM-01: Provider entities are fixed config — exactly 2 options.
 * Default association:
 *   TICKET_SALES / TIMING / RACEKIT → 5BIB
 *   OPERATIONS                     → 5SOLUTION
 * Admin can override per contract.
 */

export type ProviderId = '5BIB' | '5SOLUTION';

export interface ProviderEntity {
  id: ProviderId;
  shortName: string;
  entityName: string;
  taxId: string;
  address: string;
  representative: string;
  position: string;
  bankAccount: string;
  bankName: string;
}

export const PROVIDER_5BIB: ProviderEntity = {
  id: '5BIB',
  shortName: '5BIB',
  entityName: 'CÔNG TY CỔ PHẦN 5BIB',
  taxId: '0110398986',
  address:
    'Tầng 9, Tòa nhà Hồ Gươm Plaza (tòa văn phòng), Số 102 Phố Trần Phú, Phường Hà Đông, Thành phố Hà Nội, Việt Nam',
  representative: 'Nguyễn Bình Minh',
  position: 'Giám đốc',
  bankAccount: '110398986',
  bankName: 'MB - Chi nhánh Thụy Khuê',
};

export const PROVIDER_5SOLUTION: ProviderEntity = {
  id: '5SOLUTION',
  shortName: '5SOLUTION',
  entityName: 'CÔNG TY CỔ PHẦN CÔNG NGHỆ 5SOLUTION',
  taxId: '0111213998',
  address:
    'Văn phòng 501, tầng 5, tòa nhà Dreamland Bonanza, số 23 Duy Tân, Phường Cầu Giấy, Thành phố Hà Nội, Việt Nam',
  representative: 'Nguyễn Bình Minh',
  position: 'Tổng Giám Đốc',
  bankAccount: '111213998',
  bankName: 'MB - Chi nhánh Hai Bà Trưng',
};

export const PROVIDER_ENTITIES: Record<ProviderId, ProviderEntity> = {
  '5BIB': PROVIDER_5BIB,
  '5SOLUTION': PROVIDER_5SOLUTION,
};

/** Default provider per contract type (BR-CM-01). Admin can override. */
export const DEFAULT_PROVIDER_BY_TYPE: Record<string, ProviderId> = {
  TICKET_SALES: '5BIB',
  TIMING: '5BIB',
  RACEKIT: '5BIB',
  OPERATIONS: '5SOLUTION',
};

export function getProviderEntity(id: ProviderId): ProviderEntity {
  const entity = PROVIDER_ENTITIES[id];
  if (!entity) {
    throw new Error(`Unknown providerId: ${id}`);
  }
  return entity;
}
