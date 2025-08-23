/**
 * Test script for productivity advice notifications
 */

async function testProductivityNotification() {
  console.log('🧪 生産性アドバイス通知テストを開始...');

  try {
    const response = await fetch('http://localhost:3000/api/send-productivity-advice', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: '💡 テスト: 生産性アドバイス',
        body: 'これはテスト通知です。Cmd+Tabの代わりにCmd+`を使うと、同じアプリ内のウィンドウ切り替えが3倍速くなります。'
      })
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ 通知送信成功:', result);
    } else {
      console.error('❌ 通知送信失敗:', result);
    }
  } catch (error) {
    console.error('❌ テストエラー:', error);
  }
}

// スクリプトが直接実行された場合のみテストを実行
if (require.main === module) {
  testProductivityNotification();
}

export { testProductivityNotification };
