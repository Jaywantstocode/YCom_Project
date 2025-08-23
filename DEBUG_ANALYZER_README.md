# Image Analysis Tool

Simple tool for analyzing captured video frames with AI.

## Prerequisites

### Environment Setup

```bash
export OPENAI_API_KEY="your-api-key-here"
```

### Generate Images

```bash
npm run extract-frames <video-file-path>
```

## Usage

```bash
npm run analyze [image-index]
```

## Examples

```bash
# Analyze default image (index 10)
npm run analyze

# Analyze specific image
npm run analyze 25
npm run analyze 0
npm run analyze 100
```

## Output

AI analysis in Japanese with insights and suggestions:

```json
{
  "success": true,
  "timestamp": 1755927092092,
  "analysis": {
    "description": "画面の詳細な説明",
    "insights": ["観察結果", "ユーザー行動分析"],
    "actionSuggestions": ["改善提案"]
  }
}
```

## Troubleshooting

### No API key
```
❌ Error: OPENAI_API_KEY is not configured
```
Set your API key: `export OPENAI_API_KEY="your-key"`

### No images found
```
❌ Error: 画像ファイルが見つかりません
```
Run: `npm run extract-frames <video-file>`

### Index out of range
```
❌ Error: 画像インデックス 500 が範囲外です
```
Use valid index (0 to total images - 1)