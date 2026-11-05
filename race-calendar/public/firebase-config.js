// ============================================================
//  1) Firebase-Daten: Firebase Console → Projekteinstellungen →
//     "Meine Apps" → Web-App → SDK-Konfiguration. Einfach hier einfügen.
//     (Diese Werte sind öffentlich – geschützt wird über firestore.rules.)
//
//  Solange apiKey mit "DEIN" beginnt, läuft die Seite im Demo-Modus
//  (Beispieldaten, nur lokal im Browser gespeichert).
// ============================================================
export const firebaseConfig = {
  apiKey: "AIzaSyBl7L5Q6OregF48nu7eAnDTHsJpo9N__5k",
  authDomain: "race-calendar-4ebdf.firebaseapp.com",
  projectId: "race-calendar-4ebdf",
  storageBucket: "race-calendar-4ebdf.firebasestorage.app",
  messagingSenderId: "60191062336",
  appId: "1:60191062336:web:8d648c39798a1c64fda2a5",
  measurementId: "G-SPGFFBPJHX"
};

// ============================================================
//  2) Deine Benutzer-ID (UID) aus Firebase → Authentication → Users.
//     Nur dieser Account darf Events anlegen/ändern/löschen.
//     Dieselbe UID kommt auch in firestore.rules.
// ============================================================
export const ADMIN_UID = "68Yyd9yPfyVnAKOMz9xFsqtWRjf1";

// ============================================================
//  3) Texte auf der Seite
// ============================================================
export const SITE = {
  name: "Race Calendar",
  tagline: "Meine Läufe, Marathons & Triathlons – angemeldet und auf der Wunschliste.",
  instagram: "tmmckr",   // ohne @, wird oben angezeigt und verlinkt
};
