# BlockMate - AI Productivity Blocker 🔥

## Overview

BlockMate is a Chrome extension that blocks time-wasting websites and forces you to negotiate with AI personas (Strict, Bro, Zen) to gain temporary access. Track your progress with real-time stats: weak moments (attempts) and time reclaimed (saved minutes).

**Design**: 🎨 Premium Dark Theme with Coral Accents
**Backend**: 🚀 Node.js + Express + OpenAI GPT-4.1-nano
**Frontend**: 💻 Chrome Extension Manifest V3

## Key Features

### 🤖 Three AI Personas

-   **Strict Mode** 🛡️ - Strict, disciplined, philosophical
-   **Bro Mode** 🧢 - Casual, relatable, encouraging
-   **Zen Mode** 🧘 - Calm, mindful, balanced

Each persona has unique system prompts for varied, engaging responses.

### 📊 Real-Time Stats

-   **Weak Moments**: Total attempts to access blocked sites
-   **Time Reclaimed**: Cumulative minutes saved (tracked live in popup)

### 🎮 Game Mechanics

1. User attempts to access blocked site
2. Extension shows personalized AI challenge
3. User provides excuse/reason
4. AI evaluates response
5. Approved → Temporary unlock
6. Denied → Stats update, try again later

### 🎨 Premium Design

-   Dark theme with coral red accents (#ff6b6b)
-   Neon green stats display (#00ff00)
-   Smooth animations and micro-interactions
-   Glassmorphism effects
-   Emoji branding for personality

## Project Structure

```
BlockMate/
├── backend/                          # Node.js/Express API
│   ├── src/modules/aiChat/
│   │   ├── controllers/              # Request handlers
│   │   ├── services/                 # Business logic
│   │   ├── models/                   # Data & personas
│   │   └── routes.js                 # API endpoints
│   └── package.json
│
├── extension/                        # Chrome Extension
│   └── src/
│       ├── background/service-worker.js     # Blocking logic
│       ├── popup/                           # Dashboard UI
│       ├── blocked/                         # Negotiation page
│       ├── shared/                          # Shared utilities
│       └── styles/styles.css               # Premium design
│
└── README.md
```

## Quick Start

### Backend Setup

```bash
cd backend
npm install
echo "OPENAI_API_KEY=sk-..." > .env
npm start
# Server runs on http://localhost:3000
```

### Extension Setup

1. Open `chrome://extensions/`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select `BlockMate/extension/`
5. Pin extension to toolbar

### Test It

1. Click BlockMate icon → popup opens
2. Enter `google.com` in "Block a site" field
3. Click "Lock Site"
4. Visit google.com → blocked!
5. See challenge from selected AI persona
6. Provide excuse → AI evaluates
7. Check stats update in popup

## API Endpoints

### POST /api/challenge

Get an AI challenge to unlock a site

```json
{
  "persona": "strict" | "bro" | "zen"
}
```

Returns challenge message from selected persona.

### POST /api/evaluate

Submit your excuse for AI evaluation

```json
{
  "persona": "strict" | "bro" | "zen",
  "reason": "I need to check my email..."
}
```

Returns `{ approved: true/false, reply: "...", duration: number }`

### GET /api/stats

Fetch current stats

```json
{
  "attempts": 42,
  "savedMinutes": 210,
  "accessLog": { ... }
}
```

## Configuration

### Environment Variables (.env)

```env
OPENAI_API_KEY=sk-your-key-here
PORT=3000
```

## Design Highlights

### Colors

-   **Primary Accent**: Coral Red (#ff6b6b)
-   **Success**: Neon Green (#00ff00)
-   **Background**: Dark gradients (#0a0e14)
-   **Text**: Light gray (#e6eef8)

### Animations

-   Header pulse (subtle breathing effect)
-   Blocked page floating title
-   Button shimmer on hover
-   Response slide-up animation
-   Smooth transitions on all interactions

### Responsiveness

-   Popup: 380px fixed width (Chrome extension standard)
-   Blocked page: Max 800px, responsive on mobile
-   Mobile-optimized input fields and buttons
