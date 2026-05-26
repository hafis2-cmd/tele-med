import React, { useEffect } from 'react';
import { supabase } from '../supabase';

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
        
        // Fetch booked appointments using Supabase
        const { data: appointments, error } = await supabase
          .from('appointments')
          .select('*')
          .eq('status', 'booked');

        if (error) {
          console.error("Error fetching appointments in ReminderService:", error);
          return;
        }

        if (!appointments) return;

        for (const app of appointments) {
          // Skip if already sent
          if (app.reminder_1h_sent) continue;

          const appointmentTime = parseAppointmentDateTime(app.appointment_date, app.appointment_time);
          const diffMs = appointmentTime.getTime() - now.getTime();
          const diffHours = diffMs / (1000 * 60 * 60);

          // If the appointment is within 1 hour (60 minutes) but not in the past
          if (diffHours > 0 && diffHours <= 1.05) {
            console.log(`Sending 1-hour automated reminders for appointment: ${app.id}`);

            // 1. Send warning/reminder to patient
            await supabase.from('notifications').insert({
              recipient_email: app.patient_email,
              message: `Reminder: Your upcoming telehealth consultation with Dr. ${app.doctor_name} starts in approximately 1 hour at ${app.appointment_time}. Please prepare and join the queue.`,
              notification_type: 'appointment_reminder',
              appointment_id: app.id,
              sent_via: ['System', 'Dashboard']
            });

            // 2. Send warning/reminder to doctor
            await supabase.from('notifications').insert({
              recipient_email: app.doctor_email,
              message: `Reminder: You have an upcoming consultation with patient ${app.patient_name || 'Patient'} starting in approximately 1 hour at ${app.appointment_time}.`,
              notification_type: 'appointment_reminder',
              appointment_id: app.id,
              sent_via: ['System', 'Dashboard']
            });

            // 3. Mark as sent on the appointment document
            await supabase
              .from('appointments')
              .update({ reminder_1h_sent: true })
              .eq('id', app.id);
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
