import { useState } from 'react';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { LoginScreen } from './screens/LoginScreen';
import { MergeScreen } from './screens/MergeScreen';

function AppShell() {
  const { status } = useAuth();
  const [addingAccount, setAddingAccount] = useState(false);

  if (status === 'loading') {
    return (
      <div className="screen loading-screen">
        <div className="spinner" />
        <p>불러오는 중…</p>
      </div>
    );
  }

  if (status === 'signedOut') {
    return <LoginScreen mode="login" />;
  }

  if (addingAccount) {
    return (
      <LoginScreen
        mode="add"
        onDone={() => setAddingAccount(false)}
        onCancel={() => setAddingAccount(false)}
      />
    );
  }

  return <MergeScreen onAddAccount={() => setAddingAccount(true)} />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
