"use client";

import { useEffect, useState, useCallback } from 'react';
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
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const setupPushSubscription = useCallback(async () => {
    if (isSubscribing) return;
    
    setIsSubscribing(true);
    
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.warn('Push notifications are not supported');
        return;
      }

      // Service Workerを登録
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        console.warn('VAPID public key is not configured');
        return;
      }

      // 既存のサブスクリプションをチェック
      const storedKey = typeof window !== 'undefined' ? window.localStorage.getItem(VAPID_STORAGE_KEY) : null;
      const existing = await reg.pushManager.getSubscription();
      
      if (existing && storedKey === vapidKey) {
        console.log('✅ Already subscribed to push');
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

      // Send subscription to server
      const response = await fetch('/api/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ subscription })
      });

      if (response.ok) {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(VAPID_STORAGE_KEY, vapidKey);
          try { window.localStorage.setItem('push.subscription', JSON.stringify(subscription)); } catch {}
        }
        console.log('✅ Push subscription completed');
        
        // Send welcome notification using direct subscription
        setTimeout(async () => {
          try {
            await fetch('/api/send-notification', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                subscription,
                title: '🎉 Notifications enabled',
                body: 'Productivity advice notifications are now active. You will receive tips after analysis completes.'
              })
            });
          } catch (error) {
            console.warn('Welcome notification failed:', error);
          }
        }, 1000);
      } else {
        console.error('Failed to save subscription');
      }
    } catch (error) {
      console.error('Push setup error:', error);
    } finally {
      setIsSubscribing(false);
    }
  }, [isSubscribing]);

  useEffect(() => {
    // Ask for permission shortly after load
    const setupNotifications = async () => {
      // 既に許可されているか、サポートされていない場合はスキップ
      if (!isMounted || !isSupported || permission === 'granted' || permission === 'denied' || hasPrompted) {
        return;
      }

      // Delay slightly for better UX
      setTimeout(async () => {
        setHasPrompted(true);
        
        try {
          console.log('🔔 Requesting notification permission...');
          const result = await request();
          
          if (result === 'granted') {
            console.log('✅ Notification permission granted');
            await setupPushSubscription();
          } else {
            console.log('❌ Notification permission denied');
          }
        } catch (error) {
          console.error('Notification permission error:', error);
        }
      }, 2000);
    };

    setupNotifications();
  }, [isMounted, isSupported, permission, request, hasPrompted, setupPushSubscription]);

  // No visible UI (auto-setup only)
  return null;
}
