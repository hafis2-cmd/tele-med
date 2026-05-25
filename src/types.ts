export interface User {
  id: string;
  name: string;
  email: string;
  role: 'patient' | 'doctor' | 'admin';
}

export interface DiagnosisResult {
  condition: string;
  confidence: number;
  explanation: string;
  recommendations: string[];
  timestamp: string;
}

export interface Pharmacy {
  name: string;
  address: string;
  distance: string;
  rating: number;
  openNow: boolean;
  lat: number;
  lng: number;
}
