# First Iteration of MONOREPO
backend ports:
8000 for shared LOD2 processing
8001 for Sanierungsnavigator
8002 for Fassadenaufmass
8003 for Geruestbauer

## Getting started

### Put .env files in backend and frontend directories
.env in backend
.env.local and .env.production in frontend

### Optional: Enable SAM3 Model Compilation (Server Performance)
Für bessere Performance auf dem Server kann `torch.compile()` für das SAM3-Modell aktiviert werden:
- **Lokale Entwicklung**: Standardmäßig deaktiviert (läuft stabil auf Low-RAM Systemen)
- **Server/Produktion**: Bereits in `docker-compose-deploymentserver.yml` aktiviert via `SAM3_COMPILE=true`
- **Vorteil**: ~15-25% schnellere Inferenz nach dem ersten Warmup
- **Nachteil**: Erhöhter RAM-Bedarf, erste Inferenz langsamer (Kompilierung)

Um es manuell zu deaktivieren, entferne die `SAM3_COMPILE=true` Zeile aus der Docker Compose Datei.

### Put the mtl model in backend/wattwert_only_mtl/data
Is gitignored because it is one single, too large file for git.

### Put an "LOD2" folder in every State's folder (in backend/States_data_download)
They are gitignored because they are usually too large to sync in git.

### Install packages
cd frontend -> npm install
cd backend -> pip install -r requirements.txt
Alternativ ist es empfehlenswert, im backend zuerst eine Virtuelle Umgebung zu starten:
cd backend -> python -m venv venv -> venv\Scripts\activate -> pip install -r requirements.txt

### Start up
im frontend: npm run dev
im backend: uvicorn main:app --reload

