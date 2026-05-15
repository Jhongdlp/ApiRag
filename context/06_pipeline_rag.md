# Pipeline RAG — Recuperación y Generación

## Qué es RAG

**Retrieval-Augmented Generation** (Lewis et al., 2020, Facebook AI Research) es una arquitectura que combina:

1. **Retrieval:** Recuperar fragmentos de texto relevantes desde una base de conocimiento (en nuestro caso, pgvector con chunks institucionales).
2. **Augmented:** Inyectar esos fragmentos como contexto en el prompt del LLM.
3. **Generation:** El LLM genera una respuesta fundamentada exclusivamente en ese contexto.

La ventaja fundamental sobre un LLM puro es que RAG **ancla la respuesta a hechos verificables**, eliminando alucinaciones sobre el dominio institucional.

---

## Diagrama del pipeline de consulta

```
Estudiante escribe: "¿Cuáles son los requisitos para graduarme?"
                              │
                    ┌─────────▼──────────┐
                    │   POST /api/v1/chat │
                    │  ChatRequest{query} │
                    └─────────┬──────────┘
                              │
               ┌──────────────▼──────────────────┐
               │        HybridRetriever            │
               │                                    │
               │  ┌─────────────────────────────┐  │
               │  │      VectorRetriever         │  │
               │  │  embed(query) → bge-m3       │  │
               │  │  RPC match_chunks (pgvector) │  │
               │  │  cosine similarity ≥ 0.4     │  │
               │  │  → top-10 chunks             │  │
               │  └──────────────┬──────────────┘  │
               │                 │                   │
               │  ┌──────────────▼──────────────┐  │
               │  │       BM25Retriever          │  │
               │  │  carga corpus completo       │  │
               │  │  tokeniza query              │  │
               │  │  BM25Okapi scores            │  │
               │  │  → top-10 chunks             │  │
               │  └──────────────┬──────────────┘  │
               │                 │                   │
               │  ┌──────────────▼──────────────┐  │
               │  │   RRF (k=60) — fusión        │  │
               │  │  score_rrf = Σ 1/(k + rank)  │  │
               │  │  → top-5 chunks finales      │  │
               │  └──────────────┬──────────────┘  │
               └─────────────────┼─────────────────┘
                                 │ List[Chunk] top-5
                    ┌────────────▼──────────────┐
                    │     LLMService             │
                    │  build_prompt(query,chunks)│
                    │  ollama.generate(          │
                    │    model=qwen2.5:14b,      │
                    │    temperature=0.1,        │
                    │    num_predict=512         │
                    │  )                         │
                    └────────────┬──────────────┘
                                 │
                    ┌────────────▼──────────────┐
                    │   ChatResponse             │
                    │   {answer, sources[]}      │
                    └───────────────────────────┘
```

---

## Recuperación vectorial (`VectorRetriever`)

**Archivo:** `fastapi/services/retrieval/vector.py`

### Proceso

1. El embedding del query se genera con el mismo modelo (`bge-m3`) usado durante la ingesta, garantizando el mismo espacio vectorial.
2. Se llama a la función RPC `match_chunks` en Supabase:

```sql
SELECT id, doc_id, content, metadata,
       1 - (embedding <=> query_embedding) AS similarity
FROM document_chunks
WHERE 1 - (embedding <=> query_embedding) > 0.4
ORDER BY embedding <=> query_embedding
LIMIT 10;
```

3. El operador `<=>` es la distancia coseno en pgvector. Se convierte a similitud: `similarity = 1 - cosine_distance`.
4. El umbral `min_similarity=0.4` filtra chunks semánticamente alejados del query.

### Por qué similitud coseno

La distancia coseno mide el ángulo entre vectores, ignorando la magnitud. Es la métrica estándar para embeddings de texto porque captura la dirección semántica, no la "energía" del texto.

---

## Recuperación léxica (`BM25Retriever`)

**Archivo:** `fastapi/services/retrieval/bm25.py`

### Proceso

1. Se carga **todo el corpus** de chunks desde Supabase.
2. Se tokeniza el corpus y el query con una expresión regular de palabras (`\w+`, lowercase).
3. `BM25Okapi` calcula un score para cada chunk basado en la frecuencia de términos del query.
4. Se retornan los top-10 chunks con score > 0.

### Por qué BM25 además de vectores

BM25 (Best Match 25, Robertson & Zaragoza, 2009) es el estándar de recuperación léxica. Sus ventajas complementarias al retrieval vectorial:

- **Exactitud léxica:** Términos técnicos como "Art. 47", "Reglamento de Régimen Académico", siglas institucionales, tienen alta frecuencia de término y BM25 los recupera con precisión.
- **Sin alucinaciones semánticas:** El embedding puede considerar "similar" un texto sobre otra universidad; BM25 requiere coincidencia literal de palabras.
- **Robustez en queries específicos:** "fecha límite matrícula ordinaria" → BM25 encuentra el artículo que menciona exactamente esas palabras.

---

## Fusión de rankings: Reciprocal Rank Fusion (`HybridRetriever`)

**Archivo:** `fastapi/services/retrieval/hybrid.py`

### Fórmula RRF

```
score_rrf(chunk) = Σ_r [ 1 / (k + rank_r(chunk)) ]
```

Donde:
- `k = 60` (constante estándar de RRF, Cormack et al., 2009).
- `rank_r(chunk)` es la posición del chunk en el ranking del retriever `r` (0-indexado).
- La suma se realiza sobre todos los retrievers (vectorial y BM25).

### Ejemplo

| Chunk | Rank vectorial | Rank BM25 | Score RRF |
|---|---|---|---|
| Chunk A | 1 | 3 | 1/61 + 1/63 = 0.0322 |
| Chunk B | 2 | 1 | 1/62 + 1/61 = 0.0325 ← gana |
| Chunk C | 0 | 15 | 1/60 + 1/75 = 0.0300 |

### Por qué RRF y no suma ponderada

RRF no requiere normalizar los scores de diferentes retrievers (que tienen escalas muy distintas: coseno [0,1] vs BM25 [0,∞]). Solo usa los **rankings** relativos, haciendo la fusión robusta y sin hiperparámetros adicionales.

---

## Generación (`LLMService` + `build_prompt`)

**Archivos:** `fastapi/services/generation/llm.py`, `fastapi/services/generation/prompt.py`

### Template del prompt

```
Eres el asistente académico oficial de la Universidad Tecnológica Indoamérica (UTI).
Responde únicamente basándote en el contexto institucional proporcionado.
Si la información no está en el contexto, indica que no tienes datos suficientes.
Responde siempre en español, de forma clara, precisa y respetuosa.

### Contexto institucional:
[Fuente 1 — reglamento_academico.pdf]
Art. 47 — Para graduarse el estudiante debe...

[Fuente 2 — manual_titulacion.pdf]
...

### Pregunta del estudiante:
¿Cuáles son los requisitos para graduarme?

### Respuesta:
```

### Parámetros del LLM

| Parámetro | Valor | Razón |
|---|---|---|
| `temperature` | 0.1 | Respuestas deterministas y precisas; baja creatividad (no deseada en contexto institucional) |
| `num_predict` | 512 | Límite de tokens generados; respuestas concisas |
| `model` | `qwen2.5:14b` | Mejor balance calidad/VRAM disponible (9 GB en V100 16 GB) |

### Por qué Qwen2.5:14b

- Modelo de Alibaba Cloud, multilingüe con excelente soporte para español.
- Parámetros 14B: capacidad razonamiento superior a modelos 7B; cabe en 16 GB VRAM con cuantización Q4.
- Instrucciones: sigue el system prompt con alta fidelidad.
- Alternativas evaluadas: Llama3.1:8B (menor calidad en español), Mistral:7B (menor adherencia a instrucciones).

---

## Respuesta final

```json
{
  "answer": "Para graduarse en la UTI, según el Reglamento Académico Art. 47, el estudiante debe: (1) haber aprobado el 100% de créditos del plan de estudios...",
  "sources": [
    {"filename": "reglamento_academico.pdf", "h1": "TÍTULO IV", "h2": "CAPÍTULO III", "h3": "Art. 47", "chunk_index": 89},
    {"filename": "manual_titulacion.pdf", "h1": "PROCESO DE TITULACIÓN", "chunk_index": 12}
  ]
}
```

Las `sources` permiten al frontend mostrar la trazabilidad de la respuesta: el estudiante puede saber de qué documento y sección proviene cada parte de la respuesta.
