import * as Keychain from 'react-native-keychain';
import type { Role } from '../../types/preview';
import { demoAccounts, demoPassword } from '../mock/seed';

export type MockSession = { role: Role; userId: string; serverUrl: string; tenantId: string; expiresAt: number };
const options = { service: 'com.nascon.sports.mock-session.v1' };
export const sessionDuration = 60 * 60 * 1000;
export function authenticateMock(email: string, password: string, serverUrl: string, now: number): MockSession | null {
  const account = demoAccounts.find(x => x.email.toLowerCase() === email.trim().toLowerCase());
  if (!account || password !== demoPassword) return null;
  return { role:account.role,userId:account.user_id,serverUrl,tenantId:account.tenant_id || 'tenant-alpha',expiresAt:now+sessionDuration };
}
export function isValidSession(value: MockSession | null, server: string, now: number) {
  return !!value && value.serverUrl===server && value.expiresAt>now && demoAccounts.some(x=>x.user_id===value.userId&&x.role===value.role);
}
export const mockSessionStorage = {
  read: async (): Promise<MockSession|null> => { const value=await Keychain.getGenericPassword(options);return value?JSON.parse(value.password):null; },
  save: async (session: MockSession) => { await Keychain.setGenericPassword('mock-session',JSON.stringify(session),options); },
  clear: async () => { await Keychain.resetGenericPassword(options); },
};
