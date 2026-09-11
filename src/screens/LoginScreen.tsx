import { useState } from 'react';
import { toUserMessage } from '../api/bitbucket';
import { useAuth } from '../auth/AuthContext';
import { ErrorFooter } from '../components/ErrorFooter';

const API_TOKEN_URL =
  'https://id.atlassian.com/manage-profile/security/api-tokens';

type Props = {
  mode?: 'login' | 'add';
  onDone?: () => void;
  onCancel?: () => void;
};

export function LoginScreen({ mode = 'login', onDone, onCancel }: Props) {
  const { addAccount } = useAuth();
  const isAddMode = mode === 'add';

  const [apiToken, setApiToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = apiToken.trim().length > 0 && !submitting;

  async function onSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await addAccount(apiToken);
      onDone?.();
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="screen login-screen">
      <div className="login-card">
        <div className="brand">
          <div className="logo-mark">PR</div>
          <h1>{isAddMode ? '계정 추가' : 'pcAutoPR'}</h1>
          <p>
            {isAddMode
              ? '새 Bitbucket 계정의 API 토큰을 등록하세요'
              : 'API 토큰으로 Bitbucket에 연결하세요'}
          </p>
        </div>

        <div className="form">
          <h2>1. 토큰 발급</h2>
          <p className="help">
            아래 버튼을 누르면 브라우저가 열립니다. Create API token with scopes
            에서 Bitbucket을 고르고 권한을 선택한 뒤 토큰을 복사하세요.
          </p>
          <a
            className="link-button"
            href={API_TOKEN_URL}
            target="_blank"
            rel="noreferrer"
          >
            API 토큰 발급 페이지 열기
          </a>

          <h2 className="spaced">2. 토큰 붙여넣기</h2>
          <div className="password-row">
            <input
              type={showToken ? 'text' : 'password'}
              value={apiToken}
              onChange={(event) => setApiToken(event.target.value)}
              placeholder="API 토큰을 붙여넣으세요"
              autoComplete="off"
              onKeyDown={(event) => {
                if (event.key === 'Enter') void onSubmit();
              }}
            />
            <button
              type="button"
              className="eye-btn"
              onClick={() => setShowToken((prev) => !prev)}
            >
              {showToken ? '숨김' : '표시'}
            </button>
          </div>

          <p className="scope-hint">
            권한: read:user:bitbucket, read:workspace:bitbucket,
            read:repository:bitbucket, read:pullrequest:bitbucket,
            write:pullrequest:bitbucket
          </p>

          <div className="button-row">
            {isAddMode && onCancel ? (
              <button type="button" className="secondary-btn" onClick={onCancel}>
                취소
              </button>
            ) : null}
            <button
              type="button"
              className="primary-btn"
              disabled={!canSubmit}
              onClick={() => void onSubmit()}
            >
              {submitting
                ? '확인 중…'
                : isAddMode
                  ? '계정 추가'
                  : '로그인'}
            </button>
          </div>

          <p className="hint">
            계정은 여러 개 등록할 수 있고, 우상단에서 전환할 수 있습니다.
          </p>
        </div>
      </div>
      <ErrorFooter message={error} label={isAddMode ? 'AddAccount' : 'Login'} />
    </div>
  );
}
