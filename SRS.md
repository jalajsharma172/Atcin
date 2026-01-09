# Software Requirements Specification (SRS)
# Project: ATC Controller (Atcin)

## 1. Introduction

### 1.1 Purpose
The purpose of this document is to define the functional and non-functional requirements for the "ATC Controller" (Atcin) application. This project is a web-based Air Traffic Control (ATC) simulation game designed to simulate the experience of managing airspace, guiding aircraft, and ensuring safe takeoffs and landings.

### 1.2 Scope
The application is a single-page web application (SPA) built with Next.js. It features a realistic 2D radar display, flight progress strips, and a command interface supporting both text and voice inputs. The simulation runs entirely in the browser using a custom game engine.

### 1.3 Definitions, Acronyms, and Abbreviations
- **ATC**: Air Traffic Control
- **SPA**: Single Page Application
- **TTS**: Text-to-Speech
- **SRS**: Software Requirements Specification
- **UI**: User Interface
- **FPS**: Frames Per Second

## 2. Overall Description

### 2.1 Product Perspective
This software is a standalone web application. It is a modern port/reimagining of a legacy HTML/JS-based ATC simulator, upgrading the technology stack to React and Next.js for better performance, maintainability, and user experience.

### 2.2 Product Functions
- **Airspace Simulation**: Real-time updates of aircraft positions, headings, speeds, and altitudes.
- **Radar Visualization**: Graphical representation of the airspace, including aircraft blips, airports, and waypoints.
- **Command & Control**: Interface for users to issue standard ATC instructions (e.g., climb, descend, turn).
- **Voice Interaction**: Integration with Web Speech API for voice commands and audio feedback.
- **Flight Management**: Tracking active flights via flight strips.

### 2.3 User Characteristics
- **Target Audience**: Aviation enthusiasts, gamers, and users interested in simulation games.
- **Skill Level**: Basic understanding of ATC terminology is helpful but not strictly required (simulation can be gamified).

### 2.4 Constraints
- **Browser Compatibility**: Requires a modern web browser (Chrome, Edge, Safari) compatible with Next.js and Web Speech API.
- **Performance**: Must maintain smooth animation (target 60 FPS) for the radar display on average hardware.

## 3. Specific Requirements

### 3.1 Functional Requirements

#### 3.1.1 Simulation Engine
- **FR-01**: The system shall spawn aircraft at random intervals and locations outside the active airspace.
- **FR-02**: The system shall simulate aircraft physics (speed, heading, altitude changes) based on user commands.
- **FR-03**: The system shall detect proximity between aircraft and trigger collision alerts if separation minimums are violated.
- **FR-04**: The system shall track successful handoffs/landings and update the score.

#### 3.1.2 Radar Display
- **FR-05**: The UI shall render a 2D map with a coordinate system.
- **FR-06**: Aircraft shall be displayed as icons with data blocks showing callsign, altitude, and speed.
- **FR-07**: The display shall update in real-time to reflect the simulation state.
- **FR-08**: Users shall be able to select aircraft by clicking on them on the radar.

#### 3.1.3 Command Interface
- **FR-09**: The system shall accept text commands via an input field.
- **FR-10**: The system shall accept voice commands via the microphone using the Web Speech API.
- **FR-11**: The system shall parse standard ATC syntax (e.g., "AFR123 T L H 270" -> Turn Left Heading 270).
- **FR-12**: The system shall provide textual log feedback for every command issued.
- **FR-13**: The system shall provide audio (TTS) readback for commands.

#### 3.1.4 Flight Strips
- **FR-14**: The system shall display a list of "Flight Strips" on the sidebar.
- **FR-15**: Each strip shall show static and dynamic data (Callsign, Type, Destination, Assigned Altitude).
- **FR-16**: Clicking a flight strip shall select the corresponding aircraft.

### 3.2 Non-Functional Requirements

#### 3.2.1 Performance
- **NFR-01**: The application shall minimize layout shifts and render blocking to ensure a responsive UI.
- **NFR-02**: The game loop shall run efficiently, separating logic updates from rendering frames.

#### 3.2.2 Usability
- **NFR-03**: The interface shall use a high-contrast dark theme (simulating a radar screen) for reduced eye strain and realism.
- **NFR-04**: Critical information (collisions, warnings) shall be visually distinct (e.g., Red/Orange colors).

#### 3.2.3 Reliability
- **NFR-05**: The application shall handle speech recognition errors gracefully without crashing the game state.

## 4. Technology Stack (Implementation Constraints)

- **Frontend Framework**: Next.js 15+ (App Router)
- **UI Library**: React 19
- **Styling**: Tailwind CSS 4
- **Language**: TypeScript
- **State Management**: React Hooks (`useState`, `useRef`) for local state; Game Engine class for simulation state.
- **APIs**: Web Speech API (Recognition & Synthesis).

## 5. Appendices

### 5.1 Legacy Compatibility
The project includes a `_legacy` directory containing the original implementation. The new system aims to replicate and extend the features found in the legacy codebase while modernizing the architecture.
