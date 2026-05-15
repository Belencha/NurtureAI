# Project Instructions

- **Testing**: Always run related unit tests using `npx vitest run` after modifying core logic or UI components that depend on it to prevent regressions.
- **Language**: The application interface (UI, menus, labels) must be in English. However, AI-generated nutrition summaries and extracted diet plans should match the language of the source document (e.g., if the PDF is in Spanish, the summary should be in Spanish).
- **AI Formatting**: The Gemini service should provide diet plans using Markdown tables with "Comida" and "Descripción y Porción" (combined food and quantity) as the primary columns (using headers appropriate for the detected language).
