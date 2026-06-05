import { Injectable, Logger } from '@nestjs/common';
import { google, calendar_v3 } from 'googleapis';
import { v4 as uuid } from 'uuid';

import { MEETING_LINK_BASE_URL } from './meetings.const.js';

/**
 * Creates Google Meet links via Calendar API using OAuth2 credentials.
 * Falls back to Jitsi Meet when GOOGLE_REFRESH_TOKEN is not configured.
 */
@Injectable()
export class GoogleMeetService {
  private readonly logger = new Logger(GoogleMeetService.name);
  private calendar: calendar_v3.Calendar | null = null;

  constructor() {
    this.initClient();
  }

  private initClient(): void {
    const clientId = process.env['GOOGLE_CLIENT_ID'];
    const clientSecret = process.env['GOOGLE_CLIENT_SECRET'];
    const refreshToken = process.env['GOOGLE_REFRESH_TOKEN'];

    if (!clientId || !clientSecret || !refreshToken) {
      this.logger.warn(
        'GOOGLE_REFRESH_TOKEN not set — using Jitsi Meet fallback. ' +
        'Run: node scripts/google-get-refresh-token.mjs',
      );
      return;
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
    oauth2Client.setCredentials({ refresh_token: refreshToken });

    this.calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    this.logger.log('Google Calendar API initialized — Meet links enabled');
  }

  async createMeetLink(params: {
    meetingId: string;
    title: string;
    scheduledAt: Date;
    durationMin: number;
  }): Promise<string> {
    if (!this.calendar) {
      const roomName = `ihelp-${params.meetingId}`;
      return `${MEETING_LINK_BASE_URL}/${roomName}`;
    }

    const endTime = new Date(params.scheduledAt.getTime() + params.durationMin * 60_000);

    const event: calendar_v3.Schema$Event = {
      summary: params.title,
      start: { dateTime: params.scheduledAt.toISOString(), timeZone: 'UTC' },
      end: { dateTime: endTime.toISOString(), timeZone: 'UTC' },
      conferenceData: {
        createRequest: {
          requestId: uuid(),
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
    };

    try {
      const response = await this.calendar.events.insert({
        calendarId: 'primary',
        requestBody: event,
        conferenceDataVersion: 1,
      });

      const meetUrl = response.data.conferenceData?.entryPoints?.find(
        (ep) => ep.entryPointType === 'video',
      )?.uri;

      if (meetUrl) {
        this.logger.log(`Google Meet link created: ${meetUrl}`);
        return meetUrl;
      }

      this.logger.warn('Calendar event created but no Meet link found');
      return `${MEETING_LINK_BASE_URL}/ihelp-${params.meetingId}`;
    } catch (error) {
      this.logger.error(`Google Meet error: ${error} — using Jitsi fallback`);
      return `${MEETING_LINK_BASE_URL}/ihelp-${params.meetingId}`;
    }
  }
}
