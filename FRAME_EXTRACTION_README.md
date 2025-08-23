# Video Frame Extraction Tool

This tool is a script that extracts image frames from video files at 5-second intervals.

## Prerequisites

### FFmpeg Installation

This script uses FFmpeg. Install it using the following commands:

```bash
# macOS (using Homebrew)
brew install ffmpeg

# Ubuntu/Debian
sudo apt install ffmpeg

# Windows
# Download from https://ffmpeg.org/download.html
```

## Usage

### 1. Using npm scripts (Recommended)

```bash
npm run extract-frames <video-file-path>
```

Examples:
```bash
npm run extract-frames ~/Desktop/screen-recording.mov
npm run extract-frames /Users/username/Movies/test-video.mp4
```

### 2. Direct execution

```bash
node scripts/video-to-frames.js <video-file-path>
```

Examples:
```bash
node scripts/video-to-frames.js ~/Desktop/screen-recording.mov
```

### 3. Direct execution (with execute permission)

```bash
./scripts/video-to-frames.js <video-file-path>
```

## Output

- Extracted images are saved to the `captured-frames/` directory
- File name format: `{video-name}_{date}_frame_{sequence}.png`
- Example: `screen-recording_2024-01-15_frame_0001.png`

## Supported Video Formats

- .mp4
- .mov
- .avi
- .mkv
- .webm
- .m4v

## Configuration

The following settings in the script can be modified:

- `FRAME_INTERVAL`: Frame extraction interval (default: 5 seconds)
- `OUTPUT_DIR`: Output directory (default: `captured-frames/`)

## Example

```bash
# Extract frames from screen recording video
npm run extract-frames ~/Desktop/screen-recording-2024-01-15.mov

# Sample output:
# 📸 Generated images: 120 frames
# 📁 Images saved to the following directory:
#    /Users/yokotadaigo/Dev/YCom_Project/captured-frames
```

## Troubleshooting

### When FFmpeg is not found

```
❌ Error: FFmpeg not found

💡 Please install FFmpeg:
   macOS: brew install ffmpeg
   Ubuntu: sudo apt install ffmpeg
   Windows: https://ffmpeg.org/download.html
```

### When video format is not supported

```
❌ Error: Unsupported video format: .xyz
Supported formats: .mp4, .mov, .avi, .mkv, .webm, .m4v
```

### When video file is not found

```
❌ Error: Video file not found: /path/to/video.mp4
```

Please verify the path is correct. If the path contains spaces, wrap it in quotes:

```bash
npm run extract-frames "~/Desktop/My Video.mov"
```
