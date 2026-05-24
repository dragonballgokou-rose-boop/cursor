# Contact-Team-Manager Realtime 修正手順

## 問題
`useSupabase.ts` で 8 個の Realtime チャンネルを開いているが、
Supabase がエグレス制限 (402) を返すと全チャンネルが毎秒リトライし、
エグレスをさらに消費する悪循環が発生している。

## 修正ファイル

### 1. `src/lib/supabase.ts` を差し替え
`contact-team-manager-fix/supabase.ts` の内容で置き換える。
変更点:
- `realtime.params.eventsPerSecond: 2` でレート制限
- `pauseRealtime()` / `safeChannel()` ヘルパーを追加

### 2. `src/hooks/useSupabase.ts` の全 Realtime サブスクリプションを修正
各 `supabase.channel(...)` の呼び出しを `safeChannel(...)` に変更し、
エラー時にリトライを停止するようにする。

例 (useThreads):
```typescript
// Before:
const threadsChannel = supabase
    .channel('public:threads')
    .on('postgres_changes', { ... }, () => fetchThreads(true))
    .subscribe();

// After:
import { safeChannel, pauseRealtime } from '../lib/supabase';

const ch = safeChannel('public:threads');
const threadsChannel = ch
    ?.on('postgres_changes', { ... }, () => fetchThreads(true))
    .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') pauseRealtime();
    });

// cleanup:
return () => {
    if (threadsChannel) supabase.removeChannel(threadsChannel);
};
```

同じパターンを以下のチャンネルにも適用:
- `public:replies`
- `teams`
- `profiles`
- `tags`
- `tag-members-{tagId}`
- `all-tag-members`
- `unread-updates`
