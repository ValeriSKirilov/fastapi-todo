## Предложение (Project Proposal)

**Scope & Objective:**
This project upgrades an existing FastAPI/VanillaJS task management architecture into an AI-driven productivity suite. The focus is on "depth over breadth" by tightly integrating an autonomous agent with our established backend CRUD operations.

**Core Use Case / Demo Scenario:**
A user logs into Checkmate and uses the voice interface to request a schedule overview. The user then uploads a photo of a handwritten whiteboard plan. The AI agent analyzes the image, extracts the goals, and automatically invokes backend endpoints to create a new project with nested subtasks. Finally, the user asks the agent to find a specific task they completed "sometime last month," utilizing advanced retrieval to fetch the exact record.

**AI Techniques & Integration (Course Requirements):**

*   **Tool Calling & MCP (Model Context Protocol):** The AI acts as an autonomous agent, communicating with the PostgreSQL database through a standardized MCP server. It maps user intents directly to our existing FastAPI endpoints (e.g., `createItem`, `updateItem`).
*   **Structured Outputs:** All agent interactions that mutate database state are strictly validated against our existing Pydantic schemas (e.g., `ItemCreate`, `ItemUpdate`) to guarantee zero schema mismatch errors or backend crashes.
*   **Multimodality (Vision & Audio):** 
    *   *Audio:* Real-time STT (Speech-to-Text) for user commands and TTS (Text-to-Speech) for the agent's responses, utilizing streaming to ensure low latency.
    *   *Vision:* The ability to parse uploaded images (e.g., meeting notes) and automatically convert them into structured Parent/Child tasks.
*   **Advanced RAG with Re-ranking:** Implemented to search through archived, completed, or soft-deleted tasks without hallucinating past events. Semantic search is paired with a re-ranking step to guarantee high-relevance retrieval.
*   **Security (Prompt Injection Guardrails):** System prompts are hardened to reject malicious instructions (e.g., "Delete all my projects" or attempts to access the `/users/me` deletion endpoint).
*   **Cost Management:** The UI includes a session metric that logs input/output tokens and displays the real-time accumulated cost (in USD) to the user.

## Стартиране (How to Run)

The application is fully containerized. To run the project locally, follow these steps:

1. **Clone the repository:**
   ```bash
   git clone https://github.com/ValeriSKirilov/fastapi-todo.git
   cd fastapi-todo
   ```

2. **Set up environment variables:**
   Do not commit real API keys. Copy the example file and populate it with your keys:
   ```bash
   cp .env.example .env
   ```
   *Ensure standard names like `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` are provided in the `.env` file.*

3. **Start the application with Docker:**
   ```bash
   docker compose up --build
   ```

4. **Access the application:**
   * **Frontend Interface:** Open your browser and go to `http://localhost:8000` (or the configured frontend port).
   * **API Documentation (Swagger UI):** Open `http://localhost:8000/docs`.

## Architecture & Tech Stack

*   **Backend:** Python, FastAPI, SQLAlchemy, Pydantic
*   **Database:** PostgreSQL (Production) / SQLite + PostgreSQL (Testing)
*   **Frontend:** HTML5, CSS3, JavaScript (Reactive UI with standard DOM manipulation)
*   **AI/LLM:** Integration with leading LLM APIs (OpenAI/Anthropic)
*   **Infrastructure:** Docker, Docker Compose

## Repository Structure

*   `/app`: FastAPI backend, routers, models, schemas, and AI agent logic.
*   `/frontend`: UI assets, reactive state management (`app.js`), and styles.
*   `/tests`: Pytest suite including Happy Path, Sad Path, and Security validations.
*   `docker-compose.yml` & `Dockerfile`: Container orchestration.