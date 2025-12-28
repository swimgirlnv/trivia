# Wits & Wagers Online (Multiplayer)

This is a realtime, multiplayer trivia + betting game inspired by **Wits & Wagers**.

- Frontend: **React + TypeScript + Vite**
- Multiplayer: **Firebase Auth (anonymous) + Firestore (realtime listeners)**
- Hosting: **GitHub Pages** (static)

## 1) Run locally

```bash
cd wits-wagers-online
npm i
cp .env.example .env.local
# fill in Firebase values in .env.local
npm run dev
```

## 2) Firebase setup (minimal)

1. Create a Firebase project
2. Enable:
   - Authentication → **Anonymous**
   - Firestore Database (in production mode is fine; add rules below)
3. Put your Firebase web config values into `.env.local`

## 3) Firestore rules (starter)

Create `firestore.rules` at repo root (or paste into Firebase console):

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {
    function isAuthed() { return request.auth != null; }
    function isHost(roomId) {
      return isAuthed()
        && get(/databases/$(db)/documents/rooms/$(roomId)).data.hostUid == request.auth.uid;
    }

    match /rooms/{roomId} {
      allow read: if isAuthed();
      allow create: if isAuthed();
      allow update: if isHost(roomId);
    }

    match /rooms/{roomId}/players/{uid} {
      allow read: if isAuthed();
      allow create, update: if isAuthed() && request.auth.uid == uid;
    }

    match /rooms/{roomId}/rounds/{roundId}/answers/{uid} {
      allow read: if isAuthed();
      allow create, update: if isAuthed() && request.auth.uid == uid;
    }

    match /rooms/{roomId}/rounds/{roundId}/bets/{uid} {
      allow read: if isAuthed();
      allow create, update: if isAuthed() && request.auth.uid == uid;
    }
  }
}
```

## 4) Deploy to GitHub Pages

This repo is `swimgirlnv/trivia`, so Vite is configured with:

- `base: "/trivia/"`

Add the workflow in `.github/workflows/deploy.yml` (included in the zip this assistant generated).

Then in GitHub:
- Settings → Pages → Source: **GitHub Actions**

## Notes / Fair play

For the simplest MVP, the trivia pack (with answers) is shipped to the client bundle, which means a determined player could inspect it.
If you want “real” secrecy, move questions/answers to a server-only store (Cloud Functions or a separate admin tool).
