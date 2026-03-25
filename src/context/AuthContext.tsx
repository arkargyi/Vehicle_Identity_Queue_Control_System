import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

export type User = {
  id: string;
  username: string;
  email: string;
  role: string;
};

type AuthContextType = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, username: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const userDoc = await getDoc(userDocRef);
          
          let role = 'normal_user';
          let username = firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User';
          
          // Default super admin logic
          if (firebaseUser.email === 'arkargyi.rk57@gmail.com') {
            role = 'super_admin';
          } else if (userDoc.exists()) {
            role = userDoc.data().role || 'normal_user';
            username = userDoc.data().username || username;
          }

          if (!userDoc.exists()) {
            await setDoc(userDocRef, {
              email: firebaseUser.email,
              username: username,
              role: role,
              createdAt: serverTimestamp()
            });
          }

          setUser({
            id: firebaseUser.uid,
            username: username,
            email: firebaseUser.email || '',
            role: role
          });
        } catch (error) {
          console.error("Error fetching user role:", error);
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error("Login failed:", error);
      throw error;
    }
  };

  const signup = async (email: string, password: string, username: string) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // Create user document immediately after signup
      const role = email === 'arkargyi.rk57@gmail.com' ? 'super_admin' : 'normal_user';
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        email: email,
        username: username,
        role: role,
        createdAt: serverTimestamp()
      });
      
    } catch (error) {
      console.error("Signup failed:", error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
