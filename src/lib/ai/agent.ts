import { getDefaultModel } from './lm-models';
import OpenAI from 'openai';

// 基本的なデータ型（フロントエンドに依存しない）
export interface SessionRecord {
  id: string;
  startedAt: number;
  stoppedAt?: number;
  log: AgentLogItem[];
  tips: AgentTip[];
}

export interface AgentLogItem {
  id: string;
  ts: number;
  level: 'info' | 'warn' | 'error';
  message: string;
}

export interface AgentTip {
  id: string;
  ts: number;
  title: string;
  detail?: string;
}

// 作業パターンの分析結果
export interface WorkPattern {
  pattern: string;
  frequency: number;
  timeSpent: number;
  inefficiencyScore: number; // 0-100 (100が最も非効率)
  category: 'repetitive' | 'inefficient' | 'productive' | 'unknown';
}

// 効率化提案
export interface EfficiencyTip {
  type: 'shortcut' | 'tool' | 'workflow' | 'product';
  title: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  timesSaved?: string; // "5分/日節約可能"
  productInfo?: ProductInfo;
}

// プロダクト情報
export interface ProductInfo {
  name: string;
  description: string;
  category: string;
  url?: string;
  relevanceScore: number; // 0-100
}

// 分析レポート
export interface AnalysisReport {
  totalSessions: number;
  totalTimeSpent: number;
  inefficiencyScore: number;
  topPatterns: WorkPattern[];
  recommendations: EfficiencyTip[];
  summary: string;
}

// プロダクトハント風の検索結果
interface ProductSearchResult {
  products: ProductInfo[];
  searchQuery: string;
}

/**
 * ワークパターンを分析して非効率な作業を特定
 */
export class WorkEfficiencyAnalyzer {
  private openai: OpenAI;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }
    this.openai = new OpenAI({ apiKey });
  }

  /**
   * セッションログを分析して作業パターンを抽出
   */
  async analyzeWorkPatterns(sessions: SessionRecord[]): Promise<WorkPattern[]> {
    if (sessions.length === 0) return [];

    // ログメッセージを時系列で収集
    const allLogs = sessions.flatMap(session => 
      session.log.map(log => ({
        ...log,
        sessionId: session.id,
        sessionStart: session.startedAt,
        sessionDuration: session.stoppedAt ? session.stoppedAt - session.startedAt : 0
      }))
    ).sort((a, b) => a.ts - b.ts);

    const logMessages = allLogs.map(log => log.message);
    
    if (logMessages.length === 0) return [];

    try {
      const modelId = getDefaultModel('FAST_ANALYSIS');
      
      const response = await this.openai.chat.completions.create({
        model: modelId,
        messages: [
          {
            role: "system",
            content: `あなたは作業効率の専門家です。ユーザーの作業ログから非効率なパターンを見つけ出して分析してください。
            
特に注目すべきポイント：
- 同じ作業の繰り返し
- 時間のかかりすぎる操作
- ツールの非効率的な使用
- ショートカットキーを使わない操作
- 不要な手動作業

日本語で回答してください。`
          },
          {
            role: "user", 
            content: `以下の作業ログを分析して、非効率なパターンを特定してください：

${logMessages.slice(0, 50).join('\n')}

JSONフォーマットで以下の形式で回答してください：
{
  "patterns": [
    {
      "pattern": "具体的なパターンの説明",
      "frequency": 推定回数,
      "timeSpent": 推定時間(分),
      "inefficiencyScore": 0-100のスコア,
      "category": "repetitive/inefficient/productive/unknown"
    }
  ]
}`
          }
        ],
        max_completion_tokens: 1500,
        temperature: 0.3
      });

      const content = response.choices[0]?.message?.content;
      if (!content) return [];

      const result = JSON.parse(content);
      return result.patterns || [];

    } catch (error) {
      console.error('作業パターン分析エラー:', error);
      return [];
    }
  }

  /**
   * プロダクトハント風の検索を実行
   * 実際のAPIが無い場合は模擬データを返す
   */
  async searchRelevantProducts(query: string): Promise<ProductSearchResult> {
    // 実際のプロダクトハントAPIが利用可能になるまでは模擬データ
    const mockProducts: ProductInfo[] = [
      {
        name: "Alfred",
        description: "Mac用の高機能なランチャーアプリ。ショートカットで素早くアプリ起動や検索が可能",
        category: "productivity",
        url: "https://www.alfredapp.com/",
        relevanceScore: 95
      },
      {
        name: "Raycast",
        description: "開発者向けの拡張可能なランチャー。APIアクセスやスニペット管理も可能",
        category: "developer-tools",
        url: "https://raycast.com/",
        relevanceScore: 90
      },
      {
        name: "Text Expander",
        description: "よく使うテキストをショートカットで展開。繰り返し入力を大幅削減",
        category: "productivity",
        url: "https://textexpander.com/",
        relevanceScore: 85
      },
      {
        name: "Hammerspoon",
        description: "macOS自動化ツール。Luaスクリプトでウィンドウ管理やタスク自動化",
        category: "automation",
        url: "https://www.hammerspoon.org/",
        relevanceScore: 80
      }
    ];

    // クエリの関連性に基づいてフィルタリング
    const relevantProducts = mockProducts
      .filter(product => product.relevanceScore >= 75) // 関連性が75%以上のみ
      .sort((a, b) => b.relevanceScore - a.relevanceScore);

    return {
      products: relevantProducts,
      searchQuery: query
    };
  }

  /**
   * 効率化のためのtipsを生成
   */
  async generateEfficiencyTips(patterns: WorkPattern[]): Promise<EfficiencyTip[]> {
    const tips: EfficiencyTip[] = [];

    for (const pattern of patterns.slice(0, 3)) { // 上位3つのパターンに対してtipsを生成
      if (pattern.inefficiencyScore < 60) continue; // 効率性スコアが低いものはスキップ

      try {
        const modelId = getDefaultModel('FAST_ANALYSIS');
        
        const response = await this.openai.chat.completions.create({
          model: modelId,
          messages: [
            {
              role: "system",
              content: "あなたは作業効率化の専門家です。非効率なパターンに対して具体的で実用的な改善提案をしてください。"
            },
            {
              role: "user",
              content: `以下の非効率なパターンに対して、具体的な改善提案を1つ生成してください：

パターン: ${pattern.pattern}
カテゴリ: ${pattern.category}
非効率性スコア: ${pattern.inefficiencyScore}

JSONフォーマットで回答してください：
{
  "type": "shortcut/tool/workflow/product",
  "title": "簡潔なタイトル",
  "description": "具体的な説明と使用方法",
  "impact": "low/medium/high",
  "timesSaved": "節約できる時間の目安"
}`
            }
          ],
          max_completion_tokens: 500,
          temperature: 0.4
        });

        const content = response.choices[0]?.message?.content;
        if (content) {
          const tip = JSON.parse(content);
          tips.push(tip);
        }
      } catch (error) {
        console.error('Tips生成エラー:', error);
        // フォールバック用の基本的なtip
        tips.push({
          type: 'workflow',
          title: '作業フローの見直し',
          description: `${pattern.pattern}について、より効率的な方法を検討してみてください。`,
          impact: 'medium',
          timesSaved: '推定 10-15分/日'
        });
      }
    }

    return tips;
  }

  /**
   * 包括的な分析レポートを生成
   */
  async generateAnalysisReport(sessions: SessionRecord[]): Promise<AnalysisReport> {
    const patterns = await this.analyzeWorkPatterns(sessions);
    const recommendations = await this.generateEfficiencyTips(patterns);

    const totalTimeSpent = sessions.reduce((total, session) => {
      return total + (session.stoppedAt ? session.stoppedAt - session.startedAt : 0);
    }, 0);

    const avgInefficiencyScore = patterns.length > 0 
      ? patterns.reduce((sum, p) => sum + p.inefficiencyScore, 0) / patterns.length
      : 0;

    // サマリー生成
    let summary = `${sessions.length}セッションを分析しました。`;
    
    if (avgInefficiencyScore > 70) {
      summary += ' 大幅な効率化の余地があります。';
    } else if (avgInefficiencyScore > 40) {
      summary += ' いくつかの改善できる点が見つかりました。';
    } else {
      summary += ' 概ね効率的に作業されています。';
    }

    if (recommendations.length > 0) {
      summary += ` ${recommendations.length}つの改善提案があります。`;
    }

    return {
      totalSessions: sessions.length,
      totalTimeSpent: Math.round(totalTimeSpent / (1000 * 60)), // 分に変換
      inefficiencyScore: Math.round(avgInefficiencyScore),
      topPatterns: patterns.slice(0, 5),
      recommendations,
      summary
    };
  }
}

// 純粋な関数ベースのエクスポート（UIに依存しない）

/**
 * セッションログを分析して作業パターンを抽出
 */
export async function analyzeWorkPatterns(sessions: SessionRecord[]): Promise<WorkPattern[]> {
  const analyzer = new WorkEfficiencyAnalyzer();
  return await analyzer.analyzeWorkPatterns(sessions);
}

/**
 * 効率化のためのtipsを生成
 */
export async function generateEfficiencyTips(patterns: WorkPattern[]): Promise<EfficiencyTip[]> {
  const analyzer = new WorkEfficiencyAnalyzer();
  return await analyzer.generateEfficiencyTips(patterns);
}

/**
 * 包括的な分析レポートを生成
 */
export async function generateAnalysisReport(sessions: SessionRecord[]): Promise<AnalysisReport> {
  const analyzer = new WorkEfficiencyAnalyzer();
  return await analyzer.generateAnalysisReport(sessions);
}

/**
 * プロダクトハント風の検索を実行
 */
export async function searchRelevantProducts(query: string): Promise<ProductSearchResult> {
  const analyzer = new WorkEfficiencyAnalyzer();
  return await analyzer.searchRelevantProducts(query);
}

/**
 * 単一セッションの効率性を即座に分析
 */
export async function analyzeSingleSession(session: SessionRecord): Promise<{
  efficiencyScore: number;
  suggestions: string[];
  timeSpent: number;
}> {
  if (!session.stoppedAt) {
    return {
      efficiencyScore: 0,
      suggestions: ['セッションが完了していません'],
      timeSpent: 0
    };
  }

  const timeSpent = Math.round((session.stoppedAt - session.startedAt) / (1000 * 60));
  const logCount = session.log.length;
  const tipCount = session.tips.length;

  // 簡易効率性スコア計算
  const baseScore = Math.min(100, Math.max(0, 100 - (timeSpent / 60) * 10));
  const activityBonus = Math.min(20, (logCount + tipCount) * 2);
  const efficiencyScore = Math.round(baseScore + activityBonus);

  const suggestions: string[] = [];
  
  if (timeSpent > 60) {
    suggestions.push('長時間の作業です。定期的な休憩を取ることをおすすめします。');
  }
  
  if (logCount < 5) {
    suggestions.push('作業記録が少ないようです。より詳細なログを取ることで分析精度が向上します。');
  }

  if (efficiencyScore < 70) {
    suggestions.push('効率化の余地があります。ショートカットキーの活用やツールの導入を検討してください。');
  }

  return {
    efficiencyScore,
    suggestions,
    timeSpent
  };
}
