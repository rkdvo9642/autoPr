# pcAutoPR

Bitbucket Auto PR 데스크톱 앱 (Electron). 모바일 Auto PR과 같은 흐름입니다.

## 실행

```bash
npm install
npm run dev
```

## 패키징 (Windows)

```bash
npm run dist
```

결과물은 `release/` 에 생성됩니다.

## 기능

- Bitbucket API 토큰 로그인 / 다중 계정
- 프로젝트 · 소스/대상 브랜치 선택 후 PR 생성·병합
- 계정별 즐겨찾기 · 선택 기억 (localStorage)
