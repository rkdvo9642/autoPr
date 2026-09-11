import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toUserMessage } from "../api/bitbucket";
import { useAuth } from "../auth/AuthContext";
import { AccountMenuButton } from "../components/AccountMenuButton";
import { ErrorFooter } from "../components/ErrorFooter";
import { SelectBox } from "../components/SelectBox";
import {
  loadFavoriteBranches,
  loadFavoriteProjects,
  loadMergeSelection,
  saveFavoriteBranches,
  saveFavoriteProjects,
  saveMergeSelection,
  type BranchFavoritesMap,
  type MergeSelection,
} from "../storage";
import type { BitbucketBranch, BitbucketRepo } from "../types";

function repoKey(repo: Pick<BitbucketRepo, "workspace" | "slug">) {
  return `${repo.workspace.slug}/${repo.slug}`;
}

type Props = {
  onAddAccount: () => void;
};

export function MergeScreen({ onAddAccount }: Props) {
  const {
    client,
    activeAccountId,
    accounts,
    favoriteAccountIds,
    switchAccount,
    removeAccount,
    toggleAccountFavorite,
    handleAuthError,
  } = useAuth();

  const [repos, setRepos] = useState<BitbucketRepo[]>([]);
  const [branches, setBranches] = useState<BitbucketBranch[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [sourceBranch, setSourceBranch] = useState<string | null>(null);
  const [targetBranch, setTargetBranch] = useState<string | null>(null);
  const [loadingRepos, setLoadingRepos] = useState(true);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [branchFavoritesMap, setBranchFavoritesMap] =
    useState<BranchFavoritesMap>({});
  const [merging, setMerging] = useState(false);
  const [mergeSelection, setMergeSelection] = useState<MergeSelection>({
    projectKey: null,
    byProject: {},
  });
  const [selectionReady, setSelectionReady] = useState(false);
  const mergeSelectionRef = useRef(mergeSelection);
  mergeSelectionRef.current = mergeSelection;

  const selectedRepo = useMemo(
    () => repos.find((repo) => repoKey(repo) === selectedKey) ?? null,
    [repos, selectedKey],
  );

  const branchFavorites = useMemo(
    () =>
      selectedKey
        ? (branchFavoritesMap[selectedKey] ?? { source: [], target: [] })
        : { source: [], target: [] },
    [branchFavoritesMap, selectedKey],
  );

  const loadRepos = useCallback(async () => {
    if (!client || !activeAccountId) return;
    setLoadingRepos(true);
    setError(null);
    setSelectionReady(false);
    setSelectedKey(null);
    setSourceBranch(null);
    setTargetBranch(null);
    setBranches([]);
    try {
      const [data, favoriteKeys, branchFavs, savedSelection] =
        await Promise.all([
          client.listRepositories(),
          loadFavoriteProjects(activeAccountId),
          loadFavoriteBranches(activeAccountId),
          loadMergeSelection(activeAccountId),
        ]);
      setRepos(data);
      setFavorites(favoriteKeys);
      setBranchFavoritesMap(branchFavs);
      setMergeSelection(savedSelection);

      if (
        savedSelection.projectKey &&
        data.some((repo) => repoKey(repo) === savedSelection.projectKey)
      ) {
        setSelectedKey(savedSelection.projectKey);
      }
      setSelectionReady(true);
    } catch (err) {
      const signedOut = await handleAuthError(err);
      if (!signedOut) setError(toUserMessage(err));
      setSelectionReady(true);
    } finally {
      setLoadingRepos(false);
    }
  }, [activeAccountId, client, handleAuthError]);

  useEffect(() => {
    void loadRepos();
  }, [loadRepos]);

  const refreshBranches = useCallback(
    async (preserveSelection = true) => {
      if (!client || !selectedRepo) {
        setBranches([]);
        setSourceBranch(null);
        setTargetBranch(null);
        return;
      }

      const repo = selectedRepo;
      const projectKey = repoKey(repo);
      const remembered = mergeSelectionRef.current.byProject[projectKey];
      const prevSource = preserveSelection ? sourceBranch : null;
      const prevTarget = preserveSelection ? targetBranch : null;

      setLoadingBranches(true);
      setError(null);
      try {
        const data = await client.listBranches(repo.workspace.slug, repo.slug);
        setBranches(data);

        const names = new Set(data.map((branch) => branch.name));
        const nextSource =
          prevSource && names.has(prevSource)
            ? prevSource
            : remembered?.sourceBranch && names.has(remembered.sourceBranch)
              ? remembered.sourceBranch
              : null;
        const nextTarget =
          prevTarget && names.has(prevTarget)
            ? prevTarget
            : remembered?.targetBranch && names.has(remembered.targetBranch)
              ? remembered.targetBranch
              : repo.mainbranch?.name && names.has(repo.mainbranch.name)
                ? repo.mainbranch.name
                : null;

        setSourceBranch(nextSource);
        setTargetBranch(nextTarget);
      } catch (err) {
        const signedOut = await handleAuthError(err);
        if (!signedOut) setError(toUserMessage(err));
      } finally {
        setLoadingBranches(false);
      }
    },
    [client, handleAuthError, selectedRepo, sourceBranch, targetBranch],
  );

  useEffect(() => {
    if (!client || !selectedRepo) {
      setBranches([]);
      setSourceBranch(null);
      setTargetBranch(null);
      return;
    }

    const repo = selectedRepo;
    const api = client;
    let cancelled = false;

    async function initialLoad() {
      setLoadingBranches(true);
      setError(null);
      setSourceBranch(null);
      setTargetBranch(null);
      const projectKey = repoKey(repo);
      const remembered = mergeSelectionRef.current.byProject[projectKey];
      try {
        const data = await api.listBranches(repo.workspace.slug, repo.slug);
        if (cancelled) return;
        setBranches(data);

        const names = new Set(data.map((branch) => branch.name));
        const nextSource =
          remembered?.sourceBranch && names.has(remembered.sourceBranch)
            ? remembered.sourceBranch
            : null;
        const nextTarget =
          remembered?.targetBranch && names.has(remembered.targetBranch)
            ? remembered.targetBranch
            : repo.mainbranch?.name && names.has(repo.mainbranch.name)
              ? repo.mainbranch.name
              : null;

        setSourceBranch(nextSource);
        setTargetBranch(nextTarget);
      } catch (err) {
        if (cancelled) return;
        const signedOut = await handleAuthError(err);
        if (!signedOut) setError(toUserMessage(err));
      } finally {
        if (!cancelled) setLoadingBranches(false);
      }
    }

    void initialLoad();
    return () => {
      cancelled = true;
    };
  }, [client, handleAuthError, selectedRepo]);

  useEffect(() => {
    if (!selectionReady || loadingRepos || loadingBranches) return;

    const next: MergeSelection = {
      projectKey: selectedKey,
      byProject: { ...mergeSelection.byProject },
    };
    if (selectedKey) {
      next.byProject[selectedKey] = {
        sourceBranch,
        targetBranch,
      };
    }

    const current = mergeSelection.byProject[selectedKey ?? ""] ?? {
      sourceBranch: null,
      targetBranch: null,
    };
    const unchanged =
      mergeSelection.projectKey === selectedKey &&
      current.sourceBranch === sourceBranch &&
      current.targetBranch === targetBranch;
    if (unchanged) return;

    setMergeSelection(next);
    if (activeAccountId) {
      void saveMergeSelection(activeAccountId, next);
    }
  }, [
    activeAccountId,
    loadingBranches,
    loadingRepos,
    mergeSelection,
    selectedKey,
    selectionReady,
    sourceBranch,
    targetBranch,
  ]);

  const projectOptions = useMemo(
    () =>
      repos.map((repo) => ({
        value: repoKey(repo),
        label: repo.name,
        meta: `${repo.workspace.name}${repo.project?.name ? ` · ${repo.project.name}` : ""}`,
      })),
    [repos],
  );

  const branchOptions = useMemo(
    () =>
      branches.map((branch) => ({
        value: branch.name,
        label: branch.name,
        meta: branch.target.hash.slice(0, 7),
      })),
    [branches],
  );

  const canMerge =
    Boolean(selectedRepo && sourceBranch && targetBranch && client) &&
    sourceBranch !== targetBranch &&
    !loadingBranches &&
    !merging;

  async function toggleFavorite(key: string) {
    if (!activeAccountId) return;
    const next = favorites.includes(key)
      ? favorites.filter((item) => item !== key)
      : [key, ...favorites.filter((item) => item !== key)];
    setFavorites(next);
    await saveFavoriteProjects(activeAccountId, next);
  }

  async function toggleBranchFavorite(
    which: "source" | "target",
    branchName: string,
  ) {
    if (!selectedKey || !activeAccountId) return;
    const current = branchFavoritesMap[selectedKey] ?? {
      source: [],
      target: [],
    };
    const list = current[which];
    const nextList = list.includes(branchName)
      ? list.filter((item) => item !== branchName)
      : [branchName, ...list.filter((item) => item !== branchName)];
    const nextMap = {
      ...branchFavoritesMap,
      [selectedKey]: {
        ...current,
        [which]: nextList,
      },
    };
    setBranchFavoritesMap(nextMap);
    await saveFavoriteBranches(activeAccountId, nextMap);
  }

  async function onSelectAccount(accountId: string) {
    if (accountId === activeAccountId) return;
    try {
      await switchAccount(accountId);
    } catch (err) {
      window.alert(`계정 전환 실패\n${toUserMessage(err)}`);
    }
  }

  async function runMerge() {
    if (!selectedRepo || !sourceBranch || !targetBranch || !client) return;
    const confirmed = window.confirm(
      `${selectedRepo.name}\n\n${sourceBranch}\n→ ${targetBranch}\n\nPR를 생성(또는 기존 PR 사용)한 뒤 바로 병합합니다.`,
    );
    if (!confirmed) return;

    setMerging(true);
    setError(null);
    try {
      const result = await client.mergeBranches(
        selectedRepo.workspace.slug,
        selectedRepo.slug,
        sourceBranch,
        targetBranch,
      );
      window.alert(
        `병합 완료\nPR #${result.id} 병합이 완료되었습니다.\n${sourceBranch} → ${targetBranch}`,
      );
    } catch (err) {
      const signedOut = await handleAuthError(err);
      if (!signedOut) {
        const message = toUserMessage(err);
        setError(message);
        window.alert(`병합 실패\n${message}`);
      }
    } finally {
      setMerging(false);
    }
  }

  return (
    <div className="screen merge-screen">
      <header className="top-bar">
        <div className="brand-chip">
          <div className="logo-mark">PR</div>
        </div>
        <div className="project-select">
          {loadingRepos ? (
            <div className="loading-select">프로젝트 불러오는 중…</div>
          ) : (
            <SelectBox
              label="프로젝트"
              placeholder="프로젝트 선택"
              value={selectedKey}
              options={projectOptions}
              onChange={setSelectedKey}
              emptyText="프로젝트가 없습니다"
              favoriteValues={favorites}
              onToggleFavorite={(key) => void toggleFavorite(key)}
            />
          )}
        </div>
        <AccountMenuButton
          accounts={accounts}
          activeAccountId={activeAccountId}
          favoriteAccountIds={favoriteAccountIds}
          onSelect={(accountId) => void onSelectAccount(accountId)}
          onToggleFavorite={(accountId) =>
            void toggleAccountFavorite(accountId)
          }
          onAddAccount={onAddAccount}
          onDeleteAccount={(accountId) => void removeAccount(accountId)}
        />
      </header>

      <main className="merge-content">
        {!selectedRepo ? (
          <div className="placeholder">
            <div className="placeholder-icon">⎇</div>
            <h2>프로젝트를 선택하세요</h2>
            <p>
              상단에서 저장소를 고르면 브랜치 병합을 바로 진행할 수 있습니다.
            </p>
          </div>
        ) : (
          <div className="merge-panel">
            <div className="panel-header">
              <div>
                <h2>{selectedRepo.name}</h2>
                <p className="repo-path">
                  <span className="repo-badge">repo</span>
                  {selectedRepo.workspace.slug}/{selectedRepo.slug}
                </p>
              </div>
              <button
                type="button"
                className="refresh-btn"
                disabled={loadingBranches}
                onClick={() => void refreshBranches(true)}
                title="브랜치 새로고침"
              >
                {loadingBranches ? "…" : "↻"}
              </button>
            </div>

            {loadingBranches ? (
              <div className="branch-loading">브랜치 불러오는 중…</div>
            ) : (
              <div className="branch-stack">
                <div className="branch-step">
                  <SelectBox
                    title="병합할 브랜치"
                    label={
                      <>
                        <span className="step-num">1</span>
                        병합할 브랜치
                      </>
                    }
                    placeholder="소스 브랜치 선택"
                    value={sourceBranch}
                    options={branchOptions}
                    onChange={setSourceBranch}
                    emptyText="브랜치가 없습니다"
                    favoriteValues={branchFavorites.source}
                    onToggleFavorite={(key) =>
                      void toggleBranchFavorite("source", key)
                    }
                  />
                </div>
                <div className="flow-connector" aria-hidden="true">
                  <span>↓</span>
                </div>
                <div className="branch-step">
                  <SelectBox
                    title="대상 브랜치"
                    label={
                      <>
                        <span className="step-num">2</span>
                        대상 브랜치
                      </>
                    }
                    placeholder="대상 브랜치 선택"
                    value={targetBranch}
                    options={branchOptions}
                    onChange={setTargetBranch}
                    emptyText="브랜치가 없습니다"
                    favoriteValues={branchFavorites.target}
                    onToggleFavorite={(key) =>
                      void toggleBranchFavorite("target", key)
                    }
                  />
                </div>
                <div className="merge-actions">
                  <button
                    type="button"
                    className="merge-btn"
                    disabled={!canMerge}
                    onClick={() => void runMerge()}
                  >
                    {merging ? "병합 중…" : "병합하기"}
                  </button>
                  {sourceBranch &&
                  targetBranch &&
                  sourceBranch === targetBranch ? (
                    <p className="warn">서로 다른 브랜치를 선택해주세요.</p>
                  ) : sourceBranch && targetBranch ? (
                    <p className="merge-summary">
                      <strong>{sourceBranch}</strong>
                      {" → "}
                      <strong>{targetBranch}</strong>
                    </p>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <ErrorFooter message={error} label="Merge" />
    </div>
  );
}
