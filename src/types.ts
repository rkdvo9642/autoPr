export type Credentials = {
  apiToken: string;
};

export type StoredAccount = {
  id: string;
  apiToken: string;
  displayName: string;
  nickname?: string | null;
  avatarUrl?: string | null;
};

export type AccountStore = {
  activeAccountId: string | null;
  accounts: StoredAccount[];
  favoriteAccountIds: string[];
};

export type BitbucketUser = {
  display_name: string;
  username?: string | null;
  nickname?: string | null;
  account_id: string;
  links?: {
    avatar?: { href: string };
  };
};

export type BitbucketWorkspace = {
  slug: string;
  name: string;
  uuid: string;
};

export type BitbucketRepo = {
  uuid: string;
  slug: string;
  name: string;
  full_name: string;
  description?: string | null;
  is_private: boolean;
  updated_on: string;
  workspace: {
    slug: string;
    name: string;
  };
  project?: {
    key: string;
    name: string;
  } | null;
  mainbranch?: {
    name: string;
  } | null;
};

export type BitbucketBranch = {
  name: string;
  target: {
    hash: string;
    date: string;
    message?: string;
    author?: {
      raw?: string;
      user?: {
        display_name?: string;
      };
    };
  };
};

export type BitbucketPullRequest = {
  id: number;
  title: string;
  state: string;
  links?: {
    html?: { href: string };
  };
  source?: {
    branch?: { name?: string };
  };
  destination?: {
    branch?: { name?: string };
  };
};
