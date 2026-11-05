# 🏃 Race Calendar

Deine persönliche Wettkampf-Seite: Halbmarathons, Marathons, Ironman 70.3 & Co. –
angemeldet oder auf der Wunschliste. Öffentlich lesbar (perfekt für Linktree/Instagram),
bearbeiten kannst nur du.

**Features**
- Listen- und Kalenderansicht, Tabs: Anstehend · Angemeldet · Wunschliste · Absolviert
- Countdown zum nächsten Rennen, Statistiken (inkl. geplante Wettkampf-km)
- Vergangene Anmeldungen werden automatisch zu „Absolviert" (mit Ergebnis-Zeit)
- Besucher können jedes Event als `.ics` in ihren eigenen Kalender übernehmen
- Login nur für dich, Daten in Firestore, Auto-Deploy über GitHub

---

## Ordnerstruktur

```
race-calendar/
├── public/                 ← die eigentliche Website
│   ├── index.html
│   ├── styles.css
│   ├── app.js
│   └── firebase-config.js  ← HIER deine Daten eintragen
├── firestore.rules         ← wer darf lesen/schreiben
├── firebase.json
├── .firebaserc             ← deine Projekt-ID
└── .github/workflows/firebase-deploy.yml
```

**Vorschau ohne Firebase:** `public/index.html` lokal öffnen (z. B. mit der VS-Code-Erweiterung
„Live Server"). Solange keine Firebase-Daten eingetragen sind, läuft die Seite im Demo-Modus
mit Beispiel-Events.

---

## Einrichtung (ca. 20 Minuten)

### 1. Firebase-Projekt anlegen
1. <https://console.firebase.google.com> → **Projekt hinzufügen** (z. B. `race-calendar`). Google Analytics kannst du weglassen.
2. Auf der Projektübersicht auf das **`</>`-Symbol (Web)** klicken → App registrieren.
3. Den angezeigten `firebaseConfig`-Block in **`public/firebase-config.js`** einfügen.
4. Die **Projekt-ID** in `.firebaserc` und in `.github/workflows/firebase-deploy.yml` statt `DEIN-PROJEKT` eintragen.

### 2. Datenbank (Firestore) erstellen
1. Links **Build → Firestore Database → Datenbank erstellen**.
2. Standort z. B. `eur3 (europe-west)` oder `europe-west3 (Frankfurt)`, Modus: **Produktion**.

### 3. Deinen Login anlegen
1. **Build → Authentication → Jetzt starten → Anmeldemethode → E-Mail/Passwort** aktivieren.
2. Tab **Nutzer → Nutzer hinzufügen**: deine E-Mail + ein starkes Passwort.
3. Die angezeigte **Nutzer-UID** kopieren und eintragen in:
   - `public/firebase-config.js` → `ADMIN_UID`
   - `firestore.rules` → `"DEINE_UID"`

### 4. Sicherheitsregeln aktivieren
Firestore → Tab **Regeln** → den Inhalt von `firestore.rules` hineinkopieren → **Veröffentlichen**.
(Alternativ per CLI: `firebase deploy --only firestore:rules`)

### 5. Texte anpassen
In `public/firebase-config.js` unter `SITE`: Seitenname, Untertitel, Instagram-Name.

### 6. GitHub + automatisches Deployment
1. Neues Repository auf GitHub anlegen und den Ordner hochladen:
   ```bash
   cd race-calendar
   git init && git add . && git commit -m "Race Calendar"
   git branch -M main
   git remote add origin https://github.com/DEIN-NAME/race-calendar.git
   git push -u origin main
   ```
2. Firebase-CLI installieren (benötigt Node.js) und verbinden:
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase init hosting:github
   ```
   Fragen beantworten: Repository `DEIN-NAME/race-calendar` · Build-Skript: **Nein** ·
   Deploy bei Merge: **Ja**, Branch `main`.
   Die CLI legt dabei automatisch das GitHub-Secret an. Sie erzeugt auch eigene Workflow-Dateien –
   dann kannst du `firebase-deploy.yml` löschen (doppelt hält nicht besser).

   *Ohne CLI:* Google Cloud Console → IAM → Dienstkonten → Schlüssel (JSON) erstellen →
   in GitHub unter **Settings → Secrets → Actions** als `FIREBASE_SERVICE_ACCOUNT` speichern.
3. Ab jetzt gilt: **Push auf `main` = Seite ist live** unter
   `https://DEIN-PROJEKT.web.app`

---

## Events eintragen
1. Deine Seite öffnen und unten rechts auf das **🔒-Symbol** tippen
   (oder direkt `https://DEIN-PROJEKT.web.app/#admin` aufrufen).
2. Einloggen → der gelbe **+ Event**-Button erscheint.
3. Name, Datum, Art (z. B. *Ironman 70.3*), Status (*Angemeldet* / *Wunschliste*), Ort, Link …
4. Bearbeiten/Löschen: Event antippen → **Bearbeiten**.

Neue Events erscheinen sofort für alle – ohne neues Deployment, weil sie in Firestore liegen.
Ein Deployment brauchst du nur, wenn du am Design oder Code etwas änderst.

## Linktree / Instagram
Einfach `https://DEIN-PROJEKT.web.app` als Link in Linktree hinzufügen, z. B. mit dem Titel
„🏃 Meine Rennen 2027". Eigene Domain? Firebase → Hosting → **Benutzerdefinierte Domain hinzufügen**.

## Eigene Event-Arten
In `public/app.js` ganz oben im Objekt `TYPES` – z. B. `"swimrun": { label: "Swimrun", km: 30 },`

## Sicherheit – kurz erklärt
Die Werte in `firebase-config.js` sind **kein Geheimnis**, sie stehen bei jeder Firebase-Seite
im Browser. Geschützt wird über `firestore.rules`: Lesen darf jeder, schreiben nur deine UID.
