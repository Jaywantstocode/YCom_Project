# Image Analysis Tool

Simple tool for analyzing captured video frames with AI.

## Prerequisites

### Environment Setup

```bash
# Create .env file with your OpenAI API key
OPENAI_API_KEY=your-api-key-here
```

### Generate Images

```bash
npm run extract-frames <video-file-path>
```

## Usage

```bash
npm run screen-capture-analyze [image-index]           # AI analysis only
npm run screen-capture-analyze-and-save [image-index]  # AI analysis + Supabase save
```

## Examples

```bash
# Analyze default image (index 10)
npm run screen-capture-analyze

# Analyze specific images
npm run screen-capture-analyze 1
npm run screen-capture-analyze 25
npm run screen-capture-analyze 100
```

## Output

AI analysis in Japanese with insights and suggestions:

```json
{
  "success": true,
  "timestamp": 1755929195821,
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
Add your API key to `.env` file

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