# PRD - EducAgent: El Tutor Inteligente Proactivo

## 1. Visión del Producto
**EducAgent** es un agente de IA de terminal (CLI) diseñado para transformar el aprendizaje técnico y académico. A diferencia de un chat convencional, EducAgent actúa como un docente proactivo que ingiere contexto local, gestiona el progreso mediante metodologías ágiles (Kanban) y adapta su pedagogía según el nivel de fricción deseado por el usuario.

El objetivo es ofrecer una experiencia "hacker", minimalista y altamente productiva, eliminando las distracciones de las interfaces web pesadas mientras se construye una base sólida para escalar a una Progressive Web App (PWA).

---

## 2. Modos de Operación (Core Logic)
El agente operará bajo cuatro perfiles distintos, seleccionables al inicio de la sesión:

| Modo | Nombre | Descripción Pedagógica |
| :--- | :--- | :--- |
| **🧙‍♂️ Socrático** | *Strict Mode* | No entrega respuestas. Obliga al usuario a explicar conceptos y razonamientos antes de avanzar. Inspirado en Maieutic. |
| **🗺️ Arquitecto** | *Planning Mode* | Analiza temarios y documentos para generar "Bolsas de Tareas" y Roadmaps de estudio estructurados. |
| **⏱️ Simulacro** | *Exam Mode* | Genera evaluaciones rápidas, retos de código y preguntas de validación basadas en los apuntes del usuario. |
| **☕ Explorador** | *Brainstorming* | Consultas rápidas, explicaciones directas y análisis de viabilidad para proyectos o ideas de negocio. |

---

## 3. Características Funcionales (MVP)

### 3.1. Ingesta de Contexto (Local RAG)
* **Escaneo de Directorio:** El usuario inicia el agente en una carpeta (`educagent --init`).
* **Formatos Soportados:** Lectura de archivos `.pdf`, `.md`, `.txt` y código fuente (`.java`, `.py`, `.ts`).
* **Indexación:** Creación de un almacén de vectores local para consultas rápidas sobre el material de estudio.

### 3.2. Gestión de Tareas y Sincronización
* **Bolsas de Tareas:** Desglose automático de temas complejos en subtareas accionables.
* **Integración con Notion:** Sincronización bidireccional con tableros Kanban. El agente puede crear, actualizar y mover tarjetas de estudio según el progreso verificado en la terminal.

### 3.3. Memoria a Largo Plazo
* **Historial de Dificultad:** El agente registra qué temas le costaron más al usuario para reforzar la repetición espaciada en futuras sesiones.
* **Contexto de Carrera:** Conocimiento del semestre actual y materias relacionadas para crear analogías transversales.

---

## 4. Arquitectura Técnica y Escalabilidad

### 4.1. Diseño de Software
Se utilizará una **Arquitectura Hexagonal (Puertos y Adaptadores)** para desacoplar la lógica de negocio de la interfaz:
* **Core Logic:** Gestión de prompts, orquestación de RAG y lógica de estados de aprendizaje.
* **Interface CLI (Adaptador actual):** Desarrollada con **Ink** (React para terminal) para ofrecer una UI rica con componentes interactivos.
* **API Wrapper (Adaptador futuro):** Una capa que permitirá exponer el Core a través de un servidor para la versión PWA.

### 4.2. Stack Tecnológico
* **Lenguaje:** TypeScript (por su robustez y facilidad de refactorización).
* **CLI Framework:** `Ink` o `Clack` para una estética pulida.
* **Base de Datos Local:** `SQLite` para persistencia de progreso y memoria.
* **AI Orchestration:** `LangChain` o `Vercel AI SDK` para la integración con LLMs (Claude 3.5 Sonnet / Gemini 1.5 Pro).
* **Styling:** `Chalk` y `Lucide-static` para iconos y colores en terminal.

---

## 5. Experiencia de Usuario (UX)
* **Estética:** Paleta de colores oscuros con acentos en cian o verde neón.
* **Interactividad:** Uso de selectores de flechas, barras de progreso para la lectura de documentos y spinners de carga durante el razonamiento del agente.
* **Comandos Rápidos:**
    * `educagent learn`: Inicia sesión de estudio activa.
    * `educagent plan`: Genera roadmap y envía a Notion.
    * `educagent quiz`: Lanza modo simulacro sobre el tema actual.

---

## 6. Roadmap de Desarrollo
1.  **Fase 1 (CLI MVP):** Core de ingestión de archivos, Modos Socrático y Explorador, almacenamiento local en SQLite.
2.  **Fase 2 (Ecosistema):** Integración con Notion API y Modo Arquitecto.
3.  **Fase 3 (PWA Bridge):** Desarrollo de la API y versión web interactiva manteniendo la CLI como herramienta de productividad principal.
