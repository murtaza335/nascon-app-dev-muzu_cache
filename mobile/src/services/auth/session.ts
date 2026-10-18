import * as Keychain from 'react-native-keychain';
import type { ScreenData } from '../../types/models';
export type Session = {
  token: string;
  expires_at: string;
  user: NonNullable<ScreenData['user']>;
  tenant: ScreenData['tenant'];
  serverUrl: string;
  tenantId: string | null;
  userId: string;
};
const options = { service: 'com.nascon.sports.api-session.v1' };
export const sessionStorage = {
  read: async (): Promise<Session | null> => {
    const value = await Keychain.getGenericPassword(options);
    return value ? JSON.parse(value.password) : null;
  },
  save: async (session: Session) => {
    await Keychain.setGenericPassword('session', JSON.stringify(session), options);
  },
  clear: async () => {
    await Keychain.resetGenericPassword(options);
  },
};
export function validSession(value: Session | null, server: string) {
  return !!value?.token && value.serverUrl === server && Date.parse(value.expires_at) > Date.now();
}
export const sessionScope = (s: Session) => JSON.stringify([s.serverUrl, s.userId, s.tenantId]);
