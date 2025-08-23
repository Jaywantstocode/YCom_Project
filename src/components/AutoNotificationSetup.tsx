"use client";

import { useEffect, useState } from 'react';
import { useNotifications } from '@/hooks/useNotifications';

// VAPID公開鍵をBase64からUint8Arrayに変換
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

const VAPID_STORAGE_KEY = 'push.vapidPublicKey';

export default function AutoNotificationSetup() {
  const { permission, request, isSupported } = useNotifications();
  const [hasPrompted, setHasPrompted] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);

  useEffect(() => {
    // ページ読み込み時に自動で通知許可を求める
    const setupNotifications = async () => {
      // 既に許可されているか、サポートされていない場合はスキップ
      if (!isSupported || permission === 'granted' || permission === 'denied' || hasPrompted) {
        return;
      }

      // 少し遅延を入れてユーザーエクスペリエンスを向上
      setTimeout(async () => {
        setHasPrompted(true);
        
        try {
          console.log('🔔 通知許可を求めています...');
          const result = await request();
          
          if (result === 'granted') {
            console.log('✅ 通知許可が得られました');
            await setupPushSubscription();
          } else {
            console.log('❌ 通知許可が拒否されました');
          }
        } catch (error) {
          console.error('通知許可エラー:', error);
        }
      }, 2000); // 2秒後に許可を求める
    };

    setupNotifications();
  }, [isSupported, permission, request, hasPrompted]);

  const setupPushSubscription = async () => {
    if (isSubscribing) return;
    
    setIsSubscribing(true);
    
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.warn('プッシュ通知がサポートされていません');
        return;
      }

      // Service Workerを登録
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        console.warn('VAPID公開鍵が設定されていません');
        return;
      }

      // 既存のサブスクリプションをチェック
      const storedKey = window.localStorage.getItem(VAPID_STORAGE_KEY);
      const existing = await reg.pushManager.getSubscription();
      
      if (existing && storedKey === vapidKey) {
        console.log('✅ 既にプッシュ通知にサブスクライブ済みです');
        return;
      }

      // 既存のサブスクリプションがある場合は解除
      if (existing) {
        await existing.unsubscribe();
      }

      // 新しいサブスクリプションを作成
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey)
      });

      // サーバーにサブスクリプションを送信
      const response = await fetch('/api/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(subscription)
      });

      if (response.ok) {
        window.localStorage.setItem(VAPID_STORAGE_KEY, vapidKey);
        console.log('✅ プッシュ通知のサブスクリプションが完了しました');
        
        // ウェルカム通知を送信
        setTimeout(async () => {
          try {
            await fetch('/api/send-productivity-advice', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                title: '🎉 通知設定完了',
                body: 'YComの生産性アドバイス通知が有効になりました！作業分析が完了すると、改善提案をお届けします。'
              })
            });
          } catch (error) {
            console.warn('ウェルカム通知の送信に失敗:', error);
          }
        }, 1000);
      } else {
        console.error('サブスクリプションの保存に失敗しました');
      }
    } catch (error) {
      console.error('プッシュ通知セットアップエラー:', error);
    } finally {
      setIsSubscribing(false);
    }
  };

  // このコンポーネントは見た目を持たない（自動セットアップのみ）
  return null;
}
