# DayOne AI — Backend Implementation Specification v1.0

## 0. Document Purpose

This document is the implementation blueprint for the DayOne AI backend MVP.

It is intended to be used by an AI coding agent or backend engineer as the source of truth for implementation.

The implementation should be completed phase-by-phase. Each phase has a clear goal, deliverables, and Definition of Done.

---

# 1. PRD — Product Requirements Document

## 1.1 Product

**DayOne AI** is an AI onboarding copilot that helps new employees understand company onboarding information and complete their onboarding tasks.

## 1.2 Problem

New joiners often receive onboarding information across multiple documents. This creates:

- difficulty finding the correct information
- repeated HR questions
- uncertainty about what to do next
- missed onboarding tasks
- risk of employees receiving unsupported or outdated information

## 1.3 Target User

Primary users:

- New employees
- People Operations / HR administrators

Example employee:

- Name: Aji
- Role: Backend Engineer
- Department: Engineering
- Location: Jakarta

## 1.4 Product Goals

The MVP must:

1. Answer questions using company onboarding documents.
2. Provide citations for company-document answers.
3. Avoid fabricating unsupported company information.
4. Personalize onboarding tasks using employee role, department, and location.
5. Persist onboarding task progress.
6. Allow HR to upload and manage document versions.
7. Provide a safe fallback and HR escalation when information is unavailable or sensitive.

## 1.5 MVP Functional Requirements

### FR-01 — AI Chat

The system must provide a chat API that accepts an employee question and returns an answer.

### FR-02 — Company Knowledge

Questions about company policies and onboarding information must use the company's published knowledge base.

### FR-03 — Citations

Company-document answers must include document, version, section, and page information when available.

### FR-04 — Safe Fallback

If reliable information cannot be found, the system must not invent an answer.

### FR-05 — Document Ingestion

HR must be able to upload PDF documents and process them into searchable knowledge.

### FR-06 — Document Versioning

Documents must support multiple versions and publication states.

### FR-07 — Duplicate Detection

The system must detect byte-identical files and identical normalized document content.

### FR-08 — Personalized Onboarding

The system must create onboarding tasks based on employee profile information.

### FR-09 — Task Progress

Employees must be able to mark onboarding tasks as completed.

### FR-10 — Security

Employees must not receive unauthorized employee or HR information.

## 1.6 Non-Functional Requirements

- FastAPI backend
- Deployable to Google Cloud Run
- Firestore for application data and MVP vector search
- Cloud Storage for original documents
- Vertex AI / Gemini for generation and embeddings
- No secrets committed to Git
- Clear logging and error handling
- Local development must be supported
- APIs should be testable independently

## 1.7 Out of Scope

Do not implement:

- Real HRIS integration
- Real payroll
- Leave approval workflows
- Employee salary database
- SSO
- Native mobile applications
- Multi-company tenancy
- GKE
- Cloud SQL
- BigQuery
- Pub/Sub
- API Gateway
- Microservice architecture
- Complex autonomous agent frameworks
- Custom ML classification models

---

# 2. System Architecture

## 2.1 High-Level Architecture

```text
                         ┌─────────────────────┐
                         │      Employee       │
                         │      Web UI         │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │     FastAPI API     │
                         │     Cloud Run       │
                         └──────────┬──────────┘
                                    │
                         ┌──────────┴──────────┐
                         │                     │
                         ▼                     ▼
                  ┌──────────────┐      ┌──────────────┐
                  │ Scope/Intent │      │ User Profile │
                  │    Router    │      │  Firestore   │
                  └──────┬───────┘      └──────────────┘
                         │
              ┌──────────┼───────────────┐
              │          │               │
              ▼          ▼               ▼
           COMPANY     MY DATA       ACTIONS
           KNOWLEDGE
              │
              ▼
        ┌───────────────┐
        │   Retrieval   │
        │ Firestore     │
        │ Vector Search │
        └───────┬───────┘
                │
                ▼
        ┌───────────────┐
        │ Context       │
        │ Builder       │
        └───────┬───────┘
                │
                ▼
        ┌───────────────┐
        │ Gemini /      │
        │ Vertex AI     │
        └───────┬───────┘
                │
                ▼
        ┌───────────────┐
        │ Grounding &   │
        │ Citation      │
        │ Validation    │
        └───────┬───────┘
                │
                ▼
             Employee
```

## 2.2 Core Google Cloud Services

| Service | Responsibility |
|---|---|
| Cloud Run | Run FastAPI application |
| Firestore | Application data, chunks, embeddings, tasks |
| Cloud Storage | Original PDF files |
| Vertex AI / Gemini | LLM generation |
| Vertex AI Embeddings | Text/query embeddings |
| Cloud Logging | Application logs |
| Artifact Registry | Container image storage |

---

# 3. API Contract

Base path:

```text
/api/v1
```

## 3.1 Health

### `GET /health`

Response:

```json
{
  "status": "ok"
}
```

---

## 3.2 Chat

### `POST /chat`

Request:

```json
{
  "user_id": "user_001",
  "message": "How do I request a laptop?"
}
```

Response:

```json
{
  "answer": "You should submit a laptop request through ...",
  "citations": [
    {
      "document_id": "laptop-request-procedure",
      "document_title": "Laptop Request Procedure",
      "version": "1.0",
      "section": "Request Process",
      "page": 2
    }
  ],
  "intent": "COMPANY_KNOWLEDGE",
  "grounded": true,
  "escalation_required": false
}
```

### Business Rules

- Company knowledge questions must use RAG.
- Retrieved context must be filtered by authorization.
- Only published document versions may be retrieved.
- Unsupported questions must produce a safe fallback.
- Sensitive information requests must be rejected or escalated.
- Citations are required for company-document answers.

---

# 4. Document APIs

## 4.1 Create Document

### `POST /documents`

Creates a logical document.

Example request:

```json
{
  "title": "Leave Policy",
  "document_type": "POLICY",
  "department": "People Operations",
  "location": "Jakarta"
}
```

---

## 4.2 Upload Version

### `POST /documents/{document_id}/versions`

Uploads a PDF as a new document version.

The backend must:

1. Calculate file SHA-256.
2. Check for identical file hash.
3. Store the original PDF in Cloud Storage.
4. Extract text.
5. Normalize extracted text.
6. Calculate content hash.
7. Check for duplicate content.
8. Create a processing record.

Recommended storage path:

```text
documents/{document_id}/{version_id}/original.pdf
```

---

## 4.3 Process Version

### `POST /versions/{version_id}/process`

Runs:

```text
PDF
→ text extraction
→ normalization
→ structure detection
→ chunking
→ metadata
→ embedding
→ Firestore
→ evaluation generation
```

---

## 4.4 Publish Version

### `POST /versions/{version_id}/publish`

Only an authorized HR user may publish.

Publishing must:

1. Verify automated validation passed.
2. Verify HR approval.
3. Mark the version as `PUBLISHED`.
4. Mark the previously active version as `SUPERSEDED`.
5. Write an audit log.

---

## 4.5 Reject Version

### `POST /versions/{version_id}/reject`

Marks a version as:

```text
REJECTED
```

The version must not be available to employee retrieval.

---

## 4.6 List Documents

### `GET /documents`

Supports filtering by:

- status
- department
- location
- document type

---

# 5. Onboarding APIs

## 5.1 Get Profile

### `GET /profile`

Response:

```json
{
  "user_id": "user_001",
  "name": "Aji",
  "role": "Backend Engineer",
  "department": "Engineering",
  "location": "Jakarta"
}
```

## 5.2 Update Profile

### `PUT /profile`

Example:

```json
{
  "name": "Aji",
  "role": "Backend Engineer",
  "department": "Engineering",
  "location": "Jakarta"
}
```

## 5.3 Get Tasks

### `GET /tasks`

Returns the employee's onboarding tasks.

## 5.4 Complete Task

### `POST /tasks/{task_id}/complete`

Response:

```json
{
  "task_id": "task_001",
  "status": "COMPLETED"
}
```

## 5.5 Progress

### `GET /onboarding/progress`

Response:

```json
{
  "total": 7,
  "completed": 3,
  "remaining": 4,
  "progress_percent": 42.86
}
```

---

# 6. Firestore Schema

## 6.1 `users`

```text
users/{user_id}
```

Fields:

```text
user_id
name
role
department
location
access_level
created_at
updated_at
```

---

## 6.2 `documents`

Represents the logical document.

```text
documents/{document_id}
```

Fields:

```text
title
document_type
department
location
owner
current_version_id
created_at
updated_at
```

---

## 6.3 `document_versions`

Represents each uploaded version.

```text
document_versions/{version_id}
```

Fields:

```text
document_id
version
status
file_hash
content_hash
storage_path
effective_date
uploaded_by
created_at
processed_at
published_at
```

Possible statuses:

```text
DRAFT
PROCESSING
FAILED
REVIEW
REJECTED
PUBLISHED
SUPERSEDED
```

---

## 6.4 `document_chunks`

Each chunk belongs to exactly one document version.

```text
document_chunks/{chunk_id}
```

Fields:

```text
document_id
version_id
content
section
page
chunk_index
embedding
metadata
created_at
```

Important:

Retrieval must only consider chunks whose associated document version is currently `PUBLISHED`.

---

## 6.5 `evaluation_questions`

Persistent regression questions.

```text
evaluation_questions/{question_id}
```

Fields:

```text
document_id
question
expected_source
expected_answer
created_at
updated_at
```

These questions are reused when new versions are uploaded.

---

## 6.6 `onboarding_tasks`

```text
onboarding_tasks/{task_id}
```

Fields:

```text
user_id
title
description
day
source_document_id
status
completed_at
created_at
```

---

## 6.7 `audit_logs`

```text
audit_logs/{log_id}
```

Fields:

```text
actor_id
action
resource_type
resource_id
previous_state
new_state
timestamp
metadata
```

---

# 7. Cloud Storage Structure

Recommended:

```text
gs://{bucket}/
└── documents/
    ├── leave-policy/
    │   ├── v1/
    │   │   └── original.pdf
    │   └── v2/
    │       └── original.pdf
    │
    ├── employee-handbook/
    │   └── v1/
    │       └── original.pdf
    │
    └── laptop-request-procedure/
        └── v1/
            └── original.pdf
```

The original PDF remains the source of truth for audit, reprocessing, and verification.

---

# 8. Folder Structure

```text
hris/
├── apps/
│   ├── backend/
│   │   ├── app/
│   │   │   ├── api/
│   │   │   ├── core/
│   │   │   ├── models/
│   │   │   ├── repositories/
│   │   │   ├── routers/
│   │   │   ├── schemas/
│   │   │   ├── services/
│   │   │   ├── config.py
│   │   │   └── main.py
│   │   ├── tests/
│   │   │   ├── unit/
│   │   │   ├── integration/
│   │   │   └── evaluation/
│   │   ├── Dockerfile
│   │   └── requirements.txt
│   └── frontend/
├── docs/
│   └── DayOne_AI_Backend_Implementation_Spec_v1.0.md
├── .env.example
├── .gitignore
└── README.md
```

---

# 9. Document Lifecycle State Machine

```text
                 ┌──────────────┐
                 │    UPLOAD    │
                 └──────┬───────┘
                        ↓
                ┌───────────────┐
                │ DUPLICATE     │
                │ CHECK         │
                └───────┬───────┘
                        │
             duplicate?│
                 ┌──────┴──────┐
                 ↓             ↓
              REJECT       PROCESSING
                               │
                               ↓
                         VALIDATION
                               │
                               ↓
                            REVIEW
                           /      \
                          /        \
                     REJECT       PUBLISH
                                  │
                                  ↓
                              PUBLISHED
                                  │
                                  ↓
                             SUPERSEDED
```

## State Transition Rules

| From | To | Actor |
|---|---|---|
| UPLOAD | PROCESSING | System |
| PROCESSING | REVIEW | System |
| PROCESSING | FAILED | System |
| REVIEW | PUBLISHED | HR |
| REVIEW | REJECTED | HR |
| PUBLISHED | SUPERSEDED | System |

Important:

**Upload does not equal publish.**

Employees can only retrieve information from `PUBLISHED` versions.

---

# 10. RAG Contract

## 10.1 Retrieval Pipeline

```text
User Question
      ↓
Scope Gate
      ↓
Intent Router
      ↓
Authorization
      ↓
Query Embedding
      ↓
Firestore Vector Search
      ↓
Top-K Chunks
      ↓
Context Builder
      ↓
Gemini
      ↓
Grounding Validation
      ↓
Citation Validation
      ↓
Response
```

## 10.2 Chunking

Use heading-aware chunking with a size limit.

Recommended initial configuration:

```text
Target chunk size: ~800 tokens
Overlap: ~100–150 tokens
```

Do not split blindly in the middle of meaningful sections when headings can be detected.

Each chunk should preserve:

- document ID
- version ID
- title
- section
- page
- chunk index
- access metadata

## 10.3 Embeddings

Each chunk gets one embedding.

At query time:

```text
Question
→ query embedding
→ vector similarity search
→ top-K chunks
```

Start with:

```text
K = 5
```

and tune based on evaluation.

## 10.4 Retrieval Rules

Only retrieve:

```text
document_version.status == PUBLISHED
```

Also apply authorization and metadata filters before sending context to Gemini.

## 10.5 Gemini Context Contract

Gemini receives:

```text
SYSTEM INSTRUCTIONS
+
USER QUESTION
+
RETRIEVED CONTEXT
```

The model must be instructed to:

1. Answer using retrieved company context.
2. Avoid unsupported company claims.
3. Clearly state when context is insufficient.
4. Return citations corresponding to retrieved chunks.

## 10.6 Safe Fallback

If retrieval does not provide sufficient evidence:

```text
I couldn't find reliable information about that in the
available company documentation. Please contact People
Operations for assistance.
```

The wording may be improved for UX, but the behavior must remain the same.

---

# 11. Scope & Intent Contract

The backend should route questions before expensive retrieval/generation.

## 11.1 Intents

```text
COMPANY_KNOWLEDGE
MY_ONBOARDING
ONBOARDING_ACTION
GENERAL_ONBOARDING
OUT_OF_SCOPE
```

## 11.2 Routing

```text
                    User Question
                         │
                         ▼
                    Scope Gate
                         │
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼
   OUT_OF_SCOPE    COMPANY_KNOWLEDGE   MY_ONBOARDING
        │                │                │
        ▼                ▼                ▼
      Reject             RAG          Firestore
```

## 11.3 Routing Principles

- Do not rely solely on keyword matching.
- Keep routing simple for MVP.
- Do not use an expensive LLM call when a deterministic rule can safely reject an obviously out-of-scope request.
- Authorization must occur before sensitive context reaches Gemini.

---

# 12. Citation Contract

A company-document answer must return structured citation data.

Example:

```json
{
  "document_title": "Laptop Request Procedure",
  "version": "1.0",
  "section": "Request Process",
  "page": 2
}
```

The frontend can display:

```text
📄 Laptop Request Procedure
v1.0 · Request Process · Page 2
```

Citation data should point to the exact retrieved source whenever possible.

---

# 13. Security & Authorization

## 13.1 Employee Access

Employees may access:

- published company onboarding documentation
- their own onboarding profile
- their own onboarding tasks
- information allowed by their access level

Employees may not access:

- another employee's private data
- salary information
- private HR records
- unpublished documents
- restricted HR information

## 13.2 Security Boundary

Security must not depend only on Gemini instructions.

The backend must:

1. Authenticate/identify the user.
2. Determine authorization.
3. Filter retrieved data.
4. Build the Gemini context only from authorized information.
5. Generate the response.
6. Validate citations.

---

# 14. Duplicate Detection

## 14.1 File Hash

Calculate SHA-256 of the original uploaded PDF.

If an identical hash already exists:

```text
Do not process again.
```

## 14.2 Content Hash

After extraction and normalization:

```text
PDF
→ extracted text
→ normalized text
→ SHA-256
```

This catches cases where two PDF files are different binary files but contain the same content.

## 14.3 Semantic Duplicate Detection

Semantic similarity may be added later as an advisory signal.

It must not automatically reject a document.

---

# 15. Onboarding Contract

## 15.1 Profile

Example:

```json
{
  "name": "Aji",
  "role": "Backend Engineer",
  "department": "Engineering",
  "location": "Jakarta"
}
```

## 15.2 Task Generation

Example:

```text
Day 1
├── Read Employee Handbook
├── Request laptop
└── Set up company account

Day 2
├── Read IT Security Guide
└── Configure development environment
```

Tasks must be stored in Firestore.

## 15.3 Progress

Progress is calculated from persisted task states.

Example:

```text
Total: 7
Completed: 3
Remaining: 4
Progress: 42.86%
```

---

# 16. Evaluation & Testing

## 16.1 Retrieval Evaluation

Create a golden set.

Example:

```text
Question:
How do I request a laptop?

Expected source:
Laptop Request Procedure
```

Run:

```text
question
→ retrieve top-K
→ check whether expected source is present
```

Metric:

```text
Hit@K = questions with expected source in top-K / total questions
```

Initial target:

```text
Hit@5 >= 80%
```

## 16.2 Answer Evaluation

Check:

- grounded in retrieved context
- factually consistent with source
- citation exists
- citation points to the relevant source
- unsupported questions trigger fallback

## 16.3 Security Tests

Test that:

- unpublished documents cannot be retrieved
- users cannot access another user's tasks
- sensitive employee requests are rejected
- unauthorized context is never sent to Gemini

## 16.4 Regression Tests

Golden questions must persist across document versions.

Example:

```text
Leave Policy v1.1
        ↓
Leave Policy v1.2
        ↓
Run same evaluation questions
```

This helps detect retrieval or answer regressions.

---

# 17. Acceptance Criteria

## Chat

- [ ] `POST /chat` works.
- [ ] Gemini integration works.
- [ ] Company questions use RAG.
- [ ] Company answers include citations.
- [ ] Unsupported questions do not hallucinate.
- [ ] Sensitive requests are rejected or escalated.

## Documents

- [ ] PDF can be uploaded.
- [ ] File duplicates are detected.
- [ ] Content duplicates are detected.
- [ ] Text is extracted.
- [ ] Chunks are created.
- [ ] Metadata is attached.
- [ ] Embeddings are created.
- [ ] Document versions are persisted.
- [ ] HR can review a version.
- [ ] HR can publish a version.
- [ ] Only published versions are retrieved.

## Onboarding

- [ ] User profile is stored.
- [ ] Tasks are generated/persisted.
- [ ] Tasks can be completed.
- [ ] Progress is persisted/calculated.
- [ ] Next onboarding action can be identified.

## Security

- [ ] Unpublished documents are inaccessible to employees.
- [ ] Users cannot access another user's onboarding data.
- [ ] Sensitive requests are protected.
- [ ] Authorization happens before Gemini context construction.
- [ ] Secrets are not committed.

## Deployment

- [ ] Docker image builds.
- [ ] Cloud Run deployment works.
- [ ] `/health` returns HTTP 200.
- [ ] Firestore connection works.
- [ ] Cloud Storage connection works.
- [ ] Gemini connection works.
- [ ] README contains setup and deployment instructions.

---

# 18. Implementation Schedule

The backend must be implemented incrementally.

## Phase 1 — Foundation

### Goal

Get the FastAPI service running locally and on Cloud Run.

### Deliverables

- FastAPI project
- `/health`
- basic `/chat`
- Gemini connection
- Firestore connection
- Cloud Storage connection
- Dockerfile
- Cloud Run deployment
- `.env.example`
- basic logging

### Definition of Done

A deployed Cloud Run API can receive a chat request and return a Gemini response.

---

## Phase 2 — Document Ingestion

### Goal

Turn HR PDFs into searchable chunks.

### Deliverables

```text
PDF
→ upload
→ file hash
→ duplicate check
→ text extraction
→ normalization
→ content hash
→ section detection
→ chunking
→ metadata
→ Firestore
```

### Definition of Done

At least one HR PDF can be processed into correctly stored chunks with metadata.

---

## Phase 3 — RAG

### Goal

Answer company questions from the knowledge base.

### Deliverables

```text
Question
→ query embedding
→ vector search
→ top-K chunks
→ context builder
→ Gemini
→ citation
→ fallback
```

### Definition of Done

A company question returns a grounded answer with the correct source citation.

---

## Phase 4 — Document Lifecycle

### Goal

Allow HR to safely manage document versions.

### Deliverables

- versioning
- lifecycle state machine
- duplicate detection
- processing validation
- evaluation questions
- HR review
- publish
- supersede
- audit logs

### Definition of Done

HR can upload a new version without immediately replacing the currently published version.

---

## Phase 5 — Scope, Intent & Security

### Goal

Route questions correctly and enforce security boundaries.

### Deliverables

- scope gate
- intent router
- authorization
- sensitive-data protection
- safe fallback
- escalation behavior

### Definition of Done

Out-of-scope and unauthorized questions do not unnecessarily enter the RAG/Gemini pipeline, and unauthorized information never reaches Gemini.

---

## Phase 6 — Personalized Onboarding

### Goal

Turn the system from a company chatbot into an onboarding copilot.

### Deliverables

```text
Profile
↓
Role + Department + Location
↓
Personalized tasks
↓
Task completion
↓
Progress
↓
Next action
```

### Definition of Done

A Backend Engineer in Jakarta receives relevant onboarding tasks and can persist task progress.

---

## Phase 7 — Evaluation & Hardening

### Goal

Make the backend reliable enough for the MVP demo.

### Deliverables

- golden questions
- retrieval evaluation
- answer evaluation
- citation validation
- regression tests
- API tests
- security tests
- error handling
- logging review

### Initial Targets

- Retrieval Hit@5 >= 80% on the golden evaluation set.
- 100% of company-document answers contain citations.
- Unsupported questions produce safe fallback.
- Sensitive requests are protected.
- No secrets are committed.

---

## Phase 8 — Demo & Submission

### Goal

Freeze features and prepare the final hackathon submission.

### Deliverables

- feature freeze
- critical bug fixes
- production Cloud Run deployment
- public GitHub repository
- English README
- architecture diagram
- English presentation deck
- <=3 minute demo video
- final end-to-end test

### Definition of Done

The deployed application, repository, documentation, deck, and demo video are ready for submission.

---

# 19. Deployment Specification

## 19.1 Runtime

Recommended:

```text
Python
FastAPI
Uvicorn
Docker
Cloud Run
```

## 19.2 Container

The application must:

- expose the configured Cloud Run port
- start FastAPI with Uvicorn
- handle SIGTERM gracefully
- write logs to stdout/stderr
- not store persistent application data on the local filesystem

## 19.3 Configuration

Use environment variables or Google Cloud secret/configuration mechanisms.

Never hard-code:

- API keys
- service account credentials
- passwords
- tokens

---

# 20. Environment Variables

Example:

```text
GOOGLE_CLOUD_PROJECT
GOOGLE_CLOUD_LOCATION
GCS_BUCKET_NAME
FIRESTORE_DATABASE
GEMINI_MODEL
EMBEDDING_MODEL
ENVIRONMENT
LOG_LEVEL
```

Do not commit real values.

Provide:

```text
.env.example
```

with placeholder values.

---

# 21. Error Handling

Use structured HTTP errors.

Suggested categories:

```text
400 — invalid request
401 — unauthenticated
403 — unauthorized
404 — resource not found
409 — duplicate/conflicting resource
422 — validation error
500 — internal server error
503 — external dependency unavailable
```

Examples:

### Duplicate document

```json
{
  "error": {
    "code": "DUPLICATE_DOCUMENT",
    "message": "An identical document already exists."
  }
}
```

### Unsupported knowledge

```json
{
  "answer": "I couldn't find reliable information about that in the available company documentation.",
  "citations": [],
  "grounded": false,
  "escalation_required": true
}
```

---

# 22. Idempotency & Reliability

Document processing must be safe to retry.

Requirements:

- duplicate uploads must not create duplicate active versions
- processing should be idempotent
- publishing should be protected against race conditions
- Firestore transactions should be used where state consistency matters
- failed processing should produce a `FAILED` state and useful error information

---

# 23. Coding Agent Instructions

The coding agent must follow these rules.

## Architecture

- Use FastAPI as the application/orchestration layer.
- Use Google Cloud services as infrastructure.
- Keep Google-specific integrations behind service modules.
- Keep business logic testable independently.

## Scope

Do not add:

- microservices
- GKE
- Cloud SQL
- BigQuery
- Pub/Sub
- API Gateway
- real HRIS
- SSO
- payroll
- leave approval
- native mobile application
- complex agent frameworks

unless explicitly requested later.

## RAG

- Never fabricate company information.
- Never retrieve unpublished documents for employee queries.
- Never send unauthorized retrieved content to Gemini.
- Always preserve source metadata.
- Always return citations for company-document answers.

## Documents

- Upload does not mean publish.
- Maintain document versions.
- Detect duplicate files.
- Detect duplicate normalized content.
- Keep original PDFs in Cloud Storage.
- Keep chunks tied to a specific document version.

## Security

- Do not rely solely on Gemini prompts for authorization.
- Perform authorization before context construction.
- Never expose private employee information to another employee.

## Development

Implement one phase at a time.

For each phase:

1. Implement.
2. Write/update tests.
3. Run tests.
4. Fix failures.
5. Update README/documentation.
6. Report completed deliverables.
7. Stop before starting the next phase unless explicitly instructed.

Do not generate a massive implementation for all phases at once.

---

# 24. Suggested Development Order

```text
Phase 1
  ↓
Phase 2
  ↓
Phase 3
  ↓
Phase 4
  ↓
Phase 5
  ↓
Phase 6
  ↓
Phase 7
  ↓
Phase 8
```

The system should remain runnable after every phase.

---

# 25. MVP Definition

DayOne AI MVP is complete when:

```text
Employee
   ↓
asks onboarding question
   ↓
FastAPI
   ↓
scope + intent
   ↓
authorized retrieval
   ↓
published HR documents
   ↓
relevant chunks
   ↓
Gemini
   ↓
grounded answer
   ↓
citation
```

and:

```text
HR
 ↓
uploads PDF
 ↓
duplicate detection
 ↓
processing
 ↓
review
 ↓
publish
 ↓
knowledge base
```

and:

```text
Employee Profile
 ↓
Role / Department / Location
 ↓
Personalized onboarding tasks
 ↓
Task completion
 ↓
Persistent progress
```

This is the minimum backend capability required for the DayOne AI MVP.
