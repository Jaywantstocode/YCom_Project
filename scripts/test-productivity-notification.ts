/**
 * Test script for productivity advice notifications
 */

async function testProductivityNotification() {
  console.log('🧪 Starting productivity advice notification test...');

  try {
    const url = process.env.TEST_BASE_URL || 'http://localhost:3000';
    const response = await fetch(`${url}/api/send-productivity-advice`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: '💡 Test: Productivity Advice',
        body: 'This is a test notification. Tip: Use Cmd+` to switch windows within the same app faster than Cmd+Tab.'
      })
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Notification sent:', result);
    } else {
      console.error('❌ Notification failed:', result);
    }
  } catch (error) {
    console.error('❌ Test error:', error);
  }
}

// スクリプトが直接実行された場合のみテストを実行
if (require.main === module) {
  testProductivityNotification();
}

export { testProductivityNotification };
