import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { BitbucketApiError, BitbucketClient } from '../api/bitbucket';
import {
  clearAllAccounts,
  loadAccountStore,
  saveAccountStore,
} from '../storage';
import type {
  AccountStore,
  BitbucketUser,
  Credentials,
  StoredAccount,
} from '../types';

type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

type AuthContextValue = {
  status: AuthStatus;
  accounts: StoredAccount[];
  activeAccountId: string | null;
  favoriteAccountIds: string[];
  user: BitbucketUser | null;
  client: BitbucketClient | null;
  addAccount: (apiToken: string) => Promise<StoredAccount>;
  switchAccount: (accountId: string) => Promise<void>;
  removeAccount: (accountId: string) => Promise<void>;
  toggleAccountFavorite: (accountId: string) => Promise<void>;
  handleAuthError: (error: unknown) => Promise<boolean>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function toStoredAccount(user: BitbucketUser, apiToken: string): StoredAccount {
  return {
    id: user.account_id,
    apiToken,
    displayName: user.display_name,
    nickname: user.nickname ?? user.username ?? null,
    avatarUrl: user.links?.avatar?.href ?? null,
  };
}

async function fetchUser(apiToken: string): Promise<BitbucketUser> {
  const client = new BitbucketClient({ apiToken });
  return client.getCurrentUser();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [store, setStore] = useState<AccountStore>({
    activeAccountId: null,
    accounts: [],
    favoriteAccountIds: [],
  });
  const [user, setUser] = useState<BitbucketUser | null>(null);

  const activeAccount = useMemo(
    () =>
      store.accounts.find((account) => account.id === store.activeAccountId) ??
      null,
    [store]
  );

  const credentials: Credentials | null = activeAccount
    ? { apiToken: activeAccount.apiToken }
    : null;

  const client = useMemo(
    () => (credentials ? new BitbucketClient(credentials) : null),
    [credentials]
  );

  const persist = useCallback(async (next: AccountStore) => {
    setStore(next);
    await saveAccountStore(next);
  }, []);

  const restoreSession = useCallback(async () => {
    const loaded = await loadAccountStore();
    if (loaded.accounts.length === 0) {
      setStore(loaded);
      setUser(null);
      setStatus('signedOut');
      return;
    }

    let working = loaded;
    const active =
      working.accounts.find((account) => account.id === working.activeAccountId) ??
      working.accounts[0];

    try {
      const currentUser = await fetchUser(active.apiToken);
      const normalized = toStoredAccount(currentUser, active.apiToken);
      const accounts = working.accounts.map((account) =>
        account.id === active.id ? normalized : account
      );
      const deduped = accounts.filter(
        (account, index, list) =>
          list.findIndex((item) => item.id === account.id) === index
      );
      working = {
        activeAccountId: normalized.id,
        accounts: deduped,
        favoriteAccountIds: working.favoriteAccountIds
          .map((id) => (id === active.id ? normalized.id : id))
          .filter((id, index, list) => list.indexOf(id) === index),
      };
      await persist(working);
      setUser(currentUser);
      setStatus('signedIn');
    } catch (error) {
      if (error instanceof BitbucketApiError && error.isUnauthorized) {
        const remaining = working.accounts.filter(
          (account) => account.id !== active.id
        );
        if (remaining.length === 0) {
          await clearAllAccounts();
          setStore(emptyStore());
          setUser(null);
          setStatus('signedOut');
          return;
        }
        working = {
          ...working,
          accounts: remaining,
          activeAccountId: remaining[0].id,
          favoriteAccountIds: working.favoriteAccountIds.filter(
            (id) => id !== active.id
          ),
        };
        await persist(working);
        try {
          const nextUser = await fetchUser(remaining[0].apiToken);
          setUser(nextUser);
          setStatus('signedIn');
        } catch {
          await clearAllAccounts();
          setUser(null);
          setStatus('signedOut');
        }
        return;
      }
      setStore(working);
      setUser(null);
      setStatus('signedOut');
    }
  }, [persist]);

  useEffect(() => {
    void restoreSession();
  }, [restoreSession]);

  const addAccount = useCallback(
    async (apiToken: string) => {
      const token = apiToken.trim();
      const currentUser = await fetchUser(token);
      const account = toStoredAccount(currentUser, token);
      const withoutDup = store.accounts.filter((item) => item.id !== account.id);
      const next: AccountStore = {
        activeAccountId: account.id,
        accounts: [...withoutDup, account],
        favoriteAccountIds: store.favoriteAccountIds,
      };
      await persist(next);
      setUser(currentUser);
      setStatus('signedIn');
      return account;
    },
    [persist, store.accounts, store.favoriteAccountIds]
  );

  const switchAccount = useCallback(
    async (accountId: string) => {
      const account = store.accounts.find((item) => item.id === accountId);
      if (!account) return;
      try {
        const currentUser = await fetchUser(account.apiToken);
        const updated = toStoredAccount(currentUser, account.apiToken);
        const next: AccountStore = {
          ...store,
          activeAccountId: updated.id,
          accounts: store.accounts.map((item) =>
            item.id === accountId ? updated : item
          ),
        };
        await persist(next);
        setUser(currentUser);
        setStatus('signedIn');
      } catch (error) {
        if (error instanceof BitbucketApiError && error.isUnauthorized) {
          throw new Error('이 계정의 토큰이 만료되었습니다. 다시 추가해주세요.');
        }
        throw error;
      }
    },
    [persist, store]
  );

  const removeAccount = useCallback(
    async (accountId: string) => {
      const remaining = store.accounts.filter((item) => item.id !== accountId);
      const favoriteAccountIds = store.favoriteAccountIds.filter(
        (id) => id !== accountId
      );
      if (remaining.length === 0) {
        await clearAllAccounts();
        setStore(emptyStore());
        setUser(null);
        setStatus('signedOut');
        return;
      }

      const nextActiveId =
        store.activeAccountId === accountId
          ? remaining[0].id
          : store.activeAccountId;
      const next: AccountStore = {
        activeAccountId: nextActiveId,
        accounts: remaining,
        favoriteAccountIds,
      };
      await persist(next);

      if (store.activeAccountId === accountId) {
        const currentUser = await fetchUser(remaining[0].apiToken);
        setUser(currentUser);
      }
      setStatus('signedIn');
    },
    [persist, store]
  );

  const toggleAccountFavorite = useCallback(
    async (accountId: string) => {
      const favoriteAccountIds = store.favoriteAccountIds.includes(accountId)
        ? store.favoriteAccountIds.filter((id) => id !== accountId)
        : [accountId, ...store.favoriteAccountIds.filter((id) => id !== accountId)];
      await persist({ ...store, favoriteAccountIds });
    },
    [persist, store]
  );

  const handleAuthError = useCallback(
    async (error: unknown) => {
      if (error instanceof BitbucketApiError && error.isUnauthorized) {
        if (store.activeAccountId) {
          await removeAccount(store.activeAccountId);
        }
        return true;
      }
      return false;
    },
    [removeAccount, store.activeAccountId]
  );

  const value = useMemo(
    () => ({
      status,
      accounts: store.accounts,
      activeAccountId: store.activeAccountId,
      favoriteAccountIds: store.favoriteAccountIds,
      user,
      client,
      addAccount,
      switchAccount,
      removeAccount,
      toggleAccountFavorite,
      handleAuthError,
    }),
    [
      status,
      store.accounts,
      store.activeAccountId,
      store.favoriteAccountIds,
      user,
      client,
      addAccount,
      switchAccount,
      removeAccount,
      toggleAccountFavorite,
      handleAuthError,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function emptyStore(): AccountStore {
  return {
    activeAccountId: null,
    accounts: [],
    favoriteAccountIds: [],
  };
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
