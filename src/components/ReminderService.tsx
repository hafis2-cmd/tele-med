import React, { useEffect } from 'react';
import { collection, query, where, getDocs, updateDoc, doc, addDoc } from 'firebase/firestore';
import { db } from '../firebase';

export function parseAppointmentDateTime(dateStr: string, timeStr: string): Date {
  try {
    // dateStr is "YYYY-MM-DD"
    // timeStr is "10:00 AM" or "09:30 PM"
    const [hoursMin, ampm] = timeStr.trim().split(' ');
    const [hoursStr, minutesStr] = hoursMin.split(':');
    let hours = parseInt(hoursStr, 10);
    const minutes = parseInt(minutesStr, 10);
    
    if (ampm === 'PM' && hours < 12) {
      hours += 12;
    } else if (ampm === 'AM' && hours === 12) {
      hours = 0;
    }
    
    // Parse the dateStr with local date components to avoid timezone offset shifts to UTC
    const [year, month, day] = dateStr.split('-').map(num => parseInt(num, 10));
    const parsedDate = new Date();
    parsedDate.setFullYear(year, month - 1, day);
    parsedDate.setHours(hours, minutes, 0, 0);
    return parsedDate;
  } catch (error) {
    console.error("Error parsing appointment date/time:", error);
    return new Date();
  }
}

export default function ReminderService() {
  useEffect(() => {
    let intervalId: any = null;

    async function checkUpcomingAppointments() {
      try {
        const now = new Date();
        
        // Fetch booked appointments
        const apptsQuery = query(
          collection(db, 'appointments'),
          where('status', '==', 'booked')
        );
        
        const snapshot = await getDocs(apptsQuery);
        const appointments = snapshot.docs.map(d => ({ id: d.id, ...d.data() as any }));

        for (const app of appointments) {
          // Skip if already sent
          if (app.reminder1hSent) continue;

          const appointmentTime = parseAppointmentDateTime(app.date, app.time);
          const diffMs = appointmentTime.getTime() - now.getTime();
          const diffHours = diffMs / (1000 * 60 * 60);

          // If the appointment is within 1 hour (60 minutes) but not in the past
          if (diffHours > 0 && diffHours <= 1.05) {
            console.log(`Sending 1-hour automated reminders for appointment: ${app.id}`);

            // 1. Send warning/reminder to patient
            await addDoc(collection(db, 'notifications'), {
              recipientEmail: app.patientEmail,
              message: `Reminder: Your upcoming telehealth consultation with Dr. ${app.doctorName} starts in approximately 1 hour at ${app.time}. Please prepare and join the queue.`,
              type: 'appointment_reminder',
              appointmentId: app.id,
              timestamp: new Date(),
              sentVia: ['System', 'Dashboard']
            });

            // 2. Send warning/reminder to doctor
            await addDoc(collection(db, 'notifications'), {
              recipientEmail: app.doctorEmail,
              message: `Reminder: You have an upcoming consultation with patient ${app.patientName} starting in approximately 1 hour at ${app.time}.`,
              type: 'appointment_reminder',
              appointmentId: app.id,
              timestamp: new Date(),
              sentVia: ['System', 'Dashboard']
            });

            // 3. Mark as sent on the appointment document
            await updateDoc(doc(db, 'appointments', app.id), {
              reminder1hSent: true
            });
          }
        }
      } catch (error) {
        console.error("Error in automated reminder service run:", error);
      }
    }

    // Run immediately on mount
    checkUpcomingAppointments();

    // Check periodically every 60 seconds
    intervalId = setInterval(checkUpcomingAppointments, 60000);

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  return null; // Side-effect only component
}
