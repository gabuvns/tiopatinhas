import { initializeApp, getApps } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserSessionPersistence,
  type User,
} from "firebase/auth";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  serverTimestamp,
  query,
  orderBy,
  limit,
  getDocs as getDocsFromServer,
  getDoc as getDocFromServer,
} from "firebase/firestore/lite";
import { validateData, type AppData } from "./store";

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};
export const firebaseConfigured = Object.values(config).every(
  (value) => typeof value === "string" && value.trim(),
);
function client() {
  if (!firebaseConfigured)
    throw new Error("Configure o projeto Firebase para ativar os backups.");
  const app =
    getApps().find((app) => app.name === "TioPatinhas") ??
    initializeApp(config, "TioPatinhas");
  return { auth: getAuth(app), db: getFirestore(app) };
}
function requireUser(uid: string) {
  const value = client();
  if (!value.auth.currentUser || value.auth.currentUser.uid !== uid)
    throw new Error("A conta mudou. Entre novamente antes de continuar.");
  return value;
}
export const observeAccount = (callback: (user: User | null) => void) =>
  onAuthStateChanged(client().auth, callback);
export async function loginGoogle() {
  const { auth } = client();
  await setPersistence(auth, browserSessionPersistence);
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  await signInWithPopup(auth, provider);
}
export const logoutGoogle = () => signOut(client().auth);
async function digest(payload: string) {
  if (!globalThis.crypto?.subtle)
    throw new Error(
      "Abra o aplicativo em HTTPS ou localhost para usar o backup na nuvem.",
    );
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(payload),
  );
  return [...new Uint8Array(bytes)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}
export async function uploadCloudBackup(data: AppData, uid: string) {
  validateData(data);
  const payload = JSON.stringify(data);
  if (new TextEncoder().encode(payload).byteLength > 900000)
    throw new Error(
      "O backup excede 900 KB. Use a exportação JSON para guardar este histórico completo.",
    );
  const hash = await digest(payload),
    { db } = requireUser(uid);
  const reference = doc(collection(db, "users", uid, "backups"));
  await setDoc(reference, {
    payload,
    hash,
    createdAt: serverTimestamp(),
    eventCount: data.events.length,
  });
  return reference.id;
}
export interface CloudBackupItem {
  id: string;
  date: string;
  eventCount: number;
}
export async function listCloudBackups(
  uid: string,
): Promise<CloudBackupItem[]> {
  const { db } = requireUser(uid);
  const result = await getDocsFromServer(
    query(
      collection(db, "users", uid, "backups"),
      orderBy("createdAt", "desc"),
      limit(5),
    ),
  );
  requireUser(uid);
  return result.docs.map((record) => ({
    id: record.id,
    date:
      record.data().createdAt?.toDate().toLocaleString("pt-BR") ??
      "Data indisponível",
    eventCount: Number(record.data().eventCount) || 0,
  }));
}
export async function downloadCloudBackup(uid: string, id: string) {
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error("Identificador inválido.");
  const { db } = requireUser(uid);
  const result = await getDocFromServer(doc(db, "users", uid, "backups", id));
  requireUser(uid);
  if (!result.exists()) throw new Error("Backup não encontrado.");
  const { payload, hash } = result.data();
  if (
    typeof payload !== "string" ||
    typeof hash !== "string" ||
    (await digest(payload)) !== hash
  )
    throw new Error("O backup não passou pela verificação de integridade.");
  return validateData(JSON.parse(payload));
}
