# Gotham Animation Studio

> Make SVG animations through conversation. A new way to create.

## Overview

Gotham Animation Studio reimagines animation creation by integrating a conversational AI assistant directly into an SVG animation workflow. Instead of navigating complex timelines and property editors, simply describe what you want - the AI understands and implements your creative vision.

Born from a simple bat signal SVG, this project demonstrates how natural language can become the primary interface for digital creation, making animation accessible to everyone regardless of technical expertise.

![Gotham Animation Studio](https://placeholder-image.com/gotham-studio-screenshot.jpg)

## Architecture Overview

Gotham Animation Studio follows a clean separation of concerns between the frontend and backend:

### Backend (AI Processing)
- Handles all communication with AI providers (OpenAI or Claude)
- Processes natural language prompts and converts them to SVG animations
- Returns complete, self-contained SVG code with embedded animations
- No animation logic is implemented on the backend - it purely manages the AI conversation

### Frontend (Rendering & User Interface)
- Renders the SVG animation received directly from the backend
- Manages playback controls (play/pause/reset)
- Handles the chat interface for user prompts
- Doesn't implement any animation generation logic - it simply displays what the backend provides

This design ensures that all AI processing and SVG generation logic stays on the backend, while the frontend remains focused on rendering and user interaction.

## Data Flow

1. User enters a prompt in the chat interface
2. Frontend sends prompt to backend API
3. Backend constructs appropriate OpenAI prompt with detailed system instructions
4. OpenAI generates a complete SVG with embedded animations
5. Backend extracts and validates the SVG and sends it to the frontend
6. Frontend renders the SVG directly without modifications

### API Response Format

The API returns a simple, standardized format:

```json
{
  "success": true,
  "svg": "<svg>...</svg>",
  "message": "Human-friendly description of what was created"
}
```

This format ensures that the frontend doesn't need to process or modify the SVG - it can be inserted directly into the DOM.

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
- Get intelligent responses from OpenAI gpt-4o-mini

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
- OpenAI API key or Anthropic Claude API key

### Backend Setup
1. Navigate to the backend directory: `cd backend`
2. Install dependencies: `npm install`
3. Create a `.env` file based on `.env.example`:
   ```
   PORT=3001

   # OpenAI configuration
   OPENAI_API_KEY=your_openai_api_key_here
   OPENAI_MODEL=gpt-4o-mini

   # Claude configuration (optional)
   CLAUDE_API_KEY=your_claude_api_key_here
   CLAUDE_MODEL=claude-3-7-sonnet-20250219

   # Default AI Provider (openai or claude)
   AI_PROVIDER=openai
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

The integration with OpenAI gpt-4o-mini requires prompt engineering to generate appropriate SVG elements. The system is designed to:

1. Send a carefully structured system prompt that defines the expected SVG format
2. Include the current animation state for context-aware updates
3. Parse and validate the SVG response to ensure it meets the application's requirements

### System Prompt Structure

The backend uses a specialized system prompt that instructs the AI to generate complete SVG code with embedded animations. The prompt specifies:

- The expected output format (complete SVG with animations)
- How to structure animations using both SMIL and CSS methods
- Required SVG attributes like viewBox and namespace
- Design considerations like the dark background
- Example templates showing proper syntax

### Direct SVG Response

Unlike many AI integrations that use structured JSON for complex data, this system optimizes for simplicity by having the AI generate complete SVG code directly:

1. The AI generates a full SVG document with embedded animations
2. The backend extracts this SVG from the response
3. The frontend inserts it directly into the DOM without modifications

This approach eliminates the need for complex client-side animation logic and ensures that all creative decisions are handled by the AI, not by hard-coded frontend rules.

### Error Handling

To ensure a graceful user experience, the system includes several safeguards:

- SVG validation to catch malformed output
- Automatic fallback to error SVGs when validation fails
- Descriptive error messages that guide the user
- Rate limiting and error handling for OpenAI API issues

## Contributing

This project is in early development. If you're interested in contributing, please:
1. Star the repository to show your interest
2. Open issues for feature requests or bugs
3. Submit pull requests with improvements

## License

[MIT License](LICENSE.md) - Feel free to use, modify and distribute as needed.

---

*"The night is darkest just before the dawn. And I promise you, the dawn is coming." - Harvey Dent*
