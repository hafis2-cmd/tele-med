import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { ADMIN_EMAIL } from '../constants';

interface UserProfile {
  email: string;
  role: 'Patient' | 'Doctor' | 'Admin';
  subscribed: boolean;
  newsletter?: boolean;
  createdAt: any;
  updatedAt?: any;
  name?: string;
  age?: number;
  gender?: 'Male' | 'Female' | 'Other';
  bloodGroup?: string;
  allergies?: string;
  medicalHistory?: string;
  specialty?: string;
  bio?: string;
  location?: string;
  experience?: number;
  photoURL?: string;
  image?: string;
  isOnline?: boolean;
  lastSeen?: any;
  typingTo?: string | null;
}

interface AuthContextType {
  user: any | null;
  profile: UserProfile | null;
  loading: boolean;
  login: () => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  signupWithEmail: (email: string, pass: string, name: string, role: 'Patient' | 'Doctor' | 'Admin') => Promise<void>;
  logout: () => Promise<void>;
  updateRole: (role: 'Patient' | 'Doctor' | 'Admin') => Promise<void>;
  googleToken: string | null;
  connectGoogleCalendar: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [googleToken, setGoogleToken] = useState<string | null>(null);

  useEffect(() => {
    // Check active session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const activeUser = session?.user ?? null;
      setUser(activeUser);
      
      if (activeUser) {
        await fetchProfile(activeUser.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchProfile = async (uid: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', uid)
        .single();

      if (error) {
        console.error('Error fetching user profile:', error);
        setProfile(null);
      } else if (data) {
        // Map snake_case database columns back to camelCase for full frontend UI compatibility
        setProfile({
          email: data.email,
          role: data.role,
          subscribed: data.subscribed,
          name: data.name,
          age: data.age,
          gender: data.gender,
          bloodGroup: data.blood_group,
          allergies: data.allergies,
          medicalHistory: data.medical_history,
          specialty: data.specialty,
          bio: data.bio,
          location: data.location,
          experience: data.experience,
          photoURL: data.photo_url,
          image: data.image,
          isOnline: data.is_online,
          createdAt: data.created_at
        } as UserProfile);
      }
    } catch (err) {
      console.error('Profile fetch exception:', err);
    } finally {
      setLoading(false);
    }
  };

  const login = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    if (error) throw error;
  };

  const connectGoogleCalendar = async () => {
    await login();
    return null;
  };

  const loginWithEmail = async (email: string, pass: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: pass,
    });
    if (error) throw error;
  };

  const signupWithEmail = async (email: string, pass: string, name: string, role: 'Patient' | 'Doctor' | 'Admin') => {
    setLoading(true);
    try {
      const { data: { user: signedUpUser }, error } = await supabase.auth.signUp({
        email,
        password: pass,
        options: {
          data: {
            display_name: name
          }
        }
      });

      if (error) throw error;
      if (!signedUpUser) throw new Error("Sign up completed but user profile retrieval failed.");

      // Automatically set role to Admin if email matches
      const finalRole = email === ADMIN_EMAIL ? 'Admin' : role;

      // Insert profile data to public.users table in Supabase
      const { error: insertErr } = await supabase
        .from('users')
        .insert([
          {
            id: signedUpUser.id,
            email,
            role: finalRole,
            name,
            subscribed: email === ADMIN_EMAIL ? true : false
          }
        ]);

      if (insertErr) throw insertErr;

      setProfile({
        email,
        role: finalRole as any,
        name,
        subscribed: email === ADMIN_EMAIL ? true : false,
        createdAt: new Date()
      });
    } catch (error) {
      console.error("Signup error:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setGoogleToken(null);
  };

  const updateRole = async (role: 'Patient' | 'Doctor' | 'Admin') => {
    if (!user) return;
    setLoading(true);
    
    try {
      const finalRole = user.email === ADMIN_EMAIL ? 'Admin' : role;

      const { error } = await supabase
        .from('users')
        .upsert({
          id: user.id,
          email: user.email || '',
          role: finalRole,
          name: user.user_metadata?.display_name || user.email?.split('@')[0] || '',
          subscribed: user.email === ADMIN_EMAIL ? true : false
        });

      if (error) throw error;

      setProfile({
        email: user.email || '',
        role: finalRole as any,
        subscribed: user.email === ADMIN_EMAIL ? true : false,
        name: user.user_metadata?.display_name || '',
        createdAt: new Date()
      });
    } catch (error) {
      console.error("Role update failed:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, loginWithEmail, signupWithEmail, logout, updateRole, googleToken, connectGoogleCalendar }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
