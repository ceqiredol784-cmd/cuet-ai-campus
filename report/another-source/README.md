# CUET AI Campus — SWE Proposal Diagram Set

All diagrams are drawn for the actual CUET AI Campus project (React web client +
Node/Express API + MongoDB), grounded in `cuet-ai-campus-api/src/models` and the
route layer, in the monochrome senior-style UML aesthetic
(`report_tools/draw_senior_style.py`).

Regenerate with:

```
python report_tools/draw_opencode_diagrams.py
```

| # | File | Proposal figure | Contents |
|---|------|-----------------|----------|
| 01 | `01-03_usecase_student.png` | Use Case Diagram — Student | login, browse feed, routine/calendar, AI chat, download routine PDF |
| 02 | `02-03_usecase_cr.png` | Use Case Diagram — CR | student cases + declare CT/lecture override, compose notice/event, propose routine edits |
| 03 | `03-03_usecase_coordinator.png` | Use Case Diagram — Coordinator | approve proposals, publish, manage students/CRs/academics, audit log |
| 04 | `04_activity_diagram.png` | Activity Diagram | role-split main workflow (student / CR / coordinator branches) |
| 05 | `05_class_diagram.png` | Class Diagram | core domain entities: User, Section, Course, RoutineEntry, Exam, Update, ScheduleOverride, RoutineProposal, Assignment, ChatMessage |
| 06 | `06_sequence_login_routine.png` | Sequence Diagram — Login & Routine Fetch | client → auth → JWT → routine fetch → D1/D3 |
| 07 | `07_sequence_ct_declaration.png` | Sequence Diagram — CT Declaration & Instant Publish | CR → override create → linked feed Update → student feed |
| 08 | `08_architecture_data_centered.png` | Architectural Model (data-centered) | repositories around a central MongoDB data store |
| 09 | `09_structure_chart.png` | Structure Chart | Student / CR / Coordinator modules over shared services |
| 10 | `10_component_design.png` | Component Level Design | DeclarationService, FeedService, CalendarService with provided/required interfaces |
| 11 | `11_dfd_context.png` | First Level DFD (Context) | system process 0 with Student, CR, Coordinator, LLM/Email external entities |
| 12 | `12_dfd_student.png` | Student DFD (Level 1) | processes 1.0–4.0 with D1–D4 stores |
| 13 | `13_dfd_coordinator.png` | Coordinator DFD (Level 1) | processes 1.0–5.0 with D1, D2, D5, D6 stores |
| 14 | `14_er_cardinality.png` | Entity Relationship Mapping (Cardinality View) | 11 entities with 1:N / N:1 cardinalities |
| 15 | `15_er_diagram.png` | ER Diagram | same entities with attribute tables and key/FK marks |
| 16 | `16_system_overview.png` | System Overview | layered overview: users → React SPA → Express API → MongoDB / LLM / email |
| 17 | `17_gantt_timeline.png` | Project Timeline (Gantt Chart) | 16-week plan: SRS, design, backend, frontend, AI integration, testing, deployment |
| 18 | `18_ai_integration.png` | AI-Integration Architecture | chat UI → `/api/ai/chat` → context builder → OpenAI-compatible LLM, deterministic fallback |
| 19 | `19_home_wireframe.png` | Wireframe — Home Screen | student home: nav, updates & events feed, today's classes, upcoming exams |
| 20 | `20_deployment.png` | Deployment Diagram | client device, application server (:3000), MongoDB (:27017), cloud APIs |
