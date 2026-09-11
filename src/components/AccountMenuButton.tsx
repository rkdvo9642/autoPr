import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { StoredAccount } from '../types';

type Props = {
  accounts: StoredAccount[];
  activeAccountId: string | null;
  favoriteAccountIds: string[];
  onSelect: (accountId: string) => void;
  onToggleFavorite: (accountId: string) => void;
  onAddAccount: () => void;
  onDeleteAccount?: (accountId: string) => void;
};

function sortAccounts(
  accounts: StoredAccount[],
  favoriteSet: Set<string>
): StoredAccount[] {
  return [...accounts].sort((a, b) => {
    const aFav = favoriteSet.has(a.id) ? 0 : 1;
    const bFav = favoriteSet.has(b.id) ? 0 : 1;
    if (aFav !== bFav) return aFav - bFav;
    return a.displayName.localeCompare(b.displayName, 'ko');
  });
}

export function AccountMenuButton({
  accounts,
  activeAccountId,
  favoriteAccountIds,
  onSelect,
  onToggleFavorite,
  onAddAccount,
  onDeleteAccount,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [orderedAccounts, setOrderedAccounts] = useState<StoredAccount[]>([]);

  const favoriteSet = useMemo(
    () => new Set(favoriteAccountIds),
    [favoriteAccountIds]
  );
  const active = accounts.find((account) => account.id === activeAccountId) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return orderedAccounts;
    return orderedAccounts.filter(
      (account) =>
        account.displayName.toLowerCase().includes(q) ||
        (account.nickname ?? '').toLowerCase().includes(q)
    );
  }, [orderedAccounts, query]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        setQuery('');
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  function openSheet() {
    setOrderedAccounts(sortAccounts(accounts, new Set(favoriteAccountIds)));
    setQuery('');
    setOpen(true);
  }

  function close() {
    setOpen(false);
    setQuery('');
  }

  const modal =
    open && typeof document !== 'undefined'
      ? createPortal(
          <div className="modal-root" role="dialog" aria-modal="true">
            <button
              type="button"
              className="backdrop"
              aria-label="닫기"
              onClick={close}
            />
            <div className="sheet">
              <div className="sheet-header">
                <strong>계정</strong>
                <button type="button" className="icon-btn" onClick={close}>
                  ✕
                </button>
              </div>
              <div className="search-row">
                <span>⌕</span>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="검색"
                  autoFocus
                />
              </div>
              <button
                type="button"
                className="add-row"
                onClick={() => {
                  close();
                  onAddAccount();
                }}
              >
                ＋ 새 계정 추가
              </button>
              <div className="option-list">
                {filtered.length === 0 ? (
                  <div className="empty">등록된 계정이 없습니다</div>
                ) : (
                  filtered.map((item) => {
                    const isSelected = item.id === activeAccountId;
                    const isFavorite = favoriteSet.has(item.id);
                    return (
                      <div
                        key={item.id}
                        className={`option-row${isSelected ? ' selected' : ''}`}
                        onContextMenu={(event) => {
                          event.preventDefault();
                          if (!onDeleteAccount) return;
                          const ok = window.confirm(
                            `${item.displayName}을(를) 이 기기에서 삭제할까요?`
                          );
                          if (ok) onDeleteAccount(item.id);
                        }}
                      >
                        <button
                          type="button"
                          className={`star-btn${isFavorite ? ' on' : ''}`}
                          onClick={() => onToggleFavorite(item.id)}
                          aria-label="즐겨찾기"
                        >
                          {isFavorite ? '★' : '☆'}
                        </button>
                        {item.avatarUrl ? (
                          <img
                            src={item.avatarUrl}
                            alt=""
                            className="row-avatar"
                          />
                        ) : (
                          <span className="row-avatar fallback">
                            {item.displayName.slice(0, 1)}
                          </span>
                        )}
                        <button
                          type="button"
                          className="option-main"
                          onClick={() => {
                            onSelect(item.id);
                            close();
                          }}
                        >
                          <span className="option-label">{item.displayName}</span>
                          {item.nickname ? (
                            <span className="option-meta">{item.nickname}</span>
                          ) : null}
                        </button>
                        {isSelected ? <span className="check">✓</span> : null}
                      </div>
                    );
                  })
                )}
              </div>
              <p className="hint-footer">계정을 우클릭하면 삭제할 수 있습니다.</p>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button type="button" className="account-trigger" onClick={openSheet}>
        {active?.avatarUrl ? (
          <img src={active.avatarUrl} alt="" className="avatar" />
        ) : (
          <span className="avatar fallback">
            {(active?.displayName ?? '계').slice(0, 1)}
          </span>
        )}
        <span className="account-name">{active?.displayName ?? '계정'}</span>
      </button>
      {modal}
    </>
  );
}
