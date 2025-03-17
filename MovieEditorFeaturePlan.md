# SVG Animator Movie Editor Feature Plan

## Overview
This document outlines the plan for adding a new movie editor feature to the SVG Animator application. The movie editor will leverage existing SVG animation functionality to create a storyboard-based movie creation system where users can:

1. Create and save individual animation clips
2. Organize clips into a storyboard sequence
3. Use LLM assistance to generate storyboard ideas based on user prompts

## UX Design Plan

### Navigation & Layout
1. **New Movie Editor Page**
   - Add a new route/page accessible from the main header
   - Maintain consistent styling with the existing application
   - Responsive design for mobile and desktop views

2. **Page Structure**
   - Top: Header with navigation, save/export controls
   - Left: Storyboard panel showing clip thumbnails in sequence
   - Center: Preview area showing the current clip or full storyboard playback
   - Right: Clip editor panel (reusing existing animation editor)
   - Bottom: Timeline controls for multi-clip playback

### User Interactions
1. **Clip Creation**
   - Reuse existing SVG animation creation functionality
   - Add "Save as Clip" option to store animation in the storyboard
   - Provide clip naming/labeling capabilities

2. **Storyboard Management**
   - Drag and drop interface for arranging clips
   - Add/remove/duplicate clip functionality
   - Adjust individual clip duration
   - Preview storyboard with transitions between clips

3. **LLM Storyboard Generation**
   - Modal popup form for entering movie concept prompt
   - LLM generates complete storyboard with scene descriptions
   - Option to generate individual clips based on scene descriptions
   - Accept/reject/modify individual generated scenes

4. **Export Options**
   - Export entire movie as combined SVG
   - Export as JSON with all clip data for future editing
   - Export individual clips

## Software Architecture Plan

### Frontend Components

1. **New Pages/Components**
   - `MovieEditorPage.tsx`: Main container for the movie editor
   - `StoryboardPanel.tsx`: Displays and manages clip sequence
   - `ClipThumbnail.tsx`: Individual clip preview/selection
   - `StoryboardControls.tsx`: Controls for storyboard playback
   - `StoryboardGeneratorModal.tsx`: LLM prompt interface for storyboard generation

2. **Context Updates**
   - Extend `AnimationContext` to support clip management or create new `MovieContext`
   - Add state for:
     - Clips array (stored SVG animations)
     - Active clip selection
     - Playback position in storyboard
     - Storyboard metadata

3. **Data Model**
   ```typescript
   interface MovieClip {
     id: string;
     name: string;
     svgContent: string;
     duration: number;
     order: number;
     prompt?: string;
     chatHistory?: Message[];
   }

   interface Storyboard {
     id: string;
     name: string;
     description: string;
     clips: MovieClip[];
     createdAt: Date;
     updatedAt: Date;
   }
   ```

### Backend Changes

1. **New API Endpoints**
   - `/movie/generate-storyboard`: Accept prompt and return storyboard data
   - `/movie/save`: Save entire movie/storyboard
   - `/movie/load`: Load saved movie
   - `/movie/list`: List saved movies

2. **LLM Integration**
   - Extend existing LLM services to handle storyboard generation
   - Create prompt templates for storyboard generation
   - Define JSON schema for LLM storyboard responses

   ```typescript
   // Example response schema
   interface StoryboardGenerationResponse {
     title: string;
     description: string;
     scenes: {
       id: string;
       description: string;
       svgPrompt: string;
       duration: number;
     }[];
   }
   ```

3. **Data Storage**
   - Extend local storage handling for saving/loading movies
   - Add optional server-side storage for larger projects

## Implementation Phases

### Phase 1: Core Structure
1. Create new movie editor page with basic layout
2. Implement navigation between main app and movie editor
3. Set up data models and state management
4. Create stub components for UI elements

### Phase 2: Clip Management
1. Implement ability to save current animation as a clip
2. Develop storyboard panel with clip thumbnails
3. Add clip ordering and selection functionality
4. Create clip playback controls

### Phase 3: LLM Integration
1. Create storyboard generator modal
2. Implement backend API for storyboard generation
3. Set up LLM prompting for storyboard ideas
4. Handle generation and loading of storyboard clips

### Phase 4: Playback and Export
1. Implement sequential playback of clips
2. Add transition effects between clips
3. Develop export functionality for full storyboard
4. Create movie preview mode

### Phase 5: Polish and Refinement
1. Improve responsive design
2. Add error handling and loading states
3. Optimize performance
4. Add user guidance and tooltips

## Technical Considerations

1. **Performance**
   - Optimize SVG rendering for multiple clips
   - Consider lazy loading for storyboard with many clips
   - Efficient storage and retrieval of clip data

2. **Compatibility**
   - Ensure backward compatibility with existing saved animations
   - Maintain cross-browser support for SVG animations

3. **LLM Limitations**
   - Handle rate limits and token constraints
   - Provide fallbacks for failed LLM requests
   - Ensure prompts are structured for optimal results

4. **Local Storage**
   - Consider IndexedDB for larger storyboards instead of localStorage
   - Implement export/import to prevent data loss

## Required Changes to Existing Code

1. Extend `AnimationContext` to support clip management
2. Modify save/load utilities to handle clip and storyboard formats
3. Update the main navigation to include movie editor access
4. Ensure existing components can be reused within the movie editor

## Implementation Progress

### Completed
1. ✅ Created the feature plan document
2. ✅ Created the MovieContext for state management
3. ✅ Created the MovieEditorPage component with basic layout
4. ✅ Created the StoryboardPanel component for displaying clips
5. ✅ Added routing in App.tsx for the movie editor page
6. ✅ Updated Header component with navigation links
7. ✅ Created StoryboardGeneratorModal for LLM prompting
8. ✅ Created backend API endpoint for storyboard generation
9. ✅ Added generateRawResponse method to AIService
10. ✅ Created frontend API service for movie-related endpoints

### In Progress
1. 🔄 Implement clip creation from storyboard scenes
2. 🔄 Add functionality to save/load storyboards

### To Do
1. ⬜ Implement clip reordering functionality
2. ⬜ Add clip editing capabilities
3. ⬜ Implement playback controls for the storyboard
4. ⬜ Add export functionality for the entire storyboard
5. ⬜ Implement transitions between clips
6. ⬜ Add responsive design improvements
7. ⬜ Add error handling and loading states
8. ⬜ Optimize performance for large storyboards
9. ⬜ Add user guidance and tooltips
