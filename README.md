# Gotham Animation Studio

> Make SVG animations through conversation. A new way to create.

## Overview

Gotham Animation Studio reimagines animation creation by integrating a conversational AI assistant directly into an SVG animation workflow. Instead of navigating complex timelines and property editors, simply describe what you want - the AI understands and implements your creative vision.

Born from a simple bat signal SVG, this project demonstrates how natural language can become the primary interface for digital creation, making animation accessible to everyone regardless of technical expertise.

![Gotham Animation Studio](https://placeholder-image.com/gotham-studio-screenshot.jpg)

## Core Concept

Traditional animation tools require specialized knowledge of timelines, keyframes, easing functions, and transformation matrices. Gotham Animation Studio flips this paradigm:

```
User: "Make the bat symbol pulse with a yellow glow every 2 seconds"
AI: "I've added a pulsing glow effect to the bat symbol. The animation cycles every 2 seconds with a smooth transition. Would you like me to adjust the intensity?"
```

The AI assistant becomes your creative partner - understanding context, making intelligent suggestions, and handling the technical implementation while you focus on creative direction.

## Current Features

### Conversational Animation Interface
- Create, modify and animate SVG elements through natural language
- Ask for specific animations, effects, or timing adjustments
- Get intelligent responses from OpenAI

### SVG Animation Capabilities
- Create and manage basic shapes (rectangles, circles, paths, lines)
- Apply keyframe animations to any property (position, size, opacity, color)
- Built-in animation presets (bat signal, city skyline, lightning)
- Real-time preview of animations

### AI Integration
- Powered by OpenAI API for natural language understanding
- Structured JSON responses for consistent SVG generation
- Contextual awareness of current animation state

## Installation & Setup

### Prerequisites
- Node.js (v14+)
- npm or yarn
- OpenAI API key

### Backend Setup
1. Navigate to the backend directory: `cd backend`
2. Install dependencies: `npm install`
3. Create a `.env` file based on `.env.example`:
   ```
   PORT=3001
   OPENAI_API_KEY=your_openai_api_key_here
   OPENAI_MODEL=gpt-4-turbo
   ```
4. Start the backend server: `npm run dev`

### Frontend Setup
1. Navigate to the frontend directory: `cd frontend`
2. Install dependencies: `npm install`
3. Create a `.env` file with:
   ```
   VITE_API_URL=http://localhost:3001/api
   ```
4. Start the frontend development server: `npm start`
5. Open your browser to `http://localhost:3000`

## Basic Usage
1. Type your animation request in the chat interface (e.g., "Create a night sky with stars that twinkle randomly")
2. Review the AI's implementation in the preview window
3. Make additional requests to refine or expand your animation (e.g., "Make the stars blue instead of white")
4. Use the timeline scrubber to review specific frames
5. Adjust the animation duration if needed

## Project Structure

```
.
├── frontend/                  # Frontend application
│   ├── public/                # Static assets
│   └── src/                   # Source code
│       ├── components/        # React components
│       ├── contexts/          # Context providers
│       ├── hooks/             # Custom React hooks
│       └── utils/             # Utility functions
│
└── backend/                   # Backend application
    ├── src/                   # Source code
    │   ├── controllers/       # Request handlers
    │   ├── routes/            # API routes
    │   ├── services/          # Business logic
    │   ├── utils/             # Utility functions
    │   └── data/              # Data storage
    ├── .env                   # Environment variables
    └── .env.example           # Example environment variables
```

## OpenAI Integration

The integration with OpenAI requires prompt engineering to generate appropriate SVG elements. The system is designed to:

1. Send a carefully structured system prompt that defines the expected JSON format
2. Include the current animation state for context-aware updates
3. Parse and validate the JSON response to ensure it meets the application's requirements

### Prompt Format

The system uses a structured JSON format to communicate with OpenAI:

```json
{
  "elements": [
    {
      "id": "unique-id-string",
      "type": "circle|rect|path|text|line|group",
      "attributes": {
        "attribute1": "value1",
        "attribute2": "value2"
      },
      "animations": [
        {
          "id": "unique-animation-id",
          "targetProperty": "propertyName",
          "keyframes": [
            { "offset": 0, "value": "startValue" },
            { "offset": 0.5, "value": "midValue" },
            { "offset": 1, "value": "endValue" }
          ],
          "duration": 3000,
          "easing": "ease-in-out",
          "delay": 0,
          "iterationCount": 1
        }
      ]
    }
  ],
  "message": "Your friendly response to the user about what you created"
}
```

## Contributing

This project is in early development. If you're interested in contributing, please:
1. Star the repository to show your interest
2. Open issues for feature requests or bugs
3. Submit pull requests with improvements

## License

[MIT License](LICENSE.md) - Feel free to use, modify and distribute as needed.

---

*"The night is darkest just before the dawn. And I promise you, the dawn is coming." - Harvey Dent*
