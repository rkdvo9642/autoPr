import type {
  BitbucketBranch,
  BitbucketPullRequest,
  BitbucketRepo,
  BitbucketUser,
  BitbucketWorkspace,
  Credentials,
} from '../types';

const API_BASE = 'https://api.bitbucket.org/2.0';

export class BitbucketApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = 'BitbucketApiError';
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }
}

type Paginated<T> = {
  values?: T[];
  next?: string | null;
};

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
};

export class BitbucketClient {
  constructor(private credentials: Credentials) {}

  private headers(hasBody: boolean): Record<string, string> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.credentials.apiToken}`,
      Accept: 'application/json',
    };
    if (hasBody) {
      headers['Content-Type'] = 'application/json';
    }
    return headers;
  }

  private async request<T>(url: string, options: RequestOptions = {}): Promise<T> {
    const method = options.method ?? 'GET';
    const hasBody = options.body !== undefined;
    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers: this.headers(hasBody),
        body: hasBody ? JSON.stringify(options.body) : undefined,
      });
    } catch {
      throw new BitbucketApiError(0, `네트워크 연결을 확인해주세요.\nURL: ${url}`);
    }

    if (response.status === 401) {
      throw new BitbucketApiError(
        401,
        `토큰이 올바르지 않거나 권한이 부족합니다.\nURL: ${url}`
      );
    }

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        error?: { message?: string; detail?: string };
      } | null;
      const message =
        body?.error?.message ?? `요청에 실패했습니다. (${response.status})`;
      const detail = body?.error?.detail ? `\n${body.error.detail}` : '';
      throw new BitbucketApiError(
        response.status,
        `${message}${detail}\nURL: ${url}`
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }

    const text = await response.text();
    if (!text) {
      return undefined as T;
    }
    return JSON.parse(text) as T;
  }

  private async fetchAll<T>(url: string, maxPages = 20): Promise<T[]> {
    const items: T[] = [];
    let next: string | null = url;
    let page = 0;

    while (next && page < maxPages) {
      const data: Paginated<T> = await this.request<Paginated<T>>(next);
      items.push(...(data.values ?? []));
      next = data.next ?? null;
      page += 1;
    }

    return items;
  }

  getCurrentUser(): Promise<BitbucketUser> {
    return this.request<BitbucketUser>(`${API_BASE}/user`);
  }

  async listWorkspaces(): Promise<BitbucketWorkspace[]> {
    const url = `${API_BASE}/user/workspaces?pagelen=50`;
    const memberships = await this.fetchAll<{
      workspace?: BitbucketWorkspace;
      slug?: string;
      name?: string;
      uuid?: string;
    }>(url);

    return memberships
      .map((item) => {
        if (item.workspace?.slug) return item.workspace;
        if (item.slug) {
          return {
            slug: item.slug,
            name: item.name ?? item.slug,
            uuid: item.uuid ?? item.slug,
          };
        }
        return null;
      })
      .filter((workspace): workspace is BitbucketWorkspace => workspace !== null);
  }

  async listRepositories(): Promise<BitbucketRepo[]> {
    const workspaces = await this.listWorkspaces();
    if (workspaces.length === 0) {
      return [];
    }

    const reposByWorkspace = await Promise.all(
      workspaces.map((workspace) => {
        const url =
          `${API_BASE}/repositories/${encodeURIComponent(workspace.slug)}` +
          `?role=member&sort=-updated_on&pagelen=50`;
        return this.fetchAll<BitbucketRepo>(url);
      })
    );

    return reposByWorkspace
      .flat()
      .sort(
        (a, b) =>
          new Date(b.updated_on).getTime() - new Date(a.updated_on).getTime()
      );
  }

  listBranches(workspace: string, repoSlug: string): Promise<BitbucketBranch[]> {
    const url = `${API_BASE}/repositories/${encodeURIComponent(workspace)}/${encodeURIComponent(repoSlug)}/refs/branches?pagelen=50`;
    return this.fetchAll<BitbucketBranch>(url);
  }

  async findOpenPullRequest(
    workspace: string,
    repoSlug: string,
    sourceBranch: string,
    targetBranch: string
  ): Promise<BitbucketPullRequest | null> {
    const q = encodeURIComponent(
      `source.branch.name="${sourceBranch}" AND destination.branch.name="${targetBranch}"`
    );
    const url =
      `${API_BASE}/repositories/${encodeURIComponent(workspace)}/${encodeURIComponent(repoSlug)}` +
      `/pullrequests?state=OPEN&pagelen=50&q=${q}`;
    const pullRequests = await this.fetchAll<BitbucketPullRequest>(url, 5);
    return (
      pullRequests.find(
        (pr) =>
          pr.state === 'OPEN' &&
          pr.source?.branch?.name === sourceBranch &&
          pr.destination?.branch?.name === targetBranch
      ) ?? null
    );
  }

  createPullRequest(
    workspace: string,
    repoSlug: string,
    sourceBranch: string,
    targetBranch: string
  ): Promise<BitbucketPullRequest> {
    const url = `${API_BASE}/repositories/${encodeURIComponent(workspace)}/${encodeURIComponent(repoSlug)}/pullrequests`;
    return this.request<BitbucketPullRequest>(url, {
      method: 'POST',
      body: {
        title: `Merge ${sourceBranch} into ${targetBranch}`,
        source: {
          branch: { name: sourceBranch },
        },
        destination: {
          branch: { name: targetBranch },
        },
        close_source_branch: false,
      },
    });
  }

  mergePullRequest(
    workspace: string,
    repoSlug: string,
    pullRequestId: number,
    message?: string
  ): Promise<BitbucketPullRequest> {
    const url =
      `${API_BASE}/repositories/${encodeURIComponent(workspace)}/${encodeURIComponent(repoSlug)}` +
      `/pullrequests/${pullRequestId}/merge`;
    return this.request<BitbucketPullRequest>(url, {
      method: 'POST',
      body: {
        message: message ?? `Merged pull request #${pullRequestId}`,
        close_source_branch: false,
        merge_strategy: 'merge_commit',
      },
    });
  }

  /** Bitbucket UI 기본 머지 커밋 메시지와 동일 */
  private mergeCommitMessage(sourceBranch: string, pullRequestId: number): string {
    return `Merged in ${sourceBranch} (pull request #${pullRequestId})`;
  }

  async mergeBranches(
    workspace: string,
    repoSlug: string,
    sourceBranch: string,
    targetBranch: string
  ): Promise<BitbucketPullRequest> {
    const existing = await this.findOpenPullRequest(
      workspace,
      repoSlug,
      sourceBranch,
      targetBranch
    );

    if (existing) {
      try {
        return await this.mergePullRequest(
          workspace,
          repoSlug,
          existing.id,
          this.mergeCommitMessage(sourceBranch, existing.id)
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        if (!/already closed|not open/i.test(message)) {
          throw error;
        }
      }
    }

    const created = await this.createPullRequest(
      workspace,
      repoSlug,
      sourceBranch,
      targetBranch
    );

    return this.mergePullRequest(
      workspace,
      repoSlug,
      created.id,
      this.mergeCommitMessage(sourceBranch, created.id)
    );
  }
}

export function toUserMessage(error: unknown): string {
  if (error instanceof BitbucketApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return '요청 중 오류가 발생했습니다.';
}
