"use client";

import { useEffect, useState } from 'react';
import { useNotifications } from '@/hooks/useNotifications';
import { Badge } from '@/components/ui/badge';
import { Bell, BellOff, BellRing } from 'lucide-react';

export default function NotificationStatus() {
  const { permission, isSupported } = useNotifications();
  const [subscriptionCount, setSubscriptionCount] = useState<number>(0);

  useEffect(() => {
    // サブスクリプション数を取得（開発用）
    const checkSubscriptions = async () => {
      try {
        if ('serviceWorker' in navigator) {
          const reg = await navigator.serviceWorker.ready;
          const sub = await reg.pushManager.getSubscription();
          setSubscriptionCount(sub ? 1 : 0);
        }
      } catch (error) {
        console.warn('サブスクリプション状態の確認に失敗:', error);
      }
    };

    checkSubscriptions();
  }, [permission]);

  if (!isSupported) {
    return (
      <Badge variant="secondary" className="flex items-center gap-1">
        <BellOff className="h-3 w-3" />
        通知非対応
      </Badge>
    );
  }

  const getStatusInfo = () => {
    switch (permission) {
      case 'granted':
        return {
          icon: <BellRing className="h-3 w-3" />,
          text: '通知有効',
          variant: 'default' as const,
          color: 'bg-green-500'
        };
      case 'denied':
        return {
          icon: <BellOff className="h-3 w-3" />,
          text: '通知拒否',
          variant: 'destructive' as const,
          color: 'bg-red-500'
        };
      default:
        return {
          icon: <Bell className="h-3 w-3" />,
          text: '通知待機',
          variant: 'secondary' as const,
          color: 'bg-yellow-500'
        };
    }
  };

  const status = getStatusInfo();

  return (
    <div className="flex items-center gap-2">
      <Badge variant={status.variant} className="flex items-center gap-1">
        {status.icon}
        {status.text}
      </Badge>
      {permission === 'granted' && subscriptionCount > 0 && (
        <Badge variant="outline" className="text-xs">
          📱 登録済み
        </Badge>
      )}
    </div>
  );
}
