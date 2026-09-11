import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { SelectOption } from './SelectBox.types';

export type { SelectOption } from './SelectBox.types';

type Props = {
  label?: ReactNode;
  title?: string;
  placeholder?: string;
  value: string | null;
  options: SelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  emptyText?: string;
  favoriteValues?: string[];
  onToggleFavorite?: (value: string) => void;
};

function sortOptions(
  options: SelectOption[],
  favoriteSet: Set<string>
): SelectOption[] {
  return [...options].sort((a, b) => {
    const aFav = favoriteSet.has(a.value) ? 0 : 1;
    const bFav = favoriteSet.has(b.value) ? 0 : 1;
    if (aFav !== bFav) return aFav - bFav;
    return a.label.localeCompare(b.label, 'ko');
  });
}

export function SelectBox({
  label,
  title,
  placeholder = '선택',
  value,
  options,
  onChange,
  disabled = false,
  emptyText = '항목이 없습니다',
  favoriteValues = [],
  onToggleFavorite,
}: Props) {
  const sheetTitle =
    title ?? (typeof label === 'string' ? label : '선택');
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [orderedOptions, setOrderedOptions] = useState<SelectOption[]>([]);

  const favoriteSet = useMemo(() => new Set(favoriteValues), [favoriteValues]);
  const selected = options.find((option) => option.value === value) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return orderedOptions;
    return orderedOptions.filter(
      (option) =>
        option.label.toLowerCase().includes(q) ||
        (option.meta ?? '').toLowerCase().includes(q)
    );
  }, [orderedOptions, query]);

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
    if (disabled) return;
    setOrderedOptions(sortOptions(options, new Set(favoriteValues)));
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
                <strong>{sheetTitle}</strong>
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
              <div className="option-list">
                {filtered.length === 0 ? (
                  <div className="empty">{emptyText}</div>
                ) : (
                  filtered.map((item) => {
                    const isSelected = item.value === value;
                    const isFavorite = favoriteSet.has(item.value);
                    return (
                      <div
                        key={item.value}
                        className={`option-row${isSelected ? ' selected' : ''}`}
                      >
                        {onToggleFavorite ? (
                          <button
                            type="button"
                            className={`star-btn${isFavorite ? ' on' : ''}`}
                            onClick={() => onToggleFavorite(item.value)}
                            aria-label="즐겨찾기"
                          >
                            {isFavorite ? '★' : '☆'}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="option-main"
                          onClick={() => {
                            onChange(item.value);
                            close();
                          }}
                        >
                          <span className="option-label">{item.label}</span>
                          {item.meta ? (
                            <span className="option-meta">{item.meta}</span>
                          ) : null}
                        </button>
                        {isSelected ? <span className="check">✓</span> : null}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <div className="select-wrap">
      {label ? <div className="field-label">{label}</div> : null}
      <button
        type="button"
        className="select-trigger"
        disabled={disabled}
        onClick={openSheet}
      >
        <span className={selected ? '' : 'placeholder'}>
          {selected?.label ?? placeholder}
        </span>
        <span className="chevron">▾</span>
      </button>
      {modal}
    </div>
  );
}
