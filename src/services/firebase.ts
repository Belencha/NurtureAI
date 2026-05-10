import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, collection, query, where, getDocs, addDoc, deleteDoc, serverTimestamp, orderBy, limit, onSnapshot } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { mockDb } from './mockDb';

// More rigorous check for "placeholder" values
const isConfigured = firebaseConfig && 
                     firebaseConfig.apiKey && 
                     firebaseConfig.apiKey !== 'placeholder' && 
                     firebaseConfig.apiKey !== '' &&
                     !firebaseConfig.apiKey.includes('placeholder');

let app: any;
let auth: any;
let db: any;
let googleProvider: any;

if (isConfigured) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(app);
    db = getFirestore(app);
    googleProvider = new GoogleAuthProvider();
  } catch (err) {
    console.error("Firebase initialization failed:", err);
  }
}

export { auth, db };

export const loginWithGoogle = async () => {
  if (!isConfigured || !auth) {
    console.log("Using simulated login because Firebase is not configured");
    // Simulated login for demo
    const mockUser = {
      uid: 'demo-user-' + Math.random().toString(36).substr(2, 4),
      displayName: 'Demo User',
      email: 'demo@example.com',
      photoURL: null
    };
    localStorage.setItem('demo_user', JSON.stringify(mockUser));
    // Trigger a fake auth state change? We'll handle this in AuthContext
    window.location.reload(); 
    return mockUser;
  }
  
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
};

export const logout = () => {
  if (!isConfigured) {
    localStorage.removeItem('demo_user');
    window.location.reload();
    return;
  }
  return signOut(auth);
};

// Firestore helpers with error handling
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid || 'anonymous',
      email: auth?.currentUser?.email || null,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const saveUser = async (user: any) => {
  if (!isConfigured) return; // Mock user handled via login
  
  const userRef = doc(db, 'users', user.uid);
  try {
    await setDoc(userRef, {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      createdAt: serverTimestamp(),
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
  }
};

// Diet CRUD
export const saveDiet = async (userId: string, diet: any) => {
  if (!isConfigured) {
    mockDb.save(userId, 'diets', diet.id, diet);
    return;
  }
  try {
    const dietRef = doc(db, 'users', userId, 'diets', diet.id);
    await setDoc(dietRef, { ...diet, userId, updatedAt: serverTimestamp() });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${userId}/diets/${diet.id}`);
  }
};

export const deleteDietFromDb = async (userId: string, dietId: string) => {
  if (!isConfigured) {
    mockDb.delete(userId, 'diets', dietId);
    return;
  }
  try {
    const dietRef = doc(db, 'users', userId, 'diets', dietId);
    await deleteDoc(dietRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `users/${userId}/diets/${dietId}`);
  }
};

export const getDiets = async (userId: string) => {
  if (!isConfigured) return [];
  try {
    const dietRef = collection(db, 'users', userId, 'diets');
    const q = query(dietRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data());
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, `users/${userId}/diets`);
    return [];
  }
};

// Food Log CRUD
export const saveFoodLog = async (userId: string, log: any) => {
  if (!isConfigured) {
    mockDb.save(userId, 'logs', log.id, log);
    return;
  }
  try {
    const logRef = doc(db, 'users', userId, 'logs', log.id);
    await setDoc(logRef, { ...log, userId, updatedAt: serverTimestamp() });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${userId}/logs/${log.id}`);
  }
};

export const getFoodLogs = async (userId: string) => {
  if (!isConfigured) return [];
  try {
    const logRef = collection(db, 'users', userId, 'logs');
    const q = query(logRef, orderBy('timestamp', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data());
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, `users/${userId}/logs`);
    return [];
  }
};

export const deleteFoodLogFromDb = async (userId: string, logId: string) => {
  if (!isConfigured) {
    mockDb.delete(userId, 'logs', logId);
    return;
  }
  try {
    const logRef = doc(db, 'users', userId, 'logs', logId);
    await deleteDoc(logRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `users/${userId}/logs/${logId}`);
  }
};

// Listeners for real-time updates
export const subscribeToDiets = (userId: string, callback: (diets: any[]) => void) => {
  if (!isConfigured) return mockDb.subscribe(userId, 'diets', callback);
  const q = query(collection(db, 'users', userId, 'diets'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => doc.data()));
  }, (err) => handleFirestoreError(err, OperationType.LIST, `users/${userId}/diets`));
};

export const subscribeToLogs = (userId: string, callback: (logs: any[]) => void) => {
  if (!isConfigured) return mockDb.subscribe(userId, 'logs', callback);
  const q = query(collection(db, 'users', userId, 'logs'), orderBy('timestamp', 'desc'));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => doc.data()));
  }, (err) => handleFirestoreError(err, OperationType.LIST, `users/${userId}/logs`));
};

// Exercise Log CRUD
export const saveExerciseLogDb = async (userId: string, log: any) => {
  if (!isConfigured) {
    mockDb.save(userId, 'exerciseLogs', log.id, log);
    return;
  }
  try {
    const logRef = doc(db, 'users', userId, 'exerciseLogs', log.id);
    await setDoc(logRef, { ...log, userId, updatedAt: serverTimestamp() });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${userId}/exerciseLogs/${log.id}`);
  }
};

export const deleteExerciseLogDb = async (userId: string, logId: string) => {
  if (!isConfigured) {
    mockDb.delete(userId, 'exerciseLogs', logId);
    return;
  }
  try {
    const logRef = doc(db, 'users', userId, 'exerciseLogs', logId);
    await deleteDoc(logRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `users/${userId}/exerciseLogs/${logId}`);
  }
};

export const subscribeToExerciseLogs = (userId: string, callback: (logs: any[]) => void) => {
  if (!isConfigured) return mockDb.subscribe(userId, 'exerciseLogs', callback);
  const q = query(collection(db, 'users', userId, 'exerciseLogs'), orderBy('timestamp', 'desc'));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => doc.data()));
  }, (err) => handleFirestoreError(err, OperationType.LIST, `users/${userId}/exerciseLogs`));
};

// InBody Report CRUD
export const saveInBodyReportDb = async (userId: string, report: any) => {
  if (!isConfigured) {
    mockDb.save(userId, 'inBodyReports', report.id, report);
    return;
  }
  try {
    const reportRef = doc(db, 'users', userId, 'inBodyReports', report.id);
    await setDoc(reportRef, { ...report, userId, updatedAt: serverTimestamp() });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${userId}/inBodyReports/${report.id}`);
  }
};

export const deleteInBodyReportDb = async (userId: string, reportId: string) => {
  if (!isConfigured) {
    mockDb.delete(userId, 'inBodyReports', reportId);
    return;
  }
  try {
    const reportRef = doc(db, 'users', userId, 'inBodyReports', reportId);
    await deleteDoc(reportRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `users/${userId}/inBodyReports/${reportId}`);
  }
};

export const subscribeToInBodyReports = (userId: string, callback: (reports: any[]) => void) => {
  if (!isConfigured) return mockDb.subscribe(userId, 'inBodyReports', callback);
  const q = query(collection(db, 'users', userId, 'inBodyReports'), orderBy('date', 'desc'));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => doc.data()));
  }, (err) => handleFirestoreError(err, OperationType.LIST, `users/${userId}/inBodyReports`));
};

