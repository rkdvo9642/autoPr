import type { AccountStore, StoredAccount } from './types';

const ACCOUNT_STORE_KEY = 'autopr.accounts.v1';
const FAVORITES_KEY_PREFIX = 'autopr.favorites.projects.';
const BRANCH_FAVORITES_KEY_PREFIX = 'autopr.favorites.branches.';
const MERGE_SELECTION_KEY_PREFIX = 'autopr.merge.selection.';

function safeStorageKey(value: string): string {
  const cleaned = value.replace(/[^a-zA-Z0-9._-]/g, '_');
  return cleaned.length > 0 ? cleaned : 'unknown';
}

function setItem(key: string, value: string): void {
  localStorage.setItem(key, value);
}

function getItem(key: string): string | null {
  return localStorage.getItem(key);
}

function removeItem(key: string): void {
  localStorage.removeItem(key);
}

function emptyAccountStore(): AccountStore {
  return {
    activeAccountId: null,
    accounts: [],
    favoriteAccountIds: [],
  };
}

export async function loadAccountStore(): Promise<AccountStore> {
  const raw = getItem(ACCOUNT_STORE_KEY);
  if (!raw) return emptyAccountStore();
  try {
    const parsed = JSON.parse(raw) as Partial<AccountStore>;
    const accounts = Array.isArray(parsed.accounts)
      ? parsed.accounts.filter(
          (item): item is StoredAccount =>
            Boolean(
              item &&
                typeof item.id === 'string' &&
                typeof item.apiToken === 'string' &&
                typeof item.displayName === 'string'
            )
        )
      : [];
    const favoriteAccountIds = Array.isArray(parsed.favoriteAccountIds)
      ? parsed.favoriteAccountIds.filter(
          (item): item is string => typeof item === 'string'
        )
      : [];
    const activeAccountId =
      typeof parsed.activeAccountId === 'string' &&
      accounts.some((account) => account.id === parsed.activeAccountId)
        ? parsed.activeAccountId
        : (accounts[0]?.id ?? null);
    return { activeAccountId, accounts, favoriteAccountIds };
  } catch {
    return emptyAccountStore();
  }
}

export async function saveAccountStore(store: AccountStore): Promise<void> {
  setItem(ACCOUNT_STORE_KEY, JSON.stringify(store));
}

export async function clearAllAccounts(): Promise<void> {
  removeItem(ACCOUNT_STORE_KEY);
}

export type BranchFavoritesMap = Record<
  string,
  {
    source: string[];
    target: string[];
  }
>;

function normalizeBranchEntry(value: unknown): {
  source: string[];
  target: string[];
} {
  if (Array.isArray(value)) {
    const legacy = value.filter((item): item is string => typeof item === 'string');
    return { source: legacy, target: legacy };
  }
  if (!value || typeof value !== 'object') {
    return { source: [], target: [] };
  }
  const record = value as { source?: unknown; target?: unknown };
  return {
    source: Array.isArray(record.source)
      ? record.source.filter((item): item is string => typeof item === 'string')
      : [],
    target: Array.isArray(record.target)
      ? record.target.filter((item): item is string => typeof item === 'string')
      : [],
  };
}

export async function loadFavoriteProjects(accountId: string): Promise<string[]> {
  const raw = getItem(`${FAVORITES_KEY_PREFIX}${safeStorageKey(accountId)}`);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === 'string');
  } catch {
    return [];
  }
}

export async function saveFavoriteProjects(
  accountId: string,
  keys: string[]
): Promise<void> {
  setItem(
    `${FAVORITES_KEY_PREFIX}${safeStorageKey(accountId)}`,
    JSON.stringify(keys)
  );
}

export async function loadFavoriteBranches(
  accountId: string
): Promise<BranchFavoritesMap> {
  const raw = getItem(
    `${BRANCH_FAVORITES_KEY_PREFIX}${safeStorageKey(accountId)}`
  );
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const result: BranchFavoritesMap = {};
    for (const [projectKey, value] of Object.entries(parsed)) {
      result[projectKey] = normalizeBranchEntry(value);
    }
    return result;
  } catch {
    return {};
  }
}

export async function saveFavoriteBranches(
  accountId: string,
  map: BranchFavoritesMap
): Promise<void> {
  setItem(
    `${BRANCH_FAVORITES_KEY_PREFIX}${safeStorageKey(accountId)}`,
    JSON.stringify(map)
  );
}

export type MergeSelection = {
  projectKey: string | null;
  byProject: Record<
    string,
    {
      sourceBranch: string | null;
      targetBranch: string | null;
    }
  >;
};

export async function loadMergeSelection(
  accountId: string
): Promise<MergeSelection> {
  const raw = getItem(
    `${MERGE_SELECTION_KEY_PREFIX}${safeStorageKey(accountId)}`
  );
  if (!raw) {
    return { projectKey: null, byProject: {} };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<MergeSelection>;
    const byProject: MergeSelection['byProject'] = {};
    if (parsed.byProject && typeof parsed.byProject === 'object') {
      for (const [projectKey, value] of Object.entries(parsed.byProject)) {
        if (!value || typeof value !== 'object') continue;
        byProject[projectKey] = {
          sourceBranch:
            typeof value.sourceBranch === 'string' ? value.sourceBranch : null,
          targetBranch:
            typeof value.targetBranch === 'string' ? value.targetBranch : null,
        };
      }
    }
    return {
      projectKey:
        typeof parsed.projectKey === 'string' ? parsed.projectKey : null,
      byProject,
    };
  } catch {
    return { projectKey: null, byProject: {} };
  }
}

export async function saveMergeSelection(
  accountId: string,
  selection: MergeSelection
): Promise<void> {
  setItem(
    `${MERGE_SELECTION_KEY_PREFIX}${safeStorageKey(accountId)}`,
    JSON.stringify(selection)
  );
}
